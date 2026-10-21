import { describe, expect, it } from 'vitest';
import { parseAppleHealth } from './apple';

const EXPORT = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="fr_FR">
  <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Watch de test" unit="count" value="1200" startDate="2026-10-01 08:00:00 +0200" endDate="2026-10-01 09:00:00 +0200"/>
  <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Watch de test" unit="count" value="900" startDate="2026-10-01 18:00:00 +0200" endDate="2026-10-01 19:00:00 +0200"/>
  <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone de test" unit="count" value="1800" startDate="2026-10-01 12:00:00 +0200" endDate="2026-10-01 13:00:00 +0200"/>
  <Record type="HKQuantityTypeIdentifierActiveEnergyBurned" sourceName="Watch de test" unit="kcal" value="300" startDate="2026-10-01 08:00:00 +0200" endDate="2026-10-01 09:00:00 +0200"/>
  <Record type="HKQuantityTypeIdentifierActiveEnergyBurned" sourceName="iPhone de test" unit="kcal" value="500" startDate="2026-10-01 12:00:00 +0200" endDate="2026-10-01 13:00:00 +0200"/>
  <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Watch de test" unit="count/min" value="88" startDate="2026-10-01 10:00:00 +0200"/>
  <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="42.5" durationUnit="min"
    totalDistance="7.42" totalDistanceUnit="km" totalEnergyBurned="410" totalEnergyBurnedUnit="kcal"
    startDate="2026-10-01 07:30:00 +0200" endDate="2026-10-01 08:12:30 +0200">
    <WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate" average="152" maximum="174" unit="count/min"/>
    <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceWalkingRunning" sum="7.42" unit="km"/>
  </Workout>
  <Workout workoutActivityType="HKWorkoutActivityTypeCycling" duration="1.25" durationUnit="hour"
    totalDistance="1800" totalDistanceUnit="m" totalEnergyBurned="700" totalEnergyBurnedUnit="kJ"
    startDate="2026-10-03 16:00:00 +0200" endDate="2026-10-03 17:15:00 +0200"/>
</HealthData>`;

describe('parseAppleHealth', () => {
  it('lit les séances avec leurs unités', () => {
    const result = parseAppleHealth(EXPORT, 'export.xml');

    expect(result.source).toBe('apple');
    expect(result.activities).toHaveLength(2);

    const [run, ride] = result.activities;
    expect(run).toMatchObject({
      sport: 'course',
      title: 'Course à pied',
      durationMin: 43,
      distanceKm: 7.42,
      calories: 410,
      avgHr: 152,
      maxHr: 174,
      source: 'apple',
    });
    expect(run?.date).toBe('2026-10-01T07:30:00+02:00');
    expect(run?.externalId).toContain('apple:2026-10-01T07:30:00+02:00');

    expect(ride).toMatchObject({
      sport: 'velo',
      durationMin: 75,
      distanceKm: 1.8,
      calories: 167,
    });
  });

  it('déduplique les pas entre appareils et convertit les calories', () => {
    const result = parseAppleHealth(EXPORT);
    const day = result.days.find((item) => item.date === '2026-10-01');

    // Watch : 1200 + 900 = 2100 ; iPhone : 1800 → le maximum, pas la somme.
    expect(day?.steps).toBe(2100);
    expect(day?.activeCalories).toBe(500);
    expect(result.warnings.join(' ')).toContain('Plusieurs appareils');
  });

  it('ne signale rien quand un seul appareil fournit les pas', () => {
    const result = parseAppleHealth(
      '<HealthData><Record type="HKQuantityTypeIdentifierStepCount" sourceName="Watch" unit="count" value="900" startDate="2026-10-02 08:00:00 +0200"/></HealthData>',
    );
    expect(result.warnings).toEqual([]);
  });

  it('signale un fichier qui n’est pas un export Santé', () => {
    const result = parseAppleHealth('<html><body>bonjour</body></html>', 'page.xml');
    expect(result.activities).toHaveLength(0);
    expect(result.warnings[0]).toContain('export Santé');
  });

  it('ignore une séance sans date lisible, sans faire échouer le reste', () => {
    const result = parseAppleHealth(
      '<HealthData><Workout workoutActivityType="HKWorkoutActivityTypeYoga" duration="30" durationUnit="min" startDate="pas une date"/></HealthData>',
    );
    expect(result.activities).toHaveLength(0);
    expect(result.warnings.join(' ')).toContain('sans date');
  });
});
