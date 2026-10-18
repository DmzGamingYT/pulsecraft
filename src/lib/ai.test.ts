import { describe, expect, it } from 'vitest';
import { DEFAULT_GOALS, DEFAULT_PROFILE, type Workout } from '../types';
import type { DataSlice } from './analytics';
import { buildContext, localBriefing, localCoachReply, localPlan, localTodayAdvice } from './ai';
import { addDays } from './dates';

const today = '2026-05-10';

function makeData(overrides: Partial<DataSlice> = {}): DataSlice {
  return {
    profile: {
      ...DEFAULT_PROFILE,
      name: 'Alice Secret',
      birthYear: 1990,
      heightCm: 175,
      weightKg: 72,
      restingHr: 58,
    },
    goals: { ...DEFAULT_GOALS },
    workouts: [],
    sleeps: [],
    body: [],
    meals: [],
    days: {},
    ...overrides,
  };
}

const workout: Workout = {
  id: 'w1',
  date: today,
  type: 'Course',
  durationMin: 45,
  distanceKm: 8,
  avgHr: 150,
  rpe: 7,
  calories: 430,
  notes: 'CONFIDENTIEL-mot-de-passe',
  source: 'manuel',
};

describe('coach local et confidentialité', () => {
  it('ne transmet ni nom, ni note, ni repas dans le contexte', () => {
    const data = makeData({
      workouts: [workout],
      meals: [
        {
          id: 'm1',
          date: today,
          name: 'CONFIDENTIEL-repas',
          kcal: 500,
          protein: 20,
          carbs: 50,
          fat: 20,
        },
      ],
    });
    const context = buildContext(data, today);
    expect(context).not.toContain('Alice');
    expect(context).not.toContain('CONFIDENTIEL');
    expect(context).toContain('Course');
    expect(context).toContain('forme');
  });

  it('propose un point de départ quand le journal est vide', () => {
    const briefing = localBriefing(makeData(), today);
    expect(briefing.toLowerCase()).toContain('journal');
    expect(localTodayAdvice(makeData(), today).toLowerCase()).toContain('données');
  });

  it('adapte le conseil à la forme', () => {
    const data = makeData({
      sleeps: [
        { id: 's', date: today, durationMin: 480, quality: 5, source: 'manuel' },
      ],
      workouts: [workout],
      days: { [today]: { restingHr: 56 } },
    });
    const briefing = localBriefing(data, today);
    expect(briefing).toContain('/100');
    expect(briefing.length).toBeGreaterThan(60);
  });

  it('construit un plan de sept jours avec une règle de prudence', () => {
    const plan = localPlan(makeData());
    for (const day of ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']) {
      expect(plan).toContain(day);
    }
    expect(plan.toLowerCase()).toContain('prudence');
  });

  it('reconnaît les questions fréquentes', () => {
    const data = makeData({
      sleeps: [
        {
          id: 's',
          date: '2026-05-09',
          durationMin: 420,
          quality: 4,
          bedtime: '23:00',
          source: 'manuel',
        },
      ],
    });
    expect(localCoachReply('Comment améliorer mon sommeil ?', data, today)).toMatch(/dormez|sommeil/i);
    expect(localCoachReply('Donne-moi un plan pour la semaine', data, today)).toContain('Lundi');
    expect(localCoachReply('Analyse ma semaine', data, today)).toContain('semaine');
    expect(localCoachReply('Et mon poids ?', data, today)).toContain('poids');
  });

  it('cite des séances récentes sans recopier les notes', () => {
    const data = makeData({ workouts: [workout, { ...workout, id: 'w2', date: addDays(today, -1) }] });
    const context = buildContext(data, today);
    expect(context).toContain('Course');
    expect(context).not.toContain('CONFIDENTIEL');
  });
});
