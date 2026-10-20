/** Modèle de données de Battement. Tout est local : aucune de ces structures
 *  n'est envoyée à un serveur, sauf les agrégats choisis pour le coach IA. */

export type ISODate = string;

export const WORKOUT_TYPES = [
  'Course',
  'Marche',
  'Vélo',
  'Natation',
  'Musculation',
  'HIIT',
  'Yoga',
  'Rameur',
  'Autre',
] as const;

export type WorkoutType = (typeof WORKOUT_TYPES)[number];

export interface WorkoutMeta {
  label: string;
  /** MET utilisé pour estimer la dépense quand la montre ne la fournit pas. */
  met: number;
  icon: 'run' | 'walk' | 'bike' | 'swim' | 'strength' | 'hiit' | 'yoga' | 'row' | 'activity';
}

export const WORKOUT_META: Record<WorkoutType, WorkoutMeta> = {
  Course: { label: 'Course', met: 9.8, icon: 'run' },
  Marche: { label: 'Marche', met: 4.3, icon: 'walk' },
  Vélo: { label: 'Vélo', met: 7.5, icon: 'bike' },
  Natation: { label: 'Natation', met: 8, icon: 'swim' },
  Musculation: { label: 'Musculation', met: 5, icon: 'strength' },
  HIIT: { label: 'HIIT', met: 8, icon: 'hiit' },
  Yoga: { label: 'Yoga', met: 3, icon: 'yoga' },
  Rameur: { label: 'Rameur', met: 7, icon: 'row' },
  Autre: { label: 'Autre', met: 5.5, icon: 'activity' },
};

export type Source = 'manuel' | 'apple' | 'samsung' | 'gpx' | 'demo';

export interface Workout {
  id: string;
  date: ISODate;
  time?: string;
  type: WorkoutType;
  durationMin: number;
  distanceKm?: number;
  avgHr?: number;
  maxHr?: number;
  elevationM?: number;
  rpe?: number;
  calories?: number;
  notes?: string;
  source: Source;
  externalId?: string;
}

export interface SleepEntry {
  id: string;
  /** Jour du réveil : la nuit du 2 au 3 mai est datée du 3 mai. */
  date: ISODate;
  durationMin: number;
  deepMin?: number;
  remMin?: number;
  quality: number;
  bedtime?: string;
  wake?: string;
  source: Source;
}

export interface BodyEntry {
  id: string;
  date: ISODate;
  weightKg?: number;
  bodyFatPct?: number;
  muscleKg?: number;
  waistCm?: number;
  source: Source;
}

export interface Meal {
  id: string;
  date: ISODate;
  time?: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DayLog {
  steps?: number;
  activeKcal?: number;
  restingHr?: number;
  waterMl?: number;
}

export interface Goals {
  moveKcal: number;
  exerciseMin: number;
  waterMl: number;
  sleepHours: number;
  dailyKcal: number;
  weightKg?: number;
}

export type Sex = 'femme' | 'homme' | 'autre';

export interface Profile {
  name: string;
  sex: Sex;
  birthYear?: number;
  heightCm?: number;
  restingHr: number;
  weightKg: number;
  /** FC max mesurée si connue ; sinon estimée par l'âge. */
  maxHr?: number;
}

export type Theme = 'system' | 'light' | 'dark';

/** Où partent les agrégats du coach, et avec quelle clé. */
export type AiProvider = 'pollinations' | 'openai' | 'local';

export interface AiConfig {
  provider: AiProvider;
  /** Stockée uniquement dans IndexedDB, jamais envoyée ailleurs qu'au fournisseur. */
  apiKey: string;
  /** URL compatible OpenAI (OpenAI, OpenRouter, Groq, Ollama, LM Studio…). */
  baseUrl: string;
  model: string;
}

export interface Settings {
  theme: Theme;
  aiEnabled: boolean;
  ai: AiConfig;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  at: string;
  /** true quand la réponse vient du raisonnement local, sans réseau. */
  local?: boolean;
}

export interface CoachPlan {
  generatedAt: string;
  content: string;
  local?: boolean;
}

export interface ImportPayload {
  workouts?: Workout[];
  sleeps?: SleepEntry[];
  body?: BodyEntry[];
  days?: Record<string, DayLog>;
}

export const DEFAULT_PROFILE: Profile = {
  name: 'Vous',
  sex: 'autre',
  restingHr: 58,
  weightKg: 72,
  heightCm: 175,
};

export const DEFAULT_GOALS: Goals = {
  moveKcal: 600,
  exerciseMin: 30,
  waterMl: 2000,
  sleepHours: 8,
  dailyKcal: 2200,
};

export const DEFAULT_AI: AiConfig = {
  provider: 'pollinations',
  apiKey: '',
  baseUrl: '',
  model: '',
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  aiEnabled: true,
  ai: DEFAULT_AI,
};

/* ------------------------------------------------------- plan long terme */

export type GoalKind = 'endurance' | 'force' | 'perte' | 'sante' | 'performance';
export type Experience = 'debutant' | 'intermediaire' | 'avance';
export type Equipment = 'aucun' | 'maison' | 'salle';
export type PlanIntensity = 'faible' | 'modérée' | 'soutenue';

/** Ce que l'utilisateur déclare au premier démarrage. Aucun champ libre n'est
 *  transmis à l'IA : seule une version agrégée sert à rédiger le plan. */
export interface PlanIntake {
  goal: GoalKind;
  experience: Experience;
  daysPerWeek: number;
  sessionMin: number;
  equipment: Equipment;
  sleepHours: number;
  targetWeightKg?: number;
  targetDate?: ISODate;
  /** Texte libre (douleur, contrainte) : reste sur l'appareil. */
  constraints?: string;
  createdAt: string;
}

export type PlanType = WorkoutType | 'Repos' | 'Mobilité';

/**
 * Un mouvement prescrit dans une séance de renforcement. Les séries et les
 * répétitions sont calculées selon le niveau et la semaine : c’est ce qui rend
 * le plan personnel, sans texte libre ni promesse de charge inventée.
 */
export interface PlanExercise {
  name: string;
  sets: number;
  /** Répétitions, durée ou répétitions par côté (« 8–12 », « 30 s », « 8 / jambe »). */
  reps: string;
  restSec: number;
  /** Consigne courte : amplitude, variante plus facile, matériel. */
  note?: string;
}

export interface PlanSession {
  id: string;
  /** 0 = lundi … 6 = dimanche */
  day: number;
  type: PlanType;
  title: string;
  minutes: number;
  intensity: PlanIntensity;
  detail: string;
  /** Mouvements détaillés des séances de renforcement (poids du corps ou salle). */
  exercises?: PlanExercise[];
  /** Date de réalisation, si la séance a été cochée. */
  doneAt?: string;
}

export interface PlanWeek {
  index: number;
  /** Lundi de la semaine, au format ISO. */
  startDate: ISODate;
  focus: string;
  targetMinutes: number;
  deload: boolean;
  sessions: PlanSession[];
}

export interface PlanPhase {
  id: string;
  name: string;
  fromWeek: number;
  toWeek: number;
  focus: string;
  objective: string;
}

export interface PlanMilestone {
  id: string;
  week: number;
  label: string;
  detail: string;
}

export interface TrainingPlan {
  createdAt: string;
  horizonWeeks: number;
  goal: GoalKind;
  intake: PlanIntake;
  phases: PlanPhase[];
  weeks: PlanWeek[];
  milestones: PlanMilestone[];
  /** Commentaire du coach sur le plan (IA ou rédaction locale). */
  note: string;
  noteSource: 'ai' | 'local';
}

/** Profil tel que collecté par l'assistant de démarrage. */
export interface IntakeProfile {
  name: string;
  sex: Sex;
  birthYear?: number;
  heightCm?: number;
  weightKg: number;
  restingHr: number;
}

/** Palette des activités, utilisée par les graphiques et les pastilles. */
export const WORKOUT_COLORS: Record<WorkoutType, string> = {
  Course: '#ff4d6d',
  Marche: '#c9ff3d',
  Vélo: '#38d9ff',
  Natation: '#4d8dff',
  Musculation: '#ffb84d',
  HIIT: '#ff7a45',
  Yoga: '#b48cff',
  Rameur: '#3fe0bd',
  Autre: '#96a2a0',
};

export const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
