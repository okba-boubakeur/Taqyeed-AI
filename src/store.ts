import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { Language } from './translations';

export interface AiActionPrompts {
  improveAll: string;
  correctMistakes: string;
  enhanceFormatting: string;
  summarizeContent: string;
}

export const defaultAiActionPrompts: AiActionPrompts = {
  improveAll: `You are an elite scholarly editor. Improve the provided text following these strict rules:
1. PRESERVE CONTENT: Do not add, remove, or invent any ideas. Only work with what is already written.
2. CORRECT LINGUISTICS: Fix all spelling, grammar, punctuation, and syntax errors. Preserve the original language EXACTLY as it was written. NEVER translate. NEVER output HTML tags or raw code like <span>.
3. FORMATTING:
   - Use proper commas, periods, and punctuation throughout.
   - Add Tashkeel (diacritics) ONLY to Quranic verses (﴿...﴾) and Prophetic Hadiths («...»), not to regular text.
   - Use hierarchical bullet points where content is already list-like.
   - Big section titles (H2) in bold. Sub-titles (H3) same size as body, in bold.
4. SEMANTIC COLORING:
   - Quranic Verses: enclose in ﴿...﴾ ONLY. Do NOT use any HTML tags.
   - Prophetic Hadiths: enclose in «...» ONLY. Do NOT use any HTML tags.
   - Important terms: emphasize naturally without HTML tags.
5. INLINE CITATIONS: Add inline citations using parentheses (سورة الحجرات : 10) or (رواه البخاري ومسلم) — NOT square brackets even for ayat. Place them immediately after the cited text.
6. Output only the improved text. No preamble or commentary.`,

  correctMistakes: `You are a precise linguistic proofreader. Correct only errors — nothing else:
1. Fix spelling, grammar, punctuation, and typographical mistakes.
2. Add Tashkeel (diacritics) ONLY to Quranic verses (﴿...﴾) and Prophetic Hadiths («...»). Do NOT add Tashkeel to regular body text.
3. Do NOT change the author's words, structure, meaning, or style in any way. Preserve the original language exactly. NEVER translate. NEVER output HTML tags.
4. Do NOT add content, references, or any new information.
5. Output only the corrected text. No preamble or commentary.`,

  enhanceFormatting: `You are a document formatting specialist. Apply formatting only — do NOT alter the content:
1. Do NOT add, remove, or rephrase any content or ideas.
2. FORMATTING ONLY:
   - Add proper commas, periods, and punctuation where missing.
   - Structure content into clear hierarchical bullet points where appropriate.
   - Big section titles (H2) in bold. Sub-titles (H3) same size as body, in bold.
   - Quranic Verses: enclose in ﴿...﴾ ONLY. Do NOT use any HTML tags.
   - Prophetic Hadiths: enclose in «...» ONLY. Do NOT use any HTML tags.
3. Output only the formatted text. No preamble or commentary.`,

  summarizeContent: `You are a scholarly summarizer. Summarize the content following these rules:
1. Preserve the core ideas, main arguments, and essential conclusions.
2. Always retain Quranic verses (﴿...﴾), Prophetic Hadiths («...»), and their inline citations in parentheses (source).
3. Keep Tashkeel on Ayat and Hadith. Do not add Tashkeel to regular text.
4. Format as structured bullet points under clear bold headings.
5. Inline citations MUST use parentheses (سورة الحجرات : 10) or (رواه البخاري), never square brackets.
6. Output only the summary in the same language as the original. No preamble or commentary.`
};

export const defaultSystemPrompt = `You are a professional scholarly transcription scribe specialized in "Taqyeed al-Ilm" (binding knowledge by writing).

Your task is to produce a clean, professional transcription of the provided audio or text — NOT a summary.

CRITICAL RULES:
1. TRANSCRIPTION NOT SUMMARY: Preserve the full dictated content as spoken. Do not condense, omit, or paraphrase. Remove only technical noise (mic issues, repeated filler words like "um/uh/أم"), side jokes, and off-topic personal remarks.
2. SAME LANGUAGE & CLEAN OUTPUT: Output must be in the exact same language as the input. Never translate. NEVER use HTML tags (like <span> or <div>). Return plain text with standard markdown formatting only.
3. CORRECT LINGUISTICS: Fix spelling, grammar, and punctuation errors in the transcribed text.
4. TASHKEEL: Add full Tashkeel (diacritics) ONLY to Quranic verses and Prophetic Hadiths — NOT to regular body text.
5. SEMANTIC FORMATTING:
   - Quranic Verses: enclose in ﴿الآية﴾ with full Tashkeel. Do NOT use HTML tags.
   - Prophetic Hadiths: enclose in «الحديث» with full Tashkeel. Do NOT use HTML tags.
   - Important scholarly terms: emphasize naturally. Do NOT use HTML tags.
6. INLINE CITATIONS: Add inline source citations using parentheses (سورة الحجرات : 10) or (رواه البخاري ومسلم) immediately after the cited Ayah or Hadith — using () NOT [].
7. PROFESSIONAL FORMATTING:
   - Proper commas, periods, and punctuation throughout.
   - Clear section titles in bold (H2 for main topics, H3 for sub-topics).
   - Use bullet points for lists, definitions, and sequential content.
8. Return ONLY the transcribed document. No preamble, no meta-commentary.`;

export interface QuickActionItem {
  id: string;
  name: string;
  nameAr: string;
  prompt: string;
  icon: string;
  enabled: boolean;
  isCustom?: boolean;
}

export interface WorldLanguage {
  code: string;
  name: string;
  native: string;
  nameAr: string;
}

export const worldLanguages: WorldLanguage[] = [
  { code: "ar", name: "Arabic", native: "العربية", nameAr: "العربية" },
  { code: "en", name: "English", native: "English", nameAr: "الإنجليزية" },
  { code: "fr", name: "French", native: "Français", nameAr: "الفرنسية" },
  { code: "es", name: "Spanish", native: "Español", nameAr: "الإسبانية" },
  { code: "de", name: "German", native: "Deutsch", nameAr: "الألمانية" },
  { code: "it", name: "Italian", native: "Italiano", nameAr: "الإيطالية" },
  { code: "pt", name: "Portuguese", native: "Português", nameAr: "البرتغالية" },
  { code: "ru", name: "Russian", native: "Русский", nameAr: "الروسية" },
  { code: "zh", name: "Chinese (Simplified)", native: "简体中文", nameAr: "الصينية (المبسطة)" },
  { code: "zh-TW", name: "Chinese (Traditional)", native: "繁體中文", nameAr: "الصينية (التقليدية)" },
  { code: "ja", name: "Japanese", native: "日本語", nameAr: "اليابانية" },
  { code: "ko", name: "Korean", native: "한국어", nameAr: "الكورية" },
  { code: "tr", name: "Turkish", native: "Türkçe", nameAr: "التركية" },
  { code: "ur", name: "Urdu", native: "اردو", nameAr: "الأردية" },
  { code: "fa", name: "Persian", native: "فارسی", nameAr: "الفارسية" },
  { code: "ku", name: "Kurdish", native: "کوردی", nameAr: "الكردية" },
  { code: "ps", name: "Pashto", native: "پښتو", nameAr: "البشتو" },
  { code: "uz", name: "Uzbek", native: "Oʻzbekcha / Ўзбекча", nameAr: "الأوزبكية" },
  { code: "kk", name: "Kazakh", native: "Қазақша / Qazaqsha", nameAr: "الكازاخية" },
  { code: "az", name: "Azerbaijani", native: "Azərbaycanca", nameAr: "الأذربيجانية" },
  { code: "tg", name: "Tajik", native: "Тоҷикӣ", nameAr: "الطاجيكية" },
  { code: "tk", name: "Turkmen", native: "Türkmençe", nameAr: "التركمانية" },
  { code: "ky", name: "Kyrgyz", native: "Кыргызча", nameAr: "القيرغيزية" },
  { code: "tt", name: "Tatar", native: "Татарча", nameAr: "التتارية" },
  { code: "ug", name: "Uyghur", native: "ئۇيغۇرچە", nameAr: "الأويغورية" },
  { code: "he", name: "Hebrew", native: "עברית", nameAr: "العبرية" },
  { code: "hi", name: "Hindi", native: "हिन्दी", nameAr: "الهندية" },
  { code: "bn", name: "Bengali", native: "বাংলা", nameAr: "البنغالية" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ / پنجابی", nameAr: "البنجابية" },
  { code: "ta", name: "Tamil", native: "தமிழ்", nameAr: "التاميلية" },
  { code: "te", name: "Telugu", native: "తెలుగు", nameAr: "التيلوغوية" },
  { code: "mr", name: "Marathi", native: "मराठी", nameAr: "الماراثية" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", nameAr: "الغوجاراتية" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", nameAr: "الكانادية" },
  { code: "ml", name: "Malayalam", native: "മലയാളം", nameAr: "الماليالامية" },
  { code: "si", name: "Sinhala", native: "සිංහල", nameAr: "السنهالية" },
  { code: "ne", name: "Nepali", native: "नेपाली", nameAr: "النيبالية" },
  { code: "as", name: "Assamese", native: "অসমীয়া", nameAr: "الآسامية" },
  { code: "or", name: "Odia", native: "ଓଡ଼ିଆ", nameAr: "الأودية" },
  { code: "sa", name: "Sanskrit", native: "संस्कृतम्", nameAr: "السنسكريتية" },
  { code: "sd", name: "Sindhi", native: "سنڌي", nameAr: "السندية" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia", nameAr: "الإندونيسية" },
  { code: "ms", name: "Malay", native: "Bahasa Melayu", nameAr: "الملايو" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt", nameAr: "الفيتنامية" },
  { code: "th", name: "Thai", native: "ไทย", nameAr: "التايلاندية" },
  { code: "my", name: "Burmese", native: "မြန်မာဘာသာ", nameAr: "البورمية" },
  { code: "km", name: "Khmer", native: "ភាសាខ្មែរ", nameAr: "الخميرية" },
  { code: "lo", name: "Lao", native: "ພາສາລາວ", nameAr: "اللاوية" },
  { code: "tl", name: "Tagalog / Filipino", native: "Wikang Tagalog", nameAr: "التاغالوغية / الفلبينية" },
  { code: "jv", name: "Javanese", native: "Basa Jawa", nameAr: "الجاوية" },
  { code: "su", name: "Sundanese", native: "Basa Sunda", nameAr: "السوندية" },
  { code: "mn", name: "Mongolian", native: "Монгол хэл", nameAr: "المنغولية" },
  { code: "bo", name: "Tibetan", native: "བོད་ཡིག", nameAr: "التبتية" },
  { code: "nl", name: "Dutch", native: "Nederlands", nameAr: "الهولندية" },
  { code: "pl", name: "Polish", native: "Polski", nameAr: "البولندية" },
  { code: "uk", name: "Ukrainian", native: "Українська", nameAr: "الأوكرانية" },
  { code: "sv", name: "Swedish", native: "Svenska", nameAr: "السويدية" },
  { code: "el", name: "Greek", native: "Ελληνικά", nameAr: "اليونانية" },
  { code: "cs", name: "Czech", native: "Čeština", nameAr: "التشيكية" },
  { code: "ro", name: "Romanian", native: "Română", nameAr: "الرومانية" },
  { code: "hu", name: "Hungarian", native: "Magyar", nameAr: "المجرية" },
  { code: "bg", name: "Bulgarian", native: "Български", nameAr: "البلغارية" },
  { code: "sr", name: "Serbian", native: "Српски / Srpski", nameAr: "الصربية" },
  { code: "hr", name: "Croatian", native: "Hrvatski", nameAr: "الكرواتية" },
  { code: "bs", name: "Bosnian", native: "Bosanski", nameAr: "البوسنية" },
  { code: "sk", name: "Slovak", native: "Slovenčina", nameAr: "السلوفاكية" },
  { code: "sl", name: "Slovenian", native: "Slovenščina", nameAr: "السلوفينية" },
  { code: "da", name: "Danish", native: "Dansk", nameAr: "الدنماركية" },
  { code: "no", name: "Norwegian", native: "Norsk", nameAr: "النرويجية" },
  { code: "fi", name: "Finnish", native: "Suomi", nameAr: "الفنلندية" },
  { code: "lt", name: "Lithuanian", native: "Lietuvių", nameAr: "الليتوانية" },
  { code: "lv", name: "Latvian", native: "Latviešu", nameAr: "اللاتفية" },
  { code: "et", name: "Estonian", native: "Eesti", nameAr: "الإستونية" },
  { code: "sq", name: "Albanian", native: "Shqip", nameAr: "الألبانية" },
  { code: "mk", name: "Macedonian", native: "Македонски", nameAr: "المقدونية" },
  { code: "ga", name: "Irish", native: "Gaeilge", nameAr: "الأيرلندية" },
  { code: "cy", name: "Welsh", native: "Cymraeg", nameAr: "الويلزية" },
  { code: "gd", name: "Scottish Gaelic", native: "Gàidhlig", nameAr: "الغيلية الإسكتلندية" },
  { code: "eu", name: "Basque", native: "Euskara", nameAr: "الباسكية" },
  { code: "ca", name: "Catalan", native: "Català", nameAr: "الكتالونية" },
  { code: "gl", name: "Galician", native: "Galego", nameAr: "الجاليكية" },
  { code: "is", name: "Icelandic", native: "Íslenska", nameAr: "الأيسلندية" },
  { code: "mt", name: "Maltese", native: "Malti", nameAr: "المالطية" },
  { code: "la", name: "Latin", native: "Latina", nameAr: "اللاتينية" },
  { code: "be", name: "Belarusian", native: "Беларуская", nameAr: "البيلاروسية" },
  { code: "yi", name: "Yiddish", native: "ייִדיש", nameAr: "اليديشية" },
  { code: "lb", name: "Luxembourgish", native: "Lëtzebuergesch", nameAr: "اللوكسمبورغية" },
  { code: "oc", name: "Occitan", native: "Occitan", nameAr: "الأوكيتانية" },
  { code: "co", name: "Corsican", native: "Corsu", nameAr: "الكورسيكية" },
  { code: "fy", name: "Western Frisian", native: "Frysk", nameAr: "الفريزية" },
  { code: "br", name: "Breton", native: "Brezhoneg", nameAr: "البريتونية" },
  { code: "sw", name: "Swahili", native: "Kiswahili", nameAr: "السواحيلية" },
  { code: "ha", name: "Hausa", native: "Harshen Hausa", nameAr: "الهوسا" },
  { code: "yo", name: "Yoruba", native: "Èdè Yorùbá", nameAr: "اليوروبا" },
  { code: "ig", name: "Igbo", native: "Asụsụ Igbo", nameAr: "الإيغبو" },
  { code: "am", name: "Amharic", native: "አማርኛ", nameAr: "الأمهرية" },
  { code: "om", name: "Oromo", native: "Afaan Oromoo", nameAr: "الأورومو" },
  { code: "ti", name: "Tigrinya", native: "ትግርኛ", nameAr: "التيغرينية" },
  { code: "so", name: "Somali", native: "Af Soomaali", nameAr: "الصومالية" },
  { code: "rw", name: "Kinyarwanda", native: "Ikinyarwanda", nameAr: "الكينيارواندية" },
  { code: "ny", name: "Chichewa", native: "ChiCheŵa", nameAr: "الشيشيوا" },
  { code: "wo", name: "Wolof", native: "Wolof", nameAr: "الولوفية" },
  { code: "ff", name: "Fulah / Peul", native: "Fulfulde", nameAr: "الفولانية" },
  { code: "ln", name: "Lingala", native: "Lingála", nameAr: "اللينغالا" },
  { code: "lg", name: "Luganda", native: "Oluganda", nameAr: "اللوغندية" },
  { code: "zu", name: "Zulu", native: "isiZulu", nameAr: "الزولو" },
  { code: "xh", name: "Xhosa", native: "isiXhosa", nameAr: "الخوسا" },
  { code: "af", name: "Afrikaans", native: "Afrikaans", nameAr: "الأفريكانية" },
  { code: "sn", name: "Shona", native: "chiShona", nameAr: "الشونا" },
  { code: "mg", name: "Malagasy", native: "Fiteny Malagasy", nameAr: "الملغاشية" },
  { code: "hy", name: "Armenian", native: "Հայերեն", nameAr: "الأرمنية" },
  { code: "ka", name: "Georgian", native: "ქართული", nameAr: "الجورجية" },
  { code: "ce", name: "Chechen", native: "Нохчийн мотт", nameAr: "الشيشانية" },
  { code: "dv", name: "Dhivehi / Maldivian", native: "ދިވެހި", nameAr: "الديفيهية" },
  { code: "mi", name: "Maori", native: "Te Reo Māori", nameAr: "الماورية" },
  { code: "sm", name: "Samoan", native: "Gagana Sāmoa", nameAr: "الساموية" },
  { code: "haw", name: "Hawaiian", native: "ʻŌlelo Hawaiʻi", nameAr: "الهاوايية" },
  { code: "qu", name: "Quechua", native: "Runasimi", nameAr: "الكيشوا" },
  { code: "gn", name: "Guarani", native: "Avañe'ẽ", nameAr: "الغوارانية" },
  { code: "ay", name: "Aymara", native: "Aymar aru", nameAr: "الأيمارا" },
  { code: "eo", name: "Esperanto", native: "Esperanto", nameAr: "الإسبرانتو" },
];

export const defaultQuickActions: QuickActionItem[] = [
  {
    id: 'enhance',
    name: 'Enhance',
    nameAr: 'تحسين الصياغة',
    icon: 'Sparkles',
    enabled: true,
    prompt: `You are an academic editor. Improve the selected text for clarity, grammar, punctuation, and readability. If the text contains Islamic phrases, names, or quotes, add appropriate honorary symbols and terms (e.g., ﷺ, رضي الله عنه, رحمه الله). Output only the enhanced text without introductory or concluding remarks.`,
  },
  {
    id: 'complete',
    name: 'Complete',
    nameAr: 'إكمال النص والعبارة',
    icon: 'Check',
    enabled: true,
    prompt: `You are an academic note completer. The user has jotted down an incomplete sentence, definition, hadith, verse, law, or quote. Complete the passage accurately using the most authoritative, established source. Append a brief inline citation or source tag at the very end in brackets. Output only the completed text and citation.`,
  },
  {
    id: 'shorten',
    name: 'Make it Shorter',
    nameAr: 'تلخيص واختصار',
    icon: 'Shrink',
    enabled: true,
    prompt: `Summarize the selected text into a concise, high-yield statement. Retain only the core concept, key variables, and conclusion. Remove conversational filler, redundant modifiers, and digressions. Output only the shortened text.`,
  },
  {
    id: 'tashkeel',
    name: 'Tashkeel',
    nameAr: 'تشكيل الحركات',
    icon: 'Feather',
    enabled: true,
    prompt: `أنت مدقق لغوي نحوي متخصص. اضبط النص العربي المختار بالحركات الإعرابية التامة (التشكيل الكامل) وفق قواعد النحو والصرف العربية السليمة. حافظ على علامات الترقيم كما هي، ولا تغيّر أي كلمة. أخرج النص المشكول فقط دون أي تعليق إضافي.`,
  },
  {
    id: 'reference',
    name: 'Reference',
    nameAr: 'تخريج وإضافة المرجع',
    icon: 'BookOpen',
    enabled: true,
    prompt: `You are a citation and referencing specialist. Detect the statement, ruling, theory, or quote in the selected text. Retain the user's text, and append a verified academic reference beneath it. If it is an Islamic text, cite the classical chapter/book and standard scholar attribution; if general academic, use APA format. Output the original text followed by the reference.`,
  },
  {
    id: 'translate',
    name: 'Translate',
    nameAr: 'ترجمة أكاديمية',
    icon: 'Languages',
    enabled: true,
    prompt: `You are a precision academic translator. Translate the selected text into {{TARGET_LANGUAGE}}. Maintain academic register, accurate technical/legal/theological terminology, and standard punctuation. Output only the direct translation.`,
  },
  {
    id: 'bullets',
    name: 'Transform to Bullets',
    nameAr: 'تحويل إلى نقاط',
    icon: 'List',
    enabled: true,
    prompt: `Convert the selected paragraph into a clean, hierarchical bulleted list. Group items logically, use inline bolding for key terms at the start of each bullet, and make the points easy to review for exam prep. Output only the bulleted list.`,
  },
  {
    id: 'table',
    name: 'Transform to Table',
    nameAr: 'تحويل إلى جدول',
    icon: 'Table',
    enabled: true,
    prompt: `Analyze the entities, steps, conditions, or comparisons in the selected text and convert them into a structured Markdown table. Choose clear column headers that match the data (e.g., Term | Definition, School of Thought | Ruling | Evidence, or Concept | Pros | Cons). Output only the table.`,
  },
];

export const defaultGeneralActions: QuickActionItem[] = [
  {
    id: 'improveAll',
    name: 'Improve & Verify',
    nameAr: 'تحسين شامل وتخريج',
    icon: 'Sparkles',
    enabled: true,
    prompt: defaultAiActionPrompts.improveAll,
  },
  {
    id: 'correctMistakes',
    name: 'Correct Mistakes',
    nameAr: 'تصحيح الأخطاء اللغوية',
    icon: 'CheckCheck',
    enabled: true,
    prompt: defaultAiActionPrompts.correctMistakes,
  },
  {
    id: 'enhanceFormatting',
    name: 'Enhance Formatting',
    nameAr: 'تنسيق وتنظيم المحتوى',
    icon: 'ListTree',
    enabled: true,
    prompt: defaultAiActionPrompts.enhanceFormatting,
  },
  {
    id: 'summarizeContent',
    name: 'Summarize Note',
    nameAr: 'تلخيص المحتوى',
    icon: 'FileText',
    enabled: true,
    prompt: defaultAiActionPrompts.summarizeContent,
  },
];

export type LLMProvider =
  | 'gemini'
  | 'openrouter'
  | 'deepseek'
  | 'qwen'
  | 'kimi'
  | 'grok'
  | 'chatgpt'
  | 'anthropic'
  | 'custom'
  | 'sidecar';

export interface Settings {
  llmProvider: LLMProvider;
  geminiApiKey: string;
  openRouterApiKey: string;
  deepseekApiKey?: string;
  qwenApiKey?: string;
  kimiApiKey?: string;
  grokApiKey?: string;
  chatgptApiKey?: string;
  anthropicApiKey?: string;
  customApiKey?: string;
  customApiBaseUrl?: string;
  sidecarUrl: string;
  llmModel: string;
  language: Language;
  theme: 'light' | 'dark' | 'system';
  systemPrompt: string;
  lightPaperColor?: string;
  darkPaperColor?: string;
  aiActionPrompts?: AiActionPrompts;
  quickActions?: QuickActionItem[];
  generalActions?: QuickActionItem[];
  selectedAiOption?: string;
}

interface AppState {
  settings: Settings;
  isSidebarCollapsed: boolean;
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  lastRecordingId: number | null;
  isAiProcessing: boolean;
  isNoteOpen: boolean;
  activeScreen: string;
  isMeetingMode: boolean;
  viewMode: 'grid' | 'list';
  searchQuery: string;
  isSearchOpen: boolean;
  isSelectMode: boolean;
  selectedNoteIds: number[];
  selectedRecordingIds: number[];
  selectedFolderIds: number[];
  postRecordingModal: { isOpen: boolean; recordingId: number | null };
  activeFolderModal: { isOpen: boolean; folderId: number | null };
  activeFolderId: number | null;
  activeNoteId: number | null;
  activeRecordingId: number | null;
  activeRecordingNoteId: number | null;
  activeView: 'home' | 'recorder' | 'active' | 'settings' | 'detail' | 'texteditor';
  previousView: 'home' | 'recorder' | 'active' | 'settings' | 'detail' | 'texteditor';
  isNewNote: boolean;
  setIsNewNote: (v: boolean) => void;
  setActiveFolderModal: (modal: { isOpen: boolean; folderId: number | null }) => void;
  setActiveFolderId: (id: number | null) => void;
  updateSettings: (newSettings: Partial<Settings>) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setIsRecording: (isRecording: boolean) => void;
  setIsPaused: (isPaused: boolean) => void;
  setRecordingTime: (time: number | ((prev: number) => number)) => void;
  setLastRecordingId: (id: number | null) => void;
  setIsAiProcessing: (v: boolean) => void;
  setIsNoteOpen: (v: boolean) => void;
  setActiveScreen: (s: string) => void;
  setIsMeetingMode: (v: boolean) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setSearchQuery: (query: string) => void;
  setIsSearchOpen: (open: boolean) => void;
  setIsSelectMode: (select: boolean) => void;
  setSelectedNoteIds: (ids: number[] | ((prev: number[]) => number[])) => void;
  setSelectedRecordingIds: (ids: number[] | ((prev: number[]) => number[])) => void;
  setSelectedFolderIds: (ids: number[] | ((prev: number[]) => number[])) => void;
  clearSelection: () => void;
  setPostRecordingModal: (modal: { isOpen: boolean; recordingId: number | null }) => void;
  setActiveNoteId: (id: number | null) => void;
  setActiveRecordingId: (id: number | null) => void;
  setActiveRecordingNoteId: (id: number | null) => void;
  setActiveView: (view: 'home' | 'recorder' | 'active' | 'settings' | 'detail' | 'texteditor') => void;
  setPreviousView: (view: 'home' | 'recorder' | 'active' | 'settings' | 'detail' | 'texteditor') => void;
  addQuickAction: (action: Omit<QuickActionItem, 'id'>) => void;
  updateQuickAction: (id: string, updates: Partial<QuickActionItem>) => void;
  removeQuickAction: (id: string) => void;
  resetQuickActions: () => void;
  toggleQuickAction: (id: string) => void;
  addGeneralAction: (action: Omit<QuickActionItem, 'id'>) => void;
  updateGeneralAction: (id: string, updates: Partial<QuickActionItem>) => void;
  removeGeneralAction: (id: string) => void;
  resetGeneralActions: () => void;
  toggleGeneralAction: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      settings: {
        llmProvider: 'gemini',
        geminiApiKey: '',
        openRouterApiKey: '',
        deepseekApiKey: '',
        qwenApiKey: '',
        kimiApiKey: '',
        grokApiKey: '',
        chatgptApiKey: '',
        anthropicApiKey: '',
        customApiKey: '',
        customApiBaseUrl: '',
        sidecarUrl: 'http://127.0.0.1:47195',
        llmModel: 'gemini-2.5-flash',
        language: 'ar',
        theme: 'system',
        systemPrompt: defaultSystemPrompt,
        lightPaperColor: '#fafafa',
        darkPaperColor: '#171717',
        aiActionPrompts: defaultAiActionPrompts,
        quickActions: defaultQuickActions,
        generalActions: defaultGeneralActions,
        selectedAiOption: 'improveAll',
      },
      isSidebarCollapsed: false,
      isRecording: false,
      isPaused: false,
      recordingTime: 0,
      lastRecordingId: null,
      isAiProcessing: false,
      isNoteOpen: false,
      activeScreen: 'home',
      isMeetingMode: false,
      viewMode: 'grid',
      searchQuery: '',
      isSearchOpen: false,
      isSelectMode: false,
      selectedNoteIds: [],
      selectedRecordingIds: [],
      selectedFolderIds: [],
      postRecordingModal: { isOpen: false, recordingId: null },
      activeFolderModal: { isOpen: false, folderId: null },
      activeFolderId: null,
      activeNoteId: null,
      activeRecordingId: null,
      activeRecordingNoteId: null,
      activeView: 'home',
      previousView: 'home',
      isNewNote: false,
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: {
            ...state.settings,
            ...newSettings,
            aiActionPrompts: {
              ...defaultAiActionPrompts,
              ...(state.settings.aiActionPrompts || {}),
              ...(newSettings.aiActionPrompts || {})
            },
            quickActions: newSettings.quickActions ?? state.settings.quickActions ?? defaultQuickActions,
            generalActions: newSettings.generalActions ?? state.settings.generalActions ?? defaultGeneralActions
          }
        })),
      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
      setIsRecording: (isRecording) => set({ isRecording: isRecording }),
      setIsPaused: (isPaused) => set({ isPaused: isPaused }),
      setRecordingTime: (time) => set((state) => ({
        recordingTime: typeof time === 'function' ? time(state.recordingTime) : time
      })),
      setLastRecordingId: (id) => set({ lastRecordingId: id }),
      setIsAiProcessing: (v) => set({ isAiProcessing: v }),
      setIsNoteOpen: (v) => set({ isNoteOpen: v }),
      setActiveScreen: (s) => set((state) => ({ 
        activeScreen: s,
        activeView: (['home', 'recorder', 'active', 'settings', 'detail', 'texteditor'].includes(s) ? s : state.activeView) as any
      })),
      setIsMeetingMode: (v) => set({ isMeetingMode: v }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setIsSearchOpen: (open) => set({ isSearchOpen: open }),
      setIsSelectMode: (select) => set({
        isSelectMode: select,
        selectedNoteIds: [],
        selectedRecordingIds: [],
        selectedFolderIds: [],
      }),
      setSelectedNoteIds: (ids) => set((state) => ({
        selectedNoteIds: typeof ids === 'function' ? ids(state.selectedNoteIds) : ids
      })),
      setSelectedRecordingIds: (ids) => set((state) => ({
        selectedRecordingIds: typeof ids === 'function' ? ids(state.selectedRecordingIds) : ids
      })),
      setSelectedFolderIds: (ids) => set((state) => ({
        selectedFolderIds: typeof ids === 'function' ? ids(state.selectedFolderIds) : ids
      })),
      clearSelection: () => set({ selectedNoteIds: [], selectedRecordingIds: [], selectedFolderIds: [], isSelectMode: false }),
      setPostRecordingModal: (modal) => set({ postRecordingModal: modal }),
      setIsNewNote: (v) => set({ isNewNote: v }),
      setActiveFolderModal: (modal) => set({ activeFolderModal: modal }),
      setActiveFolderId: (id) => set({ activeFolderId: id }),
      setActiveNoteId: (id) => set({ activeNoteId: id, isNoteOpen: id !== null }),
      setActiveRecordingId: (id) => set({ activeRecordingId: id }),
      setActiveRecordingNoteId: (id) => set({ activeRecordingNoteId: id }),
      setActiveView: (view) => set({ activeView: view, activeScreen: view }),
      setPreviousView: (view) => set({ previousView: view }),
      addQuickAction: (action) => set((state) => {
        const id = `custom_${Date.now()}`;
        const newActions = [...(state.settings.quickActions || defaultQuickActions), { ...action, id, isCustom: true }];
        return {
          settings: {
            ...state.settings,
            quickActions: newActions
          }
        };
      }),
      updateQuickAction: (id, updates) => set((state) => {
        const current = state.settings.quickActions || defaultQuickActions;
        const updated = current.map(a => a.id === id ? { ...a, ...updates } : a);
        return {
          settings: {
            ...state.settings,
            quickActions: updated
          }
        };
      }),
      removeQuickAction: (id) => set((state) => {
        const current = state.settings.quickActions || defaultQuickActions;
        const filtered = current.filter(a => a.id !== id);
        return {
          settings: {
            ...state.settings,
            quickActions: filtered
          }
        };
      }),
      resetQuickActions: () => set((state) => ({
        settings: {
          ...state.settings,
          quickActions: defaultQuickActions
        }
      })),
      toggleQuickAction: (id) => set((state) => {
        const current = state.settings.quickActions || defaultQuickActions;
        const updated = current.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
        return {
          settings: {
            ...state.settings,
            quickActions: updated
          }
        };
      }),
      addGeneralAction: (action) => set((state) => {
        const id = `general_${Date.now()}`;
        const newActions = [...(state.settings.generalActions || defaultGeneralActions), { ...action, id, isCustom: true }];
        return {
          settings: {
            ...state.settings,
            generalActions: newActions
          }
        };
      }),
      updateGeneralAction: (id, updates) => set((state) => {
        const current = state.settings.generalActions || defaultGeneralActions;
        const updated = current.map(a => a.id === id ? { ...a, ...updates } : a);
        return {
          settings: {
            ...state.settings,
            generalActions: updated
          }
        };
      }),
      removeGeneralAction: (id) => set((state) => {
        const current = state.settings.generalActions || defaultGeneralActions;
        const filtered = current.filter(a => a.id !== id);
        return {
          settings: {
            ...state.settings,
            generalActions: filtered
          }
        };
      }),
      resetGeneralActions: () => set((state) => ({
        settings: {
          ...state.settings,
          generalActions: defaultGeneralActions
        }
      })),
      toggleGeneralAction: (id) => set((state) => {
        const current = state.settings.generalActions || defaultGeneralActions;
        const updated = current.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
        return {
          settings: {
            ...state.settings,
            generalActions: updated
          }
        };
      }),
    }),
    {
      name: 'meeting-summarizer-settings',
      version: 3,
      migrate: (persistedState: any, version: number) => {
        if (version < 2 && persistedState?.settings) {
          if (persistedState.settings.language === 'en') {
            persistedState.settings.language = 'ar';
          }
          delete persistedState.settings.ttsVoice;
        }
        if (version < 3 && persistedState?.settings) {
          if (!persistedState.settings.llmProvider || persistedState.settings.llmProvider === 'sidecar') {
            persistedState.settings.llmProvider = 'gemini';
          }
        }
        return persistedState;
      },
      partialize: (state) => ({
        settings: state.settings,
        viewMode: state.viewMode,
        activeView: state.activeView,
        previousView: state.previousView,
        activeNoteId: state.activeNoteId,
        activeRecordingId: state.activeRecordingId,
        activeFolderId: state.activeFolderId,
      }),
    }
  )
);
