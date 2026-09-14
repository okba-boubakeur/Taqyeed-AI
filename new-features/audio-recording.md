The suggested setup (**Opus @ 16 kbps, 16 kHz Mono**) is validated as the optimal choice, but there is one critical technical detail to adjust for **inline API calls**:

---

### The Base64 "Inflation Trap"

When passing an audio file **inline** to an API (such as the Gemini API or OpenAI endpoints), the binary file must be Base64-encoded.

* Base64 adds a **~33% size overhead** (every 3 bytes of binary become 4 characters).
* If the API has a strict **20 MB total payload limit** (e.g., Gemini's inline request ceiling):

$$\text{Max raw file on disk} \approx \frac{20\text{ MB}}{1.333} \approx 15.0\text{ MB}$$


* To leave room for the JSON payload and prompt tokens, your audio file on disk should stay **under 14.5 MB**.

---

### Format Compatibility Check

| AI Provider / API | Accepts Opus (`.opus` / `.ogg`)? | Accepts AAC (`.m4a`)? | Accepted Audio MIME Types |
| --- | --- | --- | --- |
| **Google Gemini API** (`generateContent`) | **Yes** (`audio/opus`, `audio/ogg`) | **Yes** (`audio/aac`, `audio/m4a`) | WAV, MP3, AAC, FLAC, OGG, OPUS, WEBM |
| **OpenAI Whisper / STT** (`/audio/transcriptions`) | **Yes** (`ogg`, `opus`) | **Yes** (`m4a`, `mp4`) | MP3, MP4, MPEG, MPGA, M4A, WAV, WEBM, OGG |
| **Anthropic Claude** | *Requires text / external transcription first* | *N/A* | *N/A* |

**Opus remains the most efficient choice** because its SILK hybrid layer maintains high speech intelligibility down to **12–16 kbps**, where AAC and MP3 begin exhibiting noticeable phase artifacts and robotic metallic distortion.

---

### Refined Bitrate Budget for Long Lectures

To guarantee your lecture fits inside the **14.5 MB raw threshold** (safely below the 20 MB Base64 inline request ceiling):

* **For up to 2 hours:** Use **16 kbps mono** ($\approx 14.4\text{ MB}$ raw $\to \approx 19.2\text{ MB}$ Base64).
* **For 2 to 2.5+ hours:** Drop slightly to **12 kbps mono**:

$$\frac{12\text{ kbps} \times 9000\text{ s}}{8 \times 1024} \approx 13.18\text{ MB raw} \xrightarrow{\text{Base64}} \approx 17.6\text{ MB payload}$$



---

### Production FFmpeg Adjustment

Set the bitstream to **12 kbps – 16 kbps** with the speech-tuned profile:

```bash
# 2-hour lecture safe budget (14 kbps)
ffmpeg -f alsa -i default -ac 1 -ar 16000 -c:a libopus -b:a 14k -application voip lecture.opus

```

If your API strictly requires the standard Ogg container wrapper, save as `.ogg`:

```bash
ffmpeg -f alsa -i default -ac 1 -ar 16000 -c:a libopus -b:a 14k -application voip lecture.ogg

```