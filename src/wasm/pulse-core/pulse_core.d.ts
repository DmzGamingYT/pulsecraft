/* tslint:disable */
/* eslint-disable */

export function acute_chronic_ratio(acute: number, chronic: number): number;

export function bedtime_consistency_csv(hours_csv: string): number;

export function bmi(weight_kg: number, height_cm: number): number;

export function bmi_label(value: number): string;

export function calories_met(met: number, duration_min: number, weight_kg: number): number;

export function consecutive_streak(flags: string): number;

export function hr_zone(avg_hr: number, max_hr: number): number;

export function max_hr_estimate(age: number): number;

export function moving_average_csv(values_csv: string, window: number): string;

export function pace_min_per_km(distance_km: number, minutes: number): number;

export function readiness(sleep_min: number, sleep_quality: number, acute_load: number, chronic_load: number, resting_hr_delta: number): number;

export function sleep_debt_csv(hours_csv: string, target_hours: number): number;

export function sleep_score(duration_min: number, quality: number, target_hours: number): number;

export function training_load(duration_min: number, avg_hr: number, max_hr: number, rpe: number): number;

export function trend_slope_csv(values_csv: string): number;

export function version(): string;

export function vo2max(max_hr: number, resting_hr: number): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly acute_chronic_ratio: (a: number, b: number) => number;
    readonly bedtime_consistency_csv: (a: number, b: number) => number;
    readonly bmi: (a: number, b: number) => number;
    readonly bmi_label: (a: number) => [number, number];
    readonly calories_met: (a: number, b: number, c: number) => number;
    readonly consecutive_streak: (a: number, b: number) => number;
    readonly hr_zone: (a: number, b: number) => number;
    readonly max_hr_estimate: (a: number) => number;
    readonly moving_average_csv: (a: number, b: number, c: number) => [number, number];
    readonly pace_min_per_km: (a: number, b: number) => number;
    readonly readiness: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly sleep_debt_csv: (a: number, b: number, c: number) => number;
    readonly sleep_score: (a: number, b: number, c: number) => number;
    readonly training_load: (a: number, b: number, c: number, d: number) => number;
    readonly trend_slope_csv: (a: number, b: number) => number;
    readonly version: () => [number, number];
    readonly vo2max: (a: number, b: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
