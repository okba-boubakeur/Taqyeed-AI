/**
 * Taqyeed AI Gemini Sidecar Client
 * Connects to the local/remote OnlyDeals Python Sidecar (default: http://127.0.0.1:47195)
 * Enables zero-API-key Google Gemini processing for:
 * - Multimodal audio lecture summarization
 * - Text scholarly summarization
 * - Smart title generation
 * - Arabic Tashkeel diacritization
 * - Content enhancement and formatting
 */

export const DEFAULT_SIDECAR_URL = 'http://127.0.0.1:47195';

export async function testSidecarHealth(customUrl?: string): Promise<{
  ok: boolean;
  authenticated: boolean;
  status: string;
  activeModel?: string;
  modelsAvailable?: string[];
  error?: string;
}> {
  const target = (customUrl || DEFAULT_SIDECAR_URL).replace(/\/+$/, '');
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${target}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        ok: true,
        authenticated: Boolean(data.gemini_authenticated),
        status: data.status || 'healthy',
        activeModel: data.active_model,
        modelsAvailable: data.models_available || [],
      };
    } else {
      return {
        ok: false,
        authenticated: false,
        status: 'error',
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      authenticated: false,
      status: 'offline',
      error: err.name === 'AbortError' ? 'Connection timed out' : (err.message || 'Cannot connect to sidecar'),
    };
  }
}

/**
 * Converts a Blob to a base64 Data URL (e.g. data:audio/webm;base64,...)
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Summarize audio through Sidecar's multimodal Gemini pipeline.
 */
export async function* streamSummaryFromAudioSidecar(
  audioBlob: Blob,
  sidecarUrl: string,
  model: string = 'gemini-flash',
  systemPrompt?: string
): AsyncGenerator<{ summary?: string; done?: boolean }> {
  const target = (sidecarUrl || DEFAULT_SIDECAR_URL).replace(/\/+$/, '');
  const dataUrl = await blobToDataUrl(audioBlob);

  const payload = {
    message: systemPrompt || 'Analyze the provided lecture audio and generate a comprehensive student summary.',
    prompt: systemPrompt || 'Analyze the provided lecture audio and generate a comprehensive student summary.',
    model: model || 'gemini-flash',
    extended_thinking: true,
    use_web_search: false,
    files: [
      {
        id: `audio-${Date.now()}`,
        name: 'lecture_recording.webm',
        type: audioBlob.type || 'audio/webm',
        size: audioBlob.size,
        data: dataUrl,
        dataUrl,
      },
    ],
  };

  const response = await fetch(`${target}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Sidecar request failed with status ${response.status}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Sidecar processing failed');
  }

  const replyText = result.reply || '';
  const chunkSize = Math.max(20, Math.floor(replyText.length / 15));
  for (let i = chunkSize; i < replyText.length; i += chunkSize) {
    yield { summary: replyText.slice(0, i) };
    await new Promise((r) => setTimeout(r, 40));
  }

  yield { summary: replyText, done: true };
}

/**
 * Text summarization via Sidecar
 */
export async function generateSummaryFromTextSidecar(
  text: string,
  sidecarUrl: string,
  model: string = 'gemini-flash',
  language: string = 'ar'
): Promise<string> {
  const target = (sidecarUrl || DEFAULT_SIDECAR_URL).replace(/\/+$/, '');
  const prompt = `You are an expert digital scribe specialized in summarizing scholarly and complex texts clearly and concisely.
Based on the following text, generate a comprehensive, structured summary.

CRITICAL LANGUAGE REQUIREMENT:
- The entire summary MUST be written in the exact language of the original text OR ${language} if specifically requested.
- Use natural, academic tone.
- Use clear bullet points and sub-bullets for excellent readability.

TEXT CONTENT:
${text}
`;

  const response = await fetch(`${target}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: prompt,
      model: model || 'gemini-flash',
      extended_thinking: false,
      use_web_search: false,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Sidecar request failed: ${response.statusText}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Sidecar processing failed');
  }

  return result.reply || '';
}

/**
 * Generate title from summary via Sidecar
 */
export async function generateTitleFromSummarySidecar(
  summary: string,
  sidecarUrl: string,
  model: string = 'gemini-flash',
  language: string = 'ar'
): Promise<string> {
  const target = (sidecarUrl || DEFAULT_SIDECAR_URL).replace(/\/+$/, '');
  const prompt = `Based on the following meeting or lecture summary, generate a short, relevant, and professional title (max 6-8 words).
The title MUST be in the same language as the summary.
Summary:
${summary}

Return ONLY the title text.`;

  try {
    const response = await fetch(`${target}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        model: model || 'gemini-flash',
        extended_thinking: false,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.reply) {
        return result.reply.trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch (err) {
    console.warn('Sidecar title generation failed, falling back:', err);
  }
  return `Meeting ${new Date().toLocaleDateString()}`;
}

/**
 * Add Arabic Tashkeel diacritics via Sidecar
 */
export async function addTashkeelToArabicTextSidecar(
  text: string,
  sidecarUrl: string,
  model: string = 'gemini-flash'
): Promise<string> {
  const target = (sidecarUrl || DEFAULT_SIDECAR_URL).replace(/\/+$/, '');
  const prompt = `You are an academic editor in Islamic jurisprudence and Arabic language. Your task is to apply precise Arabic diacritics (التشكيل الكامل / الضبط بالشكل) exclusively to:

Holy Qur'an verses (الآيات القرآنية).

Prophetic traditions/Hadith (الأحاديث النبوية الشريفة).

Classical Arabic poetic verses or critical terms prone to misreading (الأبيات الشعرية أو المصطلحات الملتبسة).

Strict Guardrails:

DO NOT vocalize (لا تشكل) regular student lecture notes, modern commentary, instructor names, dates, or analytical prose. Vocalizing standard explanatory text is strictly prohibited.

Ensure the vocalization on Hadith and Quranic text is 100% grammatically accurate according to canonical transmissions.

Enclose Quranic text in ﴿ ... ﴾ and Hadith in « ... ».

Output only the processed text without any conversational preamble or sign-off.
${text}
`;

  try {
    const response = await fetch(`${target}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        model: model || 'gemini-flash',
        extended_thinking: false,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.reply) {
        return result.reply.trim();
      }
    }
  } catch (err) {
    console.warn('Sidecar tashkeel failed, using original text:', err);
  }
  return text;
}

/**
 * Content enhancement via Sidecar
 */
export async function* streamEnhanceContentSidecar(
  htmlContent: string,
  sidecarUrl: string,
  model: string = 'gemini-flash',
  language: string = 'ar',
  customPrompt?: string
): AsyncGenerator<{ enhanced?: string; done?: boolean }> {
  const target = (sidecarUrl || DEFAULT_SIDECAR_URL).replace(/\/+$/, '');

  const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;
  let plainText = htmlContent;
  if (tempDiv) {
    tempDiv.innerHTML = htmlContent;
    plainText = tempDiv.textContent || tempDiv.innerText || htmlContent;
  }

  const systemInstruction = customPrompt
    ? `${customPrompt}\n\nCRITICAL: Return ONLY the final enhanced text in clean Markdown or HTML format. Do NOT add conversational preamble, pleasantries, explanations, or quotes around the response.`
    : `You are an expert scholarly editor and writing enhancer. Improve the provided text while preserving its original meaning, citations, and intent.

ENHANCEMENT RULES:
- Fix grammar, spelling, and punctuation errors
- Improve sentence structure, clarity, and flow
- Preserve technical terms, scholarly quotes, and proper nouns
- Maintain the original language (if in ${language}, keep in ${language})
- Use markdown formatting (headers, bold, bullets) for clean structure
- Return ONLY the enhanced text in clean Markdown format without any conversational intro or outro.`;

  const messageText = `TEXT TO ENHANCE / PROCESS:\n"""\n${plainText}\n"""\n\nApply the instructions to the text above and return ONLY the enhanced version.`;

  const response = await fetch(`${target}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: messageText,
      system_instruction: systemInstruction,
      model: model || 'gemini-flash',
      extended_thinking: false,
      use_web_search: false,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Sidecar request failed: ${response.statusText}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Sidecar enhancement failed');
  }

  const replyText = result.reply || '';
  const chunkSize = Math.max(15, Math.floor(replyText.length / 15));
  for (let i = chunkSize; i < replyText.length; i += chunkSize) {
    yield { enhanced: replyText.slice(0, i) };
    await new Promise((r) => setTimeout(r, 40));
  }

  yield { enhanced: replyText, done: true };
}

/**
 * Execute targeted quick action via Sidecar with pure system_instruction
 */
export async function executeQuickActionSidecar(
  selectedText: string,
  systemInstruction: string,
  sidecarUrl?: string,
  model: string = 'gemini-flash'
): Promise<string> {
  const target = (sidecarUrl || DEFAULT_SIDECAR_URL).replace(/\/+$/, '');
  const response = await fetch(`${target}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `TEXT TO PROCESS:\n"""\n${selectedText}\n"""\n\nReturn ONLY the processed text corresponding to the instructions with no preface, extra quotes, or conversational commentary.`,
      system_instruction: systemInstruction,
      model: model || 'gemini-flash',
      use_web_search: false,
      extended_thinking: false,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Sidecar request failed: ${response.statusText}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Sidecar processing failed');
  }

  return (result.reply || '').trim();
}
