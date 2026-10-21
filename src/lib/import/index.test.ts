import { describe, expect, it } from 'vitest';
import { parseTextFiles } from './index';

const APPLE = `<?xml version="1.0"?>
<HealthData>
  <Workout workoutActivityType="HKWorkoutActivityTypeYoga" duration="30" durationUnit="min"
    startDate="2026-10-02 08:00:00 +0200" endDate="2026-10-02 08:30:00 +0200"/>
  <Record type="HKQuantityTypeIdentifierStepCount" unit="count" value="2000"
    startDate="2026-10-02 08:00:00 +0200" endDate="2026-10-02 09:00:00 +0200"/>
</HealthData>`;

const SAMSUNG = `start_time,exercise_type,duration
2026-10-03 18:00:00.000,1001,1800000
`;

const STEPS = `day_time,count
2026-10-03 00:00:00.000,5000
`;

describe('parseTextFiles', () => {
  it('reconnaît un XML Apple à son contenu', () => {
    const result = parseTextFiles([{ name: 'export.xml', text: APPLE }]);
    expect(result).toHaveLength(1);
    expect(result[0]?.source).toBe('apple');
    expect(result[0]?.activities).toHaveLength(1);
    expect(result[0]?.days).toHaveLength(1);
  });

  it('regroupe les CSV Samsung et ignore les fichiers étrangers', () => {
    const result = parseTextFiles([
      { name: 'com.samsung.health.exercise.20261005.csv', text: SAMSUNG },
      { name: 'com.samsung.health.step_count.20261005.csv', text: STEPS },
      { name: 'notes.csv', text: 'a,b\n1,2' },
      { name: 'autre.xml', text: '<root/>' },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.source).toBe('samsung');
    expect(result[0]?.activities).toHaveLength(1);
    expect(result[0]?.days).toEqual([{ date: '2026-10-03', steps: 5000 }]);
  });

  it('peut renvoyer les deux sources si les deux sont présentes', () => {
    const result = parseTextFiles([
      { name: 'export.xml', text: APPLE },
      { name: 'com.samsung.health.exercise.csv', text: SAMSUNG },
    ]);
    expect(result.map((item) => item.source)).toEqual(['apple', 'samsung']);
  });

  it('ne détecte rien dans un fichier sans données de santé', () => {
    expect(parseTextFiles([{ name: 'page.xml', text: '<html/>' }])).toEqual([]);
  });
});
