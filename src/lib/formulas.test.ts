import { describe, expect, it } from 'vitest';
import {
  acuteChronicRatio,
  bedtimeConsistency,
  bmi,
  bmiLabel,
  caloriesMet,
  consecutiveStreak,
  hrZone,
  maxHrEstimate,
  movingAverage,
  paceMinPerKm,
  readiness,
  sleepDebt,
  sleepScore,
  trainingLoad,
  trendSlope,
  vo2max,
} from './formulas';

describe('formules de secours', () => {
  it('estime la FC max avec Tanaka et borne les extrêmes', () => {
    expect(maxHrEstimate(30)).toBe(187);
    expect(maxHrEstimate(0)).toBe(190);
    expect(maxHrEstimate(120)).toBe(124);
  });

  it('ordonne les zones cardiaques', () => {
    expect(hrZone(100, 190)).toBe(1);
    expect(hrZone(120, 190)).toBe(2);
    expect(hrZone(140, 190)).toBe(3);
    expect(hrZone(155, 190)).toBe(4);
    expect(hrZone(180, 190)).toBe(5);
    expect(hrZone(0, 190)).toBe(0);
  });

  it('fait croître la charge avec la durée et l’intensité', () => {
    expect(trainingLoad(60, 170, 190, 0)).toBeGreaterThan(trainingLoad(60, 130, 190, 0));
    expect(trainingLoad(0, 170, 190, 8)).toBe(0);
    expect(trainingLoad(60, 0, 0, 8)).toBeGreaterThan(trainingLoad(60, 0, 0, 3));
  });

  it('calcule les calories à partir du MET', () => {
    expect(caloriesMet(10, 60, 70)).toBe(700);
    expect(caloriesMet(10, 30, 70)).toBe(350);
    expect(caloriesMet(0, 30, 70)).toBe(0);
  });

  it('récompense une nuit complète', () => {
    expect(sleepScore(480, 4, 8)).toBeGreaterThan(sleepScore(300, 3, 8));
    expect(sleepScore(0, 5, 8)).toBe(0);
    expect(sleepScore(480, 5, 8)).toBe(100);
  });

  it('plafonne la dette de sommeil à 24 h', () => {
    expect(sleepDebt([7, 6, 8], 8)).toBe(3);
    expect(sleepDebt(Array(30).fill(1), 8)).toBe(24);
    expect(sleepDebt([], 8)).toBe(0);
  });

  it('gère un historique de charge vide', () => {
    expect(acuteChronicRatio(0, 0)).toBe(0);
    expect(acuteChronicRatio(100, 0)).toBe(1);
    expect(acuteChronicRatio(150, 100)).toBe(1.5);
  });

  it('fait baisser la forme quand la charge explose', () => {
    const rested = readiness(480, 5, 100, 120, 0);
    const tired = readiness(300, 2, 300, 120, 8);
    expect(rested).toBeGreaterThan(80);
    expect(tired).toBeLessThan(rested);
    expect(readiness(0, 0, 0, 0, 50)).toBeGreaterThanOrEqual(0);
    expect(readiness(0, 0, 0, 0, 50)).toBeLessThanOrEqual(100);
  });

  it('calcule la pente d’une tendance', () => {
    expect(trendSlope([])).toBe(0);
    expect(trendSlope([1])).toBe(0);
    expect(trendSlope([80, 79, 78])).toBeLessThan(0);
    expect(trendSlope([70, 71, 72])).toBeGreaterThan(0);
  });

  it('classe l’IMC', () => {
    expect(bmi(70, 175)).toBe(22.9);
    expect(bmiLabel(22.9)).toBe('Corpulence normale');
    expect(bmiLabel(17)).toBe('Insuffisance pondérale');
    expect(bmiLabel(27)).toBe('Surpoids');
    expect(bmiLabel(31)).toBe('Obésité');
    expect(bmi(0, 175)).toBe(0);
  });

  it('estime l’allure et le VO2 max', () => {
    expect(paceMinPerKm(10, 50)).toBe(5);
    expect(paceMinPerKm(0, 50)).toBe(0);
    expect(vo2max(190, 50)).toBeGreaterThan(50);
    expect(vo2max(190, 0)).toBe(0);
  });

  it('compte une série sans trou', () => {
    expect(consecutiveStreak('1,1,1,0,1')).toBe(3);
    expect(consecutiveStreak('0,1,1')).toBe(0);
    expect(consecutiveStreak('')).toBe(0);
  });

  it('lisse une moyenne mobile', () => {
    expect(movingAverage([10, 20, 30], 2)).toEqual([10, 15, 25]);
    expect(movingAverage([10], 0)).toEqual([]);
  });

  it('gère minuit dans la régularité du coucher', () => {
    expect(bedtimeConsistency([22.5, 22.6, 22.4])).toBeGreaterThan(
      bedtimeConsistency([21, 1, 23.5])
    );
  });
});
