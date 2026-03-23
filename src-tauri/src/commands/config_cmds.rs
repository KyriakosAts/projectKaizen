use tauri::State;
use crate::{
    models::{SHEET_CONFIG_SVC, SHEET_CONFIG_SCH, SHEET_CONFIG_INST},
    state::{AppState, get_sheets},
};

#[tauri::command]
pub async fn get_services_config(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let sheets = get_sheets(&state).await?;
    let range  = format!("{}!A1", SHEET_CONFIG_SVC);
    sheets.read_cell(&range).await
}

#[tauri::command]
pub async fn save_services_config(
    state: State<'_, AppState>,
    json: String,
) -> Result<(), String> {
    let sheets = get_sheets(&state).await?;
    let range  = format!("{}!A1", SHEET_CONFIG_SVC);
    sheets.write_cell(&range, &json).await
}

#[tauri::command]
pub async fn get_schedule_config(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let sheets = get_sheets(&state).await?;
    let range  = format!("{}!A1", SHEET_CONFIG_SCH);
    sheets.read_cell(&range).await
}

#[tauri::command]
pub async fn save_schedule_config(
    state: State<'_, AppState>,
    json: String,
) -> Result<(), String> {
    let sheets = get_sheets(&state).await?;
    let range  = format!("{}!A1", SHEET_CONFIG_SCH);
    sheets.write_cell(&range, &json).await
}

#[tauri::command]
pub async fn get_instructors_config(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let sheets = get_sheets(&state).await?;
    let range  = format!("{}!A1", SHEET_CONFIG_INST);
    sheets.read_cell(&range).await
}

#[tauri::command]
pub async fn save_instructors_config(
    state: State<'_, AppState>,
    json: String,
) -> Result<(), String> {
    let sheets = get_sheets(&state).await?;
    let range  = format!("{}!A1", SHEET_CONFIG_INST);
    sheets.write_cell(&range, &json).await
}
