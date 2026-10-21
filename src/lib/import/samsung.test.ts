import { describe, expect, it } from 'vitest';
import { parseSamsungHealth } from './samsung';

const EXERCISE = `com.samsung.health.exercise
version,2.0
datauuid,com.samsung.health.exercise.start_time,com.samsung.health.exercise.exercise_type,com.samsung.health.exercise.duration,com.samsung.health.exercise.distance,com.samsung.health.exercise.total_calorie,com.samsung.health.exercise.mean_heart_rate,com.samsung.health.exercise.max_heart_rate,com.samsung.health.exercise.comment
ex-1,2026-10-01 07:30:00.000,1002,2520000,7420,410,152,174,
ex-2,2026-10-03 16:00:00.000,11007,4500000,24600,520,134,158,,
ex-3,2026-10-05 18:00:00.000,99999,1800000,,,120,,Escalade
`;

const STEPS = `com.samsung.health.step_count
version,2.0
com.samsung.health.step_count.start_time,com.samsung.health.step_count.count
2026-10-01 00:00:00.000,4000
2026-10-01 12:00:00.000,4500
2026-10-02 00:00:00.000,3200
`;

describe('parseSamsungHealth', () => {
  it('lit les séances malgré les en-têtes préfixés et les métadonnées', () => {
    const result = parseSamsungHealth([
      { name: 'com.samsung.health.exercise.20261005.csv', text: EXERCISE },
    ]);

    expect(result.source).toBe('samsung');
    expect(result.activities).toHaveLength(3);

    const [run, ride, climb] = result.activities;
    expect(run).toMatchObject({
      date: '2026-10-01T07:30:00',
      sport: 'course',
      durationMin: 42,
      distanceKm: 7.42,
      calories: 410,
      avgHr: 152,
      maxHr: 174,
      source: 'samsung',
      externalId: 'samsung:ex-1',
    });
    expect(ride).toMatchObject({ sport: 'velo', durationMin: 75, distanceKm: 24.6 });
    expect(climb).toMatchObject({ sport: 'autre', title: 'Escalade', durationMin: 30 });
    expect(result.warnings.join(' ')).toContain('non reconnu');
  });

  it('additionne les pas d’une journée et les trie', () => {
    const result = parseSamsungHealth([
      { name: 'com.samsung.health.step_count.20261005.csv', text: STEPS },
    ]);
    expect(result.days).toEqual([
      { date: '2026-10-01', steps: 8500 },
      { date: '2026-10-02', steps: 3200 },
    ]);
  });

  it('accepte un horodatage en millisecondes', () => {
    const result = parseSamsungHealth([
      {
        name: 'com.samsung.health.exercise.20261005.csv',
        text: 'start_time,exercise_type,duration\n1759300200000,1001,1200000\n',
      },
    ]);
    expect(result.activities).toHaveLength(1);
    expect(result.activities[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.activities[0]?.durationMin).toBe(20);
  });

  it('explique ce qui manque quand seuls des pas sont fournis', () => {
    const result = parseSamsungHealth([
      { name: 'com.samsung.health.step_count.csv', text: STEPS },
    ]);
    expect(result.activities).toHaveLength(0);
    expect(result.warnings.join(' ')).toContain('séances');
  });

  it('ne choisit qu’un fichier de pas pour éviter de compter deux fois', () => {
    const result = parseSamsungHealth([
      { name: 'com.samsung.health.step_count.csv', text: STEPS },
      { name: 'com.samsung.health.step_count_summary.csv', text: STEPS },
    ]);
    expect(result.days.find((day) => day.date === '2026-10-01')?.steps).toBe(8500);
  });
});
