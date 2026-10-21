import type { DayLog, DraftActivity, ParsedImport, Sport } from '../../types';

/**
 * Export « Samsung Health » : un dossier de CSV (`com.samsung.health.*.csv`),
 * parfois accompagné de JSON. Les noms de colonnes changent selon la version,
 * la langue et l'appareil : on lit donc les en-têtes au lieu de supposer un
 * ordre fixe, et on ignore la ligne de métadonnées qui précède parfois le CSV.
 */

interface TextFile {
  name: string;
  text: string;
}

interface Table {
  headers: string[];
  rows: string[][];
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** `com.samsung.health.exercise.start_time` → `start_time`. */
function normalizeHeader(raw: string): string {
  const last = raw.replace(/^\uFEFF/, '').trim().toLowerCase().split('.').pop() ?? '';
  return last.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function readTable(text: string): Table | null {
  const rows = parseCsv(text);
  const limit = Math.min(rows.length, 10);
  for (let index = 0; index < limit; index += 1) {
    const candidate = rows[index];
    if (!candidate) continue;
    const headers = candidate.map(normalizeHeader);
    const hasDate = headers.some((header) => /^(start_time|day_time|create_time|update_time|date)$/.test(header));
    const hasData = headers.some((header) =>
      /^(exercise_type|duration|count|step_count|steps)$/.test(header),
    );
    if (hasDate && hasData) {
      return {
        headers,
        rows: rows.slice(index + 1).filter((row) => row.some((cell) => cell.trim() !== '')),
      };
    }
  }
  return null;
}

function pick(row: string[], headers: string[], names: string[]): string | undefined {
  for (const name of names) {
    const index = headers.indexOf(name);
    if (index >= 0) {
      const value = row[index]?.trim();
      if (value) return value;
    }
  }
  return undefined;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function localIsoFromEpoch(milliseconds: number): string {
  const date = new Date(milliseconds);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function normalizeStart(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]/.test(value)) {
    return value.replace(' ', 'T').replace(/\.\d+/, '').slice(0, 19);
  }
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 1_000_000_000) {
    return localIsoFromEpoch(asNumber > 1_000_000_000_000 ? asNumber : asNumber * 1000);
  }
  return undefined;
}

function datePartOf(iso: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return match?.[1] ?? iso.slice(0, 10);
}

interface SamsungSport {
  sport: Sport;
  title: string;
  /** false quand le code n'est pas dans la table : l'UI le signale. */
  known: boolean;
}

/**
 * Les codes d'exercice Samsung (documentation développeur) sont regroupés en
 * familles lisibles. Les codes inconnus restent « Autre », avec le libellé
 * fourni par l'export quand il existe.
 */
function samsungSport(code: string | undefined, label: string | undefined): SamsungSport {
  const numeric = Number(code);
  if (Number.isFinite(numeric)) {
    if ([1002, 15005].includes(numeric)) return { sport: 'course', title: 'Course à pied', known: true };
    if (numeric === 1001) return { sport: 'marche', title: 'Marche', known: true };
    if ([13001, 13002, 13003].includes(numeric)) return { sport: 'rando', title: 'Randonnée', known: true };
    if ([11007, 13004, 15003].includes(numeric)) return { sport: 'velo', title: 'Vélo', known: true };
    if ([14001, 14002].includes(numeric)) return { sport: 'natation', title: 'Natation', known: true };
    if ((numeric >= 10004 && numeric <= 10027) || [15002, 15004].includes(numeric)) {
      return { sport: 'musculation', title: 'Musculation', known: true };
    }
    if ([9001, 9002, 10001].includes(numeric)) return { sport: 'yoga', title: 'Yoga', known: true };
    if (numeric === 6002) return { sport: 'autre', title: 'Tennis', known: true };
    if (numeric === 6003) return { sport: 'autre', title: 'Badminton', known: true };
    if (numeric === 4004) return { sport: 'autre', title: 'Football', known: true };
    if (numeric === 4003) return { sport: 'autre', title: 'Basketball', known: true };
    if (numeric === 15006) return { sport: 'autre', title: 'Vélo elliptique', known: true };
    if (numeric === 14010) return { sport: 'autre', title: 'Rameur', known: true };
  }
  return { sport: 'autre', title: label || 'Séance Samsung', known: false };
}

function parseExercise(file: TextFile, warnings: string[]): DraftActivity[] {
  const table = readTable(file.text);
  if (!table) {
    warnings.push(`« ${file.name} » ne contient pas de séances lisibles.`);
    return [];
  }

  const activities: DraftActivity[] = [];
  let unknownTypes = 0;

  for (const row of table.rows) {
    const start = normalizeStart(pick(row, table.headers, ['start_time', 'create_time', 'day_time']));
    if (!start) continue;
    const code = pick(row, table.headers, ['exercise_type']);
    const label = pick(row, table.headers, ['title', 'comment', 'exercise_name', 'name']);
    const mapped = samsungSport(code, label);
    // Un type absent n'est pas une anomalie : on ne signale que les codes
    // réellement inconnus, quand le CSV en fournit un.
    if (code && !mapped.known) unknownTypes += 1;

    const rawDuration = Number(pick(row, table.headers, ['duration']));
    const durationMin =
      Number.isFinite(rawDuration) && rawDuration > 0 ? Math.max(1, Math.round(rawDuration / 60000)) : 0;
    if (durationMin === 0) continue;

    const rawDistance = Number(pick(row, table.headers, ['distance']));
    const distanceKm = Number.isFinite(rawDistance) && rawDistance > 0 ? rawDistance / 1000 : undefined;
    const rawCalories = Number(pick(row, table.headers, ['total_calorie', 'calorie']));
    const calories = Number.isFinite(rawCalories) && rawCalories > 0 ? Math.round(rawCalories) : undefined;
    const rawMeanHr = Number(pick(row, table.headers, ['mean_heart_rate', 'heart_rate']));
    const rawMaxHr = Number(pick(row, table.headers, ['max_heart_rate']));
    const uuid = pick(row, table.headers, ['datauuid', 'uuid', 'id']);

    activities.push({
      date: start,
      sport: mapped.sport,
      title: mapped.title,
      durationMin,
      distanceKm: distanceKm !== undefined ? round(distanceKm, 2) : undefined,
      calories,
      avgHr: Number.isFinite(rawMeanHr) && rawMeanHr > 0 ? Math.round(rawMeanHr) : undefined,
      maxHr: Number.isFinite(rawMaxHr) && rawMaxHr > 0 ? Math.round(rawMaxHr) : undefined,
      source: 'samsung',
      externalId: `samsung:${uuid ?? `${start}:${code ?? 'exercise'}`}`,
    });
  }

  if (unknownTypes > 0) {
    warnings.push(
      `${unknownTypes} séance(s) d’un type non reconnu ont été importées comme « Autre ».`,
    );
  }
  return activities;
}

/**
 * Le sommeil Samsung vit dans `com.samsung.health.sleep.*.csv` (pas le fichier
 * `sleep_stage`, qui détaille les phases et compterait deux fois la nuit).
 * Les bornes changent selon la version : on lit `start_time`/`end_time` par nom.
 */
function parseSleep(file: TextFile, warnings: string[]): DayLog[] {
  const rows = parseCsv(file.text);
  const limit = Math.min(rows.length, 10);
  let table: Table | null = null;

  for (let index = 0; index < limit; index += 1) {
    const candidate = rows[index];
    if (!candidate) continue;
    const headers = candidate.map(normalizeHeader);
    const hasStart = headers.includes('start_time');
    const hasEnd = headers.some((header) => header === 'end_time' || header === 'sleep_end_time');
    if (hasStart && hasEnd) {
      table = {
        headers,
        rows: rows.slice(index + 1).filter((row) => row.some((cell) => cell.trim() !== '')),
      };
      break;
    }
  }

  if (!table) {
    warnings.push(
      `« ${file.name} » ne contient pas de nuits lisibles (colonnes start_time et end_time attendues).`,
    );
    return [];
  }

  const byDate = new Map<string, DayLog>();
  for (const row of table.rows) {
    const start = normalizeStart(pick(row, table.headers, ['start_time']));
    const end = normalizeStart(pick(row, table.headers, ['end_time', 'sleep_end_time']));
    if (!start || !end) continue;
    const minutes = Math.round(
      (new Date(end.replace(' ', 'T')).getTime() - new Date(start.replace(' ', 'T')).getTime()) /
        60_000,
    );
    // Une nuit de moins de 30 min ou de plus de 20 h trahit une ligne de
    // résumé ou un fuseau cassé : on l'ignore au lieu de fausser la moyenne.
    if (!Number.isFinite(minutes) || minutes < 30 || minutes > 1200) continue;
    const day = datePartOf(end);
    const log = byDate.get(day) ?? { date: day };
    log.sleepMin = Math.max(log.sleepMin ?? 0, minutes);
    byDate.set(day, log);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function parseSteps(file: TextFile, warnings: string[]): DayLog[] {
  const table = readTable(file.text);
  if (!table) {
    warnings.push(`« ${file.name} » ne contient pas de pas lisibles.`);
    return [];
  }

  const byDate = new Map<string, DayLog>();
  for (const row of table.rows) {
    const rawDate = pick(row, table.headers, [
      'day_time',
      'start_time',
      'create_time',
      'update_time',
      'date',
    ]);
    const rawCount = pick(row, table.headers, ['count', 'step_count', 'steps']);
    if (!rawDate || !rawCount) continue;

    const iso = normalizeStart(rawDate);
    const day = iso ? datePartOf(iso) : rawDate.slice(0, 10);
    const amount = Number(rawCount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(amount) || amount <= 0) continue;

    const log = byDate.get(day) ?? { date: day };
    log.steps = (log.steps ?? 0) + Math.round(amount);
    byDate.set(day, log);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function parseSamsungHealth(files: TextFile[]): ParsedImport {
  const warnings: string[] = [];
  const exerciseFiles = files.filter(
    (file) => /\.csv$/i.test(file.name) && /exercise/i.test(file.name),
  );
  const stepCandidates = files.filter(
    (file) => /\.csv$/i.test(file.name) && /step/i.test(file.name),
  );

  // Un seul fichier de pas : les exports contiennent parfois un résumé et des
  // intervalles, les additionner compterait deux fois la même journée.
  const stepFile = stepCandidates.find((file) => /step_count|stepcount/i.test(file.name)) ?? stepCandidates[0];
  const sleepFiles = files.filter(
    (file) => /\.csv$/i.test(file.name) && /sleep/i.test(file.name) && !/stage/i.test(file.name),
  );

  const activities = exerciseFiles.flatMap((file) => parseExercise(file, warnings));
  const stepDays = stepFile ? parseSteps(stepFile, warnings) : [];
  const sleepDays = sleepFiles.flatMap((file) => parseSleep(file, warnings));

  // Les pas et le sommeil partagent la même journée : on les recolle.
  const byDate = new Map<string, DayLog>();
  for (const log of [...stepDays, ...sleepDays]) {
    const existing = byDate.get(log.date) ?? { date: log.date };
    byDate.set(log.date, {
      ...existing,
      ...log,
      steps: Math.max(existing.steps ?? 0, log.steps ?? 0) || undefined,
    });
  }
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  if (exerciseFiles.length === 0) {
    warnings.push('Aucun fichier de séances Samsung (`com.samsung.health.exercise.*.csv`) trouvé.');
  }
  if (!stepFile && sleepFiles.length === 0) {
    warnings.push('Aucun fichier de pas Samsung (`com.samsung.health.step_count.*.csv`) trouvé.');
  }

  return {
    source: 'samsung',
    fileName: files.map((file) => file.name).join(', '),
    activities,
    days,
    warnings,
  };
}
