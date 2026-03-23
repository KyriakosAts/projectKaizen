use tauri::State;
use crate::{
    auth::AuthClient,
    drive::DriveClient,
    models::{
        AppConfig, SetupResult,
        SHEET_MEMBERS, SHEET_PAYMENTS, SHEET_ATTENDANCE, SHEET_BELT_HISTORY,
        SHEET_MEMBER_NOTES, SHEET_COMMENTS, SHEET_CONFIG_SVC, SHEET_CONFIG_SCH,
        SHEET_CONFIG_INST, SHEET_LOGS, headers_for,
    },
    sheets::SheetsClient,
    state::AppState,
};
use std::path::PathBuf;

const SPREADSHEET_TITLE: &str = "Dojo Patras";
const BACKUP_FOLDER_NAME: &str = "Dojo Patras Backups";

const ALL_TABS: &[&str] = &[
    SHEET_MEMBERS, SHEET_PAYMENTS, SHEET_ATTENDANCE, SHEET_BELT_HISTORY,
    SHEET_MEMBER_NOTES, SHEET_COMMENTS, SHEET_CONFIG_SVC, SHEET_CONFIG_SCH,
    SHEET_CONFIG_INST, SHEET_LOGS,
];

fn config_file_path(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_data_dir()
        .expect("Cannot get app data dir")
        .join("dojo_config.json")
}

fn load_config(path: &PathBuf) -> AppConfig {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_config(path: &PathBuf, config: &AppConfig) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Config serialize error: {}", e))?;
    std::fs::write(path, json)
        .map_err(|e| format!("Config write error: {}", e))
}

#[tauri::command]
pub async fn setup_spreadsheet(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<SetupResult, String> {
    // Resolve service account JSON path:
    // 1. Env var (dev mode: points to local file)
    // 2. Bundled resource inside the installed app
    let sa_path = std::env::var("SERVICE_ACCOUNT_JSON").unwrap_or_else(|_| {
        app.path().resource_dir()
            .map(|p| p.join("resources").join("sa.json").to_string_lossy().to_string())
            .unwrap_or_else(|_| "./sa.json".to_string())
    });

    // Resolve personal Gmail the same way
    let personal_gmail = std::env::var("PERSONAL_GMAIL").unwrap_or_else(|_| {
        app.path().resource_dir()
            .ok()
            .and_then(|p| std::fs::read_to_string(p.join("resources").join("gmail.txt")).ok())
            .unwrap_or_default()
            .trim()
            .to_string()
    });

    // Initialize auth
    let auth = AuthClient::from_file(&sa_path)?;
    let drive = DriveClient::new(auth.clone());

    // Load or create config
    let config_path = config_file_path(&app);
    let mut config = load_config(&config_path);

    let mut created = false;

    // Create spreadsheet if we don't have an ID yet
    if config.spreadsheet_id.is_empty() {
        let sheet_id = SheetsClient::create_spreadsheet(&auth, SPREADSHEET_TITLE, ALL_TABS).await?;
        config.spreadsheet_id = sheet_id;
        created = true;

        // Write headers to all data tabs (skip config-blob tabs)
        let sheets = SheetsClient::new(config.spreadsheet_id.clone(), auth.clone());
        for tab in ALL_TABS {
            // Config-blob tabs store a single JSON cell at A1, not a header row
            let is_config_tab = *tab == SHEET_CONFIG_SVC
                || *tab == SHEET_CONFIG_SCH
                || *tab == SHEET_CONFIG_INST;
            if !is_config_tab {
                let headers = headers_for(tab);
                sheets.write_headers(tab, &headers).await?;
            }
        }

        // Share with personal Gmail
        if !personal_gmail.is_empty() {
            drive.share_with_email(&config.spreadsheet_id, &personal_gmail).await
                .unwrap_or_else(|e| eprintln!("Warning: could not share spreadsheet: {}", e));
        }
    }

    // Create backup folder if needed
    if config.backup_folder_id.is_empty() {
        let folder_id = drive.find_or_create_folder(BACKUP_FOLDER_NAME).await?;
        config.backup_folder_id = folder_id.clone();

        if !personal_gmail.is_empty() {
            drive.share_with_email(&folder_id, &personal_gmail).await
                .unwrap_or_else(|e| eprintln!("Warning: could not share backup folder: {}", e));
        }
    }

    // Persist config to disk
    save_config(&config_path, &config)?;

    // Populate app state
    let sheets = SheetsClient::new(config.spreadsheet_id.clone(), auth.clone());
    {
        let mut auth_guard   = state.auth.lock().await;
        *auth_guard   = Some(auth.clone());

        let mut sheets_guard = state.sheets.lock().await;
        *sheets_guard = Some(sheets);

        let mut drive_guard  = state.drive.lock().await;
        *drive_guard  = Some(drive);

        let mut config_guard = state.config.lock().await;
        *config_guard = config.clone();
    }

    Ok(SetupResult {
        spreadsheet_id:   config.spreadsheet_id,
        backup_folder_id: config.backup_folder_id,
        created,
    })
}

#[tauri::command]
pub async fn get_app_config(
    app: tauri::AppHandle,
) -> Result<AppConfig, String> {
    let config_path = config_file_path(&app);
    Ok(load_config(&config_path))
}
