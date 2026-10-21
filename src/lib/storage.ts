/**
 * Le stockage du navigateur, sans dépendance.
 *
 * Deux gestes seulement : demander au navigateur de ne pas effacer le journal
 * quand il manque de place, et lire ce qu'il reste comme espace. Les deux
 * échouent silencieusement : un navigateur qui refuse n'empêche pas d'écrire.
 */

export interface StorageEstimate {
  /** octets utilisés par ce site, toutes données confondues */
  usage: number;
  /** octets disponibles avant éviction, 0 quand le navigateur ne sait pas */
  quota: number;
  /** le navigateur s'engage-t-il à ne pas évincer ces données ? */
  persisted: boolean;
}

export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    if (navigator.storage.persisted && (await navigator.storage.persisted())) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function storageEstimate(): Promise<StorageEstimate | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const [estimate, persisted] = await Promise.all([
      navigator.storage.estimate(),
      navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false),
    ]);
    return {
      usage: estimate.usage ?? 0,
      quota: estimate.quota ?? 0,
      persisted,
    };
  } catch {
    return null;
  }
}

/** « 1,2 Mo » — pour le bloc Données des réglages. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Ko';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  const mega = bytes / (1024 * 1024);
  return `${mega.toFixed(mega >= 10 ? 0 : 1).replace('.', ',')} Mo`;
}
