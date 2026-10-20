/**
 * Le programme du mois : un bloc de quatre semaines, toujours disponible.
 *
 * Il ne part pas du bilan générique : il est écrit pour une semaine précise —
 * atelier informatique de 14 h à 18 h du lundi au vendredi, études autour — et
 * pour un matériel précis : poids du corps et haltères légers. Les séances se
 * placent donc soit avant l'atelier (7 h 30), soit après (19 h), soit le
 * dimanche matin, et aucune ne mord sur les heures de travail.
 *
 * La progression ne promet pas de charge : avec des haltères légers, on avance
 * par les répétitions, le tempo, les variantes unilatérales et la proximité de
 * l'échec technique. La quatrième semaine est allégée, comme dans le plan long
 * terme, pour pouvoir enchaîner les mois.
 */

import type {
  ISODate,
  PlanExercise,
  PlanIntake,
  PlanMilestone,
  PlanPhase,
  PlanSession,
  PlanWeek,
  TrainingPlan,
} from '../types';
import { addDays, parseISODate, startOfWeek, todayISO } from './dates';

export const MONTH_PRESET = 'monthly-muscle' as const;
export const MONTH_WEEKS = 4;

/* ------------------------------------------------------------ mouvements */

interface Variant {
  name: string;
  reps: string;
}

interface Movement {
  sets: number;
  restSec: number;
  note: string;
  /** Faux pour le gainage : un tempo de descente n'y a pas de sens. */
  tempo?: false;
  /** Un palier par mois : le mois 2 durcit la variante, le mois 3 encore. */
  variants: [Variant, Variant, Variant];
}

const UPPER_PUSH: Movement[] = [
  {
    sets: 3,
    restSec: 75,
    note: 'Coudes à 45°, corps gainé, poitrine qui descend vers le sol.',
    variants: [
      { name: 'Pompes inclinées sur table', reps: '10–15' },
      { name: 'Pompes', reps: '10–15' },
      { name: 'Pompes déclinées', reps: '6–12' },
    ],
  },
  {
    sets: 3,
    restSec: 60,
    note: 'Dos plat, appui sur une chaise, coude le long du corps.',
    variants: [
      { name: 'Rowing haltère un bras', reps: '10–12 / bras' },
      { name: 'Rowing haltère, pause 1 s', reps: '10–12 / bras' },
      { name: 'Rowing inversé sous table', reps: '8–12' },
    ],
  },
  {
    sets: 3,
    restSec: 60,
    note: 'Haltères posés au sol en bas, omoplates serrées.',
    variants: [
      { name: 'Développé haltères au sol', reps: '12–15' },
      { name: 'Développé haltères, pause en bas', reps: '10–12' },
      { name: 'Développé haltères + pompes serrées', reps: '10–12' },
    ],
  },
  {
    sets: 2,
    restSec: 45,
    note: 'Haltères légers, coudes légèrement fléchis, sans élan.',
    variants: [
      { name: 'Élévations latérales', reps: '15–20' },
      { name: 'Élévations latérales, pause en haut', reps: '12–15' },
      { name: 'Élévations latérales + oiseau', reps: '12–15' },
    ],
  },
  {
    sets: 3,
    restSec: 45,
    note: 'Bas du dos plaqué au sol, respiration continue.',
    tempo: false,
    variants: [
      { name: 'Planche', reps: '30–45 s' },
      { name: 'Planche + reach', reps: '8 / côté' },
      { name: 'Hollow hold', reps: '20–40 s' },
    ],
  },
];

const LOWER: Movement[] = [
  {
    sets: 4,
    restSec: 90,
    note: 'Haltère contre la poitrine, talons au sol, descente contrôlée.',
    variants: [
      { name: 'Squat gobelet haltère', reps: '12–15' },
      { name: 'Squat gobelet, pause 2 s en bas', reps: '10–12' },
      { name: 'Squat sauté', reps: '8–12' },
    ],
  },
  {
    sets: 3,
    restSec: 75,
    note: 'Genou dans l’axe du pied, buste droit, sans rebond.',
    variants: [
      { name: 'Fente arrière haltères', reps: '10–12 / jambe' },
      { name: 'Fente marchée haltères', reps: '10–12 / jambe' },
      { name: 'Fente bulgare sur chaise', reps: '8–10 / jambe' },
    ],
  },
  {
    sets: 3,
    restSec: 60,
    note: 'Poussez dans les talons, fessiers serrés en haut.',
    variants: [
      { name: 'Pont fessier haltère', reps: '15–20' },
      { name: 'Pont fessier une jambe', reps: '10–12 / jambe' },
      { name: 'Soulevé de terre haltères, jambes tendues', reps: '10–12' },
    ],
  },
  {
    sets: 3,
    restSec: 45,
    note: 'Montée lente sur la pointe, cheville stable.',
    variants: [
      { name: 'Mollets debout haltères', reps: '15–20' },
      { name: 'Mollets une jambe', reps: '12–15 / jambe' },
      { name: 'Mollets sautés', reps: '15–20' },
    ],
  },
  {
    sets: 3,
    restSec: 45,
    note: 'Mouvement lent, lombaires au sol, souffle régulier.',
    tempo: false,
    variants: [
      { name: 'Dead bug', reps: '8–10 / côté' },
      { name: 'Planche latérale', reps: '20–30 s / côté' },
      { name: 'Relevé de jambes au sol', reps: '10–15' },
    ],
  },
];

const UPPER_PULL: Movement[] = [
  {
    sets: 3,
    restSec: 75,
    note: 'Mains au bord du banc, coudes vers l’arrière, descente contrôlée.',
    variants: [
      { name: 'Dips sur banc, pieds au sol', reps: '8–12' },
      { name: 'Dips entre deux chaises', reps: '6–10' },
      { name: 'Dips entre chaises, pause en bas', reps: '6–10' },
    ],
  },
  {
    sets: 3,
    restSec: 75,
    note: 'Table solide, corps aligné, omoplates serrées.',
    variants: [
      { name: 'Rowing inversé sous table', reps: '8–12' },
      { name: 'Rowing inversé jambes tendues', reps: '8–12' },
      { name: 'Rowing inversé, pieds surélevés', reps: '6–10' },
    ],
  },
  {
    sets: 3,
    restSec: 60,
    note: 'Gainage serré, sans cambrer, haltères légers.',
    variants: [
      { name: 'Développé militaire haltères', reps: '10–12' },
      { name: 'Développé militaire, pause en haut', reps: '8–12' },
      { name: 'Développé militaire + élévations', reps: '8–12' },
    ],
  },
  {
    sets: 3,
    restSec: 45,
    note: 'Coudes fixes, montée contrôlée, descente lente.',
    variants: [
      { name: 'Curl haltères', reps: '12–15' },
      { name: 'Curl haltères, 3 s en descente', reps: '10–12' },
      { name: 'Curl marteau + curl inversé', reps: '10–12' },
    ],
  },
  {
    sets: 3,
    restSec: 45,
    note: 'Coude vers le plafond, amplitude complète, sans cambrer.',
    variants: [
      { name: 'Extension triceps au-dessus de la tête', reps: '12–15' },
      { name: 'Extension triceps, pause en bas', reps: '10–12' },
      { name: 'Dips sur chaise, jambes tendues', reps: '8–12' },
    ],
  },
];

const FULL_BODY: Movement[] = [
  {
    sets: 3,
    restSec: 75,
    note: 'Charge légère, descente lente : le corps entier, sans forcer.',
    variants: [
      { name: 'Squat gobelet haltère', reps: '12–15' },
      { name: 'Squat gobelet, pause 2 s en bas', reps: '10–12' },
      { name: 'Squat sauté', reps: '8–12' },
    ],
  },
  {
    sets: 3,
    restSec: 60,
    note: 'Coudes à 45°, corps gainé, respiration régulière.',
    variants: [
      { name: 'Pompes inclinées sur table', reps: '10–15' },
      { name: 'Pompes', reps: '8–15' },
      { name: 'Pompes déclinées', reps: '6–12' },
    ],
  },
  {
    sets: 3,
    restSec: 60,
    note: 'Dos plat, coude le long du corps, sans élan.',
    variants: [
      { name: 'Rowing haltère un bras', reps: '10–12 / bras' },
      { name: 'Rowing haltère, pause 1 s', reps: '10–12 / bras' },
      { name: 'Rowing inversé sous table', reps: '8–12' },
    ],
  },
  {
    sets: 2,
    restSec: 60,
    note: 'Pas contrôlé, genou dans l’axe, buste droit.',
    variants: [
      { name: 'Fente soutenue', reps: '10–12 / jambe' },
      { name: 'Fente avant haltères', reps: '10–12 / jambe' },
      { name: 'Fente bulgare sur chaise', reps: '8–10 / jambe' },
    ],
  },
  {
    sets: 3,
    restSec: 45,
    note: 'Bassin stable, alignement épaules-hanches-chevilles.',
    tempo: false,
    variants: [
      { name: 'Planche latérale', reps: '20–30 s / côté' },
      { name: 'Planche latérale + reach', reps: '8 / côté' },
      { name: 'Planche latérale, hanche haute', reps: '30–40 s / côté' },
    ],
  },
  {
    sets: 2,
    restSec: 45,
    note: 'Poussez dans les talons, fessiers serrés en haut.',
    variants: [
      { name: 'Pont fessier', reps: '15–20' },
      { name: 'Pont fessier haltère', reps: '15–20' },
      { name: 'Pont fessier une jambe', reps: '10–12 / jambe' },
    ],
  },
];

/* --------------------------------------------------------------- rythme */

export interface MonthSlot {
  /** 0 = lundi … 6 = dimanche. */
  day: number;
  time: string;
  title: string;
  /** Où tombe le créneau dans la journée. */
  window: string;
  detail: string;
  minutes: number;
  intensity: PlanSession['intensity'];
  movements: Movement[];
}

/**
 * Le rythme du mois. Deux séances avant l'atelier, une après, une le dimanche :
 * les études gardent le milieu d'après-midi et les soirées libres, et aucun
 * créneau ne tombe entre 14 h et 18 h.
 */
export const MONTH_RHYTHM: MonthSlot[] = [
  {
    day: 0,
    time: '7 h 30',
    title: 'Haut du corps · poussée & tirage',
    window: 'Avant l’atelier',
    detail:
      'Échauffement 5 min (épaules, pompes faciles), puis les mouvements. 40 min, avant l’atelier de 14 h.',
    minutes: 40,
    intensity: 'modérée',
    movements: UPPER_PUSH,
  },
  {
    day: 2,
    time: '7 h 30',
    title: 'Bas du corps · squat & fentes',
    window: 'Avant l’atelier',
    detail:
      'Échauffement 5 min (hanches, chevilles), puis les mouvements. 40 min, avant l’atelier de 14 h.',
    minutes: 40,
    intensity: 'soutenue',
    movements: LOWER,
  },
  {
    day: 4,
    time: '19 h',
    title: 'Haut du corps · épaules & bras',
    window: 'Après l’atelier',
    detail:
      'Sortie d’atelier à 18 h : séance à 19 h, après le repas. 40 min, sans empiéter sur la soirée d’études.',
    minutes: 40,
    intensity: 'modérée',
    movements: UPPER_PULL,
  },
  {
    day: 6,
    time: '10 h',
    title: 'Corps complet & gainage',
    window: 'Week-end',
    detail: 'Le créneau tranquille du week-end : tout le corps, sans chrono. 40 min.',
    minutes: 40,
    intensity: 'modérée',
    movements: FULL_BODY,
  },
];

/** Ce que le programme suppose de la semaine, affiché tel quel dans l'app. */
export const MONTH_CONTEXT = [
  { time: '7 h 30', label: 'Séance lundi et mercredi, avant de partir', kind: 'sport' as const },
  { time: '9 h – 13 h', label: 'Études', kind: 'study' as const },
  { time: '14 h – 18 h', label: 'Atelier informatique : aucun sport sur ce créneau', kind: 'work' as const },
  { time: '19 h', label: 'Séance vendredi, après l’atelier', kind: 'sport' as const },
  { time: 'Dim. 10 h', label: 'Séance du dimanche, le créneau tranquille', kind: 'sport' as const },
];

export const MONTH_INTAKE: PlanIntake = {
  goal: 'force',
  experience: 'intermediaire',
  daysPerWeek: MONTH_RHYTHM.length,
  sessionMin: 40,
  equipment: 'maison',
  sleepHours: 8,
  // Le texte libre ne quitte jamais l'appareil : il sert seulement à garder la
  // contrainte d'horaire sur le plan lui-même.
  constraints:
    'Atelier informatique 14 h–18 h du lundi au vendredi, études le reste du temps. Poids du corps et haltères légers.',
  createdAt: '2026-10-20T00:00:00.000Z',
};

/* ---------------------------------------------------------- construction */

/** Tempo du mois : la charge légère se compense par le contrôle du geste. */
const STAGE_TEMPO = [
  '3 s en descente, 1 s en haut',
  '3 s en descente, 1 s de pause en bas',
  '3 s en descente, pause en bas, montée dynamique',
];

const DELOAD_TEMPO = 'lent, amplitude confortable';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Ajustements de la semaine dans le bloc : la 2e ajoute une série sur les deux
 * mouvements principaux, la 3e raccourcit les repos, la 4e allège.
 */
function weekTune(weekIndex: number): { setsDelta: number; restDelta: number } {
  if (weekIndex === 3) return { setsDelta: -1, restDelta: 15 };
  if (weekIndex === 2) return { setsDelta: 1, restDelta: -15 };
  if (weekIndex === 1) return { setsDelta: 1, restDelta: 0 };
  return { setsDelta: 0, restDelta: 0 };
}

function buildExercises(
  movements: Movement[],
  weekIndex: number,
  monthIndex: number
): PlanExercise[] {
  const stage = monthIndex % STAGE_TEMPO.length;
  const tune = weekTune(weekIndex);
  const deload = weekIndex === 3;

  return movements.map((movement, position) => {
    const variant =
      movement.variants[Math.min(stage, movement.variants.length - 1)] ?? movement.variants[0]!;
    // Le bonus de série ne porte que sur les deux mouvements principaux : le
    // volume d'une séance ne doit pas bondir d'un tiers en une semaine.
    const bonus = tune.setsDelta > 0 && position < 2 ? tune.setsDelta : 0;
    const sets = clamp(movement.sets + bonus + (deload ? tune.setsDelta : 0), 2, 6);
    const tempo = deload ? DELOAD_TEMPO : STAGE_TEMPO[stage] ?? STAGE_TEMPO[0]!;
    return {
      name: variant.name,
      sets,
      reps: variant.reps,
      restSec: clamp(movement.restSec + tune.restDelta, 30, 120),
      note:
        movement.tempo === false
          ? movement.note
          : `${movement.note} Tempo : ${tempo}.`,
    };
  });
}

function buildSession(
  slot: MonthSlot,
  weekIndex: number,
  monthIndex: number
): PlanSession {
  return {
    id: `m${monthIndex}_w${weekIndex}_${slot.day}`,
    day: slot.day,
    time: slot.time,
    type: 'Musculation',
    title: slot.title,
    minutes: slot.minutes,
    intensity: slot.intensity,
    detail: slot.detail,
    exercises: buildExercises(slot.movements, weekIndex, monthIndex),
  };
}

const PHASES: PlanPhase[] = [
  {
    id: 'month-setup',
    name: 'Mise en place',
    fromWeek: 0,
    toWeek: 0,
    focus: 'Technique et amplitude, sans chercher la charge',
    objective: 'Exécuter chaque mouvement proprement, avec une dernière répétition nette.',
  },
  {
    id: 'month-build',
    name: 'Progression',
    fromWeek: 1,
    toWeek: 2,
    focus: 'Une série de plus, puis des repos plus courts',
    objective: 'Ajouter du volume sur les mouvements principaux et tenir les séries cibles.',
  },
  {
    id: 'month-deload',
    name: 'Récupération',
    fromWeek: 3,
    toWeek: 3,
    focus: 'Semaine allégée : on garde le geste',
    objective: 'Retirer une série partout et arriver frais au mois suivant.',
  },
];

const MILESTONES: PlanMilestone[] = [
  {
    id: 'month-1',
    week: 0,
    label: 'Gestes propres',
    detail: 'Squat gobelet, pompes, rowing haltère et planche sans douleur, amplitude complète.',
  },
  {
    id: 'month-2',
    week: 2,
    label: 'Séries cibles',
    detail: 'Une série de plus sur les mouvements principaux, technique inchangée.',
  },
  {
    id: 'month-3',
    week: 3,
    label: 'Bilan du mois',
    detail: 'Quatre semaines tenues : le mois suivant passe à une variante plus difficile.',
  },
];

export function monthlyNote(): string {
  return [
    'Le mois est calé sur votre semaine : atelier de 14 h à 18 h du lundi au vendredi, études le reste du temps. Les séances se placent avant l’atelier (lundi et mercredi, 7 h 30) ou après (vendredi, 19 h), avec le créneau tranquille du dimanche matin.',
    'Quatre séances de 40 min par semaine, poids du corps et haltères légers. Avec des charges légères, la progression ne vient pas des kilos mais des répétitions, du tempo lent (3 s en descente), des variantes unilatérales et des séries menées près de l’échec technique — jamais jusqu’à l’échec total.',
    'La quatrième semaine est allégée : moins de séries, repos plus longs. C’est ce qui permet d’enchaîner les mois sans accumuler de fatigue à côté de l’atelier et des études.',
  ].join('\n\n');
}

export interface MonthlyOptions {
  today?: ISODate;
  /** Rang du mois : 0 pour le premier bloc, puis 1, 2… */
  monthIndex?: number;
  /** Lundi de la première semaine, pour enchaîner un mois sans le décaler. */
  startDate?: ISODate;
}

/**
 * Construit le bloc du mois. Si le bloc démarre en semaine, la première semaine
 * ne garde que les créneaux à venir — et s'il n'en reste qu'un, le mois commence
 * le lundi suivant plutôt que par une semaine d'une seule séance.
 */
export function buildMonthlyProgram(options: MonthlyOptions = {}): TrainingPlan {
  const today = options.today ?? todayISO();
  const monthIndex = Math.max(0, Math.floor(options.monthIndex ?? 0));
  const weekday = (parseISODate(today).getDay() + 6) % 7;
  const monday = startOfWeek(today);
  const remaining = MONTH_RHYTHM.filter((slot) => slot.day >= weekday);
  const startsThisWeek = remaining.length >= 2;
  const startDate = options.startDate ?? (startsThisWeek ? monday : addDays(monday, 7));
  const partialFirst = startDate === monday && weekday > 0;

  const weeks: PlanWeek[] = Array.from({ length: MONTH_WEEKS }, (_, weekIndex) => {
    const slots =
      weekIndex === 0 && partialFirst
        ? MONTH_RHYTHM.filter((slot) => slot.day >= weekday)
        : MONTH_RHYTHM;
    const sessions = slots.map((slot) => buildSession(slot, weekIndex, monthIndex));
    return {
      index: weekIndex,
      startDate: addDays(startDate, weekIndex * 7),
      focus: weekFocus(weekIndex, partialFirst && weekIndex === 0),
      targetMinutes: sessions.reduce((total, session) => total + session.minutes, 0),
      deload: weekIndex === 3,
      sessions,
    };
  });

  return {
    createdAt: new Date().toISOString(),
    horizonWeeks: MONTH_WEEKS,
    goal: 'force',
    preset: MONTH_PRESET,
    monthIndex,
    intake: { ...MONTH_INTAKE, createdAt: new Date().toISOString() },
    phases: PHASES,
    weeks,
    milestones: MILESTONES,
    note: monthlyNote(),
    noteSource: 'local',
  };
}

function weekFocus(weekIndex: number, partialStart: boolean): string {
  if (partialStart) return 'Mise en route : on prend le rythme';
  if (weekIndex === 3) return 'Semaine allégée : on récupère';
  if (weekIndex === 2) return 'Repos plus courts, mêmes mouvements';
  if (weekIndex === 1) return 'Une série de plus sur les mouvements principaux';
  return 'Technique et amplitude avant tout';
}

/** Le mois suivant : même rythme, variante plus difficile, à partir d'aujourd'hui. */
export function nextMonthlyProgram(
  plan: TrainingPlan,
  options: { today?: ISODate } = {}
): TrainingPlan {
  const monthIndex = (plan.monthIndex ?? 0) + 1;
  return buildMonthlyProgram({ today: options.today ?? todayISO(), monthIndex });
}

/** Vrai si le plan affiché est le programme du mois (et non un bilan). */
export function isMonthlyProgram(plan: TrainingPlan | null): boolean {
  return Boolean(plan && plan.preset === MONTH_PRESET);
}

/** Le mois est terminé quand la dernière semaine est passée. */
export function isMonthOver(plan: TrainingPlan, today = todayISO()): boolean {
  const last = plan.weeks[plan.weeks.length - 1];
  if (!last) return false;
  return today > addDays(last.startDate, 6);
}
