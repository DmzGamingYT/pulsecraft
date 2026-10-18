/**
 * Import des CSV Samsung Health.
 *
 * Samsung exporte un CSV par type de donnée (`pedometer_step_count`,
 * `exercise`, `sleep`, `weight`…). Les noms de colonnes et les unités varient
 * selon la version de l'application : le lecteur détecte les colonnes plutôt
 * que de dépendre d'un schéma figé.
 *
 * Hypothèses documentées :
 * - `duration` d'une séance est en **secondes** (format Samsung) ;
 * - `distance` est en **mètres** ;
 * - les dates sont locales, au format `AAAA-MM-JJ HH:MM:SS.mmm`.
 */

import type { BodyEntry, DayLog, ImportPayload, SleepEntry, Workout, WorkoutType } from '../../types';
import { parseLooseDateTime, toISODate } from '../dates';

export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''));
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell.replace(/\r$/, ''));
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

function detectDelimiter(text: string): string {
  const line = text.slice(0, 4000).split('\n').find((candidate) => candidate.includes(',') || candidate.includes(';') || candidate.includes('\t'));
  if (!line) return ',';
  const counts = { ',': (line.match(/,/g) ?? []).length, ';': (line.match(/;/g) ?? []).length, '\t': (line.match(/\t/g) ?? []).length };
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ',') as string;
}

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/^com\.samsung\.[a-z._]+\./, '')
    .replace(/[^a-z0-9_]/g, '_');
}

function findColumn(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const exact = headers.findIndex((header) => header === candidate);
    if (exact !== -1) return exact;
  }
  for (const candidate of candidates) {
    const partial = headers.findIndex((header) => header.includes(candidate));
    if (partial !== -1) return partial;
  }
  return -1;
}

function num(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

const EXERCISE_TYPES: Record<string, WorkoutType> = {
  '1001': 'Marche',
  '1002': 'Course',
  '2001': 'Vélo',
  '3001': 'Natation',
  '4001': 'Musculation',
  '5001': 'Yoga',
  '6001': 'Rameur',
  '7001': 'HIIT',
};

export function guessExerciseType(raw: string | undefined): WorkoutType {
  if (!raw) return 'Autre';
  const text = raw.toLowerCase();
  if (/run|course|jog/.test(text)) return 'Course';
  if (/walk|marche/.test(text)) return 'Marche';
  if (/cycl|bike|vélo|velo/.test(text)) return 'Vélo';
  if (/swim|natation/.test(text)) return 'Natation';
  if (/strength|weight|muscu|fitness/.test(text)) return 'Musculation';
  if (/hiit|interval/.test(text)) return 'HIIT';
  if (/yoga/.test(text)) return 'Yoga';
  if (/row|rameur/.test(text)) return 'Rameur';
  return EXERCISE_TYPES[raw.trim()] ?? 'Autre';
}

interface Aggregates {
  days: Record<string, DayLog>;
  workouts: Workout[];
  sleeps: SleepEntry[];
  body: BodyEntry[];
}

export function parseSamsungHealthCsv(text: string): ImportPayload {
  const clean = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(clean);
  const rows = parseDelimited(clean, delimiter);
  const headerRow = rows[0];
  if (!headerRow || rows.length < 2) {
    throw new Error('CSV vide ou sans en-tête Samsung Health.');
  }
  const headers = headerRow.map(normalizeHeader);

  const timeColumn = findColumn(headers, [
    'start_time',
    'create_time',
    'day_time',
    'start_date',
    'date_time',
    'date',
  ]);
  const stepsColumn = findColumn(headers, ['step_count', 'steps']);
  const exerciseColumn = findColumn(headers, ['exercise_type', 'exercise_custom_type', 'exercise_name']);
  const durationColumn = findColumn(headers, ['duration', 'exercise_duration']);
  const distanceColumn = findColumn(headers, ['distance', 'total_distance']);
  const calorieColumn = findColumn(headers, ['calorie', 'calories', 'energy']);
  const sleepStartColumn = findColumn(headers, ['sleep_start_time', 'sleep_start']);
  const sleepEndColumn = findColumn(headers, ['sleep_end_time', 'sleep_end']);
  const weightColumn = findColumn(headers, ['weight']);
  const fatColumn = findColumn(headers, ['body_fat', 'fat_percentage', 'body_fat_percentage']);
  const waterColumn = findColumn(headers, ['water', 'dietary_water']);
  const heartColumn = findColumn(headers, ['heart_rate', 'mean_heart_rate', 'average_heart_rate']);
  const minHeartColumn = findColumn(headers, ['min_heart_rate']);
  const maxHeartColumn = findColumn(headers, ['max_heart_rate']);
  const hrColumns = headers.filter((header) => header === 'heart_rate');
  const hrIndex = hrColumns.length > 1 ? headers.lastIndexOf('heart_rate') : heartColumn;

  if (timeColumn === -1 && sleepStartColumn === -1) {
    throw new Error('Colonne de date introuvable : ce fichier ne ressemble pas à un export Samsung Health.');
  }

  const aggregate: Aggregates = { days: {}, workouts: [], sleeps: [], body: [] };
  let recognized = 0;

  rows.slice(1).forEach((row, index) => {
    const cell = (column: number) => (column >= 0 ? row[column]?.trim() : undefined);
    const timeValue = cell(timeColumn) ?? cell(sleepStartColumn);
    const parsed = timeValue ? parseLooseDateTime(timeValue) : null;
    if (!parsed) return;
    const date = toISODate(parsed);
    const time = `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;

    if (stepsColumn !== -1) {
      const steps = num(cell(stepsColumn));
      if (steps !== null) {
        recognized += 1;
        const day = (aggregate.days[date] ??= {});
        day.steps = (day.steps ?? 0) + steps;
      }
    }

    if (waterColumn !== -1) {
      const water = num(cell(waterColumn));
      if (water !== null) {
        recognized += 1;
        const day = (aggregate.days[date] ??= {});
        day.waterMl = (day.waterMl ?? 0) + water;
      }
    }

    if (weightColumn !== -1) {
      const weight = num(cell(weightColumn));
      if (weight !== null && weight > 20 && weight < 400) {
        recognized += 1;
        const fat = num(cell(fatColumn));
        aggregate.body.push({
          id: `samsung_b_${date}_${index}`,
          date,
          weightKg: Math.round(weight * 10) / 10,
          bodyFatPct: fat !== null ? Math.round((fat <= 1 ? fat * 100 : fat) * 10) / 10 : undefined,
          source: 'samsung',
        });
      }
    }

    if (sleepStartColumn !== -1 && sleepEndColumn !== -1) {
      const start = parseLooseDateTime(cell(sleepStartColumn) ?? '');
      const end = parseLooseDateTime(cell(sleepEndColumn) ?? '');
      if (start && end && end > start) {
        recognized += 1;
        const wakeDate = toISODate(end);
        const durationMin = Math.round((end.getTime() - start.getTime()) / 60_000);
        aggregate.sleeps.push({
          id: `samsung_s_${wakeDate}_${index}`,
          date: wakeDate,
          durationMin,
          quality: durationMin >= 480 ? 5 : durationMin >= 420 ? 4 : durationMin >= 360 ? 3 : 2,
          bedtime: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
          wake: `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
          source: 'samsung',
        });
      }
    }

    if (exerciseColumn !== -1 || (durationColumn !== -1 && distanceColumn !== -1)) {
      const rawDuration = num(cell(durationColumn));
      const durationMin = rawDuration !== null ? rawDuration / 60 : 0;
      if (durationMin > 0) {
        recognized += 1;
        const rawDistance = num(cell(distanceColumn));
        const calories = num(cell(calorieColumn));
        // Samsung fournit `heart_rate` en colonne min/moy/max selon les versions.
        const avgHr = num(cell(hrIndex));
        const maxHr = num(cell(maxHeartColumn));
        const minHr = num(cell(minHeartColumn));
        const type = guessExerciseType(cell(exerciseColumn));
        aggregate.workouts.push({
          id: `samsung_w_${date}_${time}_${index}`,
          date,
          time,
          type,
          durationMin: Math.round(durationMin * 10) / 10,
          distanceKm: rawDistance && rawDistance > 0 ? Math.round((rawDistance / 1000) * 100) / 100 : undefined,
          calories: calories && calories > 0 ? Math.round(calories) : undefined,
          avgHr: avgHr ?? maxHr ?? minHr ?? undefined,
          maxHr: maxHr ?? undefined,
          source: 'samsung',
          externalId: `samsung_${date}_${time}_${index}`,
        });
      }
    }
  });

  if (recognized === 0) {
    throw new Error(
      'Aucune donnée reconnue. Exportez les fichiers CSV depuis Samsung Health (Activité, Sommeil, Poids) et réessayez.'
    );
  }

  return {
    workouts: aggregate.workouts,
    sleeps: aggregate.sleeps,
    body: aggregate.body,
    days: aggregate.days,
  };
}
