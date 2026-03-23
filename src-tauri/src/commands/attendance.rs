use chrono::Utc;
use tauri::State;
use uuid::Uuid;
use crate::{
    models::{Attendance, AttendanceInput, SHEET_ATTENDANCE},
    state::{AppState, get_sheets},
};

fn row_to_attendance(row: Vec<String>) -> Option<Attendance> {
    if row.is_empty() { return None; }
    Some(Attendance {
        id:           row.get(0).cloned().unwrap_or_default(),
        member_id:    row.get(1).cloned().unwrap_or_default(),
        date:         row.get(2).cloned().unwrap_or_default(),
        session_type: row.get(3).cloned().unwrap_or_default(),
        note:         row.get(4).filter(|s| !s.is_empty()).cloned(),
        class_id:     row.get(5).filter(|s| !s.is_empty()).cloned(),
        created_at:   row.get(6).cloned().unwrap_or_default(),
    })
}

fn attendance_to_row(a: &Attendance) -> Vec<String> {
    vec![
        a.id.clone(),
        a.member_id.clone(),
        a.date.clone(),
        a.session_type.clone(),
        a.note.clone().unwrap_or_default(),
        a.class_id.clone().unwrap_or_default(),
        a.created_at.clone(),
    ]
}

#[tauri::command]
pub async fn get_attendance(state: State<'_, AppState>) -> Result<Vec<Attendance>, String> {
    let sheets = get_sheets(&state).await?;
    let rows = sheets.get_all_rows(SHEET_ATTENDANCE).await?;
    Ok(rows.into_iter().filter_map(row_to_attendance).collect())
}

#[tauri::command]
pub async fn log_attendance(
    state: State<'_, AppState>,
    data: AttendanceInput,
) -> Result<String, String> {
    let sheets = get_sheets(&state).await?;
    let id = Uuid::new_v4().to_string();
    let record = Attendance {
        id:           id.clone(),
        member_id:    data.member_id,
        date:         data.date,
        session_type: data.session_type,
        note:         data.note,
        class_id:     data.class_id,
        created_at:   Utc::now().to_rfc3339(),
    };
    sheets.append_row(SHEET_ATTENDANCE, attendance_to_row(&record)).await?;
    Ok(id)
}

#[tauri::command]
pub async fn remove_attendance(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let sheets   = get_sheets(&state).await?;
    let sheet_id = sheets.get_sheet_id(SHEET_ATTENDANCE).await?;
    let row_idx  = sheets.find_row_by_id(SHEET_ATTENDANCE, &id).await?
        .ok_or_else(|| format!("Attendance record '{}' not found", id))?;
    sheets.delete_row(SHEET_ATTENDANCE, row_idx, sheet_id).await
}
