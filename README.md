<div align="center">

<img src="public/logo.svg" alt="Taqyeed AI Logo" width="105" height="105" />

# Taqyeed AI (تقييد)

### Bind Your Knowledge — Smart Lecture Recording, Note-Taking & Custom AI Actions
#### قَيِّدْ عِلْمَكَ — تدوين ذكي وتسجيل للدروس والمحاضرات مع أدوات ذكاء اصطناعي مخصصة — مفتوح المصدر

[![MIT License](https://img.shields.io/badge/License-MIT-emerald.svg?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20Windows%20%7C%20Web-blue.svg?style=for-the-badge)](#-downloads--releases)
[![AI Actions](https://img.shields.io/badge/AI%20Actions-100%25%20Customizable-brightgreen.svg?style=for-the-badge)](#2--fully-customizable-ai-actions-studio)
[![Local-First](https://img.shields.io/badge/Storage-100%25%20Local--First-purple.svg?style=for-the-badge)](#6--100-local-first--zero-telemetry)
[![BYOK](https://img.shields.io/badge/BYOK-Google%20Gemini%20(Free)%20%7C%20OpenRouter-orange.svg?style=for-the-badge)](#3--bring-your-own-key-byok--free-gemini-tier)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg?style=for-the-badge)](#-contributing--community)

<p align="center">
  <a href="https://github.com/okba-boubakeur/Taqyeed-AI/raw/main/release/Taqyeed.apk"><strong>📱 Download APK (Android)</strong></a> •
  <a href="https://github.com/okba-boubakeur/Taqyeed-AI/raw/main/release/Taqyeed.exe"><strong>💻 Download EXE (Windows)</strong></a> •
  <a href="#-why-taqyeed-vs-other-apps"><strong>⚖️ Compare vs Competitors</strong></a> •
  <a href="#-core-features"><strong>⚡ Core Features</strong></a> •
  <a href="#-quick-start"><strong>🛠️ Quick Start</strong></a> •
  <a href="#-faq"><strong>❓ FAQ</strong></a> •
  <a href="#-contributing--community"><strong>🤝 Contributing</strong></a>
</p>

</div>

---

### What is Taqyeed AI?

During an intensive lecture, seminar, or study circle, you are constantly forced to choose: **do you listen attentively, or do you scramble to write notes before the speaker moves on?**

Existing voice recorders give you hours of audio you never have time to re-listen to. Typical AI transcription tools produce robotic, repetitive transcripts that ignore your personal observations.

**Taqyeed AI (تقييد)** solves this with a practical, local-first workflow:
1. **Record in the background** while you write down your own spontaneous thoughts, references, and questions inside the note editor.
2. **When the lecture ends**, AI fuses your written notes with the audio transcript into an organized study document. It uses your writing as the anchor, strictly avoids repeating what you already noted, and seamlessly injects the spoken proofs, citations, and missing context.
3. **Customize your own AI toolset**—from Hadith Takhrij and Fiqh analysis to custom exam-prep flashcards—using your own free Google Gemini API key or OpenRouter.

---

## ⚖️ Why Taqyeed vs Other Apps?

Most AI speech-to-note apps (like Granola, AudioPen, or Otter) charge steep monthly subscriptions, store your audio on private cloud servers, and lock you into fixed, uneditable summary formats. Taqyeed is built on an entirely different philosophy:

| Capability | **Taqyeed AI** | **Granola** | **AudioPen** | **Otter.ai** | **Notion AI** | **Obsidian** |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Pricing & License** | **100% Free & Open Source (MIT)** | Freemium ($14–$35/mo) | Paid ($75–$99/yr) | Paid ($17–$30/mo) | $10/user/mo add-on | Free Core |
| **Simultaneous Record & Write** | **Yes (Live in-editor sync)** | Desktop only | ❌ Voice only | ❌ Transcript only | ❌ Notes only | ❌ Plugin required |
| **Smart Note De-Duplication** | **Yes (Preserves user text)** | Yes | ❌ | ❌ | ❌ | ❌ |
| **Long Audio Support (1–3h+)** | **Yes (Full lectures/classes)** | Meetings only | Short rambles only | Meetings only | ❌ Text only | ❌ Plugin required |
| **Custom AI Actions Studio** | **Yes (Create & edit prompts)** | Limited | Style presets only | ❌ | Fixed prompts | ❌ Community plugins |
| **AI Model Freedom (BYOK)** | **Gemini (Free tier) + OpenRouter** | Closed proprietary | Closed proprietary | Closed proprietary | Closed proprietary | ❌ Community plugins |
| **Zero Ongoing AI Cost** | **Yes (Google AI Studio free tier)** | Paid subscription | Paid subscription | 300 mins/mo limit | Paid add-on | Depends on provider |
| **Specialized Islamic/Hadith Tools** | **Yes (Built-in Takhrij & Fiqh)** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Academic PDF Export** | **Yes (Warm paper & auto-contrast)**| ❌ Plain export | ❌ Plain text | ❌ Plain export | Basic export | Requires CSS snippets |
| **Privacy & Storage** | **100% Local-First (IndexedDB)** | Cloud servers | Cloud servers | Cloud servers | Cloud servers | Local markdown |

---

## ⚡ Core Features

### 1. 🎙️ Simultaneous Record & Write (Never Miss a Word)
- **Take notes while recording live audio:** No need to switch between an audio recorder and a notes app. An embedded waveform bar tracks elapsed time and lets you pause or resume at will.
- **Smart AI De-Duplication:** When generating notes from audio, Taqyeed treats your written text as primary ground truth. It avoids repeating points you already recorded and specifically extracts only the supplementary explanations, quotes, and examples from the audio.

### 2. ⚡ Fully Customizable AI Actions Studio
- **You are not locked into hardcoded prompts:** Taqyeed includes a visual Action Manager where you can build brand new custom AI actions from scratch, complete with custom system prompts, Lucide icons, and bilingual titles.
- **Edit any existing prompt:** Refine the built-in Hadith Takhrij prompt to target specific classical collections (*Kutub as-Sittah*, *Musnad Ahmad*), tune Fiqh prompts to your preferred Madhhab, or build tailored prompts for law, medicine, or linguistics.
- **Dual-Context Workflow:**
  - **Selection Quick Actions (Bubble Menu):** Highlight any sentence or paragraph in your note for instant contextual actions (*Grammar Parsing / I'rab*, *Hadith Source Lookup*, *Translate*, *Summarize Selection*).
  - **General Note Actions (Floating Assistant):** Run high-level transformations on the entire document (*Generate Comprehensive Study Guide*, *Extract Key Juristic Rulings*, *Produce Revision Flashcard Questions*).
- **1-Click Management:** Toggle actions on or off to keep your workspace uncluttered, reorder your workflow, or restore factory defaults anytime.

### 3. 🔑 Bring Your Own Key (BYOK) & Free Gemini Tier
- **Google Gemini 2.5 Flash / Pro (Default):** Ultra-fast comprehension of multi-speaker lectures, classical Arabic (*Fusha*), and complex terminology.
- **Zero Cost with Google AI Studio:** Includes an inline guide explaining how to obtain a free personal Gemini API key in 4 steps with **zero credit card required**.
- **OpenRouter (100+ Models):** Switch to Claude 3.5 Sonnet, DeepSeek-V3, Llama 3.3 70B, Qwen, or Mistral whenever you want.
- **Key Testing & Cross-Validation:** Test key validity with 1 click. Built-in format checking alerts you if you accidentally enter a Gemini key into OpenRouter or vice versa.

### 4. 📜 Built for Islamic Scholarship & Academic Rigor
- **Hadith Takhrij & Source Citation ("التخريج والمراجع والمصادر"):** Isolate spoken or written Hadith citations, extract narrator chains (*Isnad*), and format references according to classical scholarly standards.
- **Fiqh & Grammar Polish:** Refine technical terminology, verify Tashkeel on critical verses, and organize legal proofs (*Adillah*) cleanly.
- **Universal Utility:** Easily adapted for university lectures, legal case briefs, medical pharmacology reviews, or research symposiums.

### 5. 📄 Publication-Ready PDF Export with Warm Paper Palettes
- **No More Sterile White Pages:** Export documents rendered on authentic physical-paper color palettes:
  - *Scholar's Light*: Warm Peach (`#ffedd5`), Soft Amber (`#fed7aa`), Light Gray (`#f5f5f5`), Paper White (`#fafafa`), Warm Yellow (`#fef3c7`).
  - *Nocturnal Dark*: Deep Slate (`#171717`), Warm Stone (`#1c1917`), Neutral Dark (`#262626`), Midnight Black (`#0c0a09`), Zinc (`#18181b`).
- **Dynamic Luminance & Contrast Inversion:** The PDF engine detects paper luminance (`isDarkPaper`) and automatically switches body text to crisp ivory or deep charcoal, keeping headers, divider rules, and margins balanced.
- **Dedicated References Section:** The references section (*والتخريج والمراجع والمصادر*) is cleanly separated by a fine divider line and set in an unbolded scholarly font for an authentic manuscript look.
- **Bilingual RTL/LTR Typesetting:** Tajawal typography with zero punctuation reversal or bullet point misalignment.

### 6. 🔒 100% Local-First & Zero Telemetry
- **IndexedDB via Dexie.js:** Notes, recordings, folders, and prompt configurations stay on your physical device.
- **No Tracking, No Cloud Lock-In:** Taqyeed sends data directly to your configured AI provider (Google or OpenRouter) using your private API key. Nothing touches any middleman server.

---

## 📥 Downloads & Releases

Direct 1-click standalone downloads (no GitHub preview page):

| Platform | Format | Direct Download | Status | Checksum (SHA-256) |
| :--- | :--- | :--- | :--- | :--- |
| **Android** | `.apk` (ARM64 / Universal) | [**⬇️ Download Taqyeed.apk**](https://github.com/okba-boubakeur/Taqyeed-AI/raw/main/release/Taqyeed.apk) | ![Ready](https://img.shields.io/badge/Status-Ready-brightgreen.svg) | `A74A0F10F3B3E50AA9A6FC3E2A6A4BF5580E0C9B4FE61249C23F6F6066FB298E` |
| **Windows** | `.exe` (x64 Desktop) | [**⬇️ Download Taqyeed.exe**](https://github.com/okba-boubakeur/Taqyeed-AI/raw/main/release/Taqyeed.exe) | ![Ready](https://img.shields.io/badge/Status-Ready-brightgreen.svg) | `D8C22583A5D3863DD8207B103F4045F85A6972430C3A7DF46A73B3A0B88DAE63` |
| **Web App** | PWA / Browser | [**🌐 Launch Web Version**](#-quick-start) | ![Ready](https://img.shields.io/badge/Status-Active-brightgreen.svg) | Localhost / PWA |

*All release binaries are verified with SHA-256 checksums in [`release/checksums.txt`](release/checksums.txt).*

---

## 🛠️ Quick Start

Taqyeed AI is built with **React 19, TypeScript, Vite, Tailwind CSS v4, Capacitor (Android), and Tauri (Desktop Windows)**.

### Run in Browser
```bash
# 1. Clone repository
git clone https://github.com/okba-boubakeur/Taqyeed-AI.git
cd Taqyeed-AI

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build Android APK (Capacitor)
```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```
Output APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

### Build Windows EXE (Tauri)
```bash
npm run tauri build
```
Output binary: `src-tauri/target/release/Taqyeed.exe`.

---

## ❓ FAQ

### How does simultaneous recording and note-taking work?
When you open an empty or existing note, tap the microphone to begin recording. An in-editor bar tracks the recording while keeping the keyboard and text area active. After stopping, tap **Summarize with AI**—the AI uses your written notes as the foundation, filling in spoken details and citations without repeating what you already typed.

### Can I create and edit my own AI prompts in Taqyeed?
**Yes.** Under **Settings → Quick & General Actions Manager**, you can edit any default prompt or create new ones from scratch. You choose the title, icon, and system prompt, and decide whether it runs on selected text (bubble menu) or the entire document (floating assistant).

### Is Taqyeed AI really free? Do I need a credit card?
**Yes, 100% free and open source.** Taqyeed does not charge any fees or subscriptions. Google Gemini offers a generous free tier via Google AI Studio that requires no credit card. You only pay if you choose to use paid tiers or paid third-party models on OpenRouter.

### Can I customize the background color and style of exported PDFs?
**Yes.** Taqyeed lets you choose from 10 curated paper palettes (Warm Peach, Soft Amber, Light Gray, Paper White, Warm Yellow, Deep Slate, Neutral Dark, Warm Stone, Midnight Black, and Zinc) or custom background patterns. The PDF engine automatically inverts text color and adjusts contrast to ensure clean readability.

### Does Taqyeed work offline?
Taking notes, browsing your library, searching, and exporting PDFs works **100% offline**. An internet connection is only needed when executing AI processing tasks (audio transcription, summary, or custom AI actions).

---

## 🤝 Contributing & Community

Contributions from developers, students of knowledge, designers, and translators are warmly welcomed!

### 📣 Open Call for Contributions
> **Please never hesitate to report bugs, suggest new features, or submit pull requests!**
> 
> * 🐛 **Bug Reports:** Help us catch edge cases in audio recording, PDF formatting, or cross-platform UI.
> * 💡 **Feature Suggestions:** Recommend new scholarly prompts, export formats, or workflow tools.
> * 🌐 **Translations:** Help translate the interface into additional languages (Urdu, Turkish, Indonesian, Malay, etc.).
> * 💻 **Code Contributions:** Submit PRs for editor enhancements, offline Whisper models, or desktop shortcuts.

1. Fork the repository (`https://github.com/okba-boubakeur/Taqyeed-AI`).
2. Create your branch (`git checkout -b feature/my-feature`).
3. Commit your changes (`git commit -m 'Add new feature'`).
4. Push to branch (`git push origin feature/my-feature`).
5. Open a Pull Request on GitHub.

To report a bug or request a feature, please [open an issue on GitHub](https://github.com/okba-boubakeur/Taqyeed-AI/issues).

---

## 📜 License & Dedication

Licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

### لوجه الله تعالى (Dedication)
> هذا العمل وقفٌ خيري وصدقة جارية لوجه الله تعالى، صُمِّم وطُوِّر خدمةً لطلبة العلم الشرعي والباحثين وطلاب المعرفة في كل مكان. نسأل الله أن ينفع به كاتبه وقارئه ومطوره ومَن ساهم فيه ونشره.
> 
> *"This work is dedicated for the sake of Allah — an ongoing charity (Sadaqah Jariyah) in service of students of Islamic knowledge and researchers worldwide. We pray that Allah accepts it and benefits everyone who uses, develops, or shares it."*

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/okba-boubakeur">Okba Boubakeur</a> & Open Source Contributors.</sub>
</div>
