use std::path::PathBuf;
use tauri::{Manager, State};

use crate::{
    db,
    mirror::MIRROR_FILENAME,
    models::{AppSettings, SetupResult},
    state::{with_db, AppState},
};

pub const DATA_FOLDER_NAME: &str = "Dojo Patras";
pub const BACKUPS_SUBFOLDER: &str = "backups";

/// Default visible data folder: `{Documents}/Dojo Patras`, falling back to the
/// app-data dir when no Documents folder exists.
fn default_data_folder(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    match app.path().document_dir() {
        Ok(docs) => Ok(docs.join(DATA_FOLDER_NAME)),
        Err(_) => app
            .path()
            .app_data_dir()
            .map(|d| d.join(DATA_FOLDER_NAME))
            .map_err(|e| format!("Cannot resolve a data folder: {e}")),
    }
}

fn ensure_folder(path: &PathBuf) -> Result<(), String> {
    std::fs::create_dir_all(path.join(BACKUPS_SUBFOLDER))
        .map_err(|e| format!("Cannot create data folder '{}': {e}", path.display()))
}

/// Open (or create) the SQLite database, resolve the visible data folder for
/// the Excel mirror + backups, and start the background mirror thread.
/// Called once by the frontend on every app launch.
///
/// Ordering matters for resilience: the connection is stored into AppState as
/// soon as the database opens, BEFORE any folder/backup work — so a missing
/// USB stick or a failed startup backup can never leave the app in a state
/// where every command (including the one that fixes the folder) errors out.
/// Recoverable problems are returned as `warning` instead of failing setup.
#[tauri::command(async)]
pub fn setup_database(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<SetupResult, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {e}"))?;
    std::fs::create_dir_all(&app_data).map_err(|e| format!("Cannot create app data dir: {e}"))?;

    let db_path = app_data.join("dojo.db");
    let created = !db_path.exists();
    let conn = db::open(&db_path)?;

    {
        let mut db_guard = state.db.lock().map_err(|_| "Database lock poisoned".to_string())?;
        *db_guard = Some(conn);
        let mut path_guard = state.db_path.lock().map_err(|_| "Database lock poisoned".to_string())?;
        *path_guard = Some(db_path.clone());
    }

    let mut warnings: Vec<String> = Vec::new();

    // Resolve the data folder (persisted setting, or default to Documents).
    // If the saved folder is unusable (unplugged drive, renamed cloud folder),
    // fall back to the default so mirror + backups keep working.
    let data_folder = with_db(&state, |conn| {
        let mut folder = match db::get_setting(conn, db::SETTING_DATA_FOLDER)? {
            Some(f) if !f.is_empty() => PathBuf::from(f),
            _ => default_data_folder(&app)?,
        };
        if let Err(e) = ensure_folder(&folder) {
            let fallback = default_data_folder(&app)?;
            if fallback != folder && ensure_folder(&fallback).is_ok() {
                warnings.push(format!(
                    "Data folder '{}' is unavailable — mirror and backups moved to '{}'. You can change this in Settings. ({e})",
                    folder.display(),
                    fallback.display()
                ));
                folder = fallback;
            } else {
                warnings.push(format!(
                    "Data folder is unavailable — Excel mirror and backups are paused until it is fixed in Settings. ({e})"
                ));
            }
        }
        db::set_setting(conn, db::SETTING_DATA_FOLDER, &folder.to_string_lossy())?;
        Ok(folder)
    })?;

    // Daily auto-backup: snapshot on the first launch of each day. Never
    // fatal — a failed backup must not stop the app from opening.
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let backup_result = with_db(&state, |conn| {
        let last = db::get_setting(conn, db::SETTING_LAST_BACKUP)?.unwrap_or_default();
        if !created && !last.starts_with(&today) {
            super::backup::do_create_backup(conn, "dojo-backup")?;
        }
        Ok(())
    });
    if let Err(e) = backup_result {
        warnings.push(format!("Automatic startup backup failed: {e}"));
    }

    state.mirror.start(db_path.clone());
    state.mirror.mark_dirty();

    Ok(SetupResult {
        db_path: db_path.to_string_lossy().to_string(),
        mirror_path: data_folder.join(MIRROR_FILENAME).to_string_lossy().to_string(),
        backup_folder: data_folder.join(BACKUPS_SUBFOLDER).to_string_lossy().to_string(),
        created,
        warning: if warnings.is_empty() { None } else { Some(warnings.join("\n")) },
    })
}

fn settings_from_db(state: &AppState) -> Result<AppSettings, String> {
    let db_path = state
        .db_path
        .lock()
        .map_err(|_| "Database lock poisoned".to_string())?
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    with_db(state, |conn| {
        let folder = db::get_setting(conn, db::SETTING_DATA_FOLDER)?.unwrap_or_default();
        let folder_path = PathBuf::from(&folder);
        Ok(AppSettings {
            db_path: db_path.clone(),
            mirror_path: folder_path.join(MIRROR_FILENAME).to_string_lossy().to_string(),
            backup_folder: folder_path.join(BACKUPS_SUBFOLDER).to_string_lossy().to_string(),
            last_backup: db::get_setting(conn, db::SETTING_LAST_BACKUP)?,
        })
    })
}

#[tauri::command]
pub fn get_app_config(state: State<'_, AppState>) -> Result<AppSettings, String> {
    settings_from_db(&state)
}

/// Move the mirror + backup location (e.g. into a OneDrive/Google Drive folder
/// or a USB stick so backups leave the PC). Future mirrors and backups are
/// written there; existing files are not moved.
#[tauri::command]
pub fn set_data_folder(state: State<'_, AppState>, path: String) -> Result<AppSettings, String> {
    let folder = PathBuf::from(path.trim());
    if folder.as_os_str().is_empty() {
        return Err("Folder path is empty".to_string());
    }
    ensure_folder(&folder)?;
    with_db(&state, |conn| {
        db::set_setting(conn, db::SETTING_DATA_FOLDER, &folder.to_string_lossy())
    })?;
    state.mirror.mark_dirty();
    settings_from_db(&state)
}
