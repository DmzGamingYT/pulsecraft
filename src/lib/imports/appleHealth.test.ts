import { describe, expect, it } from 'vitest';
import { AppleHealthParser } from './appleHealth';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="fr_FR">
  <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Watch" unit="count" startDate="2026-05-01 09:00:00 +0200" endDate="2026-05-01 10:00:00 +0200" value="1200"/>
  <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Watch" unit="count" startDate="2026-05-01 10:00:00 +0200" endDate="2026-05-01 11:00:00 +0200" value="800"/>
  <Record type="HKQuantityTypeIdentifierActiveEnergyBurned" unit="kcal" startDate="2026-05-01 09:00:00 +0200" endDate="2026-05-01 10:00:00 +0200" value="240"/>
  <Record type="HKQuantityTypeIdentifierRestingHeartRate" unit="count/min" startDate="2026-05-01 09:00:00 +0200" endDate="2026-05-01 09:00:00 +0200" value="52"/>
  <Record type="HKQuantityTypeIdentifierRestingHeartRate" unit="count/min" startDate="2026-05-01 18:00:00 +0200" endDate="2026-05-01 18:00:00 +0200" value="58"/>
  <Record type="HKQuantityTypeIdentifierDietaryWater" unit="L" startDate="2026-05-01 12:00:00 +0200" endDate="2026-05-01 12:00:00 +0200" value="0.5"/>
  <Record type="HKQuantityTypeIdentifierBodyMass" unit="kg" startDate="2026-05-01 08:00:00 +0200" endDate="2026-05-01 08:00:00 +0200" value="72.4"/>
  <Record type="HKQuantityTypeIdentifierBodyFatPercentage" unit="%" startDate="2026-05-01 08:00:00 +0200" endDate="2026-05-01 08:00:00 +0200" value="0.185"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisInBed" startDate="2026-05-01 22:30:00 +0200" endDate="2026-05-01 23:00:00 +0200"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisAsleepDeep" startDate="2026-05-01 23:00:00 +0200" endDate="2026-05-02 01:00:00 +0200"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisAsleepCore" startDate="2026-05-02 01:00:00 +0200" endDate="2026-05-02 06:00:00 +0200"/>
  <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="45" durationUnit="min" totalDistance="8.2" totalDistanceUnit="km" totalEnergyBurned="520" totalEnergyBurnedUnit="kcal" startDate="2026-05-02 07:00:00 +0200" endDate="2026-05-02 07:45:00 +0200"/>
</HealthData>`;

describe('import Apple Health', () => {
  it('agrège les enregistrements par jour', () => {
    const parser = new AppleHealthParser();
    parser.feed(XML);
    const payload = parser.finish();

    expect(payload.days?.['2026-05-01']).toMatchObject({
      steps: 2000,
      activeKcal: 240,
      restingHr: 55,
      waterMl: 500,
    });
    expect(payload.body?.[0]?.weightKg).toBe(72.4);
    expect(payload.body?.[0]?.bodyFatPct).toBe(18.5);
    expect(payload.body?.[0]?.source).toBe('apple');
  });

  it('rattache le sommeil au jour de réveil et ignore le temps au lit', () => {
    const parser = new AppleHealthParser();
    parser.feed(XML);
    const payload = parser.finish();
    expect(payload.sleeps).toHaveLength(1);
    expect(payload.sleeps?.[0]).toMatchObject({
      date: '2026-05-02',
      durationMin: 420,
      deepMin: 120,
      quality: 4,
      source: 'apple',
    });
  });

  it('convertit une séance Apple en séance PulseCraft', () => {
    const parser = new AppleHealthParser();
    parser.feed(XML);
    const workout = parser.finish().workouts?.[0];
    expect(workout).toMatchObject({
      date: '2026-05-02',
      type: 'Course',
      durationMin: 45,
      distanceKm: 8.2,
      calories: 520,
      source: 'apple',
    });
    expect(workout?.externalId).toContain('apple_w_');
  });

  it('produit le même résultat en flux fragmenté', () => {
    const whole = new AppleHealthParser();
    whole.feed(XML);
    const expected = whole.finish();

    const chunked = new AppleHealthParser();
    for (let index = 0; index < XML.length; index += 137) {
      chunked.feed(XML.slice(index, index + 137));
    }
    const actual = chunked.finish();

    expect(actual.days).toEqual(expected.days);
    expect(actual.sleeps).toEqual(expected.sleeps);
    expect(actual.workouts).toEqual(expected.workouts);
  });

  it('ignore un fichier sans données utiles', () => {
    const parser = new AppleHealthParser();
    parser.feed('<HealthData></HealthData>');
    const payload = parser.finish();
    expect(payload.days).toEqual({});
    expect(payload.workouts).toEqual([]);
  });
});
