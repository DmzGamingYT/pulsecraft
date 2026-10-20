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

function listOf<T>(value: unknown, label: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`Sauvegarde incomplète : « ${label} » manquant.`);
  }
  return value as T[];
}

/**
 * Relit une sauvegarde JSON produite par « Exporter tout ». La validation reste
 * volontairement stricte sur l'enveloppe (app, profil, objectifs, listes) : une
 * restauration partielle donnerait une base incohérente, plus difficile à
 * réparer qu'un refus net.
 */
export function parseExport(text: string): ExportBundle {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Ce fichier n’est pas un JSON valide.');
  }
  if (!raw || typeof raw !== 'object') {
    throw new Error('Ce fichier ne contient pas une sauvegarde Battement.');
  }
  const data = raw as Partial<ExportBundle>;
  if (data.app !== 'Battement') {
    throw new Error('Ce fichier ne vient pas de Battement (champ « app » absent).');
  }
  if (!data.profile || typeof data.profile !== 'object') {
    throw new Error('Sauvegarde incomplète : profil manquant.');
  }
  if (!data.goals || typeof data.goals !== 'object') {
    throw new Error('Sauvegarde incomplète : objectifs manquants.');
  }
  const days =
    data.days && typeof data.days === 'object' && !Array.isArray(data.days)
      ? (data.days as Record<string, DayLog>)
      : {};
  return {
    app: 'Battement',
    version: 1,
    exportedAt:
      typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    profile: data.profile as Profile,
    goals: data.goals as Goals,
    workouts: listOf<Workout>(data.workouts, 'séances'),
    sleeps: listOf<SleepEntry>(data.sleeps, 'nuits'),
    body: listOf<BodyEntry>(data.body, 'mesures'),
    meals: Array.isArray(data.meals) ? (data.meals as Meal[]) : [],
    days,
  };
}

/** Résumé lisible d'une sauvegarde, avant de la restaurer. */
export function exportSummary(bundle: ExportBundle): string {
  const plural = (count: number, one: string, many: string) =>
    `${count} ${count > 1 ? many : one}`;
  return [
    plural(bundle.workouts.length, 'séance', 'séances'),
    plural(bundle.sleeps.length, 'nuit', 'nuits'),
    plural(bundle.body.length, 'mesure', 'mesures'),
    plural(bundle.meals.length, 'repas', 'repas'),
  ].join(' · ');
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
