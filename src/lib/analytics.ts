import type { Activity, DayLog, Sport } from '../types';
import {
  addDays,
  datePart,
  lastDays,
  mondayOf,
  monthLabel,
  parseDay,
  shortDate,
  todayISO,
} from './dates';

export interface DayBar {
  day: string;
  label: string;
  minutes: number;
}

export interface WeekStats {
  start: string;
  end: string;
  minutes: number;
  distanceKm: number;
  calories: number;
  sessions: number;
  steps: number;
  goalMin: number;
  goalPct: number;
  bars: DayBar[];
}

/** Les séances dont la date locale tombe dans `[start, end]`. */
export function activitiesBetween(
  activities: Activity[],
  start: string,
  end: string,
): Activity[] {
  return activities.filter((activity) => {
    const day = datePart(activity.date);
    return day >= start && day <= end;
  });
}

export function sumDays(days: DayLog[], start: string, end: string): { steps: number; activeCalories: number } {
  let steps = 0;
  let activeCalories = 0;
  for (const log of days) {
    if (log.date < start || log.date > end) continue;
    steps += log.steps ?? 0;
    activeCalories += log.activeCalories ?? 0;
  }
  return { steps, activeCalories };
}

/** Le résumé de la semaine glissante de sept jours qui finit aujourd'hui. */
export function weekStats(
  activities: Activity[],
  days: DayLog[],
  today = todayISO(),
  goalMin = 150,
): WeekStats {
  const start = addDays(today, -6);
  const selected = activitiesBetween(activities, start, endOf(today));
  const totals = selected.reduce(
    (acc, activity) => {
      acc.minutes += activity.durationMin;
      acc.distanceKm += activity.distanceKm ?? 0;
      acc.calories += activity.calories ?? 0;
      return acc;
    },
    { minutes: 0, distanceKm: 0, calories: 0 },
  );
  const steps = sumDays(days, start, today).steps;

  const bars = lastDays(7, today).map((day) => {
    const minutes = selected
      .filter((activity) => datePart(activity.date) === day)
      .reduce((sum, activity) => sum + activity.durationMin, 0);
    return { day, label: shortDate(day), minutes };
  });

  return {
    start,
    end: today,
    minutes: Math.round(totals.minutes),
    distanceKm: totals.distanceKm,
    calories: Math.round(totals.calories),
    sessions: selected.length,
    steps,
    goalMin,
    goalPct: goalMin > 0 ? Math.min(1, totals.minutes / goalMin) : 0,
    bars,
  };
}

export interface WeekBucket {
  start: string;
  end: string;
  minutes: number;
  sessions: number;
}

/** Huit semaines glissantes, de la plus ancienne à la plus récente. */
export function weekBuckets(
  activities: Activity[],
  count = 8,
  today = todayISO(),
): WeekBucket[] {
  const buckets: WeekBucket[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const end = addDays(today, -index * 7);
    const start = addDays(end, -6);
    const selected = activitiesBetween(activities, start, endOf(end));
    buckets.push({
      start,
      end,
      minutes: Math.round(selected.reduce((sum, activity) => sum + activity.durationMin, 0)),
      sessions: selected.length,
    });
  }
  return buckets;
}

export interface SportSlice {
  sport: Sport;
  minutes: number;
  sessions: number;
}

export function sportSplit(activities: Activity[], days = 30, today = todayISO()): SportSlice[] {
  const start = addDays(today, -(days - 1));
  const map = new Map<Sport, SportSlice>();
  for (const activity of activitiesBetween(activities, start, endOf(today))) {
    const slice = map.get(activity.sport) ?? { sport: activity.sport, minutes: 0, sessions: 0 };
    slice.minutes += activity.durationMin;
    slice.sessions += 1;
    map.set(activity.sport, slice);
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes);
}

export interface Records {
  totalActivities: number;
  totalMinutes: number;
  totalDistanceKm: number;
  longestMin: number;
  longestKm: number;
  bestWeekMin: number;
  /** jours consécutifs avec une séance (ancienne mesure, gardée pour le calcul) */
  streakDays: number;
}

export function records(activities: Activity[], today = todayISO()): Records {
  let totalMinutes = 0;
  let totalDistanceKm = 0;
  let longestMin = 0;
  let longestKm = 0;
  for (const activity of activities) {
    totalMinutes += activity.durationMin;
    totalDistanceKm += activity.distanceKm ?? 0;
    longestMin = Math.max(longestMin, activity.durationMin);
    longestKm = Math.max(longestKm, activity.distanceKm ?? 0);
  }

  const byDay = new Set(activities.map((activity) => datePart(activity.date)));
  let streak = 0;
  let cursor = today;
  // Une journée sans séance ne casse pas la série si elle est la journée en
  // cours : on commence à hier dans ce cas.
  if (!byDay.has(cursor)) cursor = addDays(cursor, -1);
  while (byDay.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return {
    totalActivities: activities.length,
    totalMinutes: Math.round(totalMinutes),
    totalDistanceKm,
    longestMin,
    longestKm,
    bestWeekMin: Math.max(0, ...weekBuckets(activities, 12, today).map((week) => week.minutes)),
    streakDays: streak,
  };
}

/** La fin de journée inclusive, pour comparer des dates locales. */
function endOf(day: string): string {
  return `${day}T23:59:59.999`;
}

/* ------------------------------------------------------------- deltas -- */

/** L'écart relatif, en pourcentage, ou `null` quand il n'y a pas de base. */
export function changePct(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export interface WeekChange {
  previous: WeekStats;
  minutes: number | null;
  sessions: number | null;
  distanceKm: number | null;
  steps: number | null;
}

/**
 * Les sept jours précédents, pour dire « +12 % vs la semaine dernière ».
 * La fenêtre glissante est la même que celle d'`weekStats`, décalée de sept
 * jours : les deux périodes ne se chevauchent jamais.
 */
export function weekChange(
  activities: Activity[],
  days: DayLog[],
  today = todayISO(),
  goalMin = 150,
): WeekChange {
  const current = weekStats(activities, days, today, goalMin);
  const previous = weekStats(activities, days, addDays(today, -7), goalMin);
  return {
    previous,
    minutes: changePct(current.minutes, previous.minutes),
    sessions: changePct(current.sessions, previous.sessions),
    distanceKm: changePct(current.distanceKm, previous.distanceKm),
    steps: changePct(current.steps, previous.steps),
  };
}

/* ---------------------------------------------------------- records -- */

export interface SportRecord {
  sport: Sport;
  sessions: number;
  minutes: number;
  distanceKm: number;
  longestMin: number;
  longestKm: number;
  /** meilleure allure (min/km) sur une sortie d'au moins 5 km */
  bestPace: number | null;
  /** meilleure vitesse (km/h) sur une sortie d'au moins 10 km */
  bestSpeed: number | null;
}

/**
 * Les records se lisent par discipline, pas seulement au total : le plus long
 * vélo et la meilleure allure de course ne se comparent pas.
 */
export function sportRecords(activities: Activity[]): SportRecord[] {
  const map = new Map<Sport, SportRecord>();

  for (const activity of activities) {
    const record = map.get(activity.sport) ?? {
      sport: activity.sport,
      sessions: 0,
      minutes: 0,
      distanceKm: 0,
      longestMin: 0,
      longestKm: 0,
      bestPace: null,
      bestSpeed: null,
    };
    record.sessions += 1;
    record.minutes += activity.durationMin;
    record.longestMin = Math.max(record.longestMin, activity.durationMin);

    const km = activity.distanceKm ?? 0;
    record.distanceKm += km;
    record.longestKm = Math.max(record.longestKm, km);

    if (km >= 5 && activity.durationMin > 0) {
      const pace = activity.durationMin / km;
      if (record.bestPace === null || pace < record.bestPace) record.bestPace = pace;
    }
    if (km >= 10 && activity.durationMin > 0) {
      const speed = km / (activity.durationMin / 60);
      if (record.bestSpeed === null || speed > record.bestSpeed) record.bestSpeed = speed;
    }

    map.set(activity.sport, record);
  }

  return [...map.values()].sort((a, b) => b.minutes - a.minutes);
}

/* -------------------------------------------------------- zones cardiaques -- */

export interface HrZone {
  zone: number;
  label: string;
  minutes: number;
}

/**
 * Le temps passé par zone cardiaque.
 *
 * Une séance ne donne ici que sa fréquence moyenne : on lui attribue donc la
 * zone de cette moyenne, et on le dit. C'est une estimation honnête, pas une
 * courbe minute par minute qu'on n'a pas.
 */
export function hrZones(activities: Activity[], maxHr = 0): { maxHr: number; zones: HrZone[] } {
  const observed = activities.reduce(
    (best, activity) => Math.max(best, activity.maxHr ?? 0, activity.avgHr ?? 0),
    0,
  );
  const reference = maxHr > 0 ? maxHr : observed || 190;
  const bands = [
    { zone: 1, label: 'Récupération', from: 0, to: 0.6 },
    { zone: 2, label: 'Endurance', from: 0.6, to: 0.7 },
    { zone: 3, label: 'Tempo', from: 0.7, to: 0.8 },
    { zone: 4, label: 'Seuil', from: 0.8, to: 0.9 },
    { zone: 5, label: 'VO2 max', from: 0.9, to: 1.2 },
  ];
  const zones: HrZone[] = bands.map((band) => ({ zone: band.zone, label: band.label, minutes: 0 }));

  for (const activity of activities) {
    if (!activity.avgHr) continue;
    const ratio = activity.avgHr / reference;
    const band = bands.find((entry) => ratio >= entry.from && ratio < entry.to) ?? bands[bands.length - 1];
    if (!band) continue;
    const zone = zones.find((entry) => entry.zone === band.zone);
    if (zone) zone.minutes += activity.durationMin;
  }

  return { maxHr: reference, zones };
}

/* ------------------------------------------------------------ mois -- */

export interface MonthStats {
  start: string;
  end: string;
  label: string;
  sessions: number;
  minutes: number;
  distanceKm: number;
  calories: number;
  steps: number;
  sleepMin: number;
  activeDays: number;
}

/** Le mois civil qui contient `today`, décalé de `offset` mois (0 = courant). */
export function monthStats(
  activities: Activity[],
  days: DayLog[],
  today = todayISO(),
  offset = 0,
): MonthStats {
  const date = parseDay(today);
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);
  const start = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const end = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(
    last.getDate(),
  ).padStart(2, '0')}`;
  const selected = activitiesBetween(activities, start, endOf(end));
  const totals = selected.reduce(
    (acc, activity) => {
      acc.minutes += activity.durationMin;
      acc.distanceKm += activity.distanceKm ?? 0;
      acc.calories += activity.calories ?? 0;
      return acc;
    },
    { minutes: 0, distanceKm: 0, calories: 0 },
  );
  const dayLogs = days.filter((log) => log.date >= start && log.date <= end);

  return {
    start,
    end,
    label: monthLabel(start),
    sessions: selected.length,
    minutes: Math.round(totals.minutes),
    distanceKm: totals.distanceKm,
    calories: Math.round(totals.calories),
    steps: dayLogs.reduce((sum, log) => sum + (log.steps ?? 0), 0),
    sleepMin: dayLogs.reduce((sum, log) => sum + (log.sleepMin ?? 0), 0),
    activeDays: new Set(selected.map((activity) => datePart(activity.date))).size,
  };
}

/* ------------------------------------------------- semaines réussies -- */

export interface GoalWeek {
  start: string;
  end: string;
  minutes: number;
  sessions: number;
  met: boolean;
  /** la semaine en cours n'est pas close : elle ne casse pas la série */
  current: boolean;
}

/** Les `count` dernières semaines civiles (lundi→dimanche), la dernière étant celle en cours. */
export function goalWeeks(
  activities: Activity[],
  goalMin: number,
  count = 8,
  today = todayISO(),
): GoalWeek[] {
  const weeks: GoalWeek[] = [];
  const currentMonday = mondayOf(today);
  for (let index = count - 1; index >= 0; index -= 1) {
    const start = addDays(currentMonday, -index * 7);
    const end = addDays(start, 6);
    const selected = activitiesBetween(activities, start, endOf(end));
    const minutes = Math.round(selected.reduce((sum, activity) => sum + activity.durationMin, 0));
    weeks.push({
      start,
      end,
      minutes,
      sessions: selected.length,
      met: goalMin > 0 && minutes >= goalMin,
      current: start === currentMonday,
    });
  }
  return weeks;
}

/**
 * Les semaines consécutives où l'objectif a été atteint, en remontant depuis la
 * semaine en cours. Une semaine en cours incomplète ne casse pas la série.
 */
export function goalStreak(
  activities: Activity[],
  goalMin: number,
  today = todayISO(),
): number {
  if (goalMin <= 0) return 0;
  const weeks = goalWeeks(activities, goalMin, 12, today);
  let streak = 0;
  for (let index = weeks.length - 1; index >= 0; index -= 1) {
    const week = weeks[index];
    if (!week) continue;
    if (week.met) {
      streak += 1;
      continue;
    }
    if (week.current) continue; // la semaine en cours n'a pas encore dit son mot
    break;
  }
  return streak;
}
