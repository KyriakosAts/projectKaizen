//! Low-level Google Sheets API v4 wrapper.
//!
//! All methods take a reference to AuthClient to get a fresh bearer token.
//! Rows are represented as Vec<String>. Row indices are 1-based (1 = first data row,
//! because row 1 is the header). The Google Sheets API uses 0-based indices internally,
//! so all row indices are converted automatically.

use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use crate::auth::AuthClient;

const SHEETS_BASE: &str = "https://sheets.googleapis.com/v4/spreadsheets";

// ─── Response types ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ValueRange {
    values: Option<Vec<Vec<Value>>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BatchGetResponse {
    value_ranges: Option<Vec<ValueRange>>,
}

#[derive(Debug, Deserialize)]
struct CreateSpreadsheetResponse {
    #[serde(rename = "spreadsheetId")]
    spreadsheet_id: String,
    sheets: Option<Vec<SheetInfo>>,
}

#[derive(Debug, Deserialize)]
struct SheetInfo {
    properties: SheetProperties,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SheetProperties {
    sheet_id: u32,
    title: String,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Convert a serde_json Value cell to a plain String.
fn cell_to_string(cell: Value) -> String {
    match cell {
        Value::String(s) => s,
        Value::Number(n) => n.to_string(),
        Value::Bool(b)   => b.to_string(),
        Value::Null      => String::new(),
        other            => other.to_string(),
    }
}

/// Convert a Vec<Vec<Value>> response into Vec<Vec<String>>.
fn parse_rows(raw: Vec<Vec<Value>>) -> Vec<Vec<String>> {
    raw.into_iter()
        .map(|row| row.into_iter().map(cell_to_string).collect())
        .collect()
}

// ─── SheetsClient ──────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct SheetsClient {
    pub spreadsheet_id: String,
    auth: AuthClient,
    http: Client,
}

impl SheetsClient {
    pub fn new(spreadsheet_id: String, auth: AuthClient) -> Self {
        Self {
            spreadsheet_id,
            auth,
            http: Client::new(),
        }
    }

    /// Retrieve a fresh Bearer token string.
    async fn bearer(&self) -> Result<String, String> {
        self.auth.access_token().await
    }

    // ─── CREATE SPREADSHEET ──────────────────────────────────────────────────

    /// Create a new spreadsheet with the given title and sheet tab names.
    /// Returns the new spreadsheet ID.
    pub async fn create_spreadsheet(
        auth: &AuthClient,
        title: &str,
        tab_names: &[&str],
    ) -> Result<String, String> {
        let http = Client::new();
        let token = auth.access_token().await?;

        let sheets: Vec<Value> = tab_names
            .iter()
            .map(|name| json!({ "properties": { "title": name } }))
            .collect();

        let body = json!({
            "properties": { "title": title },
            "sheets": sheets
        });

        let resp = http
            .post(SHEETS_BASE)
            .bearer_auth(&token)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("create_spreadsheet request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("create_spreadsheet error {}: {}", status, text));
        }

        let created: CreateSpreadsheetResponse = resp
            .json()
            .await
            .map_err(|e| format!("create_spreadsheet parse error: {}", e))?;

        Ok(created.spreadsheet_id)
    }

    // ─── WRITE HEADERS ───────────────────────────────────────────────────────

    /// Write a header row to a sheet tab (overwrites row 1).
    pub async fn write_headers(&self, sheet: &str, headers: &[&str]) -> Result<(), String> {
        let values: Vec<Value> = headers
            .iter()
            .map(|h| Value::String(h.to_string()))
            .collect();
        let body = json!({ "values": [values] });
        let range = format!("{}!A1", sheet);
        let url = format!(
            "{}/{}/values/{}?valueInputOption=RAW",
            SHEETS_BASE,
            self.spreadsheet_id,
            urlencoding::encode(&range)
        );

        let resp = self.http
            .put(&url)
            .bearer_auth(&self.bearer().await?)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("write_headers request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("write_headers error {}: {}", status, text));
        }
        Ok(())
    }

    // ─── READ ALL ROWS ───────────────────────────────────────────────────────

    /// Read all data rows from a sheet tab, skipping the header (row 1).
    /// Returns Vec<Vec<String>>; each inner Vec is one row.
    pub async fn get_all_rows(&self, sheet: &str) -> Result<Vec<Vec<String>>, String> {
        let range = format!("{}!A2:Z", sheet);
        let url = format!(
            "{}/{}/values/{}",
            SHEETS_BASE,
            self.spreadsheet_id,
            urlencoding::encode(&range)
        );

        let resp = self.http
            .get(&url)
            .bearer_auth(&self.bearer().await?)
            .send()
            .await
            .map_err(|e| format!("get_all_rows request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("get_all_rows error {}: {}", status, text));
        }

        let vr: ValueRange = resp
            .json()
            .await
            .map_err(|e| format!("get_all_rows parse error: {}", e))?;

        Ok(parse_rows(vr.values.unwrap_or_default()))
    }

    /// Batch-read all specified sheet ranges in a single API call.
    /// Returns a map of sheet_name → rows (header row excluded).
    pub async fn batch_get_all(
        &self,
        sheets: &[&str],
    ) -> Result<std::collections::HashMap<String, Vec<Vec<String>>>, String> {
        let ranges: Vec<String> = sheets
            .iter()
            .map(|s| format!("{}!A2:Z", s))
            .collect();

        let range_params: String = ranges
            .iter()
            .map(|r| format!("ranges={}", urlencoding::encode(r)))
            .collect::<Vec<_>>()
            .join("&");

        let url = format!(
            "{}/{}/values:batchGet?{}",
            SHEETS_BASE, self.spreadsheet_id, range_params
        );

        let resp = self.http
            .get(&url)
            .bearer_auth(&self.bearer().await?)
            .send()
            .await
            .map_err(|e| format!("batch_get_all request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("batch_get_all error {}: {}", status, text));
        }

        let bg: BatchGetResponse = resp
            .json()
            .await
            .map_err(|e| format!("batch_get_all parse error: {}", e))?;

        let mut result = std::collections::HashMap::new();
        let vrs = bg.value_ranges.unwrap_or_default();

        for (idx, sheet_name) in sheets.iter().enumerate() {
            let raw = vrs.get(idx).and_then(|vr| vr.values.clone()).unwrap_or_default();
            result.insert(sheet_name.to_string(), parse_rows(raw));
        }

        Ok(result)
    }

    // ─── APPEND ROW ──────────────────────────────────────────────────────────

    /// Append a new row at the end of the sheet.
    pub async fn append_row(&self, sheet: &str, values: Vec<String>) -> Result<(), String> {
        let range = format!("{}!A:A", sheet);
        let url = format!(
            "{}/{}/values/{}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS",
            SHEETS_BASE,
            self.spreadsheet_id,
            urlencoding::encode(&range)
        );

        let cell_values: Vec<Value> = values.into_iter().map(Value::String).collect();
        let body = json!({ "values": [cell_values] });

        let resp = self.http
            .post(&url)
            .bearer_auth(&self.bearer().await?)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("append_row request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("append_row error {}: {}", status, text));
        }
        Ok(())
    }

    // ─── UPDATE ROW ──────────────────────────────────────────────────────────

    /// Update a specific row by its 1-based data row index.
    /// data_row_index=1 means the first row after the header (sheet row 2).
    pub async fn update_row(
        &self,
        sheet: &str,
        data_row_index: u32, // 1-based
        values: Vec<String>,
    ) -> Result<(), String> {
        let sheet_row = data_row_index + 1; // offset by header row
        let range = format!("{}!A{}:Z{}", sheet, sheet_row, sheet_row);
        let url = format!(
            "{}/{}/values/{}?valueInputOption=RAW",
            SHEETS_BASE,
            self.spreadsheet_id,
            urlencoding::encode(&range)
        );

        let cell_values: Vec<Value> = values.into_iter().map(Value::String).collect();
        let body = json!({ "values": [cell_values] });

        let resp = self.http
            .put(&url)
            .bearer_auth(&self.bearer().await?)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("update_row request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("update_row error {}: {}", status, text));
        }
        Ok(())
    }

    // ─── DELETE ROW ──────────────────────────────────────────────────────────

    /// Delete a row by its 1-based data row index using the DeleteDimension request.
    ///
    /// Index mapping (0-based sheet indices):
    ///   - Row 0 = header row
    ///   - data_row_index 1 → startIndex 1, endIndex 2
    ///   - data_row_index 2 → startIndex 2, endIndex 3
    pub async fn delete_row(
        &self,
        _sheet: &str,
        data_row_index: u32, // 1-based
        sheet_id: u32,
    ) -> Result<(), String> {
        // data_row_index is 1-based among data rows; the header occupies index 0,
        // so data row 1 is at 0-based sheet index 1.
        let start_index = data_row_index; // equals the 0-based sheet row index
        let end_index = start_index + 1;

        let body = json!({
            "requests": [{
                "deleteDimension": {
                    "range": {
                        "sheetId":    sheet_id,
                        "dimension":  "ROWS",
                        "startIndex": start_index,
                        "endIndex":   end_index
                    }
                }
            }]
        });

        let url = format!("{}/{}:batchUpdate", SHEETS_BASE, self.spreadsheet_id);

        let resp = self.http
            .post(&url)
            .bearer_auth(&self.bearer().await?)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("delete_row request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("delete_row error {}: {}", status, text));
        }
        Ok(())
    }

    // ─── VERIFY ACCESS ───────────────────────────────────────────────────────

    /// Verify that the service account can access this spreadsheet.
    /// Returns list of existing tab names.
    pub async fn verify_access(&self) -> Result<Vec<String>, String> {
        let url = format!("{}/{}?fields=sheets.properties.title", SHEETS_BASE, self.spreadsheet_id);
        let resp = self.http
            .get(&url)
            .bearer_auth(&self.bearer().await?)
            .send()
            .await
            .map_err(|e| format!("verify_access request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("verify_access error {}: {}. Make sure you shared the spreadsheet with the service account as Editor.", status, text));
        }

        let data: CreateSpreadsheetResponse = resp.json().await
            .map_err(|e| format!("verify_access parse error: {}", e))?;

        Ok(data.sheets.unwrap_or_default()
            .into_iter()
            .map(|s| s.properties.title)
            .collect())
    }

    // ─── ADD SHEET TAB ───────────────────────────────────────────────────────

    /// Add a new sheet tab to the spreadsheet.
    pub async fn add_sheet(&self, name: &str) -> Result<(), String> {
        let body = json!({
            "requests": [{ "addSheet": { "properties": { "title": name } } }]
        });
        let url = format!("{}/{}:batchUpdate", SHEETS_BASE, self.spreadsheet_id);
        let resp = self.http
            .post(&url)
            .bearer_auth(&self.bearer().await?)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("add_sheet request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("add_sheet error {}: {}", status, text));
        }
        Ok(())
    }

    // ─── GET SHEET ID ────────────────────────────────────────────────────────

    /// Get the internal numeric sheet ID for a named tab.
    pub async fn get_sheet_id(&self, sheet_name: &str) -> Result<u32, String> {
        let url = format!(
            "{}/{}?fields=sheets.properties",
            SHEETS_BASE, self.spreadsheet_id
        );

        let resp = self.http
            .get(&url)
            .bearer_auth(&self.bearer().await?)
            .send()
            .await
            .map_err(|e| format!("get_sheet_id request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("get_sheet_id error {}: {}", status, text));
        }

        let data: CreateSpreadsheetResponse = resp
            .json()
            .await
            .map_err(|e| format!("get_sheet_id parse error: {}", e))?;

        data.sheets
            .unwrap_or_default()
            .into_iter()
            .find(|s| s.properties.title == sheet_name)
            .map(|s| s.properties.sheet_id)
            .ok_or_else(|| format!("Sheet '{}' not found", sheet_name))
    }

    // ─── FIND ROW BY ID ──────────────────────────────────────────────────────

    /// Find the 1-based data row index of a row whose column A matches `id`.
    /// Returns None if not found.
    pub async fn find_row_by_id(
        &self,
        sheet: &str,
        id: &str,
    ) -> Result<Option<u32>, String> {
        let rows = self.get_all_rows(sheet).await?;
        for (idx, row) in rows.iter().enumerate() {
            if row.first().map(|s| s.as_str()) == Some(id) {
                return Ok(Some((idx + 1) as u32)); // 1-based
            }
        }
        Ok(None)
    }

    /// Find all 1-based data row indices where column B (index 1) matches `member_id`.
    /// Used for cascade deletes across related sheets.
    pub async fn find_rows_by_member_id(
        &self,
        sheet: &str,
        member_id: &str,
    ) -> Result<Vec<u32>, String> {
        let rows = self.get_all_rows(sheet).await?;
        let indices: Vec<u32> = rows
            .iter()
            .enumerate()
            .filter(|(_, row)| row.get(1).map(|s| s.as_str()) == Some(member_id))
            .map(|(idx, _)| (idx + 1) as u32)
            .collect();
        Ok(indices)
    }

    // ─── WRITE / READ SINGLE CELL ────────────────────────────────────────────

    /// Write a single cell value. Primarily used for config blobs stored at A1.
    pub async fn write_cell(&self, range: &str, value: &str) -> Result<(), String> {
        let url = format!(
            "{}/{}/values/{}?valueInputOption=RAW",
            SHEETS_BASE,
            self.spreadsheet_id,
            urlencoding::encode(range)
        );
        let body = json!({ "values": [[value]] });

        let resp = self.http
            .put(&url)
            .bearer_auth(&self.bearer().await?)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("write_cell request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("write_cell error {}: {}", status, text));
        }
        Ok(())
    }

    /// Read a single cell value. Returns None if the cell is empty.
    pub async fn read_cell(&self, range: &str) -> Result<Option<String>, String> {
        let url = format!(
            "{}/{}/values/{}",
            SHEETS_BASE,
            self.spreadsheet_id,
            urlencoding::encode(range)
        );

        let resp = self.http
            .get(&url)
            .bearer_auth(&self.bearer().await?)
            .send()
            .await
            .map_err(|e| format!("read_cell request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("read_cell error {}: {}", status, text));
        }

        let vr: ValueRange = resp
            .json()
            .await
            .map_err(|e| format!("read_cell parse error: {}", e))?;

        Ok(vr.values
            .and_then(|v| v.into_iter().next())
            .and_then(|row| row.into_iter().next())
            .map(cell_to_string))
    }

    // ─── LOG ACTION ──────────────────────────────────────────────────────────

    /// Append a structured entry to the Logs tab.
    /// Columns: timestamp | action | collection | recordId | details
    pub async fn log_action(
        &self,
        action: &str,
        collection: &str,
        record_id: &str,
        details: &str,
    ) -> Result<(), String> {
        let now = chrono::Utc::now().to_rfc3339();
        self.append_row(
            crate::models::SHEET_LOGS,
            vec![
                now,
                action.to_string(),
                collection.to_string(),
                record_id.to_string(),
                details.to_string(),
            ],
        )
        .await
    }
}
