import { GoogleGenAI } from '@google/genai';
import { defaultSystemPrompt, useAppStore } from '../store';
import {
  streamSummaryFromAudioSidecar,
  generateSummaryFromTextSidecar,
  generateTitleFromSummarySidecar,
  addTashkeelToArabicTextSidecar,
  streamEnhanceContentSidecar,
  executeQuickActionSidecar,
} from './sidecar';

/**
 * Sanitizes model identifiers to prevent provider mismatches, CORS preflight errors,
 * and 404s (e.g. stripping OpenRouter prefixes/suffixes like "google/" or ":batch").
 */
export function sanitizeModelName(model: string, provider: 'gemini' | 'openrouter' | 'sidecar' | string): string {
  let m = (model || '').trim();

  if (provider === 'gemini') {
    // Strip provider prefix e.g. "google/", "meta-llama/"
    m = m.replace(/^[a-zA-Z0-9_-]+\//, '');
    // Strip batch/free/nitro routing suffixes e.g. ":batch", ":free"
    m = m.replace(/:(?:batch|free|default|nitro)$/i, '');
    // If empty or non-existent experimental/future version like "gemini-3.8-flash"
    if (!m || m.startsWith('gemini-3') || !m.includes('gemini')) {
      return 'gemini-2.5-flash';
    }
    return m;
  }

  if (provider === 'openrouter') {
    // OpenRouter rejects ":batch" models on the /chat/completions endpoint
    m = m.replace(/:batch$/i, '');
    if (!m || m.includes('gemini-3.8')) {
      return 'google/gemini-2.5-flash';
    }
    // If Gemini model without provider prefix, prepend google/
    if (m.startsWith('gemini-') && !m.includes('/')) {
      return `google/${m}`;
    }
    return m;
  }

  if (provider === 'sidecar') {
    if (m.includes('pro')) return 'gemini-pro';
    if (m.includes('lite')) return 'gemini-flash-lite';
    return 'gemini-flash';
  }

  return m || 'gemini-2.5-flash';
}

/**
 * Safely converts an audio Blob into a base64 string using chunked ArrayBuffer,
 * avoiding stack overflow or empty strings on large media blobs.
 */
async function blobToBase64(blob: Blob): Promise<string> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    if (bytes.length === 0) return '';
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }
    return btoa(binary);
  } catch {
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        if (!res) {
          resolve('');
          return;
        }
        const commaIdx = res.indexOf(',');
        resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  }
}

export async function* streamSummaryFromAudio(
  audioBlob: Blob,
  apiKey: string,
  model: string,
  systemPrompt?: string,
  provider?: string,
  sidecarUrl?: string
): AsyncGenerator<{ transcript?: string; summary?: string; done?: boolean }> {
  const settings = useAppStore.getState().settings;
  const activeProvider = provider || settings.llmProvider;
  const targetSidecarUrl = sidecarUrl || settings.sidecarUrl;

  // 1. If active provider is sidecar, stream directly via local daemon
  if (activeProvider === 'sidecar') {
    const sanitizedModel = sanitizeModelName(model, 'sidecar');
    yield* streamSummaryFromAudioSidecar(audioBlob, targetSidecarUrl, sanitizedModel, systemPrompt);
    return;
  }

  // 2. OpenRouter does not support direct audio uploads on /chat/completions.
  // Check if a Gemini API key is available; if not, route to Taqyeed Gate Sidecar seamlessly.
  const effectiveGeminiKey = (activeProvider === 'gemini' ? apiKey : settings.geminiApiKey) || (process as any).env?.GEMINI_API_KEY;

  if (!effectiveGeminiKey) {
    console.log('[Audio LLM] No Gemini API key provided. Using Taqyeed Gate Sidecar...');
    try {
      const sanitizedModel = sanitizeModelName(model, 'sidecar');
      yield* streamSummaryFromAudioSidecar(audioBlob, targetSidecarUrl, sanitizedModel, systemPrompt);
      return;
    } catch (sidecarErr: any) {
      throw new Error(
        'Gemini API Key is missing and Taqyeed Gate is offline. Please enter a valid Gemini API key or connect Taqyeed Gate in Settings.'
      );
    }
  }

  const sanitizedGeminiModel = sanitizeModelName(model, 'gemini');
  const ai = new GoogleGenAI({ apiKey: effectiveGeminiKey });

  let finalMimeType = audioBlob.type || 'audio/webm';
  if (finalMimeType.includes('application/octet-stream') || finalMimeType === '') {
    finalMimeType = 'audio/webm';
  }

  const isLargeAudio = audioBlob.size > 15 * 1024 * 1024;

  // 3. For large audio files (>15MB), use Gemini Files API upload
  if (isLargeAudio) {
    console.log(`[Audio LLM] Large audio detected (${Math.round(audioBlob.size / 1024 / 1024)}MB). Uploading via Gemini Files API...`);
    try {
      // In @google/genai, upload expects { file, config: { mimeType } }
      const uploadResult = await (ai as any).files.upload({
        file: audioBlob,
        config: {
          mimeType: finalMimeType,
        },
      });

      const contentsPayload = [
        uploadResult,
        { text: systemPrompt || defaultSystemPrompt },
      ];

      const result = await ai.models.generateContentStream({
        model: sanitizedGeminiModel,
        contents: contentsPayload,
      });

      let fullText = '';
      for await (const chunk of result) {
        if (chunk.text) {
          fullText += chunk.text;
          yield { summary: fullText };
        }
      }

      yield { done: true };
      return;
    } catch (uploadErr: any) {
      console.warn('[Audio LLM] Gemini Files API upload failed. Falling back to Taqyeed Gate Sidecar for large file handling:', uploadErr);
      // Large audio (>20MB) cannot use inlineData without exceeding Google API request size limit.
      // Automatically fallback to Taqyeed Gate Sidecar:
      try {
        const sanitizedModel = sanitizeModelName(model, 'sidecar');
        yield* streamSummaryFromAudioSidecar(audioBlob, targetSidecarUrl, sanitizedModel, systemPrompt);
        return;
      } catch (sidecarFallbackErr: any) {
        console.error('[Audio LLM] Sidecar fallback also failed:', sidecarFallbackErr);
        throw new Error(
          `Audio summarization failed: ${uploadErr.message || 'Gemini Files API error'}. (Taqyeed Gate sidecar error: ${sidecarFallbackErr.message || 'offline'}).`
        );
      }
    }
  }

  // 4. For standard audio (<=15MB), use inlineData with automatic fallback
  try {
    const base64Data = await blobToBase64(audioBlob);
    if (!base64Data) {
      throw new Error('Could not convert audio data to base64');
    }

    const contentsPayload = [
      {
        inlineData: {
          mimeType: finalMimeType,
          data: base64Data,
        },
      },
      { text: systemPrompt || defaultSystemPrompt },
    ];

    const result = await ai.models.generateContentStream({
      model: sanitizedGeminiModel,
      contents: contentsPayload,
    });

    let fullText = '';
    for await (const chunk of result) {
      if (chunk.text) {
        fullText += chunk.text;
        yield { summary: fullText };
      }
    }

    yield { done: true };
  } catch (err: any) {
    console.warn(`[Audio LLM] Gemini API Error (Model: ${sanitizedGeminiModel}), falling back to Taqyeed Gate:`, err);
    try {
      const sanitizedModel = sanitizeModelName(model, 'sidecar');
      yield* streamSummaryFromAudioSidecar(audioBlob, targetSidecarUrl, sanitizedModel, systemPrompt);
      return;
    } catch {
      throw err;
    }
  }
}

export async function generateTitleFromSummary(
  summary: string,
  apiKey: string,
  model: string,
  language: string,
  provider?: string,
  sidecarUrl?: string
): Promise<string> {
  const settings = useAppStore.getState().settings;
  const activeProvider = provider || settings.llmProvider;
  const targetSidecarUrl = sidecarUrl || settings.sidecarUrl;

  if (activeProvider === 'sidecar') {
    const sanitizedModel = sanitizeModelName(model, 'sidecar');
    return generateTitleFromSummarySidecar(summary, targetSidecarUrl, sanitizedModel, language);
  }

  const prompt = `Based on the following meeting summary, generate a short, relevant, and professional title (max 6-8 words).
The title MUST be in the same language as the summary.
Summary:
${summary}

Return ONLY the title text.`;

  // 1. OpenRouter Provider
  if (activeProvider === 'openrouter' && (apiKey || settings.openRouterApiKey)) {
    const key = apiKey || settings.openRouterApiKey;
    try {
      const sanitizedModel = sanitizeModelName(model, 'openrouter');
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
          'HTTP-Referer': 'https://taqyeed.app',
          'X-Title': 'Taqyeed AI Notes',
        },
        body: JSON.stringify({
          model: sanitizedModel,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const titleText = data.choices?.[0]?.message?.content?.trim();
        if (titleText) return titleText.replace(/^["']|["']$/g, '');
      }
    } catch (err) {
      console.warn('OpenRouter title generation failed, falling back:', err);
    }
  }

  // 2. Gemini Provider
  const key = (activeProvider === 'gemini' ? apiKey : settings.geminiApiKey) || (process as any).env?.GEMINI_API_KEY;
  if (key) {
    try {
      const sanitizedModel = sanitizeModelName(model, 'gemini');
      const ai = new GoogleGenAI({ apiKey: key });
      const result = await ai.models.generateContent({
        model: sanitizedModel,
        contents: prompt,
      });
      const titleText = result.text?.trim();
      if (titleText) return titleText.replace(/^["']|["']$/g, '');
    } catch (err) {
      console.warn('Gemini title generation failed, falling back to sidecar:', err);
    }
  }

  // 3. Sidecar Fallback
  try {
    const sanitizedModel = sanitizeModelName(model, 'sidecar');
    return await generateTitleFromSummarySidecar(summary, targetSidecarUrl, sanitizedModel, language);
  } catch {
    return `Meeting ${new Date().toLocaleDateString()}`;
  }
}

export async function generateSummaryFromText(
  text: string,
  apiKey: string,
  model: string,
  language: string,
  provider?: string,
  sidecarUrl?: string
): Promise<string> {
  const settings = useAppStore.getState().settings;
  const activeProvider = provider || settings.llmProvider;
  const targetSidecarUrl = sidecarUrl || settings.sidecarUrl;

  if (activeProvider === 'sidecar') {
    const sanitizedModel = sanitizeModelName(model, 'sidecar');
    return generateSummaryFromTextSidecar(text, targetSidecarUrl, sanitizedModel, language);
  }

  const prompt = `You are an expert digital scribe specialized in summarizing scholarly and complex texts clearly and concisely.
Based on the following text, generate a comprehensive, structured summary.

CRITICAL LANGUAGE REQUIREMENT:
- The entire summary MUST be written in the exact language of the original text OR ${language} if specifically requested.
- Use natural, academic tone.
- Use clear bullet points and sub-bullets for excellent readability.

TEXT CONTENT:
${text}
`;

  // 1. OpenRouter Provider
  if (activeProvider === 'openrouter' && (apiKey || settings.openRouterApiKey)) {
    const key = apiKey || settings.openRouterApiKey;
    try {
      const sanitizedModel = sanitizeModelName(model, 'openrouter');
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
          'HTTP-Referer': 'https://taqyeed.app',
          'X-Title': 'Taqyeed AI Notes',
        },
        body: JSON.stringify({
          model: sanitizedModel,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const textResult = data.choices?.[0]?.message?.content?.trim();
        if (textResult) return textResult;
      }
    } catch (err) {
      console.warn('OpenRouter text summary failed, falling back:', err);
    }
  }

  // 2. Gemini Provider
  const key = (activeProvider === 'gemini' ? apiKey : settings.geminiApiKey) || (process as any).env?.GEMINI_API_KEY;
  if (key) {
    try {
      const sanitizedModel = sanitizeModelName(model, 'gemini');
      const ai = new GoogleGenAI({ apiKey: key });
      const result = await ai.models.generateContent({
        model: sanitizedModel,
        contents: prompt,
      });
      return result.text?.trim() || '';
    } catch (err) {
      console.warn('Text summary generation failed, falling back to sidecar:', err);
    }
  }

  // 3. Sidecar Fallback
  const sanitizedModel = sanitizeModelName(model, 'sidecar');
  return generateSummaryFromTextSidecar(text, targetSidecarUrl, sanitizedModel, language);
}

export async function addTashkeelToArabicText(
  text: string,
  apiKey: string,
  model: string,
  provider?: string,
  sidecarUrl?: string
): Promise<string> {
  const settings = useAppStore.getState().settings;
  const activeProvider = provider || settings.llmProvider;
  const targetSidecarUrl = sidecarUrl || settings.sidecarUrl;

  if (activeProvider === 'sidecar') {
    const sanitizedModel = sanitizeModelName(model, 'sidecar');
    return addTashkeelToArabicTextSidecar(text, targetSidecarUrl, sanitizedModel);
  }

  const prompt = `You are an expert in Arabic linguistics and text-to-speech optimization.
Add correct Arabic diacritics (Tashkeel / تشكيل) to the following text. 
Focus carefully on correct grammar (نحو) and morphology (صرف) so that a text-to-speech engine will pronounce it flawlessly.
Do not change any words, only add the Tashkeel. DO NOT wrap the output in markdown, quotes, or any extra text. Return ONLY the fully diacritized text.
You should write the complete expression of صلى الله عليه وسلم not the shortcut symbol.
TEXT TO DIACRITIZE:
${text}
`;

  // 1. Gemini Provider
  const key = (activeProvider === 'gemini' ? apiKey : settings.geminiApiKey) || (process as any).env?.GEMINI_API_KEY;
  if (key) {
    try {
      const sanitizedModel = sanitizeModelName(model, 'gemini');
      const ai = new GoogleGenAI({ apiKey: key });
      const result = await ai.models.generateContent({
        model: sanitizedModel,
        contents: prompt,
      });
      return result.text?.trim() || text;
    } catch (err) {
      console.warn('Gemini Tashkeel generation failed, falling back to sidecar:', err);
    }
  }

  // 2. Sidecar Fallback
  try {
    const sanitizedModel = sanitizeModelName(model, 'sidecar');
    return await addTashkeelToArabicTextSidecar(text, targetSidecarUrl, sanitizedModel);
  } catch {
    return text;
  }
}

// ─── Streaming AI Content Enhancement ────────────────────────────────────────
export async function* streamEnhanceContent(
  htmlContent: string,
  apiKey: string,
  model: string,
  language: string,
  provider?: string,
  sidecarUrl?: string,
  customPrompt?: string
): AsyncGenerator<{ enhanced?: string; done?: boolean }> {
  const settings = useAppStore.getState().settings;
  const activeProvider = provider || settings.llmProvider;
  const targetSidecarUrl = sidecarUrl || settings.sidecarUrl;

  const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;
  let plainText = htmlContent;
  if (tempDiv) {
    tempDiv.innerHTML = htmlContent;
    plainText = tempDiv.textContent || tempDiv.innerText || htmlContent;
  }

  // 1. Taqyeed Gate (Sidecar) Provider
  if (activeProvider === 'sidecar') {
    try {
      const sanitizedModel = sanitizeModelName(model, 'sidecar');
      yield* streamEnhanceContentSidecar(htmlContent, targetSidecarUrl, sanitizedModel, language, customPrompt);
      return;
    } catch (sidecarErr: any) {
      console.warn('Sidecar stream enhancement failed, checking for API key fallback:', sidecarErr);
      const fallbackGeminiKey = settings.geminiApiKey || (process as any).env?.GEMINI_API_KEY;
      if (!fallbackGeminiKey && !settings.openRouterApiKey) {
        throw sidecarErr;
      }
    }
  }

  // 2. OpenRouter Provider
  if (activeProvider === 'openrouter' || (!apiKey && settings.openRouterApiKey)) {
    const openRouterKey = apiKey || settings.openRouterApiKey;
    if (openRouterKey) {
      try {
        const sanitizedModel = sanitizeModelName(model, 'openrouter');
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openRouterKey}`,
            'HTTP-Referer': 'https://taqyeed.app',
            'X-Title': 'Taqyeed AI Notes',
          },
          body: JSON.stringify({
            model: sanitizedModel,
            messages: [
              {
                role: 'system',
                content: customPrompt || `You are an expert scholarly editor and writing enhancer. Improve the provided text while preserving its original meaning, citations, and intent. Return ONLY the enhanced text in clean Markdown or HTML format without conversational intro or outro.`
              },
              {
                role: 'user',
                content: `TEXT TO PROCESS / ENHANCE:\n"""\n${plainText}\n"""\n\nApply the instructions to the text above and return ONLY the enhanced version.`
              }
            ],
            stream: true,
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(`OpenRouter error (${res.status}): ${errText || res.statusText}`);
        }

        if (res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let fullText = '';
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(':')) continue;
              if (trimmed === 'data: [DONE]') break;
              if (trimmed.startsWith('data: ')) {
                try {
                  const parsed = JSON.parse(trimmed.slice(6));
                  const token = parsed.choices?.[0]?.delta?.content || '';
                  if (token) {
                    fullText += token;
                    yield { enhanced: fullText };
                  }
                } catch {}
              }
            }
          }
          yield { enhanced: fullText, done: true };
          return;
        }
      } catch (orErr: any) {
        console.warn('OpenRouter enhancement failed, checking fallback:', orErr);
        try {
          const sanitizedModel = sanitizeModelName(model, 'sidecar');
          yield* streamEnhanceContentSidecar(htmlContent, targetSidecarUrl, sanitizedModel, language, customPrompt);
          return;
        } catch {
          throw orErr;
        }
      }
    }
  }

  // 3. Google Gemini Provider
  const geminiKey = apiKey || settings.geminiApiKey || (process as any).env?.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const sanitizedModel = sanitizeModelName(model, 'gemini');
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const prompt = customPrompt
        ? `${customPrompt}\n\nORIGINAL TEXT:\n${plainText}\n\nReturn ONLY the enhanced text in clean Markdown format without conversational meta-commentary.`
        : `You are an expert editor and writing enhancer. Improve the following text while preserving its original meaning, citations, and intent.\n\nTEXT:\n${plainText}\n\nReturn ONLY the enhanced text in clean Markdown format.`;

      const result = await ai.models.generateContentStream({
        model: sanitizedModel,
        contents: prompt,
      });

      let fullText = '';
      for await (const chunk of result) {
        if (chunk.text) {
          fullText += chunk.text;
          yield { enhanced: fullText };
        }
      }

      yield { enhanced: fullText, done: true };
      return;
    } catch (geminiErr: any) {
      console.warn(`Gemini Enhancement Error (Model: ${model}):`, geminiErr);
      try {
        const sanitizedModel = sanitizeModelName(model, 'sidecar');
        yield* streamEnhanceContentSidecar(htmlContent, targetSidecarUrl, sanitizedModel, language, customPrompt);
        return;
      } catch {
        throw geminiErr;
      }
    }
  }

  // 4. Default Fallback: Taqyeed Gate Sidecar
  const sanitizedModel = sanitizeModelName(model, 'sidecar');
  yield* streamEnhanceContentSidecar(htmlContent, targetSidecarUrl, sanitizedModel, language, customPrompt);
}

/**
 * Execute targeted AI Quick Action on selected text only
 */
export async function executeTargetedQuickAction(
  selectedText: string,
  promptTemplate: string,
  targetLanguage?: string
): Promise<string> {
  const settings = useAppStore.getState().settings;
  const activeProvider = settings.llmProvider;
  const sidecarUrl = settings.sidecarUrl;
  const model = settings.llmModel;

  const effectivePrompt = promptTemplate.replace(
    /\{\{TARGET_LANGUAGE\}\}/g,
    targetLanguage || (settings.language === 'ar' ? 'English' : 'Arabic')
  );

  const systemInstruction = `${effectivePrompt}\n\nCRITICAL OUTPUT REQUIREMENT:\nReturn ONLY the direct processed output corresponding to the instructions without any introductory remarks, explanations, quotes around the response, conversational filler, or conclusion.`;

  // 1. OpenRouter Provider
  if (activeProvider === 'openrouter' && settings.openRouterApiKey) {
    try {
      const sanitizedModel = sanitizeModelName(model, 'openrouter');
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.openRouterApiKey}`,
        },
        body: JSON.stringify({
          model: sanitizedModel,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: selectedText },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        if (text.trim()) return text.trim();
      }
    } catch (err) {
      console.warn('OpenRouter quick action failed, falling back to sidecar:', err);
    }
  }

  // 2. Gemini Direct API Provider
  const geminiKey = settings.geminiApiKey || (process as any).env?.GEMINI_API_KEY;
  if (activeProvider === 'gemini' && geminiKey) {
    try {
      const sanitizedModel = sanitizeModelName(model, 'gemini');
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: sanitizedModel,
        contents: [
          { text: `${systemInstruction}\n\nTEXT TO PROCESS:\n"""\n${selectedText}\n"""` },
        ],
      });
      const text = response.text || '';
      if (text.trim()) return text.trim();
    } catch (err) {
      console.warn('Gemini direct API failed, falling back to sidecar:', err);
    }
  }

  // 3. Default / Fallback: Taqyeed Gate Sidecar
  const sanitizedModel = sanitizeModelName(model, 'sidecar');
  return executeQuickActionSidecar(selectedText, systemInstruction, sidecarUrl, sanitizedModel);
}
