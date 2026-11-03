use std::fs;
use std::path::{Path, PathBuf};

use tauri::Manager;

const MAX_ARCHIVE_BYTES: usize = 8 * 1024 * 1024;

pub fn valid_archive_name(name: &str) -> bool {
    if name.is_empty() || name.len() > 80 || name.starts_with('.') || name.contains("..") {
        return false;
    }
    name.chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '.' || character == '-' || character == '_')
}

fn archive_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn archive_file(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    if !valid_archive_name(name) {
        return Err("非法的存档文件名".into());
    }
    Ok(archive_dir(app)?.join(name))
}

fn replace_file(tmp: &Path, path: &Path) -> Result<(), String> {
    match fs::rename(tmp, path) {
        Ok(()) => Ok(()),
        Err(error) if path.exists() => {
            fs::remove_file(path).map_err(|remove_error| remove_error.to_string())?;
            fs::rename(tmp, path).map_err(|rename_error| rename_error.to_string())?;
            let _ = error;
            Ok(())
        }
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn archive_directory(app: tauri::AppHandle) -> Result<String, String> {
    archive_dir(&app).map(|dir| dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn archive_read(app: tauri::AppHandle, name: String) -> Result<Option<String>, String> {
    let path = archive_file(&app, &name)?;
    if !path.is_file() {
        return Ok(None);
    }
    fs::read_to_string(&path).map(Some).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn archive_write(app: tauri::AppHandle, name: String, contents: String) -> Result<(), String> {
    if contents.len() > MAX_ARCHIVE_BYTES {
        return Err("存档太大".into());
    }
    let path = archive_file(&app, &name)?;
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, contents.as_bytes()).map_err(|error| error.to_string())?;
    replace_file(&tmp, &path)
}

#[tauri::command]
pub fn archive_remove(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let path = archive_file(&app, &name)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::valid_archive_name;

    #[test]
    fn archive_names_stay_inside_the_directory() {
        assert!(valid_archive_name("project.json"));
        assert!(valid_archive_name("guide-seen.txt"));
        assert!(!valid_archive_name("../project.json"));
        assert!(!valid_archive_name("a/b"));
        assert!(!valid_archive_name("a\\b"));
        assert!(!valid_archive_name(".hidden"));
        assert!(!valid_archive_name(""));
    }
}
