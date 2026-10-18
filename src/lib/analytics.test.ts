import { describe, expect, it } from 'vitest';
import type { BodyEntry, DayLog, Meal, SleepEntry, Workout } from '../types';
import { DEFAULT_GOALS, DEFAULT_PROFILE } from '../types';
import { addDays } from './dates';
import {
  bodyMetrics,
  calorieSeries,
  latestSleep,
  maxHrOf,
  nutritionToday,
  readinessFor,
  records,
  ringStats,
  sleepStats,
  streakFor,
  summary,
  typeBreakdown,
  weightSeries,
  workoutCalories,
  workoutLoad,
  type DataSlice,
} from './analytics';

const today = '2026-05-10';

function workout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: `w_${Math.random()}`,
    date: today,
    type: 'Course',
    durationMin: 45,
    distanceKm: 8,
    avgHr: 150,
    rpe: 7,
    calories: 450,
    source: 'manuel',
    ...overrides,
  };
}

function data(overrides: Partial<DataSlice> = {}): DataSlice {
  return {
    profile: { ...DEFAULT_PROFILE, name: 'Alice Secret', heightCm: 175, weightKg: 72 },
    goals: { ...DEFAULT_GOALS },
    workouts: [],
    sleeps: [],
    body: [],
    meals: [],
    days: {},
    ...overrides,
  };
}

describe('analytique', () => {
  it('utilise la FC max estimée puis la valeur connue', () => {
    expect(maxHrOf(DEFAULT_PROFILE)).toBeGreaterThan(150);
    expect(maxHrOf({ ...DEFAULT_PROFILE, maxHr: 192 })).toBe(192);
  });

  it('agrège les anneaux sans double compter l’énergie', () => {
    const custom = data({
      workouts: [workout({ durationMin: 30, calories: 300 })],
      days: { [today]: { activeKcal: 500, waterMl: 1500, steps: 8000 } },
    });
    const rings = ringStats(custom, today);
    expect(rings.move.value).toBe(500);
    expect(rings.exercise.value).toBe(30);
    expect(rings.water.value).toBe(1500);
    expect(rings.workoutKcal).toBe(300);
  });

  it('estime les calories d’une séance sans valeur fournie', () => {
    const calories = workoutCalories(workout({ calories: undefined }), 72);
    expect(calories).toBeGreaterThan(500);
  });

  it('calcule une charge positive et nulle pour un repos', () => {
    expect(workoutLoad(workout(), DEFAULT_PROFILE)).toBeGreaterThan(0);
    expect(workoutLoad(workout({ durationMin: 0 }), DEFAULT_PROFILE)).toBe(0);
  });

  it('renvoie une forme nulle sans données', () => {
    const readiness = readinessFor(data(), today);
    expect(readiness.score).toBeNull();
    expect(readiness.hasData).toBe(false);
    expect(readiness.label).toBe('Pas assez de données');
  });

  it('calcule une forme bornée avec sommeil et charge', () => {
    const custom = data({
      sleeps: [
        {
          id: 's1',
          date: today,
          durationMin: 480,
          quality: 5,
          source: 'manuel',
        },
      ],
      workouts: [workout()],
      days: { [today]: { restingHr: 56 } },
    });
    const readiness = readinessFor(custom, today);
    expect(readiness.score).not.toBeNull();
    expect(readiness.score!).toBeGreaterThan(60);
    expect(readiness.score!).toBeLessThanOrEqual(100);
    expect(readiness.sleepScore).toBe(100);
    expect(readiness.ratio).toBeGreaterThan(0);
  });

  it('retrouve la dernière nuit connue avant une date', () => {
    const sleeps: SleepEntry[] = [
      { id: 'a', date: '2026-05-08', durationMin: 440, quality: 3, source: 'manuel' },
      { id: 'b', date: '2026-05-09', durationMin: 460, quality: 4, source: 'manuel' },
    ];
    expect(latestSleep(data({ sleeps }), today)?.id).toBe('b');
  });

  it('résume une semaine', () => {
    const custom = data({
      workouts: [
        workout({ date: today, durationMin: 40, distanceKm: 8, calories: 400 }),
        workout({ date: addDays(today, -2), type: 'Vélo', durationMin: 60, distanceKm: 25, calories: 500 }),
      ],
      sleeps: [{ id: 's', date: today, durationMin: 420, quality: 4, source: 'manuel' }],
      days: { [today]: { steps: 9000 }, [addDays(today, -1)]: { steps: 6000 } },
    });
    const week = summary(custom, today, 7);
    expect(week.sessions).toBe(2);
    expect(week.minutes).toBe(100);
    expect(week.distanceKm).toBe(33);
    expect(week.calories).toBe(900);
    expect(week.activeDays).toBe(2);
    expect(week.steps).toBe(15000);
    expect(week.sleepAvgMin).toBe(420);
  });

  it('compte les jours consécutifs d’activité', () => {
    const custom = data({
      workouts: [workout({ date: today }), workout({ date: addDays(today, -1) })],
    });
    expect(streakFor(custom, today)).toBe(2);
    const withGap = data({
      workouts: [workout({ date: today }), workout({ date: addDays(today, -2) })],
    });
    expect(streakFor(withGap, today)).toBe(1);
  });

  it('calcule la dette et la régularité du sommeil', () => {
    const sleeps: SleepEntry[] = [
      { id: '1', date: today, durationMin: 420, quality: 4, bedtime: '23:00', source: 'manuel' },
      { id: '2', date: addDays(today, -1), durationMin: 360, quality: 3, bedtime: '23:15', source: 'manuel' },
    ];
    const stats = sleepStats(data({ sleeps }), today, 14);
    expect(stats.nights).toBe(2);
    expect(stats.avgMin).toBe(390);
    expect(stats.debtHours).toBe(3);
    expect(stats.consistency).toBeGreaterThan(80);
  });

  it('déduit poids, IMC et variation', () => {
    const body: BodyEntry[] = [
      { id: 'b1', date: today, weightKg: 72.5, source: 'manuel' },
      { id: 'b2', date: addDays(today, -3), weightKg: 73.1, source: 'manuel' },
    ];
    const metrics = bodyMetrics(data({ body }));
    expect(metrics.weight).toBe(72.5);
    expect(metrics.bmi).toBe(23.7);
    expect(metrics.delta).toBeCloseTo(-0.6);
    expect(metrics.bmiLabel).toBe('Corpulence normale');
  });

  it('additionne les repas du jour', () => {
    const meals: Meal[] = [
      { id: 'm1', date: today, name: 'Petit-déj', kcal: 400, protein: 15, carbs: 50, fat: 12 },
      { id: 'm2', date: today, name: 'Déjeuner', kcal: 600, protein: 40, carbs: 60, fat: 20 },
    ];
    const nutrition = nutritionToday(data({ meals }), today);
    expect(nutrition.kcal).toBe(1000);
    expect(nutrition.protein).toBe(55);
    expect(nutrition.meals).toHaveLength(2);
    expect(calorieSeries(data({ meals }), today, 7)).toHaveLength(7);
  });

  it('construit les séries et la répartition', () => {
    const custom = data({ workouts: [workout(), workout({ type: 'Yoga', durationMin: 30 })] });
    expect(weightSeries(custom, today, 30)).toHaveLength(30);
    expect(typeBreakdown(custom, today, 7)[0]?.type).toBe('Course');
    expect(records(custom).some((record) => record.label === 'Série active')).toBe(true);
  });

  it('garde des jours sans activité à zéro dans la série de charge', () => {
    const custom = data({ workouts: [workout({ date: addDays(today, -4) })] });
    const series = weightSeries(custom, today, 5);
    expect(series.every((point) => point.value === null)).toBe(true);
  });

  it('utilise les pas et l’eau du jour', () => {
    const days: Record<string, DayLog> = {
      [today]: { steps: 8123, waterMl: 750, restingHr: 55 },
    };
    const stats = ringStats(data({ days }), today);
    expect(stats.steps).toBe(8123);
    expect(stats.water.value).toBe(750);
  });
});
