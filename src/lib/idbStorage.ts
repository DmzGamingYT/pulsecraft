/**
 * Persistance zustand dans IndexedDB.
 *
 * Les données de santé grossissent vite (des mois d'entraînements, de nuits et
 * de mesures) : `localStorage` plafonne autour de 5 Mo. IndexedDB n'a pas cette
 * limite pratique et reste strictement local.
 *
 * Si IndexedDB est indisponible (navigation privée restrictive, WebView
 * ancienne), on retombe sur `localStorage` ; si les deux échouent, l'app
 * fonctionne en mémoire pour la session, sans jamais bloquer l'interface.
 */

import type { StateStorage } from 'zustand/middleware';

const DB_NAME = 'pulsecraft';
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

export const idbStorage: StateStorage = {
  async getItem(name) {
    try {
      return await idbGet(name);
    } catch {
      try {
        return localStorage.getItem(name) ?? memory.get(name) ?? null;
      } catch {
        return memory.get(name) ?? null;
      }
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
      return;
    } catch {
      try {
        localStorage.removeItem(name);
      } catch {
        memory.delete(name);
      }
    }
  },
};
