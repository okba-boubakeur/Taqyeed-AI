use std::fs::OpenOptions;
use std::io::Write;

#[tauri::command]
pub fn append_audio_chunk(path: String, data: Vec<u8>) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    file.write_all(&data).map_err(|e| e.to_string())?;
    Ok(())
}
