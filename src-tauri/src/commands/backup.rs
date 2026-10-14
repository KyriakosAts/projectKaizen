use rusqlite::Connection;
use serde::Deserialize;
use std::path::PathBuf;
use tauri::State;

use crate::{
    db,
    models::{BackupInfo, RestoreResult},
    state::{with_db, with_db_mut, AppState},
};

const KEEP_AUTO_BACKUPS: usize = 30;
const KEEP_PRE_RESTORE: usize = 5;
/// Backup format 4 = the document store (app v3). Older formats (3 = app v2
/// SQLite tables, 1/2 = Google Sheets era) use other layouts and are rejected
/// by restore.
const BACKUP_VERSION: &str = "4.0";

fn backups_dir(conn: &Connection) -> Result<PathBuf, String> {
    let folder = db::get_setting(conn, db::SETTING_DATA_FOLDER)?
        .filter(|f| !f.is_empty())
        .ok_or_else(|| "Data folder not configured. Restart the app.".to_string())?;
    let dir = PathBuf::from(folder).join(super::setup::BACKUPS_SUBFOLDER);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Cannot create backup folder: {e}"))?;
    Ok(dir)
}

/// Delete the oldest files matching `prefix`, keeping the newest `keep`.
/// Timestamped names sort chronologically, so a name sort is a time sort.
fn rotate(dir: &PathBuf, prefix: &str, keep: usize) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    let mut names: Vec<String> = entries
        .flatten()
        .map(|e| e.file_name().to_string_lossy().to_string())
        .filter(|n| n.starts_with(prefix) && n.ends_with(".json"))
        .collect();
    names.sort();
    if names.len() > keep {
        let excess = names.len() - keep;
        for name in names.iter().take(excess) {
            let _ = std::fs::remove_file(dir.join(name));
        }
    }
}

/// Snapshot the whole database to a timestamped JSON file in the backup folder.
/// Fails loudly — a backup that didn't reach disk must never look successful.
pub fn do_create_backup(conn: &Connection, prefix: &str) -> Result<BackupInfo, String> {
    let dir = backups_dir(conn)?;
    let snapshot = db::snapshot_all(conn)?;

    let now = chrono::Local::now();
    let filename = format!("{}-{}.json", prefix, now.format("%Y-%m-%d_%H-%M-%S"));

    let doc = serde_json::json!({
        "exportedAt": chrono::Utc::now().to_rfc3339(),
        "version": BACKUP_VERSION,
        "data": snapshot,
    });
    let json_str = serde_json::to_string_pretty(&doc).map_err(|e| format!("Serialize error: {e}"))?;

    let path = dir.join(&filename);
    std::fs::write(&path, &json_str)
        .map_err(|e| format!("Cannot write backup file '{}': {e}", path.display()))?;

    db::set_setting(conn, db::SETTING_LAST_BACKUP, &now.format("%Y-%m-%d %H:%M:%S").to_string())?;

    rotate(&dir, "dojo-backup-", KEEP_AUTO_BACKUPS);
    rotate(&dir, "pre-restore-", KEEP_PRE_RESTORE);

    Ok(BackupInfo {
        name: filename,
        date: now.format("%Y-%m-%d %H:%M:%S").to_string(),
        local_path: Some(path.to_string_lossy().to_string()),
        size_bytes: Some(json_str.len() as u64),
    })
}

/// One-time safety copy of a pre-v3 database (its tables are migrated by the
/// frontend). `VACUUM INTO` writes a consistent copy even in WAL mode. The
/// legacy tables themselves are never modified either.
pub fn copy_legacy_db_once(conn: &Connection) -> Result<(), String> {
    if db::legacy_snapshot(conn)?.is_none() {
        return Ok(());
    }
    let path = backups_dir(conn)?.join("pre-v3-dojo.db");
    if path.exists() {
        return Ok(());
    }
    conn.execute("VACUUM INTO ?1", rusqlite::params![path.to_string_lossy().to_string()])
        .map(|_| ())
        .map_err(|e| format!("Cannot copy the old database: {e}"))
}

#[tauri::command(async)]
pub fn create_backup(state: State<'_, AppState>) -> Result<BackupInfo, String> {
    with_db(&state, |conn| do_create_backup(conn, "dojo-backup"))
}

#[tauri::command(async)]
pub fn list_backups(state: State<'_, AppState>) -> Result<Vec<BackupInfo>, String> {
    with_db(&state, |conn| {
        let dir = backups_dir(conn)?;
        let entries = std::fs::read_dir(&dir)
            .map_err(|e| format!("Cannot read backup folder '{}': {e}", dir.display()))?;
        let mut backups = Vec::new();
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            // Only known snapshot files — stray JSON in the folder isn't restorable
            if !name.ends_with(".json")
                || !(name.starts_with("dojo-backup-") || name.starts_with("pre-restore-"))
            {
                continue;
            }
            let meta = entry.metadata().ok();
            let date = meta
                .as_ref()
                .and_then(|m| m.modified().ok())
                .map(|t| {
                    chrono::DateTime::<chrono::Local>::from(t)
                        .format("%Y-%m-%d %H:%M:%S")
                        .to_string()
                })
                .unwrap_or_default();
            backups.push(BackupInfo {
                name,
                date,
                local_path: entry.path().to_str().map(|s| s.to_string()),
                size_bytes: meta.map(|m| m.len()),
            });
        }
        backups.sort_by(|a, b| b.name.cmp(&a.name));
        Ok(backups)
    })
}

#[derive(Deserialize)]
struct BackupDoc {
    data: db::Snapshot,
}

/// Replace all data with the contents of a backup file from the backup folder.
/// A pre-restore safety snapshot of the current data is always taken first,
/// so a restore can itself be undone.
#[tauri::command(async)]
pub fn restore_backup(state: State<'_, AppState>, name: String) -> Result<RestoreResult, String> {
    // The name must be a bare filename inside the backup folder — reject
    // separators, traversal, and Windows drive-relative paths ("C:x.json")
    let is_bare_filename = std::path::Path::new(&name)
        .file_name()
        .map(|f| f == std::ffi::OsStr::new(&name))
        .unwrap_or(false);
    if !is_bare_filename || name.contains(':') || !name.ends_with(".json") {
        return Err("Invalid backup name".to_string());
    }

    let result = with_db_mut(&state, |conn| {
        let path = backups_dir(conn)?.join(&name);
        let raw = std::fs::read_to_string(&path)
            .map_err(|e| format!("Cannot read backup '{name}': {e}"))?;
        // Check the format version before the layout, so an old backup gets
        // a clear message instead of a parse error
        let value: serde_json::Value = serde_json::from_str(&raw)
            .map_err(|e| format!("Το '{name}' δεν είναι αρχείο αντιγράφου του Dojo Patras: {e}"))?;
        let version = value.get("version").and_then(|v| v.as_str()).unwrap_or("");
        if !version.starts_with("4.") {
            return Err(format!(
                "Το '{name}' είναι αντίγραφο από παλιότερη έκδοση της εφαρμογής ({version}) και δεν μπορεί να επαναφερθεί."
            ));
        }
        let doc: BackupDoc = serde_json::from_value(value)
            .map_err(|e| format!("Το '{name}' είναι κατεστραμμένο: {e}"))?;

        let safety = do_create_backup(conn, "pre-restore")?;
        db::restore_all(conn, &doc.data)?;

        Ok(RestoreResult {
            records: db::doc_count(&doc.data),
            safety_backup: safety.name,
        })
    })?;

    Ok(result)
}
