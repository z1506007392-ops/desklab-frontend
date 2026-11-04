use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use tauri::Manager;

const MAX_ARCHIVE_BYTES: usize = 8 * 1024 * 1024;

pub fn valid_archive_name(name: &str) -> bool {
    if name.is_empty() || name.len() > 80 || name.starts_with('.') || name.contains("..") {
        return false;
    }
    name.chars().all(|character| {
        character.is_ascii_alphanumeric() || character == '.' || character == '-' || character == '_'
    })
}

fn archive_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "存档目录没有准备好。".to_string())?;
    fs::create_dir_all(&dir).map_err(|error| io_message(&error, false))?;
    Ok(dir)
}

fn archive_file(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    if !valid_archive_name(name) {
        return Err("非法的存档文件名".into());
    }
    Ok(archive_dir(app)?.join(name))
}

fn hidden_sibling(path: &Path, suffix: &str) -> PathBuf {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("archive");
    path.with_file_name(format!(".{name}.{suffix}"))
}

fn io_message(error: &std::io::Error, reading: bool) -> String {
    match error.kind() {
        ErrorKind::PermissionDenied => {
            if reading {
                "这台电脑不允许读取存档。".into()
            } else {
                "这台电脑不允许写入存档。".into()
            }
        }
        ErrorKind::StorageFull | ErrorKind::OutOfMemory => "这台电脑的存储空间不够，存档没有写上。".into(),
        _ => {
            if reading {
                "存档没有从这台电脑上读出来。".into()
            } else {
                "存档没有写到这台电脑上。".into()
            }
        }
    }
}

/// Put `tmp` in place of `path`. A rename that cannot replace an existing
/// file (Windows) moves the old file aside first and puts it back if the new
/// one never lands. The old file is not deleted before that succeeds.
fn replace_file(tmp: &Path, path: &Path) -> Result<(), String> {
    match fs::rename(tmp, path) {
        Ok(()) => return Ok(()),
        Err(error) if !path.exists() => return Err(io_message(&error, false)),
        Err(_) => {}
    }
    let backup = hidden_sibling(path, "bak");
    fs::rename(path, &backup).map_err(|error| io_message(&error, false))?;
    if let Err(error) = fs::rename(tmp, path) {
        if fs::rename(&backup, path).is_err() {
            return Err("存档没有写完。原来的文件还在旁边，没有被删掉。".into());
        }
        return Err(io_message(&error, false));
    }
    let _ = fs::remove_file(&backup);
    Ok(())
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
    fs::read_to_string(&path)
        .map(Some)
        .map_err(|error| io_message(&error, true))
}

#[tauri::command]
pub fn archive_write(app: tauri::AppHandle, name: String, contents: String) -> Result<(), String> {
    if contents.len() > MAX_ARCHIVE_BYTES {
        return Err("存档太大".into());
    }
    let path = archive_file(&app, &name)?;
    let tmp = hidden_sibling(&path, "tmp");
    if let Err(error) = fs::write(&tmp, contents.as_bytes()) {
        let _ = fs::remove_file(&tmp);
        return Err(io_message(&error, false));
    }
    let written = replace_file(&tmp, &path);
    if written.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    written
}

#[tauri::command]
pub fn archive_remove(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let path = archive_file(&app, &name)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|error| io_message(&error, false))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{hidden_sibling, replace_file, valid_archive_name};
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn scratch() -> std::path::PathBuf {
        let tick = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!("desklab-archive-{tick}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn archive_names_stay_inside_the_directory() {
        assert!(valid_archive_name("project.json"));
        assert!(valid_archive_name("guide-seen.txt"));
        assert!(valid_archive_name("community-profile.json"));
        assert!(!valid_archive_name("../project.json"));
        assert!(!valid_archive_name("a/b"));
        assert!(!valid_archive_name("a\\b"));
        assert!(!valid_archive_name(".hidden"));
        assert!(!valid_archive_name(".project.json.tmp"));
        assert!(!valid_archive_name(""));
    }

    #[test]
    fn replace_swaps_the_new_file_and_leaves_no_temp() {
        let dir = scratch();
        let path = dir.join("project.json");
        fs::write(&path, "old").unwrap();
        let tmp = hidden_sibling(&path, "tmp");
        fs::write(&tmp, "new").unwrap();
        replace_file(&tmp, &path).unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "new");
        assert!(!tmp.exists());
        assert!(!hidden_sibling(&path, "bak").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_missing_temp_file_does_not_delete_the_saved_project() {
        let dir = scratch();
        let path = dir.join("project.json");
        fs::write(&path, "old").unwrap();
        let error = replace_file(&hidden_sibling(&path, "tmp"), &path).unwrap_err();
        assert!(error.chars().any(|character| ('\u{4e00}'..='\u{9fff}').contains(&character)));
        assert_eq!(fs::read_to_string(&path).unwrap(), "old");
        let _ = fs::remove_dir_all(&dir);
    }
}
