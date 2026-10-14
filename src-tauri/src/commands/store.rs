//! Generic document-store commands. The frontend owns the data model
//! (src/data); these commands only load, write and delete JSON documents.

use serde_json::{Map, Value};
use std::path::PathBuf;
use tauri::State;

use crate::{
    db::{self, Op},
    state::{with_db, with_db_mut, AppState},
};

/// Every document, grouped by collection.
#[tauri::command]
pub fn load_all(state: State<'_, AppState>) -> Result<Map<String, Value>, String> {
    with_db(&state, db::load_docs)
}

/// Atomic batch of puts/deletes.
#[tauri::command]
pub fn apply_ops(state: State<'_, AppState>, ops: Vec<Op>) -> Result<(), String> {
    with_db_mut(&state, |conn| db::apply_ops(conn, &ops))
}

#[tauri::command]
pub fn get_setting(state: State<'_, AppState>, key: String) -> Result<Option<String>, String> {
    with_db(&state, |conn| db::get_setting(conn, &key))
}

#[tauri::command]
pub fn set_setting(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    if key == db::SETTING_DATA_FOLDER || key == db::SETTING_LAST_BACKUP {
        return Err(format!("'{key}' cannot be changed this way"));
    }
    with_db(&state, |conn| db::set_setting(conn, &key, &value))
}

/// Data from the pre-v3 tables, for the one-time frontend migration.
#[tauri::command]
pub fn legacy_snapshot(state: State<'_, AppState>) -> Result<Option<Value>, String> {
    with_db(&state, db::legacy_snapshot)
}

/// Write an export (e.g. an .xlsx built by the frontend) into
/// `{data folder}/exports/` and return its full path.
#[tauri::command(async)]
pub fn save_export(state: State<'_, AppState>, name: String, bytes: Vec<u8>) -> Result<String, String> {
    let is_bare_filename = std::path::Path::new(&name)
        .file_name()
        .map(|f| f == std::ffi::OsStr::new(&name))
        .unwrap_or(false);
    if !is_bare_filename || name.contains(':') {
        return Err("Invalid file name".to_string());
    }
    let folder = with_db(&state, |conn| db::get_setting(conn, db::SETTING_DATA_FOLDER))?
        .filter(|f| !f.is_empty())
        .ok_or_else(|| "Data folder not configured. Restart the app.".to_string())?;
    let dir = PathBuf::from(folder).join("exports");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Cannot create export folder: {e}"))?;
    let path = dir.join(&name);
    std::fs::write(&path, &bytes)
        .map_err(|e| format!("Cannot write '{}': {e}", path.display()))?;
    Ok(path.to_string_lossy().to_string())
}
