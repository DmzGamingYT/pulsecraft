/**
 * Le coach de Battement — un plan calculé sur l'appareil.
 *
 * Aucun appel réseau : le plan vient du journal lui-même. Trois idées sont
 * empruntées à ce que font Apple et Samsung, transposées au local :
 *
 * - **la charge**, comparée comme la charge d'entraînement d'Apple Santé :
 *   les sept derniers jours face à la moyenne des quatre dernières semaines ;
 * - **l'énergie du jour**, proche du score d'énergie de Samsung Health : le
 *   repos, la charge récente et les pas donnent une forme du jour ;
 * - **un programme de quatre semaines avec un point de suivi**, comme les
 *   programmes de sommeil de Samsung : le point ne décore pas, il change la
 *   semaine suivante.
 *
 * Tout est pur et déterministe : mêmes données, même plan. C'est ce qui rend
 * le calcul vérifiable — et ce qui permet de le lire sans serveur.
 */

import type { Activity, DayLog, Sport } from '../types';
import { sportLabel } from '../types';
import {
  addDays,
  datePart,
  formatPace,
  formatSpeed,
  mondayOf,
  parseDay,
  todayISO,
  weekdayOf,
} from './dates';

export type Goal = 'reprise' | 'regularite' | 'endurance' | 'force';
export type Intensity = 'facile' | 'modere' | 'soutenu';
export type Rhythm = 'weekly' | 'biweekly' | 'none';
export type Feel = 'facile' | 'juste' | 'dur';

export interface Answers {
  goal: Goal;
  /** 2 à 5 séances par semaine */
  sessionsPerWeek: number;
  /** durée d'une séance, en minutes */
  minutes: number;
  /** jours de la semaine choisis, 0 = dimanche, triés */
  days: number[];
  /** cadence du point de suivi */
  rhythm: Rhythm;
}

export interface Load {
  /** minutes des sept derniers jours */
  recent: number;
  /** moyenne hebdomadaire des quatre dernières semaines */
  baseline: number;
  /** recent / baseline (0 quand il n'y a pas encore de base) */
  ratio: number;
  label: 'faible' | 'équilibrée' | 'élevée';
}

export interface Profile {
  /** semaines de journal réellement couvertes, 0 sans donnée */
  weeks: number;
  /** séances des 28 derniers jours */
  sessions: number;
  sessionsPerWeek: number;
  avgMinutes: number;
  dominant: Sport | null;
  secondary: Sport | null;
  /** part du temps de la discipline dominante, 0 à 1 */
  dominantShare: number;
  /** jours de la semaine les plus actifs, du plus fréquent au moins */
  activeDays: number[];
  load: Load;
  /** forme du jour, 0 à 100 */
  readiness: number;
  /** jours depuis la dernière séance ; 0 si elle est aujourd'hui */
  restDays: number;
}

export interface PlanSession {
  /** date réelle de la séance, YYYY-MM-DD */
  date: string;
  sport: Sport;
  title: string;
  minutes: number;
  intensity: Intensity;
  /** séance clé, séance d'appui ou récupération */
  kind: 'cle' | 'appui' | 'recup';
}

export interface PlanWeek {
  /** 0 à 3 */
  index: number;
  start: string;
  end: string;
  /** le cap de la semaine : « mise en route », « charge »… */
  focus: string;
  sessions: PlanSession[];
  minutes: number;
}

export interface CheckIn {
  /** semaine évaluée, 0 à 3 */
  week: number;
  date: string;
  feel: Feel;
  /** fatigue ressentie, 1 à 5 */
  fatigue: number;
  /** séances faites, décomptées du journal */
  done: number;
  planned: number;
  /** ce que le point a décidé, écrit après coup */
  summary?: string;
}

export interface Program {
  createdAt: string;
  start: string;
  answers: Answers;
  /** lecture du journal au moment de la création */
  profile: Profile;
  weeks: PlanWeek[];
  rationale: string[];
  checkIns: CheckIn[];
  /** numéro du cycle de quatre semaines, 1 au premier */
  cycle?: number;
}

export const GOALS: { id: Goal; label: string; body: string }[] = [
  {
    id: 'reprise',
    label: 'Reprendre',
    body: 'Bouger sans se brûler : marche, course douce, mobilité.',
  },
  {
    id: 'regularite',
    label: 'Tenir le rythme',
    body: 'Des séances courtes, chaque semaine, sans trou.',
  },
  {
    id: 'endurance',
    label: 'Gagner en endurance',
    body: 'Un fil rouge, une sortie longue, une séance plus soutenue.',
  },
  {
    id: 'force',
    label: 'Renforcer',
    body: 'Musculation deux fois par semaine, un peu de cardio.',
  },
];

export const RHYTHMS: { id: Rhythm; label: string; body: string }[] = [
  {
    id: 'weekly',
    label: 'Chaque semaine',
    body: 'Un point court à la fin de chaque semaine, et la suivante s’ajuste.',
  },
  {
    id: 'biweekly',
    label: 'Toutes les deux semaines',
    body: 'Un point sur deux, pour laisser le temps de digérer la charge.',
  },
  {
    id: 'none',
    label: 'Aucun suivi',
    body: 'Le plan reste tel qu’il a été calculé, sans réajustement.',
  },
];

export const INTENSITY_LABELS: Record<Intensity, string> = {
  facile: 'facile',
  modere: 'modéré',
  soutenu: 'soutenu',
};

const DAY_MS = 86_400_000;
const WEEKDAY_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const WEEKDAY_SHORT = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

/** L’initiale du jour, pour les pastilles de choix. */
export const DAY_INITIALS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export function weekdayShort(day: number): string {
  return WEEKDAY_SHORT[((day % 7) + 7) % 7] ?? 'lun';
}

export function weekdayLong(day: number): string {
  return WEEKDAY_LONG[((day % 7) + 7) % 7] ?? 'lundi';
}

function round5(value: number): number {
  return Math.max(15, Math.round(value / 5) * 5);
}

function within(activities: Activity[], start: string, end: string): Activity[] {
  return activities.filter((activity) => {
    const day = datePart(activity.date);
    return day >= start && day <= end;
  });
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Ce que le journal dit de vous.
 *
 * La fenêtre est de quatre semaines pour les habitudes et de huit semaines pour
 * la couverture affichée : au-delà, un journal sportif parle du passé, pas du
 * présent. Sans aucune donnée, le profil reste neutre au lieu d'inventer.
 */
export function buildProfile(
  activities: Activity[],
  days: DayLog[] = [],
  today = todayISO(),
): Profile {
  const start28 = addDays(today, -27);
  const recent = within(activities, start28, today);
  const last7Start = addDays(today, -6);
  const last7 = within(activities, last7Start, today);

  const minutesBySport = new Map<Sport, number>();
  for (const activity of recent) {
    minutesBySport.set(activity.sport, (minutesBySport.get(activity.sport) ?? 0) + activity.durationMin);
  }
  const ranked = [...minutesBySport.entries()].sort((a, b) => b[1] - a[1]);
  const totalMinutes = recent.reduce((sum, activity) => sum + activity.durationMin, 0);

  const perWeekday = new Map<number, number>();
  for (const activity of recent) {
    const day = weekdayOf(datePart(activity.date));
    perWeekday.set(day, (perWeekday.get(day) ?? 0) + 1);
  }
  const activeDays = [...perWeekday.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 3)
    .map(([day]) => day);

  const recentMinutes = last7.reduce((sum, activity) => sum + activity.durationMin, 0);
  const baselineMinutes = within(activities, addDays(today, -27), today).reduce(
    (sum, activity) => sum + activity.durationMin,
    0,
  ) / 4;
  const ratio = baselineMinutes > 0 ? recentMinutes / baselineMinutes : 0;
  const label: Load['label'] =
    baselineMinutes === 0 || ratio < 0.75 ? 'faible' : ratio <= 1.3 ? 'équilibrée' : 'élevée';

  const lastSession = activities.reduce<string | null>((latest, activity) => {
    const day = datePart(activity.date);
    if (day > today) return latest;
    return latest === null || day > latest ? day : latest;
  }, null);
  const restDays = lastSession
    ? Math.max(0, Math.round((parseDay(today).getTime() - parseDay(lastSession).getTime()) / DAY_MS))
    : 0;

  const stepsWindow = days.filter((log) => log.date >= last7Start && log.date <= today);
  const stepsAvg = mean(stepsWindow.map((log) => log.steps ?? 0));

  let readiness = 64;
  if (restDays >= 2) readiness += 18;
  else if (restDays === 1) readiness += 11;
  if (ratio > 1.4) readiness -= 16;
  else if (ratio > 1.15) readiness -= 8;
  if (stepsAvg >= 8000) readiness += 7;
  else if (stepsAvg > 0 && stepsAvg < 4000) readiness -= 5;

  const firstDay = activities.reduce<string | null>((earliest, activity) => {
    const day = datePart(activity.date);
    return earliest === null || day < earliest ? day : earliest;
  }, null);
  const weeks = firstDay
    ? Math.max(
        1,
        Math.min(
          8,
          Math.floor((parseDay(today).getTime() - parseDay(firstDay).getTime()) / (7 * DAY_MS)) + 1,
        ),
      )
    : 0;

  return {
    weeks,
    sessions: recent.length,
    sessionsPerWeek: Math.round((recent.length / 4) * 10) / 10,
    avgMinutes: Math.round(mean(recent.map((activity) => activity.durationMin))),
    dominant: ranked[0]?.[0] ?? null,
    secondary: ranked[1]?.[0] ?? null,
    dominantShare: totalMinutes > 0 ? (ranked[0]?.[1] ?? 0) / totalMinutes : 0,
    activeDays,
    load: {
      recent: Math.round(recentMinutes),
      baseline: Math.round(baselineMinutes),
      ratio: Math.round(ratio * 100) / 100,
      label,
    },
    readiness: Math.round(Math.max(30, Math.min(97, readiness))),
    restDays,
  };
}

const CARDIO_SPORTS: Sport[] = ['course', 'velo', 'natation', 'rando', 'marche'];

/**
 * La discipline fil rouge.
 *
 * Le journal décide, mais seulement s'il propose un sport qui accepte une
 * séance longue : une dominante musculation ou yoga laisse le cardio au plan
 * plutôt que de transformer le programme en salle.
 */
function mainSport(goal: Goal, profile: Profile): Sport {
  if (goal === 'force') return 'musculation';
  const dominant = profile.dominant;
  if (dominant && CARDIO_SPORTS.includes(dominant)) return dominant;
  return goal === 'reprise' ? 'marche' : 'course';
}

/** Les titres s'adaptent au sport : « 6 × 2 min soutenu » n'a pas de sens en rando. */
function longTitle(sport: Sport): string {
  if (sport === 'rando') return 'Randonnée · sortie longue';
  if (sport === 'marche') return 'Marche · sortie longue';
  if (sport === 'velo') return 'Vélo · sortie longue';
  if (sport === 'natation') return 'Natation · séance longue';
  return `${sportLabel(sport)} · sortie longue`;
}

function hardTitle(sport: Sport): string {
  if (sport === 'rando') return 'Randonnée · dénivelé, +300 m';
  if (sport === 'marche') return 'Marche · 10 min rapides, 10 min calmes';
  if (sport === 'velo') return 'Vélo · 6 × 2 min en côte';
  if (sport === 'natation') return 'Natation · 6 × 100 m soutenus';
  return 'Course · 6 × 2 min soutenu';
}

function easyTitle(sport: Sport): string {
  if (sport === 'rando') return 'Randonnée · tranquille';
  if (sport === 'marche') return 'Marche · 40 min souple';
  if (sport === 'velo') return 'Vélo · endurance fondamentale';
  if (sport === 'natation') return 'Natation · nage souple';
  return 'Course · endurance fondamentale';
}

const FOCUS: Record<Goal, string[]> = {
  reprise: ['Mise en route', 'On tient', 'Un cran au-dessus', 'Consolidation'],
  regularite: ['Le rythme', 'Le rythme', 'Le rythme', 'Le rythme'],
  endurance: ['Base', 'Volume', 'Intensité', 'Récupération'],
  force: ['Apprentissage', 'Charge', 'Charge', 'Décharge'],
};

const FACTORS: Record<Goal, number[]> = {
  reprise: [0.75, 0.85, 0.95, 1],
  regularite: [0.95, 1, 1, 1],
  endurance: [0.85, 1, 1.1, 0.9],
  force: [0.9, 1, 1.08, 0.85],
};

interface DraftSession {
  sport: Sport;
  title: string;
  minutes: number;
  intensity: Intensity;
  kind: PlanSession['kind'];
}

/** Une séance par créneau, dans l'ordre des jours choisis. */
function draftSessions(answers: Answers, profile: Profile, factor: number): DraftSession[] {
  const base = round5(answers.minutes * factor);
  const main = mainSport(answers.goal, profile);
  const label = sportLabel(main);
  const count = answers.sessionsPerWeek;
  const sessions: DraftSession[] = [];

  for (let index = 0; index < count; index += 1) {
    const last = index === count - 1;
    const recovery = count >= 4 && last;

    if (recovery) {
      sessions.push({
        sport: 'yoga',
        title: 'Mobilité et respiration',
        minutes: round5(base * 0.5),
        intensity: 'facile',
        kind: 'recup',
      });
      continue;
    }

    if (answers.goal === 'reprise') {
      sessions.push(
        index === 0
          ? {
              sport: main,
              title:
                main === 'marche' || main === 'rando'
                  ? 'Marche · 8 × 1 min rapide'
                  : `${label} · marche et course 8 × 1 min`,
              minutes: base,
              intensity: 'facile',
              kind: 'appui',
            }
          : {
              sport: index % 2 === 1 ? 'marche' : 'yoga',
              title: index % 2 === 1 ? 'Marche active, sans forcer' : 'Mobilité du dos et des hanches',
              minutes: round5(base * 0.8),
              intensity: 'facile',
              kind: index % 2 === 1 ? 'appui' : 'recup',
            },
      );
      continue;
    }

    if (answers.goal === 'force') {
      if (index === 0) {
        sessions.push({
          sport: 'musculation',
          title: 'Bas du corps · 4 × 8',
          minutes: base,
          intensity: 'modere',
          kind: 'cle',
        });
      } else if (index === 1) {
        sessions.push({
          sport: 'musculation',
          title: 'Haut du corps · 4 × 8',
          minutes: base,
          intensity: 'modere',
          kind: 'cle',
        });
      } else if (index === 2) {
        sessions.push({
          sport: 'course',
          title: 'Footing souple, entre deux séances',
          minutes: round5(base * 0.8),
          intensity: 'facile',
          kind: 'appui',
        });
      } else {
        sessions.push({
          sport: 'musculation',
          title: 'Gainage et bras · 3 × 12',
          minutes: round5(base * 0.7),
          intensity: 'modere',
          kind: 'appui',
        });
      }
      continue;
    }

    if (answers.goal === 'endurance') {
      if (index === 0) {
        sessions.push({
          sport: main,
          title: longTitle(main),
          minutes: round5(base * 1.25),
          intensity: 'facile',
          kind: 'cle',
        });
      } else if (index === 1) {
        sessions.push({
          sport: main,
          title: hardTitle(main),
          minutes: round5(base * 0.85),
          intensity: 'soutenu',
          kind: 'cle',
        });
      } else {
        sessions.push({
          sport: main,
          title: easyTitle(main),
          minutes: base,
          intensity: 'facile',
          kind: 'appui',
        });
      }
      continue;
    }

    // Régularité : on alterne le sport dominant et le renforcement.
    sessions.push(
      index % 2 === 0
        ? {
            sport: main,
            title: easyTitle(main),
            minutes: base,
            intensity: 'facile',
            kind: 'appui',
          }
        : {
            sport: 'musculation',
            title: 'Renforcement · gainage et jambes',
            minutes: round5(base * 0.7),
            intensity: 'modere',
            kind: 'appui',
          },
    );
  }

  return sessions;
}

function pickDays(answers: Answers, profile: Profile): number[] {
  const chosen = [...new Set(answers.days)].sort((a, b) => a - b);
  if (chosen.length >= answers.sessionsPerWeek) return chosen.slice(0, answers.sessionsPerWeek);

  // Complète avec les jours les plus actifs du journal, puis dans l'ordre.
  const fallback = [...profile.activeDays, 1, 3, 5, 6, 0, 2, 4];
  for (const day of fallback) {
    if (chosen.length >= answers.sessionsPerWeek) break;
    if (!chosen.includes(day)) chosen.push(day);
  }
  return chosen.sort((a, b) => a - b);
}

function rationaleFor(profile: Profile, answers: Answers, goal: Goal): string[] {
  const lines: string[] = [];
  const main = profile.dominant ? sportLabel(profile.dominant) : 'aucune discipline';

  if (profile.sessions === 0) {
    lines.push(
      'Aucune séance dans le journal : le plan démarre prudent et se calera sur vos premières semaines.',
    );
  } else {
    lines.push(
      `Lecture de ${profile.weeks} semaine${profile.weeks > 1 ? 's' : ''} : ${profile.sessions} séances, ${profile.sessionsPerWeek.toLocaleString('fr-FR')} par semaine en moyenne.`,
    );
    lines.push(
      `${main} occupe ${Math.round(profile.dominantShare * 100)} % de votre temps : le plan la garde comme fil rouge.`,
    );
    if (profile.avgMinutes > 0) {
      lines.push(
        `Vos séances durent ${profile.avgMinutes} min en moyenne ; le plan en propose ${answers.minutes}.`,
      );
    }
  }

  if (profile.activeDays.length > 0) {
    const days = profile.activeDays.map((day) => weekdayLong(day)).join(', ');
    lines.push(`Vos jours les plus actifs : ${days}. Le plan s’y cale.`);
  }

  const load = profile.load;
  if (load.baseline > 0) {
    lines.push(
      `Charge ${load.label} : ${load.recent} min sur 7 jours contre ${load.baseline} min de moyenne.`,
    );
  }

  if (goal === 'reprise') {
    lines.push('Aucune séance soutenue : la reprise se joue sur la fréquence, pas sur l’intensité.');
  } else if (goal === 'endurance') {
    lines.push('Une sortie longue, une séance soutenue, le reste en endurance fondamentale.');
  } else if (goal === 'force') {
    lines.push('Deux séances de musculation, un footing entre les deux, du gainage en fin de semaine.');
  } else {
    lines.push('Des séances de la même taille, d’une semaine à l’autre : c’est la répétition qui compte.');
  }

  return lines;
}

/**
 * Les quatre semaines telles que le plan les pose, avant tout point de suivi.
 *
 * C'est la référence des ajustements : `applyCheckIn` repart d'ici à chaque
 * point, au lieu d'empiler une correction sur la précédente.
 */
function baseWeeks(
  profile: Profile,
  answers: Answers,
  today: string,
): { start: string; days: number[]; weeks: PlanWeek[] } {
  const days = pickDays(answers, profile);
  const firstMatch = (() => {
    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDays(today, offset);
      if (days.includes(weekdayOf(date))) return date;
    }
    return today;
  })();
  const anchor = mondayOf(firstMatch);
  const factors = FACTORS[answers.goal];

  const weeks: PlanWeek[] = [0, 1, 2, 3].map((index) => {
    const start = addDays(anchor, index * 7);
    const end = addDays(start, 6);
    const drafts = draftSessions(answers, profile, factors[index] ?? 1);
    const sessions: PlanSession[] = drafts
      .map((draft, slot) => {
        const weekday = days[slot] ?? days[days.length - 1] ?? 1;
        const date = addDays(start, (weekday + 6) % 7);
        return { ...draft, date };
      })
      // La semaine va du lundi au dimanche : le dimanche choisi tombe en fin de
      // semaine, pas avant le lundi. On trie donc les séances par date.
      .sort((a, b) => a.date.localeCompare(b.date));
    // La première semaine ne propose pas de séance déjà passée.
    const kept = index === 0 ? sessions.filter((session) => session.date >= today) : sessions;
    return {
      index,
      start,
      end,
      focus: FOCUS[answers.goal][index] ?? 'Semaine',
      sessions: kept,
      minutes: kept.reduce((sum, session) => sum + session.minutes, 0),
    };
  });

  return { start: firstMatch, days, weeks };
}

/** Crée le programme de quatre semaines à partir du profil et des réponses. */
export function buildProgram(
  profile: Profile,
  answers: Answers,
  today = todayISO(),
): Program {
  const base = baseWeeks(profile, answers, today);
  return {
    createdAt: today,
    start: base.start,
    answers: { ...answers, days: base.days },
    profile,
    weeks: base.weeks,
    rationale: rationaleFor(profile, { ...answers, days: base.days }, answers.goal),
    checkIns: [],
    cycle: 1,
  };
}

/** Ce que le point de suivi décide pour la suite. */
export function adjustmentFor(input: {
  feel: Feel;
  fatigue: number;
  done: number;
  planned: number;
}): { factor: number; downgrade: boolean; note: string } {
  if (input.feel === 'dur' || input.fatigue >= 4) {
    return {
      factor: 0.85,
      downgrade: true,
      note: 'Semaine allégée de 15 % : la fatigue est haute.',
    };
  }
  if (input.fatigue <= 2 && input.done >= input.planned && input.planned > 0) {
    return {
      factor: 1.08,
      downgrade: false,
      note: 'Progression de 8 % : la semaine a été digérée.',
    };
  }
  if (input.done < input.planned) {
    return {
      factor: 0.95,
      downgrade: false,
      note: 'Volume tenu, sans progression : la semaine a été incomplète.',
    };
  }
  return {
    factor: 1,
    downgrade: false,
    note: 'On garde le cap : la charge était juste.',
  };
}

interface Decision {
  entry: CheckIn;
  verdict: ReturnType<typeof adjustmentFor>;
}

/**
 * Le plan ne peut ni fondre ni gonfler sans fin : le volume cumulé reste entre
 * −25 % et +15 % de sa version d'origine.
 */
export const MIN_PLAN_FACTOR = 0.75;
export const MAX_PLAN_FACTOR = 1.15;

function clampFactor(factor: number): number {
  return Math.min(MAX_PLAN_FACTOR, Math.max(MIN_PLAN_FACTOR, factor));
}

/**
 * Applique un point de suivi, toujours à partir du plan d'origine.
 *
 * Deux garde-fous, parce qu'un plan tient sur la confiance :
 *  - seules les séances encore à venir au moment du point bougent ; une semaine
 *    déjà terminée n'est jamais réécrite, même si le point est saisi en retard ;
 *  - le volume cumulé reste borné, donc deux points difficiles ne s'empilent
 *    pas jusqu'à vider le programme — et une bonne semaine peut rendre le
 *    volume qu'un point difficile avait retiré.
 */
export function applyCheckIn(program: Program, checkIn: CheckIn): Program {
  // Un point rejoué pour la même semaine ne compte qu'une fois.
  const checkIns = [
    ...program.checkIns.filter((entry) => entry.week !== checkIn.week),
    checkIn,
  ].sort((a, b) => a.week - b.week || a.date.localeCompare(b.date));
  const decisions: Decision[] = checkIns.map((entry) => ({
    entry,
    verdict: adjustmentFor(entry),
  }));

  // La base est reconstruite depuis les réponses et le profil : les minutes du
  // plan courant ne servent jamais de point de départ à un nouveau point.
  const base = baseWeeks(program.profile, program.answers, program.createdAt).weeks;

  /** Le produit brut des points qui concernent une séance, avant bornage. */
  const rawFactorFor = (weekIndex: number, date: string, active: Decision[]): number =>
    active
      .filter((decision) => decision.entry.week < weekIndex && decision.entry.date <= date)
      .reduce((product, decision) => product * decision.verdict.factor, 1);

  /** Le même produit, ramené dans les bornes du plan. */
  const factorFor = (weekIndex: number, date: string, active: Decision[]): number =>
    clampFactor(rawFactorFor(weekIndex, date, active));

  const weeks: PlanWeek[] = base.map((week) => {
    const sessions = week.sessions.map((session) => {
      const active = decisions.filter(
        (decision) => decision.entry.week < week.index && decision.entry.date <= session.date,
      );
      const latest = active[active.length - 1];
      return {
        ...session,
        minutes: round5(session.minutes * factorFor(week.index, session.date, decisions)),
        // L'intensité suit le dernier point, pas tous les points passés : une
        // semaine digérée remet la séance soutenue que la fatigue avait baissée.
        intensity:
          latest?.verdict.downgrade && session.intensity === 'soutenu'
            ? ('modere' as const)
            : session.intensity,
      };
    });
    return {
      ...week,
      sessions,
      minutes: sessions.reduce((sum, session) => sum + session.minutes, 0),
    };
  });

  const logged: CheckIn[] = decisions.map(({ entry, verdict }, position) => {
    // Le résumé d'un point se juge avec les points de son époque : un point
    // ultérieur ne réécrit pas ce que celui-ci avait décidé.
    const history = decisions.slice(0, position + 1);
    const targets = base.flatMap((week) =>
      week.index > entry.week
        ? week.sessions
            .filter((session) => session.date >= entry.date)
            .map((session) => ({ weekIndex: week.index, date: session.date }))
        : [],
    );

    let summary = verdict.note;
    if (targets.length === 0) {
      summary += ' Aucune séance à ajuster après ce point.';
    } else if (verdict.factor !== 1) {
      const others = history.filter((decision) => decision.entry !== entry);
      const verb = verdict.factor > 1 ? 'monte' : 'baisse';
      const ceiling = ` Plafond de +${Math.round((MAX_PLAN_FACTOR - 1) * 100)} % atteint`;
      const floor = ` Plancher de −${Math.round((1 - MIN_PLAN_FACTOR) * 100)} % atteint`;

      // Ce point ne change plus rien : le plan bute sur sa borne.
      const stuck = targets.every(
        (target) =>
          factorFor(target.weekIndex, target.date, history) ===
          factorFor(target.weekIndex, target.date, others),
      );
      // Il change encore, mais moins que prévu : la borne mord en partie.
      const limited = targets.some((target) => {
        const raw = rawFactorFor(target.weekIndex, target.date, history);
        return verdict.factor > 1 ? raw > MAX_PLAN_FACTOR : raw < MIN_PLAN_FACTOR;
      });

      if (stuck) {
        const atCeiling = targets.some(
          (target) => factorFor(target.weekIndex, target.date, history) >= MAX_PLAN_FACTOR,
        );
        summary += `${atCeiling ? ceiling : floor} : le volume ne ${verb} plus.`;
      } else if (limited) {
        summary += `${
          verdict.factor > 1 ? ceiling : floor
        } : le mouvement est limité.`;
      }
    }

    return { ...entry, summary };
  });

  return { ...program, weeks, checkIns: logged };
}

/**
 * La semaine qui attend son point, s'il y en a une.
 *
 * Un point ne se propose qu'une fois la semaine terminée : juger une semaine
 * en cours n'aurait aucun sens. En cadence « toutes les deux semaines », seules
 * les semaines impaires sont évaluées.
 */
export function checkInDue(program: Program, today = todayISO()): PlanWeek | null {
  if (program.answers.rhythm === 'none') return null;
  const every = program.answers.rhythm === 'biweekly' ? 2 : 1;
  for (const week of program.weeks) {
    if (week.end >= today) continue;
    if (every === 2 && week.index % 2 === 0) continue;
    if (program.checkIns.some((entry) => entry.week === week.index)) continue;
    return week;
  }
  return null;
}

/** Nombre de séances marquées faites dans une semaine. */
export function doneInWeek(week: PlanWeek, done: Set<string>): number {
  return week.sessions.filter((session) => done.has(session.date)).length;
}

export function totalDone(program: Program, done: Set<string>): number {
  return program.weeks.reduce((sum, week) => sum + doneInWeek(week, done), 0);
}

export function totalPlanned(program: Program): number {
  return program.weeks.reduce((sum, week) => sum + week.sessions.length, 0);
}

/* ------------------------------------------------------------ le contenu -- */

export interface SessionContent {
  warmup: string;
  main: string[];
  cooldown: string;
  /** l'allure ou la vitesse conseillée, quand le journal permet de la situer */
  target?: string;
  /** ce que la séance cherche à produire */
  purpose: string;
}

/** Ce que le journal dit du déplacement, pour situer les allures proposées. */
export interface PaceReference {
  /** meilleure allure récente sur 5 km et plus, min/km */
  paceMinPerKm?: number;
  /** meilleure vitesse récente sur 10 km et plus, km/h */
  speedKmh?: number;
}

const KIND_PURPOSE: Record<PlanSession['kind'], string> = {
  cle: 'Séance clé : c’est elle qui porte la progression du cycle.',
  appui: 'Séance d’appui : elle ajoute du volume sans entamer la récupération.',
  recup: 'Récupération : elle aide à digérer les autres séances.',
};

function warmupFor(sport: Sport): string {
  if (sport === 'musculation') {
    return '6 min de mobilité et d’échauffement articulaire, une série légère par mouvement.';
  }
  if (sport === 'velo') return '10 min de pédalage souple, cadence libre.';
  if (sport === 'natation') return '200 m de nage souple, puis 100 m d’éducatifs.';
  if (sport === 'yoga' || sport === 'autre') return '3 min de respiration, puis quelques postures douces.';
  return '10 min de marche rapide, puis mobilité des chevilles et des hanches.';
}

function cooldownFor(sport: Sport): string {
  if (sport === 'musculation') return '5 min d’étirements, sans forcer.';
  if (sport === 'velo') return '5 min de pédalage très souple.';
  if (sport === 'natation') return '100 m de nage souple, épaules relâchées.';
  if (sport === 'yoga') return '3 min allongé, respiration lente.';
  return '5 min de marche, étirements des mollets et des ischios.';
}

function mainFor(session: PlanSession): string[] {
  const block = Math.max(10, session.minutes - 20);

  if (session.kind === 'recup') {
    return [
      'Respiration au rythme de la marche, 5 min',
      'Mobilité douce, 8 à 10 postures tenues 30 s',
      'Rien d’intense : la séance doit finir plus frais qu’elle n’a commencé.',
    ];
  }

  if (session.sport === 'musculation') {
    return [
      '4 séries de 8 répétitions, charge tenable sur la dernière série',
      '2 séries de 12 en finition, plus léger',
      '60 à 90 s de récupération entre les séries',
    ];
  }

  if (session.sport === 'yoga') {
    return [
      'Salutation au soleil × 4',
      'Postures tenues 45 s, respiration continue',
      'Torsions et ouverture des hanches',
    ];
  }

  if (session.sport === 'rando') {
    return [
      `Marche ${block} min à allure régulière, sans à-coups`,
      'Une pause courte au milieu, surtout si le dénivelé est là',
      'Le retour se fait souple : c’est la descente qui fatigue les jambes.',
    ];
  }

  if (session.sport === 'velo') {
    return session.intensity === 'soutenu'
      ? ['20 min d’endurance fondamentale', '6 × 2 min en côte ou en force, 90 s souples', '10 min pour rentrer au calme']
      : [
          `${block} min de pédalage régulier, cadence 80 à 90 tr/min`,
          'Une accélération de 30 s toutes les 10 min, sans forcer',
        ];
  }

  if (session.sport === 'natation') {
    return session.intensity === 'soutenu'
      ? ['200 m d’échauffement', '6 × 100 m soutenus, 20 s de repos', '100 m souples']
      : [`${block * 25} m de nage continue, respiration régulière`, 'Deux longueurs d’éducatifs pour finir'];
  }

  // Course et marche.
  if (session.intensity === 'soutenu') {
    return [
      '20 min d’endurance fondamentale',
      '6 × 2 min soutenu, 90 s de récupération',
      '10 min pour rentrer au calme',
    ];
  }
  if (session.kind === 'cle') {
    return [
      `${block} min en continu, allure conversationnelle`,
      'Les 10 dernières minutes un peu plus relâchées',
      'Si la respiration se bloque, ralentir plutôt que raccourcir',
    ];
  }
  return [
    `${block} min souples, sans regarder la montre`,
    'Terminer avec la sensation de pouvoir continuer',
  ];
}

function targetFor(session: PlanSession, reference?: PaceReference): string | undefined {
  if (session.intensity === 'soutenu') {
    if (session.sport === 'velo' && reference?.speedKmh) {
      return `${formatSpeed(reference.speedKmh * 1.05)} sur les blocs, souple entre`;
    }
    if (reference?.paceMinPerKm) {
      return `${formatPace(reference.paceMinPerKm)} sur les blocs, nettement plus lent entre`;
    }
  }
  if (session.sport === 'velo' && reference?.speedKmh) {
    return `${formatSpeed(reference.speedKmh * 0.85)} à ${formatSpeed(reference.speedKmh)}`;
  }
  if (reference?.paceMinPerKm) {
    return `${formatPace(reference.paceMinPerKm * 1.25)} à ${formatPace(
      reference.paceMinPerKm * 1.1,
    )}`;
  }
  return undefined;
}

/**
 * Le contenu d'une séance : échauffement, corps, retour au calme, et une allure
 * située par rapport aux sorties déjà au journal. Rien n'est inventé quand le
 * journal ne donne pas d'allure : la séance reste alors à la sensation.
 */
export function sessionContent(
  session: PlanSession,
  reference?: PaceReference,
): SessionContent {
  return {
    warmup: warmupFor(session.sport),
    main: mainFor(session),
    cooldown: cooldownFor(session.sport),
    target: targetFor(session, reference),
    purpose: KIND_PURPOSE[session.kind],
  };
}

/* --------------------------------------------------------- fin de cycle -- */

/** La semaine affichée : la semaine en cours, ou la dernière si le cycle est fini. */
export function currentWeekIndex(program: Program, today = todayISO()): number {
  const index = program.weeks.findIndex((week) => today >= week.start && today <= week.end);
  if (index >= 0) return index;
  const last = program.weeks[program.weeks.length - 1];
  return last && today > last.end ? program.weeks.length - 1 : 0;
}

/** Vrai quand la dernière semaine du cycle est passée. */
export function cycleComplete(program: Program, today = todayISO()): boolean {
  const last = program.weeks[program.weeks.length - 1];
  return Boolean(last && today > last.end);
}

/** Ce que le cycle a réellement produit, pour la carte de fin de cycle. */
export function cycleSummary(
  program: Program,
  done: Set<string>,
): { done: number; planned: number; minutes: number; weeks: number } {
  const planned = totalPlanned(program);
  const completed = totalDone(program, done);
  return {
    done: completed,
    planned,
    minutes: program.weeks.reduce((sum, week) => sum + week.minutes, 0),
    weeks: program.weeks.length,
  };
}
