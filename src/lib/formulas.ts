/**
 * Formules de secours, en TypeScript pur.
 *
 * Le noyau Rust (`crates/pulse-core`) fait exactement les mêmes calculs et
 * reste la source de vérité. Ce fichier sert quand WebAssembly est indisponible
 * (navigateur ancien, fichier `.wasm` bloqué) *et* de référence lisible pour
 * les tests : chaque formule est volontairement courte et documentée.
 */

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const round = (value: number, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** FC max estimée — Tanaka : 208 − 0,7 × âge. */
export function maxHrEstimate(age: number): number {
  if (!Number.isFinite(age) || age <= 0) return 190;
  return round(clamp(208 - 0.7 * age, 120, 220), 0);
}

/** Zone d'intensité 1 à 5 (0 = inconnue). */
export function hrZone(avgHr: number, maxHr: number): number {
  if (!(avgHr > 0) || !(maxHr > 0)) return 0;
  const ratio = avgHr / maxHr;
  if (ratio < 0.6) return 1;
  if (ratio < 0.7) return 2;
  if (ratio < 0.8) return 3;
  if (ratio < 0.9) return 4;
  return 5;
}

/**
 * Charge d'entraînement (points), TRIMP simplifié : la durée multipliée par une
 * intensité quadratique issue de la FC moyenne, sinon du RPE.
 */
export function trainingLoad(
  durationMin: number,
  avgHr: number,
  maxHr: number,
  rpe: number
): number {
  if (!(durationMin > 0)) return 0;
  let intensity: number;
  if (avgHr > 0 && maxHr > 0) intensity = (avgHr / maxHr - 0.5) / 0.45;
  else if (rpe > 0) intensity = rpe / 10 - 0.1;
  else intensity = 0.5;
  intensity = clamp(intensity, 0.15, 1);
  return round(durationMin * (0.8 + 3.2 * intensity * intensity), 1);
}

/** Calories estimées par le MET de l'activité. */
export function caloriesMet(met: number, durationMin: number, weightKg: number): number {
  if (!(met > 0) || !(durationMin > 0) || !(weightKg > 0)) return 0;
  return Math.round(met * weightKg * (durationMin / 60));
}

/** Score de sommeil 0–100 (60 % durée, 40 % qualité ressentie). */
export function sleepScore(durationMin: number, quality: number, targetHours: number): number {
  if (!(durationMin > 0)) return 0;
  const target = targetHours > 0 ? targetHours * 60 : 480;
  const durationPart = clamp(durationMin / target, 0, 1);
  const qualityPart = clamp((quality - 1) / 4, 0, 1);
  return Math.round(100 * (0.6 * durationPart + 0.4 * qualityPart));
}

/** Dette de sommeil cumulée, en heures, plafonnée à 24 h. */
export function sleepDebt(hours: number[], targetHours: number): number {
  const target = targetHours > 0 ? targetHours : 8;
  const debt = hours
    .filter((h) => Number.isFinite(h) && h >= 0)
    .reduce((sum, h) => sum + Math.max(0, target - h), 0);
  return round(Math.min(debt, 24), 1);
}

/** Ratio charge aiguë (7 j) / chronique (28 j). */
export function acuteChronicRatio(acute: number, chronic: number): number {
  if (!(chronic > 0)) return acute > 0 ? 1 : 0;
  return round(acute / chronic, 2);
}

/** Score de forme 0–100 : sommeil, charge récente, FC de repos. */
export function readiness(
  sleepMin: number,
  sleepQuality: number,
  acuteLoad: number,
  chronicLoad: number,
  restingHrDelta: number
): number {
  const sleepPart = sleepScore(sleepMin, sleepQuality, 8) / 100;
  let loadPart = 0.75;
  if (chronicLoad > 0) {
    const ratio = clamp(acuteLoad / chronicLoad, 0, 3);
    loadPart = clamp(1.15 - ratio * 0.35, 0, 1);
  }
  const rhrPart = clamp(1 - restingHrDelta / 12, 0, 1);
  return round(clamp(100 * (0.5 * sleepPart + 0.32 * loadPart + 0.18 * rhrPart), 0, 100), 1);
}

/** Pente de tendance (moindres carrés). */
export function trendSlope(values: number[]): number {
  const points = values
    .map((value, index) => [index, value] as const)
    .filter(([, value]) => Number.isFinite(value));
  if (points.length < 2) return 0;
  const n = points.length;
  const meanX = points.reduce((sum, [x]) => sum + x, 0) / n;
  const meanY = points.reduce((sum, [, y]) => sum + y, 0) / n;
  let num = 0;
  let den = 0;
  for (const [x, y] of points) {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  }
  return den === 0 ? 0 : round(num / den, 3);
}

export function bmi(weightKg: number, heightCm: number): number {
  if (!(weightKg > 0) || !(heightCm > 0)) return 0;
  const meters = heightCm / 100;
  return round(weightKg / (meters * meters), 1);
}

export function bmiLabel(value: number): string {
  if (!(value > 0)) return '—';
  if (value < 18.5) return 'Insuffisance pondérale';
  if (value < 25) return 'Corpulence normale';
  if (value < 30) return 'Surpoids';
  return 'Obésité';
}

/** VO2 max estimé — Uth–Sørensen : 15 × FC max / FC repos. */
export function vo2max(maxHr: number, restingHr: number): number {
  if (!(maxHr > 0) || !(restingHr > 0)) return 0;
  return round(clamp((15 * maxHr) / restingHr, 10, 90), 1);
}

/** Allure en minutes par kilomètre. */
export function paceMinPerKm(distanceKm: number, minutes: number): number {
  if (!(distanceKm > 0) || !(minutes > 0)) return 0;
  return round(minutes / distanceKm, 2);
}

/** Jours consécutifs depuis la série de drapeaux « 1,1,0,1 ». */
export function consecutiveStreak(flags: string): number {
  let streak = 0;
  for (const flag of flags.split(',')) {
    if (flag.trim() !== '1') break;
    streak += 1;
  }
  return streak;
}

/** Moyenne mobile simple. */
export function movingAverage(values: number[], window: number): number[] {
  if (window <= 0 || values.length === 0) return [];
  return values.map((_, index) => {
    const slice = values.slice(Math.max(0, index - window + 1), index + 1);
    return round(slice.reduce((sum, v) => sum + v, 0) / slice.length, 1);
  });
}

/** Régularité du coucher 0–100 (heures décimales, minuit géré). */
export function bedtimeConsistency(hours: number[]): number {
  const values = hours.filter((h) => Number.isFinite(h)).map((h) => (h < 12 ? h + 24 : h));
  if (values.length < 2) return 100;
  const mean = values.reduce((sum, h) => sum + h, 0) / values.length;
  const variance = values.reduce((sum, h) => sum + (h - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return Math.round(clamp(100 - stdDev * 18, 0, 100));
}
