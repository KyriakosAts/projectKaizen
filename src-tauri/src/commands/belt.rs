use chrono::Utc;
use tauri::State;
use uuid::Uuid;
use crate::{
    models::{BeltEntry, BeltInput, SHEET_BELT_HISTORY},
    state::{AppState, get_sheets},
};

fn row_to_belt(row: Vec<String>) -> Option<BeltEntry> {
    if row.is_empty() { return None; }
    Some(BeltEntry {
        id:          row.get(0).cloned().unwrap_or_default(),
        member_id:   row.get(1).cloned().unwrap_or_default(),
        category:    row.get(2).cloned().unwrap_or_default(),
        from_belt:   row.get(3).filter(|s| !s.is_empty()).cloned(),
        to_belt:     row.get(4).cloned().unwrap_or_default(),
        promoted_at: row.get(5).cloned().unwrap_or_default(),
        notes:       row.get(6).filter(|s| !s.is_empty()).cloned(),
        created_at:  row.get(7).cloned().unwrap_or_default(),
    })
}

fn belt_to_row(b: &BeltEntry) -> Vec<String> {
    vec![
        b.id.clone(),
        b.member_id.clone(),
        b.category.clone(),
        b.from_belt.clone().unwrap_or_default(),
        b.to_belt.clone(),
        b.promoted_at.clone(),
        b.notes.clone().unwrap_or_default(),
        b.created_at.clone(),
    ]
}

#[tauri::command]
pub async fn get_belt_history(state: State<'_, AppState>) -> Result<Vec<BeltEntry>, String> {
    let sheets = get_sheets(&state).await?;
    let rows = sheets.get_all_rows(SHEET_BELT_HISTORY).await?;
    Ok(rows.into_iter().filter_map(row_to_belt).collect())
}

#[tauri::command]
pub async fn add_belt_promotion(
    state: State<'_, AppState>,
    member_id: String,
    data: BeltInput,
) -> Result<String, String> {
    let sheets = get_sheets(&state).await?;
    let id = Uuid::new_v4().to_string();
    let entry = BeltEntry {
        id:          id.clone(),
        member_id,
        category:    data.category,
        from_belt:   data.from_belt,
        to_belt:     data.to_belt,
        promoted_at: data.promoted_at,
        notes:       data.notes,
        created_at:  Utc::now().to_rfc3339(),
    };
    sheets.append_row(SHEET_BELT_HISTORY, belt_to_row(&entry)).await?;
    Ok(id)
}
