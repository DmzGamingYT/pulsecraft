/**
 * Persistance du journal dans IndexedDB.
 *
 * Un journal sportif grossit vite : plusieurs années d'Apple Santé, ce sont
 * des milliers de séances, plus les journées de pas. `localStorage` plafonne
 * autour de 5 Mo et bloque le fil principal ; IndexedDB n'a pas cette limite
 * pratique et reste strictement local.
 *
 * Les journaux écrits avant ce changement vivent dans `localStorage` sous la
 * même clé : au premier chargement, on les recopie dans IndexedDB avant de
 * répondre. Si IndexedDB est indisponible (navigation privée restrictive,
 * WebView ancienne), on retombe sur `localStorage` ; si les deux échouent, le
 * journal vit en mémoire pour la session, sans jamais bloquer l'interface.
 */

import type { StateStorage } from 'zustand/middleware';

const DB_NAME = 'battement';
const DB_VERSION = 1;
const STORE = 'state';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Ouverture IndexedDB impossible'));
    request.onblocked = () => reject(new Error('IndexedDB bloquée par un autre onglet'));
  });
  return dbPromise;
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Écriture IndexedDB annulée'));
  });
}

async function idbRemove(key: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const memory = new Map<string, string>();

/** `localStorage`, quand il est encore lisible (et pas seulement en secours). */
function legacyGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export const idbStorage: StateStorage = {
  async getItem(name) {
    try {
      const value = await idbGet(name);
      if (value !== null) return value;
      // Journal écrit avant IndexedDB : on le reprend ici, une seule fois.
      const legacy = legacyGet(name);
      if (legacy !== null) {
        await idbSet(name, legacy).catch(() => undefined);
        return legacy;
      }
      return null;
    } catch {
      return legacyGet(name) ?? memory.get(name) ?? null;
    }
  },
  async setItem(name, value) {
    try {
      await idbSet(name, value);
      return;
    } catch {
      try {
        localStorage.setItem(name, value);
        return;
      } catch {
        memory.set(name, value);
      }
    }
  },
  async removeItem(name) {
    try {
      await idbRemove(name);
    } catch {
      /* IndexedDB absente : on efface aussi la copie de secours */
    }
    try {
      localStorage.removeItem(name);
    } catch {
      /* rien à faire */
    }
    memory.delete(name);
  },
};
