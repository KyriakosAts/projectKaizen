use tauri::State;
use crate::{
    db,
    state::{with_db, AppState},
};

#[tauri::command]
pub fn get_services_config(state: State<'_, AppState>) -> Result<Option<String>, String> {
    with_db(&state, |conn| db::get_setting(conn, db::SETTING_SERVICES))
}

#[tauri::command]
pub fn save_services_config(state: State<'_, AppState>, json: String) -> Result<(), String> {
    with_db(&state, |conn| db::set_setting(conn, db::SETTING_SERVICES, &json))?;
    state.mirror.mark_dirty();
    Ok(())
}

#[tauri::command]
pub fn get_schedule_config(state: State<'_, AppState>) -> Result<Option<String>, String> {
    with_db(&state, |conn| db::get_setting(conn, db::SETTING_SCHEDULE))
}

#[tauri::command]
pub fn save_schedule_config(state: State<'_, AppState>, json: String) -> Result<(), String> {
    with_db(&state, |conn| db::set_setting(conn, db::SETTING_SCHEDULE, &json))?;
    state.mirror.mark_dirty();
    Ok(())
}

#[tauri::command]
pub fn get_instructors_config(state: State<'_, AppState>) -> Result<Option<String>, String> {
    with_db(&state, |conn| db::get_setting(conn, db::SETTING_INSTRUCTORS))
}

#[tauri::command]
pub fn save_instructors_config(state: State<'_, AppState>, json: String) -> Result<(), String> {
    with_db(&state, |conn| db::set_setting(conn, db::SETTING_INSTRUCTORS, &json))?;
    state.mirror.mark_dirty();
    Ok(())
}
