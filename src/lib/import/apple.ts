import type { DayLog, DraftActivity, ParsedImport, Sport } from '../../types';
import { datePart } from '../dates';

/**
 * Export « Santé » d'Apple : un `export.xml` (souvent dans `export.zip`).
 *
 * Le format n'est pas garanti par Apple et change avec les versions. On lit
 * donc les éléments utiles (`Workout`, `Record`) de façon tolérante, sans
 * construire un DOM complet : un export peut peser plusieurs centaines de Mo.
 */

const APPLE_TYPES: Record<string, { sport: Sport; title: string }> = {
  Walking: { sport: 'marche', title: 'Marche' },
  Running: { sport: 'course', title: 'Course à pied' },
  Cycling: { sport: 'velo', title: 'Vélo' },
  Swimming: { sport: 'natation', title: 'Natation' },
  Hiking: { sport: 'rando', title: 'Randonnée' },
  TraditionalStrengthTraining: { sport: 'musculation', title: 'Musculation' },
  FunctionalStrengthTraining: { sport: 'musculation', title: 'Musculation fonctionnelle' },
  CrossTraining: { sport: 'musculation', title: 'Entraînement croisé' },
  HighIntensityIntervalTraining: { sport: 'musculation', title: 'HIIT' },
  Yoga: { sport: 'yoga', title: 'Yoga' },
  Flexibility: { sport: 'yoga', title: 'Étirements' },
  Tennis: { sport: 'autre', title: 'Tennis' },
  Soccer: { sport: 'autre', title: 'Football' },
  Basketball: { sport: 'autre', title: 'Basketball' },
  Rowing: { sport: 'autre', title: 'Rameur' },
  Elliptical: { sport: 'autre', title: 'Vélo elliptique' },
  StairClimbing: { sport: 'autre', title: 'Escaliers' },
  Dance: { sport: 'autre', title: 'Danse' },
};

function decode(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

function attributes(source: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pattern = /([A-Za-z_][\w:.-]*)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const key = match[1];
    const value = match[2];
    if (key && value !== undefined) result[key] = decode(value);
  }
  return result;
}

function number(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toIso(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:\s*([+-]\d{2}:?\d{2}))?/.exec(raw);
  if (!match) return undefined;
  const day = match[1];
  const time = match[2];
  const offset = match[3] ? match[3].replace(/^([+-]\d{2})(\d{2})$/, '$1:$2') : '';
  return `${day}T${time}${offset}`;
}

function durationMinutes(value: string | undefined, unit: string | undefined): number {
  const amount = number(value);
  if (amount === undefined) return 0;
  switch ((unit ?? 'min').toLowerCase()) {
    case 's':
    case 'sec':
      return amount / 60;
    case 'h':
    case 'hr':
    case 'hour':
      return amount * 60;
    default:
      return amount;
  }
}

function kilometers(value: string | undefined, unit: string | undefined): number | undefined {
  const amount = number(value);
  if (amount === undefined) return undefined;
  switch ((unit ?? 'km').toLowerCase()) {
    case 'm':
      return amount / 1000;
    case 'mi':
      return amount * 1.609344;
    case 'ft':
      return amount * 0.0003048;
    default:
      return amount;
  }
}

function kilocalories(value: string | undefined, unit: string | undefined): number | undefined {
  const amount = number(value);
  if (amount === undefined) return undefined;
  const normalized = (unit ?? 'kcal').toLowerCase();
  if (normalized === 'kj') return amount / 4.184;
  return amount;
}

function workoutSport(type: string | undefined): { sport: Sport; title: string } {
  if (!type) return { sport: 'autre', title: 'Séance' };
  const short = type.replace(/^HKWorkoutActivityType/, '');
  return APPLE_TYPES[short] ?? { sport: 'autre', title: short.replace(/([a-z])([A-Z])/g, '$1 $2') };
}

/** Les séances d'un export Santé, avec leurs statistiques imbriquées. */
function parseWorkouts(xml: string, warnings: string[]): DraftActivity[] {
  const activities: DraftActivity[] = [];
  const pattern = /<Workout\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Workout>)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml))) {
    const attrs = attributes(match[1] ?? '');
    const inner = match[2] ?? '';
    const start = toIso(attrs.startDate);
    if (!start) {
      warnings.push('Une séance sans date de début a été ignorée.');
      continue;
    }
    const type = attrs.workoutActivityType;
    const mapped = workoutSport(type);
    const stats = [...inner.matchAll(/<WorkoutStatistics\b([^>]*?)\/?>/g)].map((entry) =>
      attributes(entry[1] ?? ''),
    );

    const distanceStat = stats
      .filter((stat) => /Distance(WalkingRunning|Cycling|Swimming|Wheelchair)/i.test(stat.type ?? ''))
      .reduce((sum, stat) => sum + (kilometers(stat.sum, stat.unit) ?? 0), 0);
    const energyStat = stats
      .filter((stat) => /ActiveEnergyBurned/i.test(stat.type ?? ''))
      .reduce(
        (sum, stat) => sum + (kilocalories(stat.sum, stat.unit) ?? 0),
        0,
      );
    const heart = stats.find((stat) => /HeartRate/i.test(stat.type ?? ''));

    const distance =
      kilometers(attrs.totalDistance, attrs.totalDistanceUnit) ??
      (distanceStat > 0 ? distanceStat : undefined);
    const calories =
      kilocalories(attrs.totalEnergyBurned, attrs.totalEnergyBurnedUnit) ??
      (energyStat > 0 ? energyStat : undefined);

    activities.push({
      date: start,
      sport: mapped.sport,
      title: mapped.title,
      durationMin: Math.round(durationMinutes(attrs.duration, attrs.durationUnit)),
      distanceKm: distance !== undefined ? Math.round(distance * 100) / 100 : undefined,
      calories: calories !== undefined ? Math.round(calories) : undefined,
      avgHr: number(heart?.average) !== undefined ? Math.round(number(heart?.average) ?? 0) : undefined,
      maxHr: number(heart?.maximum) !== undefined ? Math.round(number(heart?.maximum) ?? 0) : undefined,
      source: 'apple',
      externalId: `apple:${start}:${type ?? 'workout'}`,
    });
  }

  return activities;
}

/**
 * Pas et énergie active, agrégés par jour local puis par appareil.
 *
 * Apple Santé conserve les échantillons de chaque appareil : l'iPhone et la
 * Watch comptent souvent les mêmes pas. Additionner les sources gonflerait la
 * journée, on garde donc le maximum par jour (comme le fait l'import Samsung
 * pour deux exports successifs).
 */
function parseRecords(xml: string): { days: DayLog[]; stepSources: number } {
  const bySource = new Map<string, Map<string, { steps: number; activeCalories: number }>>();
  const stepSources = new Set<string>();
  const pattern = /<Record\b([^>]*?)\/?>/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml))) {
    const attrs = attributes(match[1] ?? '');
    const type = attrs.type ?? '';
    const isSteps = type === 'HKQuantityTypeIdentifierStepCount';
    const isEnergy = type === 'HKQuantityTypeIdentifierActiveEnergyBurned';
    if (!isSteps && !isEnergy) continue;

    const start = toIso(attrs.startDate);
    const amount = number(attrs.value);
    if (!start || amount === undefined) continue;

    const day = datePart(start);
    const source = attrs.sourceName || attrs.sourceRevision || 'Apple Santé';
    const sourceDays =
      bySource.get(source) ?? new Map<string, { steps: number; activeCalories: number }>();
    const totals = sourceDays.get(day) ?? { steps: 0, activeCalories: 0 };

    if (isSteps) {
      totals.steps += Math.max(0, Math.round(amount));
      stepSources.add(source);
    }
    if (isEnergy) {
      totals.activeCalories += Math.max(0, Math.round(kilocalories(String(amount), attrs.unit) ?? 0));
    }
    sourceDays.set(day, totals);
    bySource.set(source, sourceDays);
  }

  const byDate = new Map<string, DayLog>();
  for (const sourceDays of bySource.values()) {
    for (const [day, totals] of sourceDays) {
      const log = byDate.get(day) ?? { date: day, steps: 0, activeCalories: 0 };
      log.steps = Math.max(log.steps ?? 0, totals.steps) || undefined;
      log.activeCalories = Math.max(log.activeCalories ?? 0, totals.activeCalories) || undefined;
      byDate.set(day, log);
    }
  }

  return {
    days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    stepSources: stepSources.size,
  };
}

export function parseAppleHealth(xml: string, fileName = 'export.xml'): ParsedImport {
  const warnings: string[] = [];
  if (!/<HealthData\b/.test(xml) && !/<Workout\b/.test(xml) && !/<Record\b/.test(xml)) {
    return {
      source: 'apple',
      fileName,
      activities: [],
      days: [],
      warnings: ['Ce fichier ne ressemble pas à un export Santé d’Apple.'],
    };
  }

  const activities = parseWorkouts(xml, warnings);
  const records = parseRecords(xml);

  if (activities.length === 0 && records.days.length === 0) {
    warnings.push('Aucune séance ni donnée de pas trouvée dans cet export.');
  }
  if (records.stepSources > 1) {
    warnings.push(
      'Plusieurs appareils ont compté des pas les mêmes jours : le maximum par jour a été gardé pour éviter de doubler.',
    );
  }

  return { source: 'apple', fileName, activities, days: records.days, warnings };
}
