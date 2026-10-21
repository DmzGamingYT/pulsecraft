import type { ParsedImport, Source } from '../../types';
import { parseAppleHealth } from './apple';
import { parseSamsungHealth } from './samsung';
import { readZip } from './zip';

export interface TextFile {
  name: string;
  text: string;
}

export interface ImportOptions {
  onStep?: (message: string) => void;
}

/** Décompresse les ZIP et lit les fichiers texte, sans dépendance. */
export async function readImportFiles(
  files: File[],
  options: ImportOptions = {},
): Promise<TextFile[]> {
  const collected: TextFile[] = [];

  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      options.onStep?.(`Ouverture de ${file.name}…`);
      const entries = await readZip(await file.arrayBuffer());
      collected.push(...entries);
      continue;
    }
    if (!/\.(xml|csv|txt)$/i.test(file.name)) continue;
    options.onStep?.(`Lecture de ${file.name}…`);
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
export function parseTextFiles(files: TextFile[]): ParsedImport[] {
  const xmlFiles = files.filter(
    (file) =>
      /\.xml$/i.test(file.name) &&
      (/<HealthData\b/.test(file.text) ||
        /HKQuantityTypeIdentifier|HKWorkoutActivityType/.test(file.text)),
  );
  const csvFiles = files.filter(
    (file) =>
      /\.csv$/i.test(file.name) &&
      /(exercise|step_count|stepcount)/i.test(file.name),
  );

  const results: ParsedImport[] = [];

  if (xmlFiles.length > 0) {
    results.push(merge('apple', xmlFiles.map((file) => parseAppleHealth(file.text, file.name))));
  }
  if (csvFiles.length > 0) {
    results.push(merge('samsung', [parseSamsungHealth(csvFiles)]));
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
    throw new Error('Aucun fichier XML ou CSV lisible dans la sélection.');
  }
  const parsed = parseTextFiles(texts);
  if (parsed.length === 0) {
    throw new Error(
      'Export non reconnu. Prenez le fichier export.zip d’Apple Santé ou les CSV Samsung Health.',
    );
  }
  return parsed;
}
