/**
 * Relais de développement pour l'IA du coach (Pollinations, gratuit et sans clé).
 *
 * Le navigateur appelle d'abord Pollinations en direct ; si le CORS, le quota
 * (≈ 1 requête / 30 s par IP) ou le réseau bloquent, il retombe sur
 * `POST /pc/api/ai`. Ce relais n'expose aucun secret, borne la taille du corps
 * et la durée de l'appel, et n'ajoute aucun en-tête CORS permissif.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

const ENDPOINT = 'https://text.pollinations.ai/openai';
const MODEL = 'openai';
const MAX_BODY = 64 * 1024;
const TIMEOUT_MS = 45_000;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Corps de requête trop volumineux.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, payload: unknown) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function sanitizeMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input)) return null;
  const messages: ChatMessage[] = [];
  for (const item of input.slice(-16)) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const role = entry.role;
    const content = entry.content;
    if (role !== 'system' && role !== 'user' && role !== 'assistant') continue;
    if (typeof content !== 'string' || content.trim().length === 0) continue;
    messages.push({ role, content: content.slice(0, 6000) });
  }
  return messages.length > 0 ? messages : null;
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'GET') {
    json(res, 200, { ok: true, model: MODEL, proxy: true });
    return;
  }
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Méthode non autorisée.' });
    return;
  }

  let body: unknown;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    json(res, 400, { error: 'JSON invalide ou corps trop volumineux.' });
    return;
  }

  const messages = sanitizeMessages((body as { messages?: unknown } | null)?.messages);
  if (!messages) {
    json(res, 400, { error: 'Messages manquants.' });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.55,
        max_tokens: 900,
        referrer: 'battement',
      }),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      json(res, 502, { error: `IA indisponible (${upstream.status}).` });
      return;
    }

    const data = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      text?: string;
    };
    const text = data.choices?.[0]?.message?.content ?? data.text ?? '';
    if (typeof text !== 'string' || text.trim().length === 0) {
      json(res, 502, { error: 'Réponse vide de l’IA.' });
      return;
    }
    json(res, 200, { text: text.trim() });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    json(res, aborted ? 504 : 502, { error: aborted ? 'Délai dépassé.' : 'IA injoignable.' });
  } finally {
    clearTimeout(timer);
  }
}

export function aiProxyPlugin(): Plugin {
  return {
    name: 'pulsecraft-ai-proxy',
    configureServer(server) {
      server.middlewares.use('/pc/api/ai', (req, res) => {
        void handle(req, res);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use('/pc/api/ai', (req, res) => {
        void handle(req, res);
      });
    },
  };
}
