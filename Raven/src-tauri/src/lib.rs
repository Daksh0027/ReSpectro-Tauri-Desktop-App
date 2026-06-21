use std::fs::File;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
pub struct MediaItem {
    id: u64,
    media_type: String, // "movie" or "tv"
    title: Option<String>,
    name: Option<String>,
    release_date: Option<String>,
    first_air_date: Option<String>,
    vote_average: Option<f64>,
    poster_path: Option<String>,
    original_language: Option<String>,
    popularity: Option<f64>,
    genre_ids: Option<Vec<u32>>,
}

// Helper function to resolve the local data directory and create it if necessary
fn get_file_path(app: &AppHandle, filename: &str) -> Result<PathBuf, String> {
    let mut path = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    // Ensure the directories exist
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    path.push(filename);
    Ok(path)
}

// Helper to load media items from a local JSON file
fn load_media(app: &AppHandle, filename: &str) -> Result<Vec<MediaItem>, String> {
    let path = get_file_path(app, filename)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let file = File::open(path).map_err(|e| e.to_string())?;
    let items = serde_json::from_reader(file).map_err(|e| e.to_string())?;
    Ok(items)
}

// Helper to save media items to a local JSON file
fn save_media(app: &AppHandle, filename: &str, items: &[MediaItem]) -> Result<(), String> {
    let path = get_file_path(app, filename)?;
    let file = File::create(path).map_err(|e| e.to_string())?;
    serde_json::to_writer_pretty(file, items).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_favorites(app: AppHandle) -> Result<Vec<MediaItem>, String> {
    load_media(&app, "favorites.json")
}

#[tauri::command]
fn toggle_favorite(app: AppHandle, item: MediaItem) -> Result<Vec<MediaItem>, String> {
    let mut favorites = load_media(&app, "favorites.json")?;
    if let Some(pos) = favorites.iter().position(|m| m.id == item.id && m.media_type == item.media_type) {
        favorites.remove(pos); // Already a favorite, remove it
    } else {
        favorites.push(item); // Not a favorite, add it
    }
    save_media(&app, "favorites.json", &favorites)?;
    Ok(favorites)
}

#[tauri::command]
fn get_history(app: AppHandle) -> Result<Vec<MediaItem>, String> {
    load_media(&app, "history.json")
}

#[tauri::command]
fn add_to_history(app: AppHandle, item: MediaItem) -> Result<Vec<MediaItem>, String> {
    let mut history = load_media(&app, "history.json")?;
    // Remove duplicate to bring it to the top
    if let Some(pos) = history.iter().position(|m| m.id == item.id && m.media_type == item.media_type) {
        history.remove(pos);
    }
    history.insert(0, item); // Insert at index 0 (top of history)
    if history.len() > 50 {
        history.truncate(50); // Cap history at 50 items
    }
    save_media(&app, "history.json", &history)?;
    Ok(history)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_favorites,
            toggle_favorite,
            get_history,
            add_to_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

