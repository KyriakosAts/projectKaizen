use chrono::Utc;
use tauri::State;
use uuid::Uuid;
use crate::{
    models::{
        Member, MemberInput,
        SHEET_MEMBERS, SHEET_PAYMENTS, SHEET_ATTENDANCE,
        SHEET_BELT_HISTORY, SHEET_MEMBER_NOTES, SHEET_COMMENTS,
    },
    state::{AppState, get_sheets},
};

fn row_to_member(row: Vec<String>) -> Option<Member> {
    if row.is_empty() { return None; }
    Some(Member {
        id:            row.get(0).cloned().unwrap_or_default(),
        name:          row.get(1).cloned().unwrap_or_default(),
        phone:         row.get(2).filter(|s| !s.is_empty()).cloned(),
        email:         row.get(3).filter(|s| !s.is_empty()).cloned(),
        categories:    row.get(4).cloned().unwrap_or_else(|| "[]".to_string()),
        belts:         row.get(5).cloned().unwrap_or_else(|| "{}".to_string()),
        service_dates: row.get(6).cloned().unwrap_or_else(|| "{}".to_string()),
        join_date:     row.get(7).cloned().unwrap_or_default(),
        status:        row.get(8).cloned().unwrap_or_else(|| "active".to_string()),
        custom_fee:    row.get(9).filter(|s| !s.is_empty()).cloned(),
        notes:         row.get(10).filter(|s| !s.is_empty()).cloned(),
        created_at:    row.get(11).cloned().unwrap_or_default(),
        updated_at:    row.get(12).cloned().unwrap_or_default(),
    })
}

fn member_to_row(m: &Member) -> Vec<String> {
    vec![
        m.id.clone(),
        m.name.clone(),
        m.phone.clone().unwrap_or_default(),
        m.email.clone().unwrap_or_default(),
        m.categories.clone(),
        m.belts.clone(),
        m.service_dates.clone(),
        m.join_date.clone(),
        m.status.clone(),
        m.custom_fee.clone().unwrap_or_default(),
        m.notes.clone().unwrap_or_default(),
        m.created_at.clone(),
        m.updated_at.clone(),
    ]
}

#[tauri::command]
pub async fn get_members(state: State<'_, AppState>) -> Result<Vec<Member>, String> {
    let sheets = get_sheets(&state).await?;
    let rows = sheets.get_all_rows(SHEET_MEMBERS).await?;
    Ok(rows.into_iter().filter_map(row_to_member).collect())
}

#[tauri::command]
pub async fn add_member(
    state: State<'_, AppState>,
    data: MemberInput,
) -> Result<String, String> {
    let sheets = get_sheets(&state).await?;
    let now = Utc::now().to_rfc3339();
    let id  = Uuid::new_v4().to_string();
    let member = Member {
        id:            id.clone(),
        name:          data.name,
        phone:         data.phone,
        email:         data.email,
        categories:    data.categories,
        belts:         data.belts,
        service_dates: data.service_dates,
        join_date:     data.join_date,
        status:        data.status,
        custom_fee:    data.custom_fee,
        notes:         data.notes,
        created_at:    now.clone(),
        updated_at:    now,
    };
    sheets.append_row(SHEET_MEMBERS, member_to_row(&member)).await?;
    sheets.log_action("ADD", SHEET_MEMBERS, &id, &member.name).await.ok();
    Ok(id)
}

#[tauri::command]
pub async fn update_member(
    state: State<'_, AppState>,
    id: String,
    data: MemberInput,
) -> Result<(), String> {
    let sheets = get_sheets(&state).await?;
    
    // OPTIMIZATION: find_row_with_data returns both the row index and existing data
    // in a single API call, avoiding duplicate get_all_rows calls
    let (row_idx, existing_row) = sheets.find_row_with_data(SHEET_MEMBERS, &id).await?
        .ok_or_else(|| format!("Member '{}' not found", id))?;

    let now = Utc::now().to_rfc3339();

    // Preserve the original creation timestamp from existing data (column 11)
    let created_at = existing_row
        .get(11)
        .cloned()
        .unwrap_or_else(|| now.clone());

    let member = Member {
        id:            id.clone(),
        name:          data.name,
        phone:         data.phone,
        email:         data.email,
        categories:    data.categories,
        belts:         data.belts,
        service_dates: data.service_dates,
        join_date:     data.join_date,
        status:        data.status,
        custom_fee:    data.custom_fee,
        notes:         data.notes,
        created_at,
        updated_at:    now,
    };
    sheets.update_row(SHEET_MEMBERS, row_idx, member_to_row(&member)).await?;
    sheets.log_action("UPDATE", SHEET_MEMBERS, &id, &member.name).await.ok();
    Ok(())
}

#[tauri::command]
pub async fn delete_member_cascade(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let sheets = get_sheets(&state).await?;

    // OPTIMIZATION: get_all_sheet_ids() fetches ALL sheet metadata in 1 API call
    // instead of calling get_sheet_id() 6 times (was making 6 separate requests)
    let all_sheet_ids = sheets.get_all_sheet_ids().await?;

    // Delete all related rows in related sheets (memberId is column B = index 1)
    let related: &[&str] = &[
        SHEET_PAYMENTS,
        SHEET_ATTENDANCE,
        SHEET_BELT_HISTORY,
        SHEET_MEMBER_NOTES,
        SHEET_COMMENTS,
    ];

    for sheet in related {
        let sheet_id = all_sheet_ids.get(*sheet).copied().unwrap_or(0);
        let indices  = sheets.find_rows_by_member_id(sheet, &id).await?;
        // Delete in reverse order so earlier indices remain valid
        for &row_idx in indices.iter().rev() {
            sheets.delete_row(sheet, row_idx, sheet_id).await.ok();
        }
    }

    // Delete the member row itself
    let member_sheet_id = all_sheet_ids.get(SHEET_MEMBERS).copied().unwrap_or(0);
    let row_idx = sheets.find_row_by_id(SHEET_MEMBERS, &id).await?
        .ok_or_else(|| format!("Member '{}' not found", id))?;
    sheets.delete_row(SHEET_MEMBERS, row_idx, member_sheet_id).await?;
    sheets.log_action("DELETE_CASCADE", SHEET_MEMBERS, &id, "cascade delete").await.ok();
    Ok(())
}
