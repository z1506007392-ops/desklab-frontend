mod archive;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            archive::archive_directory,
            archive::archive_read,
            archive::archive_write,
            archive::archive_remove,
        ])
        .run(tauri::generate_context!())
        .expect("error while running DeskLab");
}
