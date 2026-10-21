/**
 * Sauvegarde et restauration du journal.
 *
 * L'export JSON existait déjà ; il n'était pas réimportable. C'est pourtant le
 * seul filet de sécurité d'un journal qui vit dans le navigateur : il doit
 * pouvoir revenir, y compris dans une autre version de l'app.
 *
 * Le format reste volontairement plat et lisible : `activities`, `days`,
 * `settings`, et le programme s'il existe. La lecture est tolérante — une
 * sauvegarde ancienne, sans sommeil ni RPE, reste valable.
 */

import type { Activity, DayLog, Source, Sport } from '../types';
import type { Program } from './coach';

export interface BackupPayload {
  app: 'battement';
  version: number;
  exportedAt: string;
  activities: Activity[];
  days: DayLog[];
  program?: unknown;
  programDone?: string[];
  settings?: unknown;
}

export interface ParsedBackup {
  activities: Activity[];
  days: DayLog[];
  program: Program | null;
  programDone: string[];
  settings: Record<string, unknown> | null;
  exportedAt: string | null;
}

export function makeBackup(input: {
  activities: Activity[];
  days: DayLog[];
  program?: unknown;
  programDone?: string[];
  settings?: unknown;
  now?: Date;
}): BackupPayload {
  return {
    app: 'battement',
    version: 2,
    exportedAt: (input.now ?? new Date()).toISOString(),
    activities: input.activities,
    days: input.days,
    program: input.program ?? null,
    programDone: input.programDone ?? [],
    settings: input.settings,
  };
}

const SPORTS: Sport[] = [
  'course',
  'marche',
  'rando',
  'velo',
  'natation',
  'musculation',
  'yoga',
  'autre',
];

const SOURCES: Source[] = ['manuel', 'apple', 'samsung', 'fichier'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Une séance lisible, ou `null` si la ligne n'a pas de quoi exister. */
function readActivity(raw: unknown): Activity | null {
  if (!isRecord(raw)) return null;
  const date = text(raw.date);
  const durationMin = optionalNumber(raw.durationMin);
  if (!/^\d{4}-\d{2}-\d{2}/.test(date) || durationMin === undefined || durationMin <= 0) return null;
  const sport = SPORTS.includes(raw.sport as Sport) ? (raw.sport as Sport) : 'autre';
  const source = SOURCES.includes(raw.source as Source) ? (raw.source as Source) : 'manuel';
  return {
    id: text(raw.id) || `b_${date}_${Math.random().toString(36).slice(2, 8)}`,
    date,
    sport,
    title: typeof raw.title === 'string' ? raw.title : undefined,
    durationMin,
    distanceKm: optionalNumber(raw.distanceKm),
    elevationM: optionalNumber(raw.elevationM),
    calories: optionalNumber(raw.calories),
    avgHr: optionalNumber(raw.avgHr),
    maxHr: optionalNumber(raw.maxHr),
    rpe: optionalNumber(raw.rpe),
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    source,
    externalId: typeof raw.externalId === 'string' ? raw.externalId : undefined,
    route: typeof raw.route === 'string' ? raw.route : undefined,
  };
}

/**
 * Un programme n'est repris que s'il a la forme attendue : un plan incomplet
 * ferait planter le calcul du coach, et personne ne veut ça au chargement.
 */
export function readProgram(raw: unknown): Program | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.createdAt !== 'string') return null;
  if (!isRecord(raw.answers) || !Array.isArray(raw.answers.days)) return null;
  if (!isRecord(raw.profile)) return null;
  if (!Array.isArray(raw.weeks) || raw.weeks.length === 0) return null;
  if (!Array.isArray(raw.checkIns)) return null;
  const weeksOk = raw.weeks.every(
    (week) => isRecord(week) && Array.isArray(week.sessions) && typeof week.start === 'string',
  );
  return weeksOk ? (raw as unknown as Program) : null;
}

function readDay(raw: unknown): DayLog | null {
  if (!isRecord(raw)) return null;
  const date = text(raw.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    date,
    steps: optionalNumber(raw.steps),
    activeCalories: optionalNumber(raw.activeCalories),
    sleepMin: optionalNumber(raw.sleepMin),
    restingHr: optionalNumber(raw.restingHr),
    vo2max: optionalNumber(raw.vo2max),
  };
}

/**
 * Lit une sauvegarde. Lève une erreur lisible quand le fichier n'en est pas
 * une : mieux vaut le dire que remplacer un journal par du vide.
 */
export function parseBackup(input: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    throw new Error('Ce fichier n’est pas du JSON.');
  }
  if (!isRecord(raw)) throw new Error('Sauvegarde illisible.');
  if (raw.app !== undefined && raw.app !== 'battement') {
    throw new Error('Ce fichier ne vient pas de Battement.');
  }
  if (!Array.isArray(raw.activities)) {
    throw new Error('Cette sauvegarde ne contient pas de séances.');
  }

  const activities = raw.activities
    .map(readActivity)
    .filter((activity): activity is Activity => activity !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
  const days = Array.isArray(raw.days)
    ? raw.days.map(readDay).filter((day): day is DayLog => day !== null)
    : [];

  return {
    activities,
    days,
    program: readProgram(raw.program),
    programDone: Array.isArray(raw.programDone)
      ? raw.programDone.filter((value): value is string => typeof value === 'string')
      : [],
    settings: isRecord(raw.settings) ? raw.settings : null,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : null,
  };
}
