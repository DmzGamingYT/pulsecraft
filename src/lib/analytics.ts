/**
 * Sélecteurs et indicateurs dérivés.
 *
 * Toutes les fonctions sont pures et reçoivent un `DataSlice` : aucun accès au
 * store, donc testables sans navigateur. Les calculs lourds passent par
 * `core.ts` (wasm, repli JS) ; l'agrégation et la présentation restent ici.
 */

import type {
  BodyEntry,
  DayLog,
  Goals,
  Meal,
  Profile,
  SleepEntry,
  Workout,
} from '../types';
import { WORKOUT_META } from '../types';
import { ageFromBirthYear, addDays, dateRange, daysBetween, parseISODate, todayISO } from './dates';
import * as core from './core';

export interface DataSlice {
  profile: Profile;
  goals: Goals;
  workouts: Workout[];
  sleeps: SleepEntry[];
  body: BodyEntry[];
  meals: Meal[];
  days: Record<string, DayLog>;
}

export function maxHrOf(profile: Profile): number {
  if (profile.maxHr && profile.maxHr > 100) return profile.maxHr;
  return core.maxHr(ageFromBirthYear(profile.birthYear));
}

export function workoutsOn(data: DataSlice, date: string): Workout[] {
  return data.workouts.filter((item) => item.date === date);
}

export function mealsOn(data: DataSlice, date: string): Meal[] {
  return data.meals.filter((item) => item.date === date);
}

export function sleepOn(data: DataSlice, date: string): SleepEntry | undefined {
  return data.sleeps.find((item) => item.date === date);
}

/** Dernière nuit connue à cette date (ou avant), pour ne pas afficher « — » un
 *  jour où l'utilisateur n'a simplement pas encore synchronisé sa montre. */
export function latestSleep(data: DataSlice, date: string): SleepEntry | undefined {
  return data.sleeps
    .filter((item) => item.date <= date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
}

export function latestBody(data: DataSlice, date = todayISO()): BodyEntry | undefined {
  return data.body
    .filter((item) => item.date <= date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
}

export function bodyWeight(data: DataSlice, date = todayISO()): number {
  return latestBody(data, date)?.weightKg ?? data.profile.weightKg;
}

export function workoutCalories(workout: Workout, weightKg: number): number {
  if (workout.calories && workout.calories > 0) return Math.round(workout.calories);
  const meta = WORKOUT_META[workout.type];
  return core.calories(meta.met, workout.durationMin, weightKg);
}

export function workoutLoad(workout: Workout, profile: Profile): number {
  return core.load(
    workout.durationMin,
    workout.avgHr ?? 0,
    workout.maxHr ?? maxHrOf(profile),
    workout.rpe ?? 0
  );
}

export function dayLoad(data: DataSlice, date: string): number {
  return workoutsOn(data, date).reduce(
    (total, workout) => total + workoutLoad(workout, data.profile),
    0
  );
}

export function rangeLoad(data: DataSlice, endDate: string, days: number): number {
  return dateRange(endDate, days).reduce((total, date) => total + dayLoad(data, date), 0);
}

export function ringStats(data: DataSlice, date = todayISO()) {
  const workouts = workoutsOn(data, date);
  const weight = bodyWeight(data, date);
  const workoutKcal = workouts.reduce(
    (total, workout) => total + workoutCalories(workout, weight),
    0
  );
  const activeKcal = data.days[date]?.activeKcal ?? 0;
  const move = Math.max(activeKcal, workoutKcal);
  const exercise = workouts.reduce((total, workout) => total + workout.durationMin, 0);
  const water = data.days[date]?.waterMl ?? 0;

  return {
    move: { value: move, goal: data.goals.moveKcal },
    exercise: { value: exercise, goal: data.goals.exerciseMin },
    water: { value: water, goal: data.goals.waterMl },
    steps: data.days[date]?.steps ?? 0,
    workoutKcal,
  };
}

export interface Readiness {
  score: number | null;
  label: string;
  sleepScore: number;
  loadScore: number;
  rhrScore: number;
  acute: number;
  chronic: number;
  ratio: number;
  restingHr: number;
  sleepMin: number;
  sleepQuality: number;
  hasData: boolean;
}

export function readinessFor(data: DataSlice, date = todayISO()): Readiness {
  const sleep = latestSleep(data, date);
  const sleepMin = sleep?.durationMin ?? 0;
  const sleepQuality = sleep?.quality ?? 0;
  const acute = rangeLoad(data, date, 7);
  const chronic = rangeLoad(data, date, 28) / 4;

  const rhrValues = dateRange(date, 14)
    .map((day) => data.days[day]?.restingHr)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  const baseline =
    rhrValues.length > 0
      ? rhrValues.reduce((sum, value) => sum + value, 0) / rhrValues.length
      : data.profile.restingHr;
  const todayRhr = data.days[date]?.restingHr ?? baseline;
  const delta = todayRhr - baseline;

  const hasData = Boolean(sleep) || acute > 0;
  const score = hasData
    ? core.readinessScore(sleepMin, sleepQuality, acute, chronic, delta)
    : null;

  const sleepFactor = sleep ? core.sleepScore(sleepMin, sleepQuality, data.goals.sleepHours) : 0;
  const loadFactor =
    chronic > 0 ? Math.max(0, Math.min(1, 1.15 - (acute / chronic) * 0.35)) : 0.75;
  const rhrFactor = Math.max(0, Math.min(1, 1 - delta / 12));

  return {
    score,
    label: readinessLabel(score),
    sleepScore: Math.round(sleepFactor),
    loadScore: Math.round(loadFactor * 100),
    rhrScore: Math.round(rhrFactor * 100),
    acute,
    chronic,
    ratio: core.ratio(acute, chronic),
    restingHr: Math.round(todayRhr),
    sleepMin,
    sleepQuality,
    hasData,
  };
}

export function readinessLabel(score: number | null): string {
  if (score === null) return 'Pas assez de données';
  if (score >= 85) return 'Prêt à pousser';
  if (score >= 70) return 'Bonne forme';
  if (score >= 50) return 'À ménager';
  return 'Récupération';
}

export interface Summary {
  sessions: number;
  minutes: number;
  distanceKm: number;
  calories: number;
  load: number;
  activeDays: number;
  steps: number;
  waterMl: number;
  sleepAvgMin: number;
}

export function summary(data: DataSlice, endDate: string, days: number): Summary {
  const dates = dateRange(endDate, days);
  let sessions = 0;
  let minutes = 0;
  let distanceKm = 0;
  let calories = 0;
  let load = 0;
  let activeDays = 0;
  let steps = 0;
  let waterMl = 0;
  let sleepTotal = 0;
  let sleepCount = 0;
  const weight = bodyWeight(data, endDate);

  for (const date of dates) {
    const dayWorkouts = workoutsOn(data, date);
    if (dayWorkouts.length > 0) activeDays += 1;
    for (const workout of dayWorkouts) {
      sessions += 1;
      minutes += workout.durationMin;
      distanceKm += workout.distanceKm ?? 0;
      calories += workoutCalories(workout, weight);
      load += workoutLoad(workout, data.profile);
    }
    steps += data.days[date]?.steps ?? 0;
    waterMl += data.days[date]?.waterMl ?? 0;
    const sleep = sleepOn(data, date);
    if (sleep) {
      sleepTotal += sleep.durationMin;
      sleepCount += 1;
    }
  }

  return {
    sessions,
    minutes,
    distanceKm: Math.round(distanceKm * 10) / 10,
    calories,
    load: Math.round(load),
    activeDays,
    steps,
    waterMl,
    sleepAvgMin: sleepCount > 0 ? Math.round(sleepTotal / sleepCount) : 0,
  };
}

export interface SeriesPoint {
  date: string;
  value: number | null;
}

export function loadSeries(data: DataSlice, endDate: string, days: number): SeriesPoint[] {
  return dateRange(endDate, days).map((date) => ({
    date,
    value: Math.round(dayLoad(data, date)),
  }));
}

export function minutesSeries(data: DataSlice, endDate: string, days: number): SeriesPoint[] {
  return dateRange(endDate, days).map((date) => ({
    date,
    value: workoutsOn(data, date).reduce((total, workout) => total + workout.durationMin, 0),
  }));
}

export function sleepSeries(data: DataSlice, endDate: string, days: number): SeriesPoint[] {
  return dateRange(endDate, days).map((date) => ({
    date,
    value: sleepOn(data, date)?.durationMin ?? null,
  }));
}

export function weightSeries(data: DataSlice, endDate: string, days: number): SeriesPoint[] {
  return dateRange(endDate, days).map((date) => ({
    date,
    value: latestBody(data, date)?.weightKg ?? null,
  }));
}

export function calorieSeries(data: DataSlice, endDate: string, days: number): SeriesPoint[] {
  return dateRange(endDate, days).map((date) => ({
    date,
    value: mealsOn(data, date).reduce((total, meal) => total + meal.kcal, 0),
  }));
}

export function stepsSeries(data: DataSlice, endDate: string, days: number): SeriesPoint[] {
  return dateRange(endDate, days).map((date) => ({
    date,
    value: data.days[date]?.steps ?? 0,
  }));
}

export function streakFor(data: DataSlice, today = todayISO()): number {
  const flags: string[] = [];
  for (let index = 0; index < 365; index += 1) {
    const date = addDays(today, -index);
    flags.push(workoutsOn(data, date).length > 0 ? '1' : '0');
  }
  return core.streak(flags.join(','));
}

export interface SleepStats {
  last: SleepEntry | undefined;
  avgMin: number;
  avgQuality: number;
  debtHours: number;
  consistency: number;
  nights: number;
}

export function sleepStats(data: DataSlice, endDate = todayISO(), days = 14): SleepStats {
  const entries = data.sleeps
    .filter((entry) => entry.date <= endDate && entry.date >= addDays(endDate, -(days - 1)))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const avgMin =
    entries.length > 0
      ? Math.round(entries.reduce((sum, entry) => sum + entry.durationMin, 0) / entries.length)
      : 0;
  const avgQuality =
    entries.length > 0
      ? Math.round((entries.reduce((sum, entry) => sum + entry.quality, 0) / entries.length) * 10) /
        10
      : 0;

  const target = data.goals.sleepHours > 0 ? data.goals.sleepHours : 8;
  const last7 = entries.slice(0, 7).map((entry) => entry.durationMin / 60);
  const bedtimes = entries
    .slice(0, 14)
    .map((entry) => bedtimeHours(entry.bedtime))
    .filter((value): value is number => value !== null);

  return {
    last: entries[0],
    avgMin,
    avgQuality,
    debtHours: core.sleepDebt(last7, target),
    consistency: bedtimes.length >= 2 ? core.consistency(bedtimes) : 0,
    nights: entries.length,
  };
}

/** « 23:15 » → 23,25 ; « 00:40 » → 24,67 (après minuit). */
export function bedtimeHours(bedtime?: string): number | null {
  if (!bedtime) return null;
  const match = bedtime.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const value = hours + minutes / 60;
  return hours < 12 ? value + 24 : value;
}

export function bodyMetrics(data: DataSlice) {
  const latest = latestBody(data);
  const height = data.profile.heightCm ?? 0;
  const weight = latest?.weightKg ?? data.profile.weightKg;
  const value = core.bmi(weight, height);
  const previous = data.body
    .filter((entry) => entry.weightKg && entry.id !== latest?.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const delta = latest?.weightKg && previous?.weightKg ? latest.weightKg - previous.weightKg : 0;
  return {
    latest,
    weight,
    bmi: value,
    bmiLabel: core.bmiLabel(value),
    delta,
    height,
  };
}

export function nutritionToday(data: DataSlice, date = todayISO()) {
  const meals = mealsOn(data, date);
  return {
    meals,
    kcal: meals.reduce((total, meal) => total + meal.kcal, 0),
    protein: meals.reduce((total, meal) => total + meal.protein, 0),
    carbs: meals.reduce((total, meal) => total + meal.carbs, 0),
    fat: meals.reduce((total, meal) => total + meal.fat, 0),
    water: data.days[date]?.waterMl ?? 0,
  };
}

export interface RecordItem {
  label: string;
  value: string;
  detail: string;
}

export function records(data: DataSlice, today = todayISO()): RecordItem[] {
  const items: RecordItem[] = [];
  const withDistance = data.workouts.filter((workout) => (workout.distanceKm ?? 0) >= 2);
  const longest = [...data.workouts].sort((a, b) => b.durationMin - a.durationMin)[0];
  const bestPace = withDistance
    .map((workout) => ({
      workout,
      pace: core.pace(workout.distanceKm ?? 0, workout.durationMin),
    }))
    .filter((entry) => entry.pace > 0)
    .sort((a, b) => a.pace - b.pace)[0];
  const maxHr = [...data.workouts]
    .map((workout) => workout.maxHr ?? workout.avgHr ?? 0)
    .sort((a, b) => b - a)[0];

  const weeks: Array<{ start: string; load: number }> = [];
  for (let index = 0; index < 26; index += 1) {
    const end = addDays(today, -index * 7);
    weeks.push({ start: addDays(end, -6), load: rangeLoad(data, end, 7) });
  }
  const bestWeek = weeks.sort((a, b) => b.load - a.load)[0];

  const streak = streakFor(data, today);

  if (longest) {
    items.push({
      label: 'Séance la plus longue',
      value: `${Math.round(longest.durationMin)} min`,
      detail: `${longest.type} · ${longest.date}`,
    });
  }
  if (bestPace) {
    items.push({
      label: 'Meilleure allure',
      value: formatPace(bestPace.pace),
      detail: `${bestPace.workout.distanceKm} km · ${bestPace.workout.type}`,
    });
  }
  if (bestWeek && bestWeek.load > 0) {
    items.push({
      label: 'Meilleure semaine',
      value: `${Math.round(bestWeek.load)} pts`,
      detail: `semaine du ${bestWeek.start}`,
    });
  }
  if (maxHr && maxHr > 0) {
    items.push({
      label: 'FC max observée',
      value: `${Math.round(maxHr)} bpm`,
      detail: 'sur une séance enregistrée',
    });
  }
  items.push({
    label: 'Série active',
    value: `${streak} ${streak > 1 ? 'jours' : 'jour'}`,
    detail: 'séances consécutives',
  });

  return items;
}

function formatPace(minutesPerKm: number): string {
  const minutes = Math.floor(minutesPerKm);
  const seconds = Math.round((minutesPerKm - minutes) * 60);
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
}

/** Répartition des activités sur une fenêtre, pour les barres de progression. */
export function typeBreakdown(data: DataSlice, endDate: string, days: number) {
  const map = new Map<string, { minutes: number; sessions: number }>();
  for (const workout of data.workouts) {
    if (workout.date < addDays(endDate, -(days - 1)) || workout.date > endDate) continue;
    const current = map.get(workout.type) ?? { minutes: 0, sessions: 0 };
    current.minutes += workout.durationMin;
    current.sessions += 1;
    map.set(workout.type, current);
  }
  return [...map.entries()]
    .map(([type, value]) => ({ type, ...value }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Intensité par jour pour la carte de chaleur (0 à 1). */
export function activityHeatmap(data: DataSlice, today = todayISO(), weeks = 18) {
  const days = weeks * 7;
  const values = dateRange(today, days).map((date) => ({
    date,
    load: dayLoad(data, date),
    minutes: workoutsOn(data, date).reduce((sum, workout) => sum + workout.durationMin, 0),
  }));
  const max = Math.max(1, ...values.map((value) => value.load));
  return values.map((value) => ({ ...value, intensity: value.load / max }));
}

export function daysSince(iso: string, today = todayISO()): number {
  return Math.max(0, daysBetween(iso, today));
}

export function weekdayOf(iso: string): number {
  return (parseISODate(iso).getDay() + 6) % 7;
}
