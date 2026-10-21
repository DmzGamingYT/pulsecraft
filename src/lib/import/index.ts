import type { ParsedImport, Source } from '../../types';
import { parseAppleHealth } from './apple';
import { parseSamsungHealth } from './samsung';
import { isFit, parseFit } from './fit';
import { isGpx, isTcx, parseGpx, parseTcx } from './track';
import { readZip } from './zip';
import { throwIfAborted } from './signal';

export interface TextFile {
  name: string;
  text: string;
  /** les octets d'un fichier binaire (FIT) ; absent pour les fichiers texte */
  bytes?: Uint8Array;
}

export interface ImportOptions {
  onStep?: (message: string) => void;
  /** avancement global, de 0 à 1 */
  onProgress?: (value: number) => void;
  signal?: AbortSignal;
}

function report(options: ImportOptions, message: string, progress: number): void {
  throwIfAborted(options.signal);
  options.onStep?.(message);
  options.onProgress?.(Math.max(0, Math.min(1, progress)));
}

/** Décompresse les ZIP et lit les fichiers texte, sans dépendance. */
export async function readImportFiles(
  files: File[],
  options: ImportOptions = {},
): Promise<TextFile[]> {
  const collected: TextFile[] = [];
  const total = Math.max(1, files.length);

  for (const [index, file] of files.entries()) {
    throwIfAborted(options.signal);
    const base = 0.05 + (index / total) * 0.35;

    if (/\.zip$/i.test(file.name)) {
      report(options, `Ouverture de ${file.name}…`, base);
      const entries = await readZip(await file.arrayBuffer(), {
        signal: options.signal,
        onProgress: (done, count) => {
          options.onProgress?.(base + (0.35 * done) / Math.max(1, count));
        },
      });
      collected.push(...entries);
      continue;
    }
    if (/\.fit$/i.test(file.name)) {
      report(options, `Lecture de ${file.name}…`, base);
      collected.push({
        name: file.name,
        text: '',
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
      continue;
    }
    if (!/\.(xml|csv|txt|gpx|tcx)$/i.test(file.name)) continue;
    report(options, `Lecture de ${file.name}…`, base);
    collected.push({ name: file.name, text: await file.text() });
  }

  return collected;
}

function merge(source: Source, imports: ParsedImport[]): ParsedImport {
  const warnings = [...new Set(imports.flatMap((item) => item.warnings))];
  return {
    source,
    fileName: imports.map((item) => item.fileName).filter(Boolean).join(', '),
    activities: imports.flatMap((item) => item.activities),
    days: imports.flatMap((item) => item.days),
    warnings,
  };
}

/**
 * Reconnaît les exports à leur contenu plutôt qu'à leur seul nom : un ZIP
 * Samsung contient beaucoup de CSV et un ZIP Apple d'autres XML parasites.
 */
export function parseTextFiles(files: TextFile[], options: ImportOptions = {}): ParsedImport[] {
  const xmlFiles = files.filter(
    (file) =>
      /\.xml$/i.test(file.name) &&
      (/<HealthData\b/.test(file.text) ||
        /HKQuantityTypeIdentifier|HKWorkoutActivityType/.test(file.text)),
  );
  const csvFiles = files.filter(
    (file) =>
      /\.csv$/i.test(file.name) &&
      /(exercise|step_count|stepcount|sleep)/i.test(file.name) &&
      !/sleep_stage/i.test(file.name),
  );
  const gpxFiles = files.filter((file) => /\.gpx$/i.test(file.name) && isGpx(file.text));
  const tcxFiles = files.filter((file) => /\.tcx$/i.test(file.name) && isTcx(file.text));
  const fitFiles = files.filter((file) => /\.fit$/i.test(file.name) && isFit(file.bytes));

  const results: ParsedImport[] = [];

  if (xmlFiles.length > 0) {
    report(options, 'Analyse de l’export Apple Santé…', 0.45);
    results.push(
      merge(
        'apple',
        xmlFiles.map((file) => parseAppleHealth(file.text, file.name, { signal: options.signal })),
      ),
    );
    report(options, 'Sommeil, cœur, séances : lecture terminée.', 0.8);
  }
  if (csvFiles.length > 0) {
    report(options, 'Analyse de l’export Samsung Health…', 0.82);
    results.push(merge('samsung', [parseSamsungHealth(csvFiles)]));
  }
  if (gpxFiles.length > 0) {
    report(options, 'Lecture des tracés GPX…', 0.85);
    results.push(merge('fichier', gpxFiles.map((file) => parseGpx(file.text, file.name))));
  }
  if (tcxFiles.length > 0) {
    report(options, 'Lecture des fichiers TCX…', 0.88);
    results.push(merge('fichier', tcxFiles.map((file) => parseTcx(file.text, file.name))));
  }
  if (fitFiles.length > 0) {
    report(options, 'Lecture des fichiers FIT…', 0.9);
    results.push(
      merge(
        'fichier',
        fitFiles.map((file) => parseFit(file.bytes ?? new Uint8Array(), file.name)),
      ),
    );
  }

  return results;
}

/**
 * Import complet depuis l'interface : lit les fichiers, décompresse, détecte
 * la source et renvoie les journaux prêts à fusionner.
 */
export async function importFiles(
  files: File[],
  options: ImportOptions = {},
): Promise<ParsedImport[]> {
  const texts = await readImportFiles(files, options);
  if (texts.length === 0) {
    throw new Error('Aucun fichier XML, CSV, GPX, TCX ou FIT lisible dans la sélection.');
  }
  const parsed = parseTextFiles(texts, options);
  if (parsed.length === 0) {
    throw new Error(
      'Export non reconnu. Prenez le fichier export.zip d’Apple Santé, les CSV Samsung Health, ou un fichier GPX/TCX/FIT.',
    );
  }
  options.onProgress?.(0.95);
  return parsed;
}
