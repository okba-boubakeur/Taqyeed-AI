import { GoogleGenAI } from '@google/genai';
import { defaultSystemPrompt, useAppStore, LLMProvider, Settings } from '../store';
import {
  streamSummaryFromAudioSidecar,
  generateSummaryFromTextSidecar,
  generateTitleFromSummarySidecar,
  addTashkeelToArabicTextSidecar,
  streamEnhanceContentSidecar,
  executeQuickActionSidecar,
} from './sidecar';

/**
 * Helper to retrieve the saved API key for any given provider.
 */
export function getEffectiveApiKey(settings: Settings, providerOverride?: LLMProvider): string {
  const provider = providerOverride || settings.llmProvider;
  switch (provider) {
    case 'gemini':
      return settings.geminiApiKey || (process as any).env?.GEMINI_API_KEY || '';
    case 'openrouter':
      return settings.openRouterApiKey || '';
    case 'deepseek':
      return settings.deepseekApiKey || '';
    case 'qwen':
      return settings.qwenApiKey || '';
    case 'kimi':
      return settings.kimiApiKey || '';
    case 'grok':
      return settings.grokApiKey || '';
    case 'chatgpt':
      return settings.chatgptApiKey || '';
    case 'anthropic':
      return settings.anthropicApiKey || '';
    case 'custom':
      return settings.customApiKey || 'custom-key';
    case 'sidecar':
      return '';
    default:
      return '';
  }
}

/**
 * Returns default recommended cheapest model for each provider.
 */
export function getDefaultModelForProvider(provider: LLMProvider): string {
  switch (provider) {
    case 'gemini':
      return 'gemini-2.5-flash';
    case 'openrouter':
      return 'openrouter/free';
    case 'qwen':
      return 'qwen3.7-flash';
    case 'deepseek':
      return 'deepseek-flash';
    case 'kimi':
      return 'kimi-k2.6';
    case 'grok':
      return 'grok-code-fast-1';
    case 'chatgpt':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-3-5-haiku-20241022';
    case 'custom':
      return 'default';
    case 'sidecar':
      return 'gemini-flash';
    default:
      return 'gemini-2.5-flash';
  }
}

/**
 * Sanitizes model identifiers to prevent provider mismatches, CORS preflight errors,
 * and 404s (e.g. stripping OpenRouter prefixes/suffixes like "google/" or ":batch").
 */
export function sanitizeModelName(model: string, provider: LLMProvider | string): string {
  let m = (model || '').trim();

  if (provider === 'gemini') {
    m = m.replace(/^[a-zA-Z0-9_-]+\//, '');
    m = m.replace(/:(?:batch|free|default|nitro)$/i, '');
    if (!m || !m.includes('gemini')) {
      return 'gemini-2.5-flash';
    }
    return m;
  }

  if (provider === 'openrouter') {
    m = m.replace(/:batch$/i, '');
    if (!m) return 'openrouter/free';
    if (m === 'openrouter/free') return 'openrouter/free';
    if (m.startsWith('gemini-') && !m.includes('/')) {
      return `google/${m}`;
    }
    return m;
  }


  if (provider === 'qwen') {
    return m || 'qwen3.7-flash';
  }

  if (provider === 'deepseek') {
    return m || 'deepseek-flash';
  }

  if (provider === 'kimi') {
    return m || 'kimi-k2.6';
  }

  if (provider === 'grok') {
    return m || 'grok-code-fast-1';
  }

  if (provider === 'chatgpt') {
    return m || 'gpt-4o-mini';
  }

  if (provider === 'anthropic') {
    return m || 'claude-3-5-haiku-20241022';
  }

  if (provider === 'custom') {
    return m || 'default';
  }

  if (provider === 'sidecar') {
    if (m.includes('pro')) return 'gemini-pro';
    if (m.includes('lite')) return 'gemini-flash-lite';
    return 'gemini-flash';
  }

  return m || 'gemini-2.5-flash';
}

export interface ProviderEndpointConfig {
  baseUrl: string;
  isOpenAiCompatible: boolean;
  extraHeaders?: (key: string) => Record<string, string>;
}

export function getProviderConfig(provider: LLMProvider, customBaseUrl?: string): ProviderEndpointConfig {
  switch (provider) {
    case 'openrouter':
      return {
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
        isOpenAiCompatible: true,
        extraHeaders: () => ({
          'HTTP-Referer': 'https://taqyeed.app',
          'X-Title': 'Taqyeed AI Notes',
        }),
      };
    case 'deepseek':
      return {
        baseUrl: 'https://api.deepseek.com/chat/completions',
        isOpenAiCompatible: true,
      };
    case 'qwen':
      return {
        baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
        isOpenAiCompatible: true,
      };
    case 'kimi':
      return {
        baseUrl: 'https://api.moonshot.ai/v1/chat/completions',
        isOpenAiCompatible: true,
      };
    case 'grok':
      return {
        baseUrl: 'https://api.x.ai/v1/chat/completions',
        isOpenAiCompatible: true,
      };
    case 'chatgpt':
      return {
        baseUrl: 'https://api.openai.com/v1/chat/completions',
        isOpenAiCompatible: true,
      };
    case 'anthropic':
      return {
        baseUrl: 'https://api.anthropic.com/v1/messages',
        isOpenAiCompatible: false,
      };
    case 'custom': {
      const cleanUrl = (customBaseUrl || '').trim().replace(/\/+$/, '');
      const fullUrl = cleanUrl.endsWith('/chat/completions')
        ? cleanUrl
        : cleanUrl.endsWith('/v1')
        ? `${cleanUrl}/chat/completions`
        : cleanUrl
        ? `${cleanUrl}/v1/chat/completions`
        : 'http://localhost:11434/v1/chat/completions';
      return {
        baseUrl: fullUrl,
        isOpenAiCompatible: true,
      };
    }
    default:
      return {
        baseUrl: '',
        isOpenAiCompatible: false,
      };
  }
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Universal caller for non-streaming OpenAI-compatible & Anthropic providers
 */
async function callProviderLlm(
  provider: LLMProvider,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  customBaseUrl?: string
): Promise<string> {
  const sanitized = sanitizeModelName(model, provider);

  if (provider === 'anthropic') {
    const systemMsg = messages.find((m) => m.role === 'system')?.content;
    const userMsgs = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: sanitized,
        max_tokens: 4096,
        ...(systemMsg ? { system: systemMsg } : {}),
        messages: userMsgs,
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Anthropic error (${res.status}): ${err}`);
    }
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || '';
  }

  // OpenAI-compatible providers
  const config = getProviderConfig(provider, customBaseUrl);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(apiKey && apiKey !== 'custom-key' ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...(config.extraHeaders ? config.extraHeaders(apiKey) : {}),
  };

  const res = await fetch(config.baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: sanitized,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`${provider} error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * Universal streaming generator for OpenAI-compatible & Anthropic providers
 */
async function* streamProviderLlm(
  provider: LLMProvider,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  customBaseUrl?: string
): AsyncGenerator<{ token: string }> {
  const sanitized = sanitizeModelName(model, provider);

  let url: string;
  let headers: Record<string, string>;
  let body: any;

  if (provider === 'anthropic') {
    url = 'https://api.anthropic.com/v1/messages';
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    const systemMsg = messages.find((m) => m.role === 'system')?.content;
    const userMsgs = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));
    body = {
      model: sanitized,
      max_tokens: 4096,
      ...(systemMsg ? { system: systemMsg } : {}),
      messages: userMsgs,
      stream: true,
    };
  } else {
    const config = getProviderConfig(provider, customBaseUrl);
    url = config.baseUrl;
    headers = {
      'Content-Type': 'application/json',
      ...(apiKey && apiKey !== 'custom-key' ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(config.extraHeaders ? config.extraHeaders(apiKey) : {}),
    };
    body = {
      model: sanitized,
      messages,
      stream: true,
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`${provider} streaming error (${res.status}): ${err}`);
  }

  if (!res.body) {
    throw new Error('No response body from provider');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
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
          const token =
            parsed.choices?.[0]?.delta?.content ||
            parsed.delta?.text ||
            '';
          if (token) {
            yield { token };
          }
        } catch {}
      }
    }
  }
}

/**
 * Validates connection and API Key validity across all 9 providers
 */
export async function testProviderApiKey(
  provider: LLMProvider,
  key: string,
  customBaseUrl?: string
): Promise<{ success: boolean; message?: string }> {
  const cleanKey = (key || '').trim();
  if (!cleanKey && provider !== 'sidecar' && provider !== 'custom') {
    return { success: false, message: 'API key is required' };
  }

  try {
    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`;
      const res = await fetch(url);
      if (res.ok) {
        return { success: true };
      }
      const data = await res.json().catch(() => ({}));
      const msg = data.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      return { success: false, message: msg };
    }

    if (provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${cleanKey}` },
      });
      if (res.ok) {
        return { success: true };
      }
      const data = await res.json().catch(() => ({}));
      const msg = data.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      return { success: false, message: msg };
    }

    if (provider === 'deepseek') {
      const res = await fetch('https://api.deepseek.com/models', {
        headers: { Authorization: `Bearer ${cleanKey}` },
      });
      if (res.ok) {
        return { success: true };
      }
      const data = await res.json().catch(() => ({}));
      const msg = data.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      return { success: false, message: msg };
    }

    if (provider === 'qwen') {
      const res = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models', {
        headers: { Authorization: `Bearer ${cleanKey}` },
      });
      if (res.ok) {
        return { success: true };
      }
      const data = await res.json().catch(() => ({}));
      const msg = data.error?.message || data.message || `HTTP ${res.status}: ${res.statusText}`;
      return { success: false, message: msg };
    }

    if (provider === 'kimi') {
      const res = await fetch('https://api.moonshot.ai/v1/models', {
        headers: { Authorization: `Bearer ${cleanKey}` },
      });
      if (res.ok) {
        return { success: true };
      }
      const data = await res.json().catch(() => ({}));
      const msg = data.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      return { success: false, message: msg };
    }


    if (provider === 'grok') {
      const res = await fetch('https://api.x.ai/v1/models', {
        headers: { Authorization: `Bearer ${cleanKey}` },
      });
      if (res.ok) {
        return { success: true };
      }
      const data = await res.json().catch(() => ({}));
      const msg = data.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      return { success: false, message: msg };
    }

    if (provider === 'chatgpt') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${cleanKey}` },
      });
      if (res.ok) {
        return { success: true };
      }
      const data = await res.json().catch(() => ({}));
      const msg = data.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      return { success: false, message: msg };
    }

    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cleanKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        }),
      });
      if (res.ok) {
        return { success: true };
      }
      const data = await res.json().catch(() => ({}));
      const msg = data.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      return { success: false, message: msg };
    }

    if (provider === 'custom') {
      const cleanUrl = (customBaseUrl || '').trim();
      if (!cleanUrl) {
        return { success: false, message: 'Base URL is required for custom provider' };
      }
      const base = cleanUrl.replace(/\/+$/, '');
      const testUrl = base.endsWith('/chat/completions')
        ? base
        : base.endsWith('/v1')
        ? `${base}/chat/completions`
        : `${base}/v1/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (cleanKey && cleanKey !== 'custom-key') {
        headers['Authorization'] = `Bearer ${cleanKey}`;
      }

      const modelsUrl = base.endsWith('/chat/completions')
        ? base.replace(/\/chat\/completions$/, '/models')
        : `${base.replace(/\/v1$/, '')}/v1/models`;

      const res = await fetch(modelsUrl, { headers }).catch(() => null);
      if (res && res.ok) {
        return { success: true };
      }

      const compRes = await fetch(testUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'default',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        }),
      });

      if (compRes.ok) {
        return { success: true };
      }
      const compData = await compRes.json().catch(() => ({}));
      const msg = compData.error?.message || `HTTP ${compRes.status}: ${compRes.statusText}`;
      return { success: false, message: msg };
    }

    if (provider === 'sidecar') {
      const res = await fetch('http://127.0.0.1:47195/health').catch(() => null);
      if (res && res.ok) {
        return { success: true };
      }
      return { success: false, message: 'Sidecar daemon is offline (port 47195)' };
    }

    return { success: false, message: 'Unknown provider' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Connection failed' };
  }
}

/**
 * Safely converts an audio Blob into a base64 string using chunked ArrayBuffer
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
  const activeProvider = (provider || settings.llmProvider) as LLMProvider;
  const targetSidecarUrl = sidecarUrl || settings.sidecarUrl;

  // 1. If active provider is sidecar, stream directly via local daemon
  if (activeProvider === 'sidecar') {
    const sanitizedModel = sanitizeModelName(model, 'sidecar');
    yield* streamSummaryFromAudioSidecar(audioBlob, targetSidecarUrl, sanitizedModel, systemPrompt);
    return;
  }

  // 2. Audio uploads require Gemini multimodal capabilities or Sidecar
  const effectiveGeminiKey = (activeProvider === 'gemini' ? apiKey : settings.geminiApiKey) || (process as any).env?.GEMINI_API_KEY;

  if (!effectiveGeminiKey) {
    console.log('[Audio LLM] No Gemini API key provided. Using Taqyeed Gate Sidecar...');
    try {
      const sanitizedModel = sanitizeModelName(model, 'sidecar');
      yield* streamSummaryFromAudioSidecar(audioBlob, targetSidecarUrl, sanitizedModel, systemPrompt);
      return;
    } catch (sidecarErr: any) {
      throw new Error(
        'Audio processing requires either a Google Gemini API Key or the Taqyeed Gate Sidecar running locally.'
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
      console.warn('[Audio LLM] Gemini Files API upload failed. Falling back to Taqyeed Gate Sidecar:', uploadErr);
      try {
        const sanitizedModel = sanitizeModelName(model, 'sidecar');
        yield* streamSummaryFromAudioSidecar(audioBlob, targetSidecarUrl, sanitizedModel, systemPrompt);
        return;
      } catch (sidecarFallbackErr: any) {
        throw new Error(
          `Audio summarization failed: ${uploadErr.message || 'Gemini error'}.`
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
  const activeProvider = (provider || settings.llmProvider) as LLMProvider;
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

  const effectiveKey = apiKey || getEffectiveApiKey(settings, activeProvider);

  // 1. Gemini
  if (activeProvider === 'gemini') {
    if (effectiveKey) {
      try {
        const sanitizedModel = sanitizeModelName(model, 'gemini');
        const ai = new GoogleGenAI({ apiKey: effectiveKey });
        const result = await ai.models.generateContent({
          model: sanitizedModel,
          contents: prompt,
        });
        const titleText = result.text?.trim();
        if (titleText) return titleText.replace(/^["']|["']$/g, '');
      } catch (err) {
        console.warn('Gemini title generation failed, falling back:', err);
      }
    }
  } else if (effectiveKey) {
    // 2. Any other provider
    try {
      const titleText = await callProviderLlm(
        activeProvider,
        effectiveKey,
        model,
        [{ role: 'user', content: prompt }],
        settings.customApiBaseUrl
      );
      if (titleText) return titleText.replace(/^["']|["']$/g, '');
    } catch (err) {
      console.warn(`${activeProvider} title generation failed:`, err);
    }
  }

  // 3. Sidecar Fallback
  try {
    const sanitizedModel = sanitizeModelName(model, 'sidecar');
    return await generateTitleFromSummarySidecar(summary, targetSidecarUrl, sanitizedModel, language);
  } catch {
    return `Note ${new Date().toLocaleDateString()}`;
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
  const activeProvider = (provider || settings.llmProvider) as LLMProvider;
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

  const effectiveKey = apiKey || getEffectiveApiKey(settings, activeProvider);

  if (activeProvider === 'gemini') {
    if (effectiveKey) {
      try {
        const sanitizedModel = sanitizeModelName(model, 'gemini');
        const ai = new GoogleGenAI({ apiKey: effectiveKey });
        const result = await ai.models.generateContent({
          model: sanitizedModel,
          contents: prompt,
        });
        return result.text?.trim() || '';
      } catch (err) {
        console.warn('Gemini text summary failed:', err);
      }
    }
  } else if (effectiveKey) {
    try {
      return await callProviderLlm(
        activeProvider,
        effectiveKey,
        model,
        [{ role: 'user', content: prompt }],
        settings.customApiBaseUrl
      );
    } catch (err) {
      console.warn(`${activeProvider} text summary failed:`, err);
    }
  }

  // Fallback to Sidecar
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
  const activeProvider = (provider || settings.llmProvider) as LLMProvider;
  const targetSidecarUrl = sidecarUrl || settings.sidecarUrl;

  if (activeProvider === 'sidecar') {
    const sanitizedModel = sanitizeModelName(model, 'sidecar');
    return addTashkeelToArabicTextSidecar(text, targetSidecarUrl, sanitizedModel);
  }

  const prompt = `You are an expert in Arabic grammar (النحو والصرف) and classical Arabic literature.
Task: Add full, accurate Arabic diacritics (التشكيل الكامل / علامات الإعراب) to the provided Arabic text.

STRICT RULES:
1. Do NOT translate, summarize, or alter any word or word order.
2. Return ONLY the diacritized Arabic text.
3. Preserve all punctuation marks, line breaks, and formatting exactly as in the input.
4. You should write the complete expression of صلى الله عليه وسلم not the shortcut symbol.
TEXT TO DIACRITIZE:
${text}
`;

  const effectiveKey = apiKey || getEffectiveApiKey(settings, activeProvider);

  if (activeProvider === 'gemini') {
    if (effectiveKey) {
      try {
        const sanitizedModel = sanitizeModelName(model, 'gemini');
        const ai = new GoogleGenAI({ apiKey: effectiveKey });
        const result = await ai.models.generateContent({
          model: sanitizedModel,
          contents: prompt,
        });
        return result.text?.trim() || text;
      } catch (err) {
        console.warn('Gemini Tashkeel generation failed:', err);
      }
    }
  } else if (effectiveKey) {
    try {
      return await callProviderLlm(
        activeProvider,
        effectiveKey,
        model,
        [{ role: 'user', content: prompt }],
        settings.customApiBaseUrl
      );
    } catch (err) {
      console.warn(`${activeProvider} Tashkeel generation failed:`, err);
    }
  }

  const sanitizedModel = sanitizeModelName(model, 'sidecar');
  return await addTashkeelToArabicTextSidecar(text, targetSidecarUrl, sanitizedModel);
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
  const activeProvider = (provider || settings.llmProvider) as LLMProvider;
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
      console.warn('Sidecar stream enhancement failed:', sidecarErr);
      throw sidecarErr;
    }
  }

  const effectiveKey = apiKey || getEffectiveApiKey(settings, activeProvider);

  // 2. Google Gemini Provider
  if (activeProvider === 'gemini') {
    if (effectiveKey) {
      try {
        const sanitizedModel = sanitizeModelName(model, 'gemini');
        const ai = new GoogleGenAI({ apiKey: effectiveKey });
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
        throw geminiErr;
      }
    }
  }

  // 3. All other providers (OpenRouter, DeepSeek, Qwen, Kimi, Grok, ChatGPT, Anthropic)
  if (effectiveKey) {
    try {
      const systemInstruction = customPrompt || 'You are an expert scholarly editor and writing enhancer. Improve the provided text while preserving its original meaning, citations, and intent. Return ONLY the enhanced text in clean Markdown format without conversational intro or outro.';
      const messages: ChatMessage[] = [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: `TEXT TO PROCESS / ENHANCE:\n"""\n${plainText}\n"""\n\nApply the instructions to the text above and return ONLY the enhanced version.` },
      ];

      let fullText = '';
      for await (const { token } of streamProviderLlm(activeProvider, effectiveKey, model, messages, settings.customApiBaseUrl)) {
        fullText += token;
        yield { enhanced: fullText };
      }

      yield { enhanced: fullText, done: true };
      return;
    } catch (err: any) {
      console.warn(`${activeProvider} stream enhancement failed:`, err);
      throw err;
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

  const effectiveKey = getEffectiveApiKey(settings, activeProvider);

  // 1. Gemini Direct API Provider
  if (activeProvider === 'gemini' && effectiveKey) {
    try {
      const sanitizedModel = sanitizeModelName(model, 'gemini');
      const ai = new GoogleGenAI({ apiKey: effectiveKey });
      const response = await ai.models.generateContent({
        model: sanitizedModel,
        contents: [
          { text: `${systemInstruction}\n\nTEXT TO PROCESS:\n"""\n${selectedText}\n"""` },
        ],
      });
      const text = response.text || '';
      if (text.trim()) return text.trim();
    } catch (err) {
      console.warn('Gemini direct quick action failed:', err);
      throw err;
    }
  } else if (activeProvider !== 'sidecar' && effectiveKey) {
    // 2. OpenAI-compatible or Anthropic
    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: selectedText },
      ];
      const text = await callProviderLlm(activeProvider, effectiveKey, model, messages, settings.customApiBaseUrl);
      if (text.trim()) return text.trim();
    } catch (err) {
      console.warn(`${activeProvider} quick action failed:`, err);
      throw err;
    }
  }

  // 3. Fallback: Taqyeed Gate Sidecar
  const sanitizedModel = sanitizeModelName(model, 'sidecar');
  return executeQuickActionSidecar(selectedText, systemInstruction, sidecarUrl, sanitizedModel);
}
