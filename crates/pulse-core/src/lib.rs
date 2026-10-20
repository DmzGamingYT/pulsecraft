//! Noyau de calcul de Battement.
//!
//! Toutes les fonctions sont pures et testées nativement (`cargo test`). Les
//! wrappers WebAssembly (module `wasm`) ne font que les exposer au navigateur.
//! Les formules restent volontairement simples et lisibles : un suivi sportif
//! grand public doit pouvoir expliquer chaque chiffre qu'il affiche.

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Fréquence cardiaque maximale estimée (Tanaka : 208 − 0,7 × âge).
pub fn max_hr_estimate(age: f64) -> f64 {
    if age <= 0.0 {
        return 190.0;
    }
    let value = 208.0 - 0.7 * age;
    value.clamp(120.0, 220.0)
}

/// Zone d'intensité (1 à 5) pour une FC moyenne rapportée à la FC max.
pub fn hr_zone(avg_hr: f64, max_hr: f64) -> u8 {
    if avg_hr <= 0.0 || max_hr <= 0.0 {
        return 0;
    }
    let ratio = avg_hr / max_hr;
    if ratio < 0.6 {
        1
    } else if ratio < 0.7 {
        2
    } else if ratio < 0.8 {
        3
    } else if ratio < 0.9 {
        4
    } else {
        5
    }
}

/// Charge d'entraînement en points arbitraires (proche d'un TRIMP simplifié).
///
/// L'intensité vient de la FC moyenne quand elle existe, sinon de l'effort
/// perçu (RPE 1–10), sinon d'une valeur modérée. Le résultat croît avec la
/// durée et quadratiquement avec l'intensité.
pub fn training_load(duration_min: f64, avg_hr: f64, max_hr: f64, rpe: f64) -> f64 {
    if duration_min <= 0.0 {
        return 0.0;
    }
    let intensity = if avg_hr > 0.0 && max_hr > 0.0 {
        ((avg_hr / max_hr) - 0.5) / 0.45
    } else if rpe > 0.0 {
        (rpe / 10.0) - 0.1
    } else {
        0.5
    }
    .clamp(0.15, 1.0);

    let load = duration_min * (0.8 + 3.2 * intensity * intensity);
    (load * 10.0).round() / 10.0
}

/// Calories estimées à partir du MET de l'activité.
pub fn calories_met(met: f64, duration_min: f64, weight_kg: f64) -> f64 {
    if met <= 0.0 || duration_min <= 0.0 || weight_kg <= 0.0 {
        return 0.0;
    }
    let kcal = met * weight_kg * (duration_min / 60.0);
    kcal.round()
}

/// Score de sommeil 0–100 : 60 % de durée, 40 % de qualité perçue.
pub fn sleep_score(duration_min: f64, quality: f64, target_hours: f64) -> f64 {
    if duration_min <= 0.0 {
        return 0.0;
    }
    let target = if target_hours > 0.0 {
        target_hours * 60.0
    } else {
        480.0
    };
    let duration_part = (duration_min / target).clamp(0.0, 1.0);
    let quality_part = ((quality - 1.0) / 4.0).clamp(0.0, 1.0);
    (100.0 * (0.6 * duration_part + 0.4 * quality_part)).round()
}

/// Dette de sommeil cumulée, en heures, sur une liste de nuits (heures).
pub fn sleep_debt(hours: &[f64], target_hours: f64) -> f64 {
    let target = if target_hours > 0.0 {
        target_hours
    } else {
        8.0
    };
    let debt: f64 = hours
        .iter()
        .filter(|h| h.is_finite() && **h >= 0.0)
        .map(|h| (target - h).max(0.0))
        .sum();
    (debt.min(24.0) * 10.0).round() / 10.0
}

/// Ratio de charge aiguë / chronique (7 j / 28 j), indicateur de surcharge.
///
/// Sous 0,8 : désentraînement relatif. Entre 0,8 et 1,3 : zone favorable.
/// Au-delà de 1,5 : progression rapide, risque de fatigue accumulée.
pub fn acute_chronic_ratio(acute: f64, chronic: f64) -> f64 {
    if chronic <= 0.0 {
        return if acute > 0.0 { 1.0 } else { 0.0 };
    }
    let ratio = acute / chronic;
    (ratio * 100.0).round() / 100.0
}

/// Score de forme 0–100 (sommeil, charge récente, FC de repos).
pub fn readiness(
    sleep_min: f64,
    sleep_quality: f64,
    acute_load: f64,
    chronic_load: f64,
    resting_hr_delta: f64,
) -> f64 {
    let sleep_part = sleep_score(sleep_min, sleep_quality, 8.0) / 100.0;

    let load_part = if chronic_load <= 0.0 {
        0.75
    } else {
        let ratio = (acute_load / chronic_load).clamp(0.0, 3.0);
        (1.15 - ratio * 0.35).clamp(0.0, 1.0)
    };

    let rhr_part = (1.0 - (resting_hr_delta / 12.0)).clamp(0.0, 1.0);

    let score = 100.0 * (0.5 * sleep_part + 0.32 * load_part + 0.18 * rhr_part);
    (score.clamp(0.0, 100.0) * 10.0).round() / 10.0
}

/// Pente d'une tendance (moindres carrés), dans l'unité des valeurs par point.
pub fn trend_slope(values: &[f64]) -> f64 {
    let points: Vec<(f64, f64)> = values
        .iter()
        .enumerate()
        .filter(|(_, v)| v.is_finite())
        .map(|(i, v)| (i as f64, *v))
        .collect();
    if points.len() < 2 {
        return 0.0;
    }
    let n = points.len() as f64;
    let mean_x = points.iter().map(|(x, _)| x).sum::<f64>() / n;
    let mean_y = points.iter().map(|(_, y)| y).sum::<f64>() / n;
    let mut num = 0.0;
    let mut den = 0.0;
    for (x, y) in &points {
        num += (x - mean_x) * (y - mean_y);
        den += (x - mean_x) * (x - mean_x);
    }
    if den == 0.0 {
        return 0.0;
    }
    let slope = num / den;
    (slope * 1000.0).round() / 1000.0
}

/// Indice de masse corporelle.
pub fn bmi(weight_kg: f64, height_cm: f64) -> f64 {
    if weight_kg <= 0.0 || height_cm <= 0.0 {
        return 0.0;
    }
    let meters = height_cm / 100.0;
    let value = weight_kg / (meters * meters);
    (value * 10.0).round() / 10.0
}

/// Catégorie OMS de l'IMC (libellé français).
pub fn bmi_label(value: f64) -> &'static str {
    if value <= 0.0 {
        "—"
    } else if value < 18.5 {
        "Insuffisance pondérale"
    } else if value < 25.0 {
        "Corpulence normale"
    } else if value < 30.0 {
        "Surpoids"
    } else {
        "Obésité"
    }
}

/// VO2 max estimé (Uth–Sørensen : 15 × FC max / FC repos).
pub fn vo2max(max_hr: f64, resting_hr: f64) -> f64 {
    if max_hr <= 0.0 || resting_hr <= 0.0 {
        return 0.0;
    }
    let value = 15.0 * max_hr / resting_hr;
    (value.clamp(10.0, 90.0) * 10.0).round() / 10.0
}

/// Allure moyenne en minutes par kilomètre.
pub fn pace_min_per_km(distance_km: f64, minutes: f64) -> f64 {
    if distance_km <= 0.0 || minutes <= 0.0 {
        return 0.0;
    }
    let value = minutes / distance_km;
    (value * 100.0).round() / 100.0
}

/// Série de jours consécutifs, à partir de drapeaux « 1,1,0,1 » (du plus récent
/// au plus ancien). S'arrête au premier jour sans activité.
pub fn consecutive_streak(flags: &str) -> u32 {
    let mut streak = 0;
    for flag in flags.split(',') {
        if flag.trim() == "1" {
            streak += 1;
        } else {
            break;
        }
    }
    streak
}

/// Dépense énergétique hebdomadaire lissée (moyenne mobile simple).
pub fn moving_average(values: &[f64], window: usize) -> Vec<f64> {
    if window == 0 || values.is_empty() {
        return Vec::new();
    }
    let mut out = Vec::with_capacity(values.len());
    for i in 0..values.len() {
        let start = i.saturating_sub(window - 1);
        let slice = &values[start..=i];
        let mean = slice.iter().sum::<f64>() / slice.len() as f64;
        out.push((mean * 10.0).round() / 10.0);
    }
    out
}

/// Cohérence du coucher : écart-type circulaire approximé sur des heures
/// décimales (22,5 = 22 h 30), avec passage de minuit ramené autour de 3 h.
pub fn bedtime_consistency(hours: &[f64]) -> f64 {
    let values: Vec<f64> = hours
        .iter()
        .filter(|h| h.is_finite())
        .map(|h| if *h < 12.0 { *h + 24.0 } else { *h })
        .collect();
    if values.len() < 2 {
        return 100.0;
    }
    let mean = values.iter().sum::<f64>() / values.len() as f64;
    let variance = values
        .iter()
        .map(|h| (h - mean) * (h - mean))
        .sum::<f64>()
        / values.len() as f64;
    let std_dev = variance.sqrt();
    (100.0 - std_dev * 18.0).clamp(0.0, 100.0).round()
}

#[cfg(target_arch = "wasm32")]
pub mod wasm;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn max_hr_tanaka() {
        assert!((max_hr_estimate(30.0) - 187.0).abs() < 0.001);
        assert_eq!(max_hr_estimate(0.0), 190.0);
        assert_eq!(max_hr_estimate(120.0), 124.0);
    }

    #[test]
    fn zones_are_ordered() {
        assert_eq!(hr_zone(100.0, 190.0), 1);
        assert_eq!(hr_zone(120.0, 190.0), 2);
        assert_eq!(hr_zone(140.0, 190.0), 3);
        assert_eq!(hr_zone(155.0, 190.0), 4);
        assert_eq!(hr_zone(180.0, 190.0), 5);
        assert_eq!(hr_zone(0.0, 190.0), 0);
    }

    #[test]
    fn load_grows_with_duration_and_intensity() {
        let easy = training_load(60.0, 130.0, 190.0, 0.0);
        let hard = training_load(60.0, 170.0, 190.0, 0.0);
        assert!(hard > easy);
        assert_eq!(training_load(0.0, 170.0, 190.0, 8.0), 0.0);
        assert!(training_load(60.0, 0.0, 0.0, 8.0) > training_load(60.0, 0.0, 0.0, 3.0));
    }

    #[test]
    fn calories_use_met_formula() {
        assert_eq!(calories_met(10.0, 60.0, 70.0), 700.0);
        assert_eq!(calories_met(10.0, 30.0, 70.0), 350.0);
        assert_eq!(calories_met(0.0, 30.0, 70.0), 0.0);
    }

    #[test]
    fn sleep_score_rewards_full_nights() {
        let short = sleep_score(300.0, 3.0, 8.0);
        let full = sleep_score(480.0, 4.0, 8.0);
        assert!(full > short);
        assert_eq!(sleep_score(0.0, 5.0, 8.0), 0.0);
        assert!((sleep_score(480.0, 5.0, 8.0) - 100.0).abs() < 0.001);
    }

    #[test]
    fn sleep_debt_caps_at_24h() {
        assert_eq!(sleep_debt(&[7.0, 6.0, 8.0], 8.0), 3.0);
        assert_eq!(sleep_debt(&[1.0; 30], 8.0), 24.0);
        assert_eq!(sleep_debt(&[], 8.0), 0.0);
    }

    #[test]
    fn ratio_handles_empty_history() {
        assert_eq!(acute_chronic_ratio(0.0, 0.0), 0.0);
        assert_eq!(acute_chronic_ratio(100.0, 0.0), 1.0);
        assert_eq!(acute_chronic_ratio(150.0, 100.0), 1.5);
    }

    #[test]
    fn readiness_drops_with_training_spike() {
        let rested = readiness(480.0, 5.0, 100.0, 120.0, 0.0);
        let tired = readiness(300.0, 2.0, 300.0, 120.0, 8.0);
        assert!(rested > 80.0);
        assert!(tired < rested);
        assert!((0.0..=100.0).contains(&readiness(0.0, 0.0, 0.0, 0.0, 50.0)));
    }

    #[test]
    fn trend_slope_signs() {
        assert_eq!(trend_slope(&[]), 0.0);
        assert_eq!(trend_slope(&[1.0]), 0.0);
        assert!(trend_slope(&[80.0, 79.0, 78.0]) < 0.0);
        assert!(trend_slope(&[70.0, 71.0, 72.0]) > 0.0);
    }

    #[test]
    fn bmi_is_classified() {
        assert_eq!(bmi(70.0, 175.0), 22.9);
        assert_eq!(bmi_label(22.9), "Corpulence normale");
        assert_eq!(bmi_label(17.0), "Insuffisance pondérale");
        assert_eq!(bmi_label(27.0), "Surpoids");
        assert_eq!(bmi_label(31.0), "Obésité");
        assert_eq!(bmi(0.0, 175.0), 0.0);
    }

    #[test]
    fn pace_and_vo2() {
        assert_eq!(pace_min_per_km(10.0, 50.0), 5.0);
        assert_eq!(pace_min_per_km(0.0, 50.0), 0.0);
        assert!(vo2max(190.0, 50.0) > 50.0);
        assert_eq!(vo2max(190.0, 0.0), 0.0);
    }

    #[test]
    fn streak_stops_at_first_gap() {
        assert_eq!(consecutive_streak("1,1,1,0,1"), 3);
        assert_eq!(consecutive_streak("0,1,1"), 0);
        assert_eq!(consecutive_streak(""), 0);
    }

    #[test]
    fn moving_average_smooths() {
        let values = [10.0, 20.0, 30.0];
        assert_eq!(moving_average(&values, 2), vec![10.0, 15.0, 25.0]);
        assert!(moving_average(&values, 0).is_empty());
    }

    #[test]
    fn bedtime_consistency_handles_midnight() {
        let regular = bedtime_consistency(&[22.5, 22.6, 22.4]);
        let chaotic = bedtime_consistency(&[21.0, 1.0, 23.5]);
        assert!(regular > chaotic);
    }
}
