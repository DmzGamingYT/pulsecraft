import type { Activity, DayLog, Sport } from '../types';
import { addDays, datePart, lastDays, shortDate, todayISO } from './dates';

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
