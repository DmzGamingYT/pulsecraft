/*
 * Battement — service worker.
 *
 * Le journal vit déjà dans IndexedDB : il ne manquait que l'application
 * elle-même pour l'ouvrir sans réseau. On garde la coquille (HTML, JS, CSS,
 * polices) dans un cache versionné, et on sert le réseau d'abord pour les
 * navigations afin qu'une nouvelle version remplace l'ancienne.
 *
 * Aucune donnée du journal ne passe par ici : seules les ressources de la
 * page sont mises en cache, et uniquement depuis cette origine.
 */

const VERSION = 'battement-v3';
const SHELL = new URL('./', self.location.href).href;
const INDEX = new URL('./index.html', self.location.href).href;

/**
 * Les noms des fichiers JS et CSS sont hachés à chaque build : on les découvre
 * en lisant l'index au moment de l'installation, sinon la première visite ne
 * serait pas disponible hors ligne (le worker s'active après le chargement).
 */
async function precache(cache) {
  const response = await fetch(INDEX, { cache: 'no-cache' });
  if (!response.ok) throw new Error('index illisible');
  const html = await response.text();
  const urls = new Set([SHELL, INDEX]);

  const references = /(?:src|href)="([^"]+)"/g;
  let match;
  while ((match = references.exec(html))) {
    const url = new URL(match[1], INDEX);
    if (url.origin === self.location.origin) urls.add(url.href);
  }

  // Les polices ne sont citées que par la feuille de style.
  const stylesheet = [...urls].find((url) => /\.css($|\?)/.test(url));
  if (stylesheet) {
    try {
      const css = await (await fetch(stylesheet, { cache: 'no-cache' })).text();
      for (const [, , value] of css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)) {
        if (!value) continue;
        const url = new URL(value, stylesheet);
        if (url.origin === self.location.origin) urls.add(url.href);
      }
    } catch {
      // Une feuille de style absente ne bloque pas l'installation.
    }
  }

  await Promise.all([...urls].map((url) => cache.add(url).catch(() => undefined)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await precache(cache).catch(() => undefined);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(VERSION);
          void cache.put(INDEX, response.clone());
          return response;
        } catch {
          const cache = await caches.open(VERSION);
          return (
            (await cache.match(INDEX)) ??
            (await cache.match(SHELL)) ??
            new Response('Battement est hors ligne et la page n’a pas encore été visitée.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          );
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
          void cache.put(request, response.clone());
        }
        return response;
      } catch {
        return (
          cached ??
          new Response('', { status: 504, statusText: 'Hors ligne' })
        );
      }
    })(),
  );
});
