use chrono::Utc;
use tauri::State;
use uuid::Uuid;
use crate::{
    models::{MemberNote, SHEET_MEMBER_NOTES},
    state::{AppState, get_sheets},
};

fn row_to_note(row: Vec<String>) -> Option<MemberNote> {
    if row.is_empty() { return None; }
    Some(MemberNote {
        id:         row.get(0).cloned().unwrap_or_default(),
        member_id:  row.get(1).cloned().unwrap_or_default(),
        text:       row.get(2).cloned().unwrap_or_default(),
        created_at: row.get(3).cloned().unwrap_or_default(),
    })
}

#[tauri::command]
pub async fn get_member_notes(state: State<'_, AppState>) -> Result<Vec<MemberNote>, String> {
    let sheets = get_sheets(&state).await?;
    let rows = sheets.get_all_rows(SHEET_MEMBER_NOTES).await?;
    Ok(rows.into_iter().filter_map(row_to_note).collect())
}

#[tauri::command]
pub async fn add_member_note(
    state: State<'_, AppState>,
    member_id: String,
    text: String,
) -> Result<String, String> {
    let sheets = get_sheets(&state).await?;
    let id  = Uuid::new_v4().to_string();
    let row = vec![id.clone(), member_id, text, Utc::now().to_rfc3339()];
    sheets.append_row(SHEET_MEMBER_NOTES, row).await?;
    Ok(id)
}

#[tauri::command]
pub async fn delete_member_note(
    state: State<'_, AppState>,
    note_id: String,
) -> Result<(), String> {
    let sheets   = get_sheets(&state).await?;
    let sheet_id = sheets.get_sheet_id(SHEET_MEMBER_NOTES).await?;
    let row_idx  = sheets.find_row_by_id(SHEET_MEMBER_NOTES, &note_id).await?
        .ok_or_else(|| format!("Note '{}' not found", note_id))?;
    sheets.delete_row(SHEET_MEMBER_NOTES, row_idx, sheet_id).await
}
