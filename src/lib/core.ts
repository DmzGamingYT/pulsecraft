/**
 * Chargement du noyau Rust → WebAssembly.
 *
 * Le `.wasm` est livré dans `src/wasm/pulse-core` (généré par
 * `npm run wasm:build`). S'il manque, si WebAssembly est désactivé ou si le
 * fichier ne se charge pas, `formulas.ts` prend le relais : l'interface ne
 * change jamais, seul le moteur de calcul diffère. Le statut est affiché dans
 * les réglages pour rester honnête sur ce qui tourne réellement.
 */

import { useEffect, useState } from 'react';
import init, * as wasm from '../wasm/pulse-core/pulse_core.js';
import wasmUrl from '../wasm/pulse-core/pulse_core_bg.wasm?url';
import * as js from './formulas';

export type CoreStatus = 'loading' | 'wasm' | 'js';

let status: CoreStatus = 'loading';
let started = false;

export async function initCore(): Promise<CoreStatus> {
  if (started) return status;
  started = true;
  try {
    await init({ module_or_path: wasmUrl });
    status = 'wasm';
  } catch (error) {
    console.warn('[PulseCraft] Noyau WASM indisponible, repli JavaScript actif.', error);
    status = 'js';
  }
  return status;
}

export function coreStatus(): CoreStatus {
  return status;
}

export function coreVersion(): string {
  return status === 'wasm' ? wasm.version() : 'js-fallback';
}

/** Statut réactif du noyau, pour l'afficher honnêtement dans les réglages. */
export function useCoreStatus(): CoreStatus {
  const [value, setValue] = useState<CoreStatus>(status);
  useEffect(() => {
    let alive = true;
    void initCore().then((next) => {
      if (alive) setValue(next);
    });
    return () => {
      alive = false;
    };
  }, []);
  return value;
}

const useWasm = () => status === 'wasm';

/* Chaque appel retombe sur la formule TypeScript si le noyau n'est pas prêt. */

export const maxHr = (age: number) =>
  useWasm() ? wasm.max_hr_estimate(age) : js.maxHrEstimate(age);

export const zone = (avgHr: number, maxHrValue: number) =>
  useWasm() ? wasm.hr_zone(avgHr, maxHrValue) : js.hrZone(avgHr, maxHrValue);

export const load = (durationMin: number, avgHr: number, maxHrValue: number, rpe: number) =>
  useWasm()
    ? wasm.training_load(durationMin, avgHr, maxHrValue, rpe)
    : js.trainingLoad(durationMin, avgHr, maxHrValue, rpe);

export const calories = (met: number, durationMin: number, weightKg: number) =>
  useWasm()
    ? wasm.calories_met(met, durationMin, weightKg)
    : js.caloriesMet(met, durationMin, weightKg);

export const sleepScore = (durationMin: number, quality: number, targetHours: number) =>
  useWasm()
    ? wasm.sleep_score(durationMin, quality, targetHours)
    : js.sleepScore(durationMin, quality, targetHours);

export const sleepDebt = (hours: number[], targetHours: number) =>
  useWasm()
    ? wasm.sleep_debt_csv(hours.join(','), targetHours)
    : js.sleepDebt(hours, targetHours);

export const ratio = (acute: number, chronic: number) =>
  useWasm() ? wasm.acute_chronic_ratio(acute, chronic) : js.acuteChronicRatio(acute, chronic);

export const readinessScore = (
  sleepMin: number,
  sleepQuality: number,
  acuteLoad: number,
  chronicLoad: number,
  restingHrDelta: number
) =>
  useWasm()
    ? wasm.readiness(sleepMin, sleepQuality, acuteLoad, chronicLoad, restingHrDelta)
    : js.readiness(sleepMin, sleepQuality, acuteLoad, chronicLoad, restingHrDelta);

export const slope = (values: number[]) =>
  useWasm() ? wasm.trend_slope_csv(values.join(',')) : js.trendSlope(values);

export const bmi = (weightKg: number, heightCm: number) =>
  useWasm() ? wasm.bmi(weightKg, heightCm) : js.bmi(weightKg, heightCm);

export const bmiLabel = (value: number) =>
  useWasm() ? wasm.bmi_label(value) : js.bmiLabel(value);

export const vo2 = (maxHrValue: number, restingHr: number) =>
  useWasm() ? wasm.vo2max(maxHrValue, restingHr) : js.vo2max(maxHrValue, restingHr);

export const pace = (distanceKm: number, minutes: number) =>
  useWasm() ? wasm.pace_min_per_km(distanceKm, minutes) : js.paceMinPerKm(distanceKm, minutes);

export const streak = (flags: string) =>
  useWasm() ? wasm.consecutive_streak(flags) : js.consecutiveStreak(flags);

export const consistency = (hours: number[]) =>
  useWasm() ? wasm.bedtime_consistency_csv(hours.join(',')) : js.bedtimeConsistency(hours);

export const average = (values: number[], window: number) =>
  useWasm()
    ? wasm
        .moving_average_csv(values.join(','), window)
        .split(',')
        .filter(Boolean)
        .map(Number)
    : js.movingAverage(values, window);
