/** Les données de Battement : séances, journées et réglages. */

export type Sport =
  | 'course'
  | 'marche'
  | 'rando'
  | 'velo'
  | 'natation'
  | 'musculation'
  | 'yoga'
  | 'autre';

export type Source = 'manuel' | 'apple' | 'samsung';

export interface Activity {
  id: string;
  /** date et heure de début, ISO (fuseau conservé quand la source le donne) */
  date: string;
  sport: Sport;
  /** libellé précis quand la source en donne un (« Course à pied », « Tennis »…) */
  title?: string;
  durationMin: number;
  distanceKm?: number;
  calories?: number;
  avgHr?: number;
  maxHr?: number;
  notes?: string;
  source: Source;
  /** identifiant stable de la source, pour ne jamais importer deux fois la même séance */
  externalId?: string;
}

export interface DayLog {
  /** YYYY-MM-DD */
  date: string;
  steps?: number;
  activeCalories?: number;
}

/** Une séance prête à entrer dans le journal (sans id local). */
export type DraftActivity = Omit<Activity, 'id'>;

export interface ParsedImport {
  source: Source;
  fileName: string;
  activities: DraftActivity[];
  days: DayLog[];
  warnings: string[];
}

export interface ImportSummary {
  activities: number;
  days: number;
  skipped: number;
  warnings: string[];
}

export const SPORTS: { id: Sport; label: string; glyph: string }[] = [
  { id: 'course', label: 'Course', glyph: '↗' },
  { id: 'marche', label: 'Marche', glyph: '→' },
  { id: 'rando', label: 'Randonnée', glyph: '⌁' },
  { id: 'velo', label: 'Vélo', glyph: '◒' },
  { id: 'natation', label: 'Natation', glyph: '≈' },
  { id: 'musculation', label: 'Musculation', glyph: '▮' },
  { id: 'yoga', label: 'Yoga', glyph: '☾' },
  { id: 'autre', label: 'Autre', glyph: '✦' },
];

export const SOURCE_LABELS: Record<Source, string> = {
  manuel: 'Manuel',
  apple: 'Apple Santé',
  samsung: 'Samsung Health',
};

export function sportLabel(sport: Sport): string {
  return SPORTS.find((item) => item.id === sport)?.label ?? 'Autre';
}

export function sportGlyph(sport: Sport): string {
  return SPORTS.find((item) => item.id === sport)?.glyph ?? '✦';
}
