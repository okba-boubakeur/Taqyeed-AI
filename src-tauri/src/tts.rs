use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct TtsVoice {
    pub name: String,
    pub short_name: String,
    pub locale: String,
    pub gender: String,
}

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
use msedge_tts::{
    tts::client::connect_async,
    tts::SpeechConfig,
    voice::get_voices_list_async,
};

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
#[tauri::command]
pub async fn edge_tts_list_voices(locale: Option<String>) -> Result<Vec<TtsVoice>, String> {
    let voices = get_voices_list_async()
        .await
        .map_err(|e| format!("Failed to fetch voices: {}", e))?;

    let result: Vec<TtsVoice> = voices
        .into_iter()
        .map(|v| TtsVoice {
            name: v.name.clone(),
            short_name: v.short_name.clone().unwrap_or_default(),
            locale: v.locale.clone().unwrap_or_default(),
            gender: v.gender.clone().unwrap_or_default(),
        })
        .filter(|v| {
            if let Some(ref loc) = locale {
                let prefix = loc.split('-').next().unwrap_or(loc).to_lowercase();
                v.locale.to_lowercase().starts_with(&prefix)
            } else {
                true
            }
        })
        .collect();

    Ok(result)
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
#[tauri::command]
pub async fn edge_tts_list_voices(_locale: Option<String>) -> Result<Vec<TtsVoice>, String> {
    Ok(Vec::new())
}

#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
#[tauri::command]
pub async fn edge_tts_synthesize(
    text: String,
    voice: String,
) -> Result<Vec<u8>, String> {
    if text.trim().is_empty() {
        return Ok(Vec::new());
    }

    let voices = get_voices_list_async()
        .await
        .map_err(|e| format!("Failed to fetch voices: {}", e))?;

    let safe_text = text.replace("&", "&amp;")
                        .replace("<", "&lt;")
                        .replace(">", "&gt;");

    let target_voice = voices.iter().find(|v| v.name == voice || v.short_name.as_deref() == Some(&voice));

    let config = match target_voice {
        Some(v) => SpeechConfig::from(v),
        None => {
            let mut c = SpeechConfig::from(&voices[0]);
            c.voice_name = voice.clone();
            c
        }
    };

    let mut tts = connect_async()
        .await
        .map_err(|e| format!("TTS connection failed: {}", e))?;

    let audio = tts
        .synthesize(&safe_text, &config)
        .await
        .map_err(|e| format!("TTS synthesis failed: {}", e))?;

    println!("TTS synthesis completed. Target voice: {}, safe_text length: {}, Audio bytes length: {}", voice, safe_text.len(), audio.audio_bytes.len());

    Ok(audio.audio_bytes)
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
#[tauri::command]
pub async fn edge_tts_synthesize(
    _text: String,
    _voice: String,
) -> Result<Vec<u8>, String> {
    Err("Edge TTS native synthesis is not available on mobile. Using native speech synthesis fallback.".into())
}

