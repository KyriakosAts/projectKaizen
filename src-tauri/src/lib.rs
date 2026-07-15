mod db;
mod mirror;
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
            // Setup / settings
            commands::setup::setup_database,
            commands::setup::get_app_config,
            commands::setup::set_data_folder,
            // Members
            commands::members::get_members,
            commands::members::add_member,
            commands::members::update_member,
            commands::members::delete_member_cascade,
            // Payments
            commands::payments::get_payments,
            commands::payments::add_payment,
            commands::payments::mark_payment_paid,
            commands::payments::mark_payment_unpaid,
            // Attendance
            commands::attendance::get_attendance,
            commands::attendance::log_attendance,
            commands::attendance::remove_attendance,
            // Belt history
            commands::belt::get_belt_history,
            commands::belt::add_belt_promotion,
            // Member notes
            commands::notes::get_member_notes,
            commands::notes::add_member_note,
            commands::notes::delete_member_note,
            // Comments
            commands::comments::get_comments,
            commands::comments::upsert_comment,
            // Config
            commands::config_cmds::get_services_config,
            commands::config_cmds::save_services_config,
            commands::config_cmds::get_schedule_config,
            commands::config_cmds::save_schedule_config,
            commands::config_cmds::get_instructors_config,
            commands::config_cmds::save_instructors_config,
            // Backup / restore
            commands::backup::create_backup,
            commands::backup::list_backups,
            commands::backup::restore_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
