import { describe, expect, it } from 'vitest';
import { parseDelimited, parseSamsungHealthCsv } from './samsung';

describe('import Samsung Health', () => {
  it('additionne les pas par jour', () => {
    const csv = [
      'create_time,step_count,calorie',
      '2026-05-01 08:00:00.000,1500,60',
      '2026-05-01 18:00:00.000,2500,90',
      '2026-05-02 08:00:00.000,1000,40',
    ].join('\n');
    const payload = parseSamsungHealthCsv(csv);
    expect(payload.days?.['2026-05-01']?.steps).toBe(4000);
    expect(payload.days?.['2026-05-02']?.steps).toBe(1000);
  });

  it('convertit une séance (secondes, mètres) et son type', () => {
    const csv = [
      'start_time,duration,distance,calorie,exercise_type,heart_rate,min_heart_rate,max_heart_rate',
      '2026-05-02 07:00:00.000,2700,8200,500,1002,150,120,175',
    ].join('\n');
    const workout = parseSamsungHealthCsv(csv).workouts?.[0];
    expect(workout).toMatchObject({
      date: '2026-05-02',
      type: 'Course',
      durationMin: 45,
      distanceKm: 8.2,
      calories: 500,
      avgHr: 150,
      maxHr: 175,
      source: 'samsung',
    });
  });

  it('lit une nuit Samsung', () => {
    const csv = [
      'sleep_start_time,sleep_end_time',
      '2026-05-01 23:00:00.000,2026-05-02 07:00:00.000',
    ].join('\n');
    const sleep = parseSamsungHealthCsv(csv).sleeps?.[0];
    expect(sleep).toMatchObject({
      date: '2026-05-02',
      durationMin: 480,
      bedtime: '23:00',
      wake: '07:00',
      quality: 5,
      source: 'samsung',
    });
  });

  it('lit une mesure de poids et de masse grasse', () => {
    const csv = ['create_time,weight,body_fat', '2026-05-01 07:00:00.000,72.4,18.5'].join('\n');
    const body = parseSamsungHealthCsv(csv).body?.[0];
    expect(body).toMatchObject({ date: '2026-05-01', weightKg: 72.4, bodyFatPct: 18.5 });
  });

  it('détecte le point-virgule et les champs entre guillemets', () => {
    const csv = [
      'create_time;step_count;commentaire',
      '2026-05-01 08:00:00.000;2000;"marche, matin"',
    ].join('\n');
    expect(parseDelimited(csv, ';')[1]?.[2]).toBe('marche, matin');
    expect(parseSamsungHealthCsv(csv).days?.['2026-05-01']?.steps).toBe(2000);
  });

  it('refuse un CSV sans colonne reconnue', () => {
    expect(() => parseSamsungHealthCsv('foo,bar\n1,2')).toThrow(/date/i);
  });
});
