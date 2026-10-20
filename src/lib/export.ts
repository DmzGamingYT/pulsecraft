import type { BodyEntry, DayLog, Goals, Meal, Profile, SleepEntry, Workout } from '../types';
import { todayISO } from './dates';

export interface ExportBundle {
  app: 'Battement';
  version: 1;
  exportedAt: string;
  profile: Profile;
  goals: Goals;
  workouts: Workout[];
  sleeps: SleepEntry[];
  body: BodyEntry[];
  meals: Meal[];
  days: Record<string, DayLog>;
}

export function buildExport(data: Omit<ExportBundle, 'app' | 'version' | 'exportedAt'>): ExportBundle {
  return {
    app: 'Battement',
    version: 1,
    exportedAt: new Date().toISOString(),
    ...data,
  };
}

export function downloadFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[";\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** CSV lisible par Excel / Numbers en configuration française (séparateur `;`). */
export function workoutsCsv(workouts: Workout[]): string {
  const header = [
    'date',
    'heure',
    'type',
    'duree_min',
    'distance_km',
    'fc_moyenne',
    'fc_max',
    'rpe',
    'calories',
    'denivele_m',
    'source',
    'notes',
  ];
  const rows = [...workouts]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((workout) =>
      [
        workout.date,
        workout.time ?? '',
        workout.type,
        workout.durationMin,
        workout.distanceKm ?? '',
        workout.avgHr ?? '',
        workout.maxHr ?? '',
        workout.rpe ?? '',
        workout.calories ?? '',
        workout.elevationM ?? '',
        workout.source,
        workout.notes ?? '',
      ]
        .map(csvEscape)
        .join(';')
    );
  return `\uFEFF${[header.join(';'), ...rows].join('\r\n')}`;
}

export function exportDate(): string {
  return todayISO();
}
