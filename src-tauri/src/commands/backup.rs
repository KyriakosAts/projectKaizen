use chrono::Utc;
use tauri::State;
use std::path::PathBuf;
use crate::{
    models::{
        BackupInfo,
        SHEET_MEMBERS, SHEET_PAYMENTS, SHEET_ATTENDANCE, SHEET_BELT_HISTORY,
        SHEET_MEMBER_NOTES, SHEET_COMMENTS,
        SHEET_CONFIG_SVC, SHEET_CONFIG_SCH, SHEET_CONFIG_INST,
    },
    state::{AppState, get_sheets, get_drive},
};

const ALL_DATA_SHEETS: &[&str] = &[
    SHEET_MEMBERS, SHEET_PAYMENTS, SHEET_ATTENDANCE, SHEET_BELT_HISTORY,
    SHEET_MEMBER_NOTES, SHEET_COMMENTS, SHEET_CONFIG_SVC, SHEET_CONFIG_SCH, SHEET_CONFIG_INST,
];

fn backup_local_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_data_dir()
        .expect("Cannot get app data dir")
        .join("backups")
}

#[tauri::command]
pub async fn create_backup(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<BackupInfo, String> {
    let sheets = get_sheets(&state).await?;
    let drive  = get_drive(&state).await?;
    let config = state.config.lock().await.clone();

    // Batch-read all row data from every sheet
    let data = sheets.batch_get_all(ALL_DATA_SHEETS).await?;

    // Read the three config-blob cells
    let svc_config  = sheets.read_cell(&format!("{}!A1", SHEET_CONFIG_SVC)).await?;
    let sch_config  = sheets.read_cell(&format!("{}!A1", SHEET_CONFIG_SCH)).await?;
    let inst_config = sheets.read_cell(&format!("{}!A1", SHEET_CONFIG_INST)).await?;

    let today    = Utc::now().format("%Y-%m-%d").to_string();
    let filename = format!("{}.json", today);

    let backup_doc = serde_json::json!({
        "exportedAt": Utc::now().to_rfc3339(),
        "version": "2.0",
        "data": {
            "members":     data.get(SHEET_MEMBERS).cloned().unwrap_or_default(),
            "payments":    data.get(SHEET_PAYMENTS).cloned().unwrap_or_default(),
            "attendance":  data.get(SHEET_ATTENDANCE).cloned().unwrap_or_default(),
            "beltHistory": data.get(SHEET_BELT_HISTORY).cloned().unwrap_or_default(),
            "memberNotes": data.get(SHEET_MEMBER_NOTES).cloned().unwrap_or_default(),
            "comments":    data.get(SHEET_COMMENTS).cloned().unwrap_or_default(),
            "config": {
                "services":    svc_config,
                "schedule":    sch_config,
                "instructors": inst_config,
            }
        }
    });

    let json_str = serde_json::to_string_pretty(&backup_doc)
        .map_err(|e| format!("Serialize error: {}", e))?;
    let size = json_str.len() as u64;

    // Upload to Google Drive (optional — don't fail the whole backup if Drive is unavailable)
    let drive_file_id = if !config.backup_folder_id.is_empty() {
        drive.upload_json(&config.backup_folder_id, &filename, &json_str).await.ok()
    } else {
        None
    };

    // Save a local copy
    let local_dir = backup_local_dir(&app);
    std::fs::create_dir_all(&local_dir).ok();
    let local_path = local_dir.join(&filename);
    std::fs::write(&local_path, &json_str).ok();

    // Persist the lastBackup timestamp into the config
    {
        let config_path = app.path().app_data_dir()
            .expect("Cannot get app data dir")
            .join("dojo_config.json");
        let mut cfg = state.config.lock().await;
        cfg.last_backup = Some(today.clone());
        if let Ok(json) = serde_json::to_string_pretty(&*cfg) {
            std::fs::write(&config_path, json).ok();
        }
    }

    Ok(BackupInfo {
        name:          filename,
        date:          today,
        drive_file_id,
        local_path:    local_path.to_str().map(|s| s.to_string()),
        size_bytes:    Some(size),
    })
}

#[tauri::command]
pub async fn list_backups(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<BackupInfo>, String> {
    let config = state.config.lock().await.clone();
    let mut backups: Vec<BackupInfo> = Vec::new();

    // Enumerate Drive backups
    if let Ok(drive) = get_drive(&state).await {
        if !config.backup_folder_id.is_empty() {
            if let Ok(files) = drive.list_files_in_folder(&config.backup_folder_id).await {
                for (id, name) in files {
                    let date = name.trim_end_matches(".json").to_string();
                    backups.push(BackupInfo {
                        name,
                        date,
                        drive_file_id: Some(id),
                        local_path:    None,
                        size_bytes:    None,
                    });
                }
            }
        }
    }

    // Merge local backups
    let local_dir = backup_local_dir(&app);
    if let Ok(entries) = std::fs::read_dir(&local_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.ends_with(".json") { continue; }
            let date = name.trim_end_matches(".json").to_string();
            let size = entry.metadata().map(|m| m.len()).ok();
            let path = entry.path().to_str().map(|s| s.to_string());

            if let Some(existing) = backups.iter_mut().find(|b| b.date == date) {
                // Enrich the Drive entry with local path and size
                existing.local_path = path;
                existing.size_bytes = size;
            } else {
                backups.push(BackupInfo {
                    name,
                    date,
                    drive_file_id: None,
                    local_path:    path,
                    size_bytes:    size,
                });
            }
        }
    }

    // Most-recent first
    backups.sort_by(|a, b| b.date.cmp(&a.date));
    Ok(backups)
}
