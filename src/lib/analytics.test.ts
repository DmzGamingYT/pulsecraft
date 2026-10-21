import { describe, expect, it } from 'vitest';
import type { Activity, DayLog } from '../types';
import { records, sportSplit, weekBuckets, weekStats } from './analytics';

function activity(
  id: string,
  date: string,
  durationMin: number,
  distanceKm?: number,
  sport: Activity['sport'] = 'course',
): Activity {
  return {
    id,
    date,
    sport,
    title: 'Séance',
    durationMin,
    distanceKm,
    calories: durationMin * 10,
    source: 'manuel',
  };
}

const TODAY = '2026-10-21';

const ACTIVITIES: Activity[] = [
  activity('a', '2026-10-20T08:00:00', 60, 10),
  activity('b', '2026-10-19T18:00:00', 30, undefined, 'musculation'),
  activity('c', '2026-10-14T18:00:00', 45, 8),
  activity('d', '2026-09-30T18:00:00', 90, 20),
];

const DAYS: DayLog[] = [
  { date: '2026-10-20', steps: 10_000 },
  { date: '2026-10-19', steps: 5_000 },
  { date: '2026-10-01', steps: 8_000 },
];

describe('weekStats', () => {
  it('ne garde que les sept derniers jours, aujourd’hui inclus', () => {
    const stats = weekStats(ACTIVITIES, DAYS, TODAY, 150);

    expect(stats.start).toBe('2026-10-15');
    expect(stats.end).toBe('2026-10-21');
    expect(stats.sessions).toBe(2);
    expect(stats.minutes).toBe(90);
    expect(stats.distanceKm).toBe(10);
    expect(stats.calories).toBe(900);
    expect(stats.steps).toBe(15_000);
    expect(stats.bars).toHaveLength(7);
    expect(stats.bars.at(-1)?.day).toBe(TODAY);
    expect(stats.goalPct).toBeCloseTo(0.6);
  });

  it('gère un objectif nul sans division par zéro', () => {
    const stats = weekStats(ACTIVITIES, DAYS, TODAY, 0);
    expect(stats.goalPct).toBe(0);
  });
});

describe('records', () => {
  it('calcule les totaux, la série et la meilleure semaine', () => {
    const marks = records(ACTIVITIES, TODAY);
    expect(marks.totalActivities).toBe(4);
    expect(marks.totalMinutes).toBe(225);
    expect(marks.totalDistanceKm).toBe(38);
    expect(marks.longestMin).toBe(90);
    expect(marks.longestKm).toBe(20);
    expect(marks.streakDays).toBe(2);
    expect(marks.bestWeekMin).toBeGreaterThanOrEqual(90);
  });

  it('ne casse pas la série si aujourd’hui est encore vide', () => {
    expect(records([activity('x', '2026-10-20T08:00:00', 30)], TODAY).streakDays).toBe(1);
  });
});

describe('weekBuckets et sportSplit', () => {
  it('produit huit semaines glissantes, de la plus ancienne à la plus récente', () => {
    const buckets = weekBuckets(ACTIVITIES, 8, TODAY);
    expect(buckets).toHaveLength(8);
    expect(buckets.at(-1)?.end).toBe(TODAY);
    expect(buckets.at(-1)?.minutes).toBe(90);
    expect(buckets.at(-2)?.minutes).toBe(45);
  });

  it('classe les sports par temps actif sur trente jours', () => {
    const slices = sportSplit(ACTIVITIES, 30, TODAY);
    expect(slices[0]?.sport).toBe('course');
    expect(slices[0]?.minutes).toBe(195);
    expect(slices.find((slice) => slice.sport === 'musculation')?.minutes).toBe(30);
  });
});
