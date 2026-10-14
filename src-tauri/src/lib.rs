mod db;
mod models;
mod state;
mod commands;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // Setup / device settings
            commands::setup::setup_database,
            commands::setup::get_app_config,
            commands::setup::set_data_folder,
            // Document store
            commands::store::load_all,
            commands::store::apply_ops,
            commands::store::get_setting,
            commands::store::set_setting,
            commands::store::legacy_snapshot,
            commands::store::save_export,
            // Backup / restore
            commands::backup::create_backup,
            commands::backup::list_backups,
            commands::backup::restore_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
