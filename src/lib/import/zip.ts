/**
 * Lecteur ZIP minimal, sans dépendance.
 *
 * Les exports Santé d'Apple et de Samsung arrivent tous les deux en `.zip`.
 * On lit le répertoire central, on ne garde que les fichiers texte utiles
 * (`.xml`, `.csv`, `.txt`) et on décompresse avec `DecompressionStream`
 * (`deflate-raw`), disponible dans les navigateurs récents.
 */

export interface ZipTextEntry {
  name: string;
  text: string;
  /** les octets bruts, pour les formats binaires comme le FIT */
  bytes?: Uint8Array;
}

export interface ZipOptions {
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/** Une entrée plus grosse que ça est presque sûrement une archive à part. */
const MAX_ENTRY_BYTES = 220 * 1024 * 1024;

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;

function findEndOfCentralDirectory(view: DataView): number {
  const minimum = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD) return offset;
  }
  return -1;
}

function decodeName(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

export async function readZip(
  buffer: ArrayBuffer,
  options: ZipOptions = {},
): Promise<ZipTextEntry[]> {
  if (buffer.byteLength < 22) throw new Error('Archive ZIP vide ou incomplète.');
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd === -1) throw new Error('Ce fichier n’est pas une archive ZIP lisible.');

  const count = view.getUint16(eocd + 10, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  const entries: ZipTextEntry[] = [];
  let cursor = directoryOffset;

  for (let index = 0; index < count; index += 1) {
    if (options.signal?.aborted) throw new DOMException('Import annulé.', 'AbortError');
    options.onProgress?.(index + 1, count);
    if (cursor + 46 > view.byteLength || view.getUint32(cursor, true) !== CENTRAL) break;

    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decodeName(bytes.subarray(cursor + 46, cursor + 46 + nameLength));

    cursor += 46 + nameLength + extraLength + commentLength;

    if (!name || name.endsWith('/')) continue;
    if (!/\.(xml|csv|txt|gpx|tcx|fit)$/i.test(name)) continue;
    // `export_cda.xml` est le carnet médical au format CDA : plusieurs
    // gigaoctets possibles, et aucune séance ni pas à en tirer.
    if (/export_cda\.xml$/i.test(name)) continue;
    if (uncompressedSize > MAX_ENTRY_BYTES) {
      throw new Error(
        `« ${name} » est trop volumineux (${Math.round(uncompressedSize / 1024 / 1024)} Mo). Décompressez l’archive et importez le fichier seul.`,
      );
    }

    if (localOffset + 30 > view.byteLength || view.getUint32(localOffset, true) !== 0x04034b50) {
      continue;
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    if (dataStart + compressedSize > view.byteLength) continue;

    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    let data: Uint8Array;

    if (method === 0) {
      data = compressed;
    } else if (method === 8) {
      const stream = new Response(compressed).body;
      if (!stream) continue;
      const inflated = stream.pipeThrough(new DecompressionStream('deflate-raw'));
      data = new Uint8Array(await new Response(inflated).arrayBuffer());
    } else {
      // bzip2, LZMA… : rare dans ces exports, on l'ignore proprement.
      continue;
    }

    entries.push({
      name,
      // Un FIT est binaire : décoder ses octets en texte n'aurait aucun sens.
      text: /\.fit$/i.test(name) ? '' : new TextDecoder('utf-8').decode(data),
      bytes: /\.fit$/i.test(name) ? data : undefined,
    });
  }

  if (entries.length === 0) {
    throw new Error('Aucun fichier XML, CSV, GPX, TCX ou FIT lisible dans cette archive.');
  }

  return entries;
}
