/**
 * Import de l'export Apple Health (`export.xml`).
 *
 * Le fichier fait souvent plusieurs centaines de mégaoctets : il est lu en
 * flux, ligne de balise par ligne de balise, et **agrégé à la volée**. Aucun
 * XML complet n'est conservé en mémoire, et seules les données utiles à
 * Battement sont gardées (pas, énergie, FC de repos, eau, sommeil, poids,
 * masse grasse, séances).
 *
 * Limites assumées : les exports `.zip` doivent être décompressés, les données
 * de fréquence cardiaque seconde par seconde ne sont pas importées, et les
 * métadonnées de sommeil absentes (stades) restent vides.
 */

import type { BodyEntry, DayLog, ImportPayload, SleepEntry, Workout, WorkoutType } from '../../types';
import { toISODate } from '../dates';

interface Attrs {
  [key: string]: string;
}

function attrsOf(raw: string): Attrs {
  const attrs: Attrs = {};
  for (const match of raw.matchAll(/([A-Za-z_][\w.-]*)="([^"]*)"/g)) {
    const key = match[1];
    const value = match[2];
    if (key && value !== undefined) attrs[key] = value;
  }
  return attrs;
}

function appleDate(value: string | undefined): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? 0)
  );
}

function dateKey(date: Date): string {
  return toISODate(date);
}

function timeKey(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function durationMinutes(value: string | undefined, unit: string | undefined): number {
  const amount = toNumber(value);
  if (amount === null) return 0;
  switch ((unit ?? 'min').toLowerCase()) {
    case 's':
    case 'sec':
    case 'second':
    case 'seconds':
      return amount / 60;
    case 'h':
    case 'hr':
    case 'hour':
    case 'hours':
      return amount * 60;
    default:
      return amount;
  }
}

function distanceKm(value: string | undefined, unit: string | undefined): number | undefined {
  const amount = toNumber(value);
  if (amount === null || amount <= 0) return undefined;
  switch ((unit ?? 'km').toLowerCase()) {
    case 'm':
    case 'meter':
    case 'meters':
      return amount / 1000;
    case 'mi':
    case 'mile':
    case 'miles':
      return amount * 1.609344;
    case 'ft':
    case 'feet':
      return amount * 0.0003048;
    default:
      return amount;
  }
}

function energyKcal(value: string | undefined, unit: string | undefined): number | undefined {
  const amount = toNumber(value);
  if (amount === null || amount <= 0) return undefined;
  if ((unit ?? 'kcal').toLowerCase().includes('kj')) return amount / 4.184;
  return amount;
}

const WORKOUT_MAP: Record<string, WorkoutType> = {
  HKWorkoutActivityTypeRunning: 'Course',
  HKWorkoutActivityTypeWalking: 'Marche',
  HKWorkoutActivityTypeCycling: 'Vélo',
  HKWorkoutActivityTypeSwimming: 'Natation',
  HKWorkoutActivityTypeTraditionalStrengthTraining: 'Musculation',
  HKWorkoutActivityTypeFunctionalStrengthTraining: 'Musculation',
  HKWorkoutActivityTypeHighIntensityIntervalTraining: 'HIIT',
  HKWorkoutActivityTypeYoga: 'Yoga',
  HKWorkoutActivityTypeRowing: 'Rameur',
  HKWorkoutActivityTypeHiking: 'Marche',
  HKWorkoutActivityTypeElliptical: 'Autre',
};

interface SleepAggregate {
  durationMin: number;
  deepMin: number;
  remMin: number;
  start?: Date;
  end?: Date;
}

interface BodyAggregate {
  date: string;
  weightKg?: number;
  bodyFatPct?: number;
}

export class AppleHealthParser {
  private buffer = '';
  private days: Record<string, DayLog> = {};
  private sleeps = new Map<string, SleepAggregate>();
  private body = new Map<string, BodyAggregate>();
  private workouts = new Map<string, Workout>();
  private rhr = new Map<string, { sum: number; count: number }>();

  feed(chunk: string): void {
    this.buffer += chunk;
    const cut = this.buffer.lastIndexOf('>');
    if (cut === -1) return;
    const complete = this.buffer.slice(0, cut + 1);
    this.buffer = this.buffer.slice(cut + 1);
    this.scan(complete);
  }

  finish(): ImportPayload {
    if (this.buffer.trim()) this.scan(this.buffer);
    this.buffer = '';

    for (const [date, entry] of this.rhr) {
      const day = this.days[date] ?? {};
      day.restingHr = Math.round(entry.sum / entry.count);
      this.days[date] = day;
    }

    const sleeps: SleepEntry[] = [...this.sleeps.entries()].map(([date, aggregate]) => {
      const duration = Math.round(aggregate.durationMin);
      const quality =
        duration >= 8 * 60 ? 5 : duration >= 7 * 60 ? 4 : duration >= 6 * 60 ? 3 : duration >= 4 * 60 ? 2 : 1;
      return {
        id: `apple_s_${date}`,
        date,
        durationMin: duration,
        deepMin: aggregate.deepMin > 0 ? Math.round(aggregate.deepMin) : undefined,
        remMin: aggregate.remMin > 0 ? Math.round(aggregate.remMin) : undefined,
        quality,
        bedtime: aggregate.start ? timeKey(aggregate.start) : undefined,
        wake: aggregate.end ? timeKey(aggregate.end) : undefined,
        source: 'apple',
      };
    });

    const body: BodyEntry[] = [...this.body.values()]
      .filter((entry) => entry.weightKg || entry.bodyFatPct)
      .map((entry, index) => ({
        id: `apple_b_${entry.date}_${index}`,
        date: entry.date,
        weightKg: entry.weightKg,
        bodyFatPct: entry.bodyFatPct,
        source: 'apple',
      }));

    return {
      workouts: [...this.workouts.values()],
      sleeps: sleeps.sort((a, b) => (a.date < b.date ? 1 : -1)),
      body: body.sort((a, b) => (a.date < b.date ? 1 : -1)),
      days: this.days,
    };
  }

  private day(date: string): DayLog {
    this.days[date] ??= {};
    return this.days[date];
  }

  private scan(text: string): void {
    for (const match of text.matchAll(/<(Record|Workout)\s([^>]*?)\/?>/g)) {
      const tag = match[1];
      const raw = match[2];
      if (!tag || !raw) continue;
      const attrs = attrsOf(raw);
      if (tag === 'Workout') {
        this.scanWorkout(attrs);
      } else {
        this.scanRecord(attrs);
      }
    }
  }

  private scanRecord(attrs: Attrs): void {
    const type = attrs.type ?? '';
    const end = appleDate(attrs.endDate);
    const start = appleDate(attrs.startDate) ?? end;
    const date = end ? dateKey(end) : start ? dateKey(start) : null;
    const value = toNumber(attrs.value);

    if (date && value !== null) {
      switch (type) {
        case 'HKQuantityTypeIdentifierStepCount':
          this.day(date).steps = (this.day(date).steps ?? 0) + value;
          break;
        case 'HKQuantityTypeIdentifierActiveEnergyBurned': {
          const kcal = energyKcal(attrs.value, attrs.unit);
          if (kcal) this.day(date).activeKcal = (this.day(date).activeKcal ?? 0) + kcal;
          break;
        }
        case 'HKQuantityTypeIdentifierRestingHeartRate': {
          const current = this.rhr.get(date) ?? { sum: 0, count: 0 };
          current.sum += value;
          current.count += 1;
          this.rhr.set(date, current);
          break;
        }
        case 'HKQuantityTypeIdentifierDietaryWater': {
          const liters = (attrs.unit ?? '').toLowerCase().startsWith('l');
          this.day(date).waterMl = (this.day(date).waterMl ?? 0) + (liters ? value * 1000 : value);
          break;
        }
        case 'HKQuantityTypeIdentifierBodyMass': {
          const unit = (attrs.unit ?? 'kg').toLowerCase();
          const kg = unit === 'lb' ? value * 0.45359237 : value;
          const entry = this.body.get(date) ?? { date };
          entry.weightKg = Math.round(kg * 10) / 10;
          this.body.set(date, entry);
          break;
        }
        case 'HKQuantityTypeIdentifierBodyFatPercentage': {
          const pct = value <= 1 ? value * 100 : value;
          const entry = this.body.get(date) ?? { date };
          entry.bodyFatPct = Math.round(pct * 10) / 10;
          this.body.set(date, entry);
          break;
        }
        default:
          break;
      }
    }

    if (type === 'HKCategoryTypeIdentifierSleepAnalysis' && start && end) {
      const category = attrs.value ?? '';
      if (!/asleep/i.test(category)) return;
      const wakeDate = dateKey(end);
      const duration = Math.max(0, (end.getTime() - start.getTime()) / 60_000);
      const aggregate = this.sleeps.get(wakeDate) ?? {
        durationMin: 0,
        deepMin: 0,
        remMin: 0,
      };
      aggregate.durationMin += duration;
      if (/deep/i.test(category)) aggregate.deepMin += duration;
      if (/rem/i.test(category)) aggregate.remMin += duration;
      if (!aggregate.start || start < aggregate.start) aggregate.start = start;
      if (!aggregate.end || end > aggregate.end) aggregate.end = end;
      this.sleeps.set(wakeDate, aggregate);
    }
  }

  private scanWorkout(attrs: Attrs): void {
    const start = appleDate(attrs.startDate);
    const end = appleDate(attrs.endDate);
    if (!start) return;
    const type = WORKOUT_MAP[attrs.workoutActivityType ?? ''] ?? 'Autre';
    const duration =
      durationMinutes(attrs.duration, attrs.durationUnit) ||
      (end ? (end.getTime() - start.getTime()) / 60_000 : 0);
    if (duration <= 0) return;

    const distance = distanceKm(attrs.totalDistance, attrs.totalDistanceUnit);
    const energy = energyKcal(attrs.totalEnergyBurned, attrs.totalEnergyBurnedUnit);
    const date = dateKey(start);
    const id = `apple_w_${start.toISOString()}_${type}`;

    this.workouts.set(id, {
      id,
      date,
      time: timeKey(start),
      type,
      durationMin: Math.round(duration * 10) / 10,
      distanceKm: distance ? Math.round(distance * 100) / 100 : undefined,
      calories: energy ? Math.round(energy) : undefined,
      source: 'apple',
      externalId: id,
    });
  }
}

export async function parseAppleHealthFile(file: File): Promise<ImportPayload> {
  const parser = new AppleHealthParser();
  if (typeof file.stream === 'function' && typeof TextDecoder !== 'undefined') {
    const reader = file.stream().getReader();
    const decoder = new TextDecoder('utf-8');
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) parser.feed(decoder.decode(value, { stream: true }));
      }
      parser.feed(decoder.decode());
    } finally {
      reader.releaseLock();
    }
  } else {
    parser.feed(await file.text());
  }
  return parser.finish();
}
