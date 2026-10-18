/**
 * Données d'exemple, explicitement signalées dans l'interface.
 *
 * Elles ne sont jamais chargées automatiquement : l'utilisateur clique sur
 * « Explorer avec des données d'exemple ». Les dates sont calculées par rapport
 * à aujourd'hui pour que les anneaux, la semaine et le coach restent cohérents.
 */

import type {
  BodyEntry,
  DayLog,
  Meal,
  SleepEntry,
  Workout,
  WorkoutType,
} from '../types';
import { addDays, todayISO } from './dates';

const PLAN: Array<{
  type: WorkoutType;
  duration: number;
  distance?: number;
  avgHr?: number;
  rpe?: number;
  calories?: number;
}> = [
  { type: 'HIIT', duration: 32, avgHr: 158, rpe: 8, calories: 330 },
  { type: 'Course', duration: 46, distance: 8.2, avgHr: 151, rpe: 7, calories: 470 },
  { type: 'Musculation', duration: 55, avgHr: 118, rpe: 7, calories: 280 },
  { type: 'Vélo', duration: 72, distance: 28.4, avgHr: 134, rpe: 6, calories: 520 },
  { type: 'Yoga', duration: 40, avgHr: 92, rpe: 3, calories: 110 },
  { type: 'Course', duration: 62, distance: 11.6, avgHr: 147, rpe: 7, calories: 640 },
  { type: 'Marche', duration: 38, distance: 3.1, avgHr: 104, rpe: 3, calories: 150 },
  { type: 'Musculation', duration: 48, avgHr: 121, rpe: 6, calories: 250 },
  { type: 'Course', duration: 34, distance: 6.3, avgHr: 162, rpe: 8, calories: 380 },
  { type: 'Natation', duration: 41, distance: 1.4, avgHr: 138, rpe: 6, calories: 350 },
];

export interface DemoData {
  workouts: Workout[];
  sleeps: SleepEntry[];
  body: BodyEntry[];
  meals: Meal[];
  days: Record<string, DayLog>;
}

export function makeDemoData(today = todayISO()): DemoData {
  const workouts: Workout[] = [];
  const sleeps: SleepEntry[] = [];
  const body: BodyEntry[] = [];
  const days: Record<string, DayLog> = {};

  for (let index = 0; index < 42; index += 1) {
    const date = addDays(today, -index);
    const plan = PLAN[index % PLAN.length];
    const restDay = index % 7 === 3 || index % 11 === 6;

    if (plan && !restDay) {
      workouts.push({
        id: `demo_w_${index}`,
        date,
        time: index % 2 === 0 ? '07:20' : '18:10',
        type: plan.type,
        durationMin: plan.duration + (index % 5) - 2,
        distanceKm: plan.distance ? Math.round((plan.distance + (index % 4) * 0.3) * 10) / 10 : undefined,
        avgHr: plan.avgHr ? plan.avgHr - (index % 6) : undefined,
        maxHr: plan.avgHr ? plan.avgHr + 14 : undefined,
        rpe: plan.rpe,
        calories: plan.calories ? plan.calories - (index % 5) * 8 : undefined,
        notes:
          plan.type === 'Course' && index % 5 === 0
            ? 'Sortie souple le long du canal, jambes légères.'
            : undefined,
        source: 'demo',
      });
    }

    const sleepMinutes = 414 + ((index * 37) % 96);
    sleeps.push({
      id: `demo_s_${index}`,
      date,
      durationMin: sleepMinutes,
      deepMin: Math.round(sleepMinutes * 0.21),
      remMin: Math.round(sleepMinutes * 0.23),
      quality: 2 + (index % 4),
      bedtime: index % 3 === 0 ? '23:15' : index % 3 === 1 ? '22:40' : '23:50',
      wake: '07:10',
      source: 'demo',
    });

    if (index % 3 === 0) {
      const weight = 74.8 - index * 0.035 + ((index % 4) - 1.5) * 0.15;
      body.push({
        id: `demo_b_${index}`,
        date,
        weightKg: Math.round(weight * 10) / 10,
        bodyFatPct: Math.round((19.4 - index * 0.018) * 10) / 10,
        muscleKg: Math.round((34.2 + index * 0.012) * 10) / 10,
        waistCm: index % 6 === 0 ? 82 - Math.round(index * 0.04) : undefined,
        source: 'demo',
      });
    }

    days[date] = {
      steps: 5200 + ((index * 1433) % 7600),
      activeKcal: 280 + ((index * 97) % 420),
      restingHr: 56 + (index % 7 === 0 ? 2 : 0) + (index % 5 === 0 ? 1 : 0),
      waterMl: index === 0 ? 1250 : 1600 + ((index * 277) % 900),
    };
  }

  // Aujourd'hui, valeurs choisies pour une démonstration lisible.
  days[today] = { steps: 8420, activeKcal: 520, restingHr: 57, waterMl: 1250 };
  const todaySleep = sleeps[0];
  if (todaySleep) {
    todaySleep.durationMin = 452;
    todaySleep.deepMin = 96;
    todaySleep.remMin = 104;
    todaySleep.quality = 4;
    todaySleep.bedtime = '22:55';
    todaySleep.wake = '06:55';
  }

  const meals: Meal[] = [
    {
      id: 'demo_m_1',
      date: today,
      time: '07:40',
      name: 'Flocons d’avoine, myrtilles, amandes',
      kcal: 430,
      protein: 16,
      carbs: 58,
      fat: 14,
    },
    {
      id: 'demo_m_2',
      date: today,
      time: '12:35',
      name: 'Poulet, riz complet, légumes rôtis',
      kcal: 640,
      protein: 48,
      carbs: 62,
      fat: 18,
    },
    {
      id: 'demo_m_3',
      date: today,
      time: '16:20',
      name: 'Yaourt grec et banane',
      kcal: 260,
      protein: 18,
      carbs: 32,
      fat: 6,
    },
  ];

  return { workouts, sleeps, body, meals, days };
}
