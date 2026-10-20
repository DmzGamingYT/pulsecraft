//! Coque native de Battement.
//!
//! Le front est exactement le même que sur le Web : le build Vite est embarqué
//! dans une WebView native. Aucune commande Rust n'est exposée au front pour
//! l'instant — les données restent dans IndexedDB, dans la WebView — ce qui
//! réduit la surface d'attaque au strict nécessaire. Les futurs accès capteurs
//! (HealthKit, Health Connect) passeront par des commandes explicites et
//! documentées ici.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("Battement n'a pas pu démarrer");
}
