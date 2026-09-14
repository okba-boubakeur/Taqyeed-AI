mod tts;
mod recorder;

#[tauri::command]
fn open_url(_url: String) -> Result<(), String> {
  #[cfg(target_os = "windows")]
  {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("cmd")
      .raw_arg(format!("/c start \"\" \"{}\"", _url))
      .spawn()
      .map_err(|e| e.to_string())?;
  }
  #[cfg(target_os = "macos")]
  {
    std::process::Command::new("open")
      .arg(&_url)
      .spawn()
      .map_err(|e| e.to_string())?;
  }
  #[cfg(target_os = "linux")]
  {
    std::process::Command::new("xdg-open")
      .arg(&_url)
      .spawn()
      .map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
        tts::edge_tts_list_voices,
        tts::edge_tts_synthesize,
        recorder::append_audio_chunk,
        open_url,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      #[cfg(desktop)]
      {
        use tauri::Manager;
        let icon_bytes = include_bytes!("../icons/128x128.png");
        if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
          for window in app.webview_windows().values() {
            let _ = window.set_icon(icon.clone());
          }
        }
      }



      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
  #[test]
  fn test_load_icons() {
    let png128 = include_bytes!("../icons/128x128.png");
    let img128 = tauri::image::Image::from_bytes(png128);
    assert!(img128.is_ok(), "128x128.png failed: {:?}", img128.err());

    let png32 = include_bytes!("../icons/32x32.png");
    let img32 = tauri::image::Image::from_bytes(png32);
    assert!(img32.is_ok(), "32x32.png failed: {:?}", img32.err());

    let ico = include_bytes!("../icons/icon.ico");
    let img_ico = tauri::image::Image::from_bytes(ico);
    assert!(img_ico.is_ok(), "icon.ico failed: {:?}", img_ico.err());
  }
}

