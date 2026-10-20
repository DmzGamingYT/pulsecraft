/**
 * Accès aux modèles de langage, quel que soit le fournisseur.
 *
 * Trois modes, choisis par l'utilisateur dans les réglages :
 *  - `pollinations` : gratuit, sans clé, agrégats seulement ;
 *  - `openai` : toute API compatible OpenAI (OpenAI, OpenRouter, Groq, Mistral,
 *    Together…) avec la clé de l'utilisateur, stockée dans IndexedDB ;
 *  - `local` : Ollama, LM Studio, llama.cpp… sur la machine, sans réseau.
 *
 * Aucun secret ne transite par Battement : la clé n'est envoyée qu'à l'URL
 * choisie, dans l'en-tête Authorization. Un échec réseau ne casse jamais l'app :
 * l'appelant retombe sur le raisonnement local.
 */

import type { AiConfig } from '../types';
import { DEFAULT_AI } from '../types';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmOptions {
  signal?: AbortSignal;
  timeout?: number;
  maxTokens?: number;
  temperature?: number;
}

export const PROVIDER_LABELS: Record<AiConfig['provider'], string> = {
  pollinations: 'Pollinations (gratuit, sans clé)',
  openai: 'API compatible OpenAI (clé personnelle)',
  local: 'Modèle local (Ollama, LM Studio…)',
};

export const PROVIDER_HINTS: Record<AiConfig['provider'], string> = {
  pollinations: 'Aucune configuration. Le palier gratuit peut limiter le débit.',
  openai: 'Votre clé reste sur cet appareil et n’est envoyée qu’au fournisseur choisi.',
  local: 'Rien ne quitte la machine. Démarrez Ollama ou LM Studio avant de tester.',
};

const DEFAULT_OPENAI_BASE = 'https://api.openai.com/v1';
const DEFAULT_LOCAL_BASE = 'http://127.0.0.1:11434/v1';
const POLLINATIONS_URL = 'https://text.pollinations.ai/openai';
const PROXY_URL = `${import.meta.env.BASE_URL}pc/api/ai`;

export function normalizeConfig(config?: Partial<AiConfig> | null): AiConfig {
  return { ...DEFAULT_AI, ...(config ?? {}) };
}

export function providerLabel(config: AiConfig): string {
  if (config.provider === 'openai') return config.model || 'API compatible OpenAI';
  if (config.provider === 'local') return config.model || 'Modèle local';
  return 'Pollinations';
}

/** Un fournisseur est prêt quand tout ce qu'il exige est renseigné. */
export function aiReady(config?: AiConfig | null): boolean {
  const resolved = normalizeConfig(config);
  if (!resolved.provider) return false;
  if (resolved.provider === 'openai') return resolved.apiKey.trim().length > 8;
  if (resolved.provider === 'local') return true;
  return true;
}

function endpointFor(config: AiConfig): { url: string; model: string; headers: Record<string, string> } {
  if (config.provider === 'openai') {
    const base = (config.baseUrl.trim() || DEFAULT_OPENAI_BASE).replace(/\/+$/, '');
    return {
      url: `${base}/chat/completions`,
      model: config.model.trim() || 'gpt-4o-mini',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
    };
  }
  if (config.provider === 'local') {
    const base = (config.baseUrl.trim() || DEFAULT_LOCAL_BASE).replace(/\/+$/, '');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiKey.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`;
    return {
      url: `${base}/chat/completions`,
      model: config.model.trim() || 'llama3.1',
      headers,
    };
  }
  return {
    url: POLLINATIONS_URL,
    model: 'openai',
    headers: { 'Content-Type': 'application/json' },
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  options: LlmOptions
): Promise<Response> {
  const controller = new AbortController();
  const timeout = options.timeout ?? 30_000;
  const timer = setTimeout(() => controller.abort(), timeout);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

function readText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const data = payload as {
    choices?: Array<{ message?: { content?: string } }>;
    text?: string;
    error?: string;
  };
  const text = data.choices?.[0]?.message?.content ?? data.text ?? '';
  return typeof text === 'string' ? text.trim() : '';
}

/**
 * Envoie une conversation et renvoie le texte.
 * `pollinations` tente d'abord le direct, puis le relais de développement.
 */
export async function complete(
  messages: LlmMessage[],
  configInput?: Partial<AiConfig> | null,
  options: LlmOptions = {}
): Promise<string> {
  const config = normalizeConfig(configInput);
  const { url, model, headers } = endpointFor(config);
  const body = JSON.stringify({
    model,
    messages,
    temperature: options.temperature ?? 0.55,
    max_tokens: options.maxTokens ?? 700,
    ...(config.provider === 'pollinations' ? { referrer: 'battement' } : {}),
  });

  if (config.provider === 'openai') {
    if (!config.apiKey.trim()) throw new Error('Ajoutez une clé API pour ce fournisseur.');
    const response = await fetchWithTimeout(url, { method: 'POST', headers, body }, options);
    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? 'Clé API refusée (401). Vérifiez-la dans les réglages.'
          : `Fournisseur IA indisponible (${response.status}).`
      );
    }
    const text = readText(await response.json());
    if (!text) throw new Error('Réponse vide du fournisseur IA.');
    return text;
  }

  if (config.provider === 'local') {
    let response: Response;
    try {
      response = await fetchWithTimeout(url, { method: 'POST', headers, body }, options);
    } catch {
      throw new Error(
        `Modèle local injoignable (${url}). Démarrez Ollama ou LM Studio, puis vérifiez l’URL.`
      );
    }
    if (!response.ok) {
      throw new Error(`Le modèle local a répondu ${response.status}.`);
    }
    const text = readText(await response.json());
    if (!text) throw new Error('Réponse vide du modèle local.');
    return text;
  }

  // Pollinations : direct, puis relais local si le CORS ou le quota bloque.
  try {
    const response = await fetchWithTimeout(
      url,
      { method: 'POST', headers, body },
      { ...options, timeout: options.timeout ?? 20_000 }
    );
    if (response.ok) {
      const text = readText(await response.json());
      if (text) return text;
    }
  } catch {
    /* on tente le relais de développement */
  }

  // Le relais `/pc/api/ai` n'existe que sous Vite : sur un hébergement
  // statique il renverrait un 405 dans la console pour rien.
  if (!import.meta.env.DEV) {
    throw new Error('IA indisponible pour le moment. Réessayez dans un instant.');
  }

  const proxy = await fetchWithTimeout(
    PROXY_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    },
    options
  );
  if (!proxy.ok) throw new Error(`IA indisponible (${proxy.status}).`);
  const text = readText(await proxy.json());
  if (!text) throw new Error('Réponse vide de l’IA.');
  return text;
}

export interface TestResult {
  ok: boolean;
  message: string;
}

/** Test court, appelé depuis les réglages : il ne transporte aucune donnée de santé. */
export async function testProvider(config: AiConfig): Promise<TestResult> {
  if (!aiReady(config)) {
    return { ok: false, message: 'Clé API manquante ou trop courte.' };
  }
  const started = performance.now();
  try {
    const text = await complete(
      [
        { role: 'system', content: 'Tu réponds uniquement par le mot « ok », en minuscules.' },
        { role: 'user', content: 'Connexion Battement.' },
      ],
      config,
      { timeout: 15_000, maxTokens: 12, temperature: 0 }
    );
    const elapsed = Math.round(performance.now() - started);
    return {
      ok: true,
      message: `${providerLabel(config)} répond en ${elapsed} ms${text ? ` (« ${text.slice(0, 24)} »)` : ''}.`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Test impossible.',
    };
  }
}
