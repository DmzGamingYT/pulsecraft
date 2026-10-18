//! Passerelle WebAssembly. Aucune formule ici : uniquement l'adaptation des
//! types JS (nombres, chaînes) vers les fonctions pures du crate.

use wasm_bindgen::prelude::*;

fn parse_list(csv: &str) -> Vec<f64> {
    csv.split(',')
        .filter_map(|part| part.trim().parse::<f64>().ok())
        .collect()
}

#[wasm_bindgen]
pub fn version() -> String {
    crate::VERSION.to_string()
}

#[wasm_bindgen]
pub fn max_hr_estimate(age: f64) -> f64 {
    crate::max_hr_estimate(age)
}

#[wasm_bindgen]
pub fn hr_zone(avg_hr: f64, max_hr: f64) -> u32 {
    crate::hr_zone(avg_hr, max_hr) as u32
}

#[wasm_bindgen]
pub fn training_load(duration_min: f64, avg_hr: f64, max_hr: f64, rpe: f64) -> f64 {
    crate::training_load(duration_min, avg_hr, max_hr, rpe)
}

#[wasm_bindgen]
pub fn calories_met(met: f64, duration_min: f64, weight_kg: f64) -> f64 {
    crate::calories_met(met, duration_min, weight_kg)
}

#[wasm_bindgen]
pub fn sleep_score(duration_min: f64, quality: f64, target_hours: f64) -> f64 {
    crate::sleep_score(duration_min, quality, target_hours)
}

#[wasm_bindgen]
pub fn sleep_debt_csv(hours_csv: &str, target_hours: f64) -> f64 {
    crate::sleep_debt(&parse_list(hours_csv), target_hours)
}

#[wasm_bindgen]
pub fn acute_chronic_ratio(acute: f64, chronic: f64) -> f64 {
    crate::acute_chronic_ratio(acute, chronic)
}

#[wasm_bindgen]
pub fn readiness(
    sleep_min: f64,
    sleep_quality: f64,
    acute_load: f64,
    chronic_load: f64,
    resting_hr_delta: f64,
) -> f64 {
    crate::readiness(
        sleep_min,
        sleep_quality,
        acute_load,
        chronic_load,
        resting_hr_delta,
    )
}

#[wasm_bindgen]
pub fn trend_slope_csv(values_csv: &str) -> f64 {
    crate::trend_slope(&parse_list(values_csv))
}

#[wasm_bindgen]
pub fn bmi(weight_kg: f64, height_cm: f64) -> f64 {
    crate::bmi(weight_kg, height_cm)
}

#[wasm_bindgen]
pub fn bmi_label(value: f64) -> String {
    crate::bmi_label(value).to_string()
}

#[wasm_bindgen]
pub fn vo2max(max_hr: f64, resting_hr: f64) -> f64 {
    crate::vo2max(max_hr, resting_hr)
}

#[wasm_bindgen]
pub fn pace_min_per_km(distance_km: f64, minutes: f64) -> f64 {
    crate::pace_min_per_km(distance_km, minutes)
}

#[wasm_bindgen]
pub fn consecutive_streak(flags: &str) -> u32 {
    crate::consecutive_streak(flags)
}

#[wasm_bindgen]
pub fn bedtime_consistency_csv(hours_csv: &str) -> f64 {
    crate::bedtime_consistency(&parse_list(hours_csv))
}

#[wasm_bindgen]
pub fn moving_average_csv(values_csv: &str, window: u32) -> String {
    crate::moving_average(&parse_list(values_csv), window as usize)
        .iter()
        .map(|value| value.to_string())
        .collect::<Vec<_>>()
        .join(",")
}
