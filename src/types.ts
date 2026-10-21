import type { IconName } from './components/Icons';

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

export type Source = 'manuel' | 'apple' | 'samsung' | 'fichier';

export interface Activity {
  id: string;
  /** date et heure de début, ISO (fuseau conservé quand la source le donne) */
  date: string;
  sport: Sport;
  /** libellé précis quand la source en donne un (« Course à pied », « Tennis »…) */
  title?: string;
  durationMin: number;
  distanceKm?: number;
  /** dénivelé positif cumulé, en mètres */
  elevationM?: number;
  calories?: number;
  avgHr?: number;
  maxHr?: number;
  /** effort ressenti, 1 (très facile) à 10 (maximal) */
  rpe?: number;
  notes?: string;
  source: Source;
  /** identifiant stable de la source, pour ne jamais importer deux fois la même séance */
  externalId?: string;
  /**
   * Tracé simplifié du parcours : « lat,lng;lat,lng;… ».
   * Une centaine de points suffit à dessiner une silhouette ; le stocker en
   * texte évite d'alourdir le journal et reste lisible sans carte ni réseau.
   */
  route?: string;
}

export interface DayLog {
  /** YYYY-MM-DD : le jour où la nuit se termine, pour le sommeil */
  date: string;
  steps?: number;
  activeCalories?: number;
  /** minutes dormies la nuit précédant ce jour */
  sleepMin?: number;
  /** fréquence cardiaque au repos, bpm */
  restingHr?: number;
  /** VO2 max estimé, mL/kg/min */
  vo2max?: number;
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
  /** séances dont un tracé a été lu (GPX, TCX) */
  routes: number;
  /** journées qui portent une nuit de sommeil */
  sleepNights: number;
}

/** Chaque discipline porte une icône dessinée, pas un symbole abstrait. */
export const SPORTS: { id: Sport; label: string; icon: IconName }[] = [
  { id: 'course', label: 'Course', icon: 'run' },
  { id: 'marche', label: 'Marche', icon: 'walk' },
  { id: 'rando', label: 'Randonnée', icon: 'hike' },
  { id: 'velo', label: 'Vélo', icon: 'bike' },
  { id: 'natation', label: 'Natation', icon: 'swim' },
  { id: 'musculation', label: 'Musculation', icon: 'strength' },
  { id: 'yoga', label: 'Yoga', icon: 'yoga' },
  { id: 'autre', label: 'Autre', icon: 'sparkle' },
];

export const SOURCE_LABELS: Record<Source, string> = {
  manuel: 'Manuel',
  apple: 'Apple Santé',
  samsung: 'Samsung Health',
  fichier: 'GPX / TCX',
};

export function sportLabel(sport: Sport): string {
  return SPORTS.find((item) => item.id === sport)?.label ?? 'Autre';
}

export function sportIcon(sport: Sport): IconName {
  return SPORTS.find((item) => item.id === sport)?.icon ?? 'sparkle';
}
