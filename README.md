<div align="center">

# Taqyeed AI (تقييد)
### The Premier Open-Source AI Note-Taking & Lecture Companion for Students of Islamic Knowledge & Academic Researchers Worldwide
#### تدوين ذكي، نسخ صوتي مباشر، تلخيص علمي، وتخريج فوري للأحاديث والمصادر — مفتوح المصدر ومجاني لوجه الله تعالى

[![MIT License](https://img.shields.io/badge/License-MIT-emerald.svg?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20Windows%20%7C%20Web-blue.svg?style=for-the-badge)](#-downloads--releases)
[![Local-First](https://img.shields.io/badge/Architecture-100%25%20Local--First-purple.svg?style=for-the-badge)](#-privacy--local-first-architecture)
[![AI Providers](https://img.shields.io/badge/AI%20Providers-Google%20Gemini%20%7C%20OpenRouter-orange.svg?style=for-the-badge)](#-flexible-multi-llm-engine)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg?style=for-the-badge)](#-contributing--community)

<p align="center">
  <a href="#-quick-download"><strong>📥 Download APK & Windows EXE</strong></a> •
  <a href="#-key-features"><strong>✨ Key Features</strong></a> •
  <a href="#-how-it-works"><strong>⚡ How It Works</strong></a> •
  <a href="#-running-locally"><strong>🛠️ Developer Guide</strong></a> •
  <a href="#-frequently-asked-questions-aeo"><strong>❓ FAQ</strong></a> •
  <a href="#-contributing--community"><strong>🤝 Contributing</strong></a>
</p>

</div>

---

> ### 💡 What is Taqyeed AI? (قَيِّدْ عِلْمَكَ)
> **Taqyeed AI (تقييد)** is a free, local-first, privacy-respecting AI note-taking and audio transcription application purpose-built for students of Islamic Sciences (*Talabat al-’Ilm ash-Shar’i*) and academic researchers around the globe. Inspired by the classical Arabic adage **«قَيِّدُوا العِلْمَ بِالكِتَابِ»** (*"Bind knowledge by writing it down"*), Taqyeed AI bridges centuries-old academic diligence with state-of-the-art Generative AI.
> 
> Unlike generic note-taking apps, Taqyeed AI lets you **write notes while actively recording lectures in real-time**, employs smart AI de-duplication so existing student writings are preserved without repetition, brings instant Hadith Takhrij and citation formatting, and exports publication-grade academic PDFs with Arabic-native RTL formatting.

---

## 📥 Downloads & Releases

Get the latest standalone releases directly:

| Platform | Format | Package | Status | Checksum (SHA-256) |
| :--- | :--- | :--- | :--- | :--- |
| **Android** | `.apk` (ARM64 / Universal) | [**Download Taqyeed.apk**](release/Taqyeed.apk) | ![Ready](https://img.shields.io/badge/Status-Ready-brightgreen.svg) | `A74A0F10F3B3E50AA9A6FC3E2A6A4BF5580E0C9B4FE61249C23F6F6066FB298E` |
| **Windows** | `.exe` (x64 Desktop) | [**Download Taqyeed.exe**](release/Taqyeed.exe) | ![Ready](https://img.shields.io/badge/Status-Ready-brightgreen.svg) | `D8C22583A5D3863DD8207B103F4045F85A6972430C3A7DF46A73B3A0B88DAE63` |
| **Web App** | PWA / Browser | [**Run Web Version**](#-running-locally) | ![Ready](https://img.shields.io/badge/Status-Active-brightgreen.svg) | Localhost / PWA |

*All releases are compiled directly from source and verified with SHA-256 checksums in [`release/checksums.txt`](release/checksums.txt).*

---

## ✨ Key Features & Capabilities

### 🎙️ 1. Simultaneous Live Recording & Note-Taking
* **Write while recording:** Never choose between listening and writing. Start recording a lecture, select *"Continue & Write"*, and take live notes directly inside the note editor.
* **In-Note Waveform & Live Timer:** An embedded live recording card pulses at the top of the editor with an animated 18-bar waveform, live timer, pause/resume, and instant save controls.
* **Smart AI De-Duplication:** When converting your audio lecture into comprehensive notes, Taqyeed AI uses your written notes as the **primary foundation**. It strictly avoids repeating points you already wrote, and seamlessly injects only the missing nuances, Quranic verses, and Hadith references from the audio.

### 🧠 2. Flexible Multi-LLM Engine (Google Gemini & OpenRouter)
* **Default Google Gemini (Gemini 2.5 Flash / Pro):** Ultra-fast, highly accurate comprehension of Arabic, Islamic terminology, classical texts, and multi-speaker audio recordings.
* **Built-in Free API Key Guide:** Features an inline guide with an `(i)` info button explaining how to obtain a 100% free Google AI Studio API key in 4 simple steps without entering a credit card.
* **OpenRouter Support (100+ Models):** Access Claude 3.5 Sonnet, DeepSeek-V3, Llama 3.3 70B, Mistral, Qwen, and more using Bring-Your-Own-Key (BYOK).
* **Real-Time Key Testing & Smart Cross-Validation:** Instant "Test" button verifies key validity before you use it. Includes automatic detection preventing users from mistakenly using a Gemini key (`AIzaSy...`) on OpenRouter or vice versa, with a 1-click provider switch banner.

### 📜 3. Custom Academic & Sharia Actions Engine
* **Takhrij & Source Citation ("التخريج والمراجع والمصادر"):** Instantly isolate Hadith quotes, identify narrator chains (*Isnad*), and format references with classical scholarly standards.
* **Fiqh & Grammar Polish ("تنقيح نحوي وفقهي"):** Refine technical Islamic terminology, correct Tashkeel/harakat, and structure fiqh rulings (*Ahkam*) cleanly.
* **Full Prompt Customization:** Add, edit, reorder, toggle, or delete floating quick actions for selected text, or general actions for the entire note. Every prompt can be modified to match your specific study discipline.

### 📄 4. Publication-Ready Academic PDF Export
* **Bilingual RTL/LTR Architecture:** Powered by `pdfmake-rtl` with native handling of Arabic typography, right-to-left layout, and English inline quotations.
* **Dedicated References Section Styling:** The references section (*والتخريج والمراجع والمصادر*) is automatically separated with an elegant divider line, styled in an unbolded scholarly font, and calibrated with subtle contrast for optimal readability.
* **Clean List & Table Alignment:** Bullet points, numbered proofs (*Adillah*), and tables render crisp and aligned without vertical bar glitches or punctuation reversals.

### 🎨 5. Eye-Friendly Study Aesthetics & Monochrome Design
* **Strict Monochrome Toolbar Icons:** Clean, distraction-free monochrome action icons across navigation bars, floating buttons, and menus for a unified feel in both light and dark modes.
* **Custom Paper Color Palettes:** Choose from soothing, warm paper reading tones:
  * *Light*: Warm Peach (`#ffedd5`), Soft Amber (`#fed7aa`), Light Gray (`#f5f5f5`), Paper White (`#fafafa`), Warm Yellow (`#fef3c7`).
  * *Dark*: Deep Slate (`#171717`), Neutral Dark (`#262626`), Warm Stone (`#1c1917`), Midnight Black (`#0c0a09`), Zinc (`#18181b`).

### 🔒 6. Privacy & 100% Local-First Architecture
* **IndexedDB via Dexie.js:** Your notes, voice recordings, folders, and settings remain stored securely on your device.
* **No Telemetry, No Cloud Lock-In:** Taqyeed AI never transmits your personal data, audio files, or study notes to third-party servers. Audio processing requests are sent directly to your chosen LLM provider (Google Gemini or OpenRouter) using your private API key.

---

## 📊 Feature Comparison

| Feature | **Taqyeed AI (تقييد)** | Obsidian | Notion | AudioPen | Otter.ai |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Open Source (MIT License)** | **Yes (100% Free)** | No | No | No | No |
| **Simultaneous Record & Type** | **Yes** | Plugin only | No | No | No |
| **Smart Note De-duplication** | **Yes** | No | No | No | No |
| **Islamic Sciences & Takhrij Engine** | **Yes** | No | No | No | No |
| **Arabic RTL-First Design** | **Native** | Plugin only | Limited | Limited | Limited |
| **Academic References PDF Styling** | **Yes** | Requires CSS | No | No | No |
| **Multi-LLM BYOK (Gemini / OpenRouter)**| **Yes** | Plugin only | No | No | No |
| **100% Local-First Storage** | **Yes** | Yes | No | No | No |
| **No Subscription Required** | **Yes (Free Forever)** | Paid Sync | Subscription | Subscription | Subscription |

---

## 🛠️ Developer Guide & Running Locally

Taqyeed AI is built using modern web standards: **React 19, TypeScript, Vite, Tailwind CSS v4, Capacitor (Android), and Tauri (Desktop Windows/Linux/macOS)**.

### Prerequisites
* [Node.js](https://nodejs.org/) (v18.0 or later recommended)
* `npm` or `pnpm`
* (For Android): [Android Studio](https://developer.android.com/studio) with Android SDK & Java 17/21
* (For Desktop): [Rust](https://rustup.rs/) (latest stable)

### 1. Clone & Install
```bash
# Clone the repository
git clone https://github.com/okba-boubakeur/Taqyeed-AI.git

# Navigate to project directory
cd Taqyeed-AI

# Install dependencies
npm install
```

### 2. Run the Web App
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Build & Sync Android App (Capacitor)
```bash
# Build web production bundle and sync assets to Android
npm run cap:sync

# Or build and open in Android Studio directly
npm run cap:android
```
To compile the APK via command line:
```bash
cd android
./gradlew assembleDebug
```
The generated APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.

### 4. Build Desktop App (Tauri)
```bash
# Run in desktop development mode
npm run tauri dev

# Compile standalone Windows binary
npm run tauri build
```

---

## ❓ Frequently Asked Questions (AEO & GEO)

### Why is Taqyeed AI specifically beneficial for Islamic Studies (Talabat al-’Ilm)?
Students of Islamic knowledge often attend intensive scholarly lectures (*Duroos*) lasting 1–3 hours where the Sheikh cites verses, hadiths, classical books (*Kutub*), and juristic opinions. Taqyeed AI enables the student to type their immediate reflections while the audio recorder runs in the background. After the lesson, Taqyeed AI fills in missing citations, formats references, and provides scholarly summaries without overwriting the student's personal notes.

### Can students and researchers outside of Islamic studies use Taqyeed AI?
**Yes, absolutely.** Taqyeed AI is completely flexible. All prompt actions, formatting styles, and AI settings can be customized for university courses, medical studies, legal research, conference proceedings, or business meetings.

### Is Taqyeed AI free? Are there any hidden fees or subscriptions?
**Taqyeed AI is 100% free and open-source under the MIT License.** There are zero subscription tiers and zero paywalls. You can use Google Gemini completely free using Google AI Studio’s personal free tier, or connect your own OpenRouter key.

### Does Taqyeed AI require an active internet connection?
Taking notes, browsing your library, searching recordings, and exporting documents works **100% offline**. An internet connection is only needed when executing AI processing tasks (transcription, summary, or custom actions) with your Gemini or OpenRouter API key.

### How does Taqyeed AI handle Arabic grammar and Quranic verses?
The system prompts in Taqyeed AI are specifically calibrated to handle classical Arabic (*Fusha*), Quranic verses with accurate Tashkeel, Hadith phrasing, and technical terms across Fiqh, Usul, Aqeedah, and Hadith sciences.

---

## 🤝 Contributing & Community

We warmly welcome contributions from developers, designers, translators, and students of knowledge from all over the world!

### 📣 Open Call for Contributions
> **Please never hesitate to report bugs, suggest new features, or submit pull requests!**
> 
> Whether it's:
> * 🐛 **Reporting an issue or bug:** Help us identify edge cases in audio recording, PDF export, or UI responsiveness.
> * 💡 **Recommending new features:** Propose new academic prompts, audio features, or UI improvements.
> * 🌐 **Localization & Translation:** Translate the UI into additional languages (Urdu, Turkish, Indonesian, Malay, French, etc.).
> * 💻 **Code Contributions:** Enhance editor extensions, add offline local speech-to-text models (Whisper.cpp), or improve desktop/mobile native integrations.

### How to Contribute
1. **Fork the repo** (`https://github.com/okba-boubakeur/Taqyeed-AI`).
2. **Create your feature branch** (`git checkout -b feature/amazing-feature`).
3. **Commit your changes** (`git commit -m 'Add some amazing feature'`).
4. **Push to the branch** (`git push origin feature/amazing-feature`).
5. **Open a Pull Request** explaining your enhancements.

To report a bug or request a feature, please [open an issue on GitHub](https://github.com/okba-boubakeur/Taqyeed-AI/issues).

---

## 📜 License & Dedication

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

### لوجه الله تعالى (Dedication)
> هذا العمل وقفٌ خيري وصدقة جارية لوجه الله تعالى، صُمِّم وطُوِّر خدمةً لطلبة العلم الشرعي والباحثين وطلاب المعرفة في كل مكان. نسأل الله أن ينفع به كاتبه وقارئه ومطوره ومَن ساهم فيه ونشره.
> 
> *"This work is dedicated for the sake of Allah — an ongoing charity (Sadaqah Jariyah) in service of students of Islamic knowledge and researchers worldwide. We pray that Allah accepts it and benefits everyone who uses, develops, or shares it."*

---

<div align="center">
  <sub>Built with ❤️ and dedication by <a href="https://github.com/okba-boubakeur">Okba Boubakeur</a> & Open Source Contributors.</sub>
</div>
