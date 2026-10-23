use std::fs;
use std::io::Write;
use std::path::PathBuf;

use tauri::Manager;

fn data_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("armtable-data.json"))
}

/// Возвращает весь JSON данных приложения (или None, если файла ещё нет)
#[tauri::command]
fn load_data(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = data_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(&path).map(Some).map_err(|e| e.to_string())
}

/// Атомарная запись данных: сначала во временный файл, затем переименование
#[tauri::command]
fn save_data(app: tauri::AppHandle, data: String) -> Result<(), String> {
    let path = data_path(&app)?;
    let tmp = path.with_extension("json.tmp");
    {
        let mut f = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        f.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        f.sync_all().ok();
    }
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![load_data, save_data])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
