/**
 * FIT : le format binaire des montres Garmin, Polar, Wahoo, Suunto…
 *
 * C'est un fichier de messages : des définitions (type de message, champs et
 * tailles) suivies de leurs valeurs. On ne lit que trois messages — `session`
 * pour le résumé, `record` pour le tracé et la fréquence cardiaque — ce qui
 * suffit pour remplir une séance, et on ignore le reste sans erreur.
 *
 * Aucun réseau, aucune dépendance : le fichier est lu sur l'appareil.
 */

import type { DraftActivity, ParsedImport, Sport } from '../../types';
import { downsample, serializeRoute, type RoutePoint } from '../route';
import { distanceOf, elevationGain } from './track';

interface FieldDef {
  number: number;
  size: number;
  baseType: number;
}

interface MessageDef {
  global: number;
  little: boolean;
  fields: FieldDef[];
}

/** Secondes entre l'époque FIT (31/12/1989) et l'époque Unix. */
const FIT_EPOCH = 631_065_600;

const BASE_SIZES: Record<number, number> = {
  0x00: 1, // enum
  0x01: 1, // sint8
  0x02: 1, // uint8
  0x03: 2, // sint16
  0x04: 2, // uint16
  0x05: 4, // sint32
  0x06: 4, // uint32
  0x07: 1, // string, taille variable
  0x08: 4, // float32
  0x09: 8, // float64
  0x0a: 1, // uint8z
  0x0b: 2, // uint16z
  0x0c: 4, // uint32z
  0x0d: 1, // byte
  0x0e: 8, // sint64
  0x0f: 8, // uint64
  0x10: 8, // uint64z
};

/** La valeur « invalide » d'un champ : tous les bits à 1. */
const INVALID: Record<number, number> = {
  0x00: 0xff,
  0x01: 0x7f,
  0x02: 0xff,
  0x03: 0x7fff,
  0x04: 0xffff,
  0x05: 0x7fffffff,
  0x06: 0xffffffff,
  0x0a: 0,
  0x0b: 0,
  0x0c: 0,
  0x0d: 0xff,
};

const SPORTS: Record<number, { sport: Sport; title: string }> = {
  0: { sport: 'autre', title: 'Séance' },
  1: { sport: 'course', title: 'Course à pied' },
  2: { sport: 'velo', title: 'Vélo' },
  4: { sport: 'musculation', title: 'Renforcement' },
  5: { sport: 'natation', title: 'Natation' },
  10: { sport: 'musculation', title: 'Entraînement' },
  11: { sport: 'marche', title: 'Marche' },
  17: { sport: 'rando', title: 'Randonnée' },
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function localIso(seconds: number): string | undefined {
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  const date = new Date((seconds + FIT_EPOCH) * 1000);
  if (Number.isNaN(date.getTime())) return undefined;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function readField(
  view: DataView,
  offset: number,
  field: FieldDef,
  little: boolean,
): number | string | undefined {
  if (offset + field.size > view.byteLength) return undefined;
  const type = field.baseType;
  switch (type) {
    case 0x07: {
      let text = '';
      for (let index = 0; index < field.size; index += 1) {
        const code = view.getUint8(offset + index);
        if (code === 0) break;
        text += String.fromCharCode(code);
      }
      return text;
    }
    case 0x08:
      return field.size === 4 ? view.getFloat32(offset, little) : undefined;
    case 0x09:
      return field.size === 8 ? view.getFloat64(offset, little) : undefined;
    case 0x00:
    case 0x02:
    case 0x0a:
    case 0x0d:
      return view.getUint8(offset);
    case 0x01:
      return view.getInt8(offset);
    case 0x03:
      return view.getInt16(offset, little);
    case 0x04:
    case 0x0b:
      return view.getUint16(offset, little);
    case 0x05:
      return view.getInt32(offset, little);
    case 0x06:
    case 0x0c:
      return view.getUint32(offset, little);
    default:
      return undefined;
  }
}

/** La taille sur le disque d'un champ ; les chaînes portent la leur. */
function fieldSize(field: FieldDef): number {
  return field.baseType === 0x07 ? field.size : (BASE_SIZES[field.baseType] ?? field.size);
}

export function isFit(bytes: Uint8Array | undefined): boolean {
  if (!bytes || bytes.length < 12) return false;
  // « .FIT » aux octets 8 à 11.
  return bytes[8] === 0x2e && bytes[9] === 0x46 && bytes[10] === 0x49 && bytes[11] === 0x54;
}

interface RecordPoint {
  lat?: number;
  lng?: number;
  time?: number;
  altitude?: number;
  heartRate?: number;
}

interface SessionSummary {
  start?: number;
  sport?: number;
  timerMs?: number;
  elapsedMs?: number;
  distanceCm?: number;
  calories?: number;
}

export function parseFit(bytes: Uint8Array, fileName = 'sortie.fit'): ParsedImport {
  const warnings: string[] = [];
  const empty: ParsedImport = { source: 'fichier', fileName, activities: [], days: [], warnings };

  if (!isFit(bytes)) {
    warnings.push('Ce fichier n’est pas un FIT lisible (en-tête absent).');
    return empty;
  }

  const headerSize = bytes[0] ?? 12;
  if (headerSize !== 12 && headerSize !== 14) {
    warnings.push('En-tête FIT inconnu : le fichier est peut-être corrompu.');
    return empty;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dataSize = view.getUint32(4, true);
  const end = Math.min(bytes.length, headerSize + dataSize);
  const definitions = new Map<number, MessageDef>();
  const records: RecordPoint[] = [];
  const sessions: SessionSummary[] = [];
  let cursor = headerSize;

  while (cursor < end) {
    const header = view.getUint8(cursor);
    cursor += 1;

    // Bit 6 : définition de message. Bit 7 : message à horodatage comprimé.
    // Un message de données ordinaire n'a ni l'un ni l'autre.
    if (header & 0x40) {
      const local = header & 0x0f;
      cursor += 1; // octet réservé
      if (cursor + 5 > end) break;
      const little = view.getUint8(cursor) === 0;
      cursor += 1;
      const global = view.getUint16(cursor, little);
      cursor += 2;
      const count = view.getUint8(cursor);
      cursor += 1;
      const fields: FieldDef[] = [];
      for (let index = 0; index < count; index += 1) {
        if (cursor + 3 > end) break;
        fields.push({
          number: view.getUint8(cursor),
          size: view.getUint8(cursor + 1),
          baseType: view.getUint8(cursor + 2) & 0x1f,
        });
        cursor += 3;
      }
      definitions.set(local, { global, little, fields });
      continue;
    }

    if (header & 0x80) {
      // En-tête comprimé : le type de message tient sur deux bits et
      // l'horodatage est transporté par l'en-tête, donc absent des champs.
      const local = (header >> 5) & 0x03;
      const definition = definitions.get(local);
      if (!definition) break;
      const target = readMessage(view, cursor, definition, true);
      cursor = target.cursor;
      collect(definition.global, target.values, records, sessions);
      continue;
    }

    const definition = definitions.get(header & 0x0f);
    if (!definition) break;
    const target = readMessage(view, cursor, definition, false);
    cursor = target.cursor;
    collect(definition.global, target.values, records, sessions);
  }

  if (sessions.length === 0 && records.length === 0) {
    warnings.push('Aucune séance ni aucun point dans ce fichier FIT.');
    return empty;
  }

  const activities: DraftActivity[] = [];
  const summaries: SessionSummary[] =
    sessions.length > 0 ? sessions : [{ start: records[0]?.time }];

  for (const session of summaries) {
    const startSeconds = session.start ?? records[0]?.time;
    const start = startSeconds !== undefined ? localIso(startSeconds) : undefined;
    if (!start) continue;

    const first = records[0];
    const last = records[records.length - 1];
    const spanMinutes =
      first?.time !== undefined && last?.time !== undefined
        ? Math.round((last.time - first.time) / 60)
        : 0;
    const points = records.filter(
      (point): point is RoutePoint => point.lat !== undefined && point.lng !== undefined,
    );
    const duration =
      session.timerMs && session.timerMs > 0
        ? Math.round(session.timerMs / 60_000)
        : session.elapsedMs && session.elapsedMs > 0
          ? Math.round(session.elapsedMs / 60_000)
          : spanMinutes;
    if (duration <= 0) continue;

    const distanceKm =
      session.distanceCm && session.distanceCm > 0
        ? Math.round(session.distanceCm) / 100_000
        : distanceOf(points);
    const mapped = SPORTS[session.sport ?? 0] ?? { sport: 'autre' as Sport, title: 'Séance' };
    const heartRates = records
      .map((point) => point.heartRate)
      .filter((value): value is number => value !== undefined && value > 0);
    const altitudes = records
      .map((point) => point.altitude)
      .filter((value): value is number => value !== undefined);
    const elevation = elevationGain(altitudes);

    activities.push({
      date: start,
      sport: mapped.sport,
      title: mapped.title,
      durationMin: duration,
      distanceKm: distanceKm > 0.05 ? Math.round(distanceKm * 100) / 100 : undefined,
      elevationM: elevation > 0 ? elevation : undefined,
      calories: session.calories && session.calories > 0 ? Math.round(session.calories) : undefined,
      avgHr:
        heartRates.length > 0
          ? Math.round(heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length)
          : undefined,
      maxHr: heartRates.length > 0 ? Math.max(...heartRates) : undefined,
      source: 'fichier',
      externalId: `fit:${start}:${Math.round(distanceKm * 100)}`,
      route: points.length > 1 ? serializeRoute(downsample(points)) : undefined,
    });
  }

  if (activities.length === 0) {
    warnings.push('Aucune activité datée dans ce fichier FIT.');
  }

  return { source: 'fichier', fileName, activities, days: [], warnings };
}

/** Lit les champs d'un message et avance le curseur. */
function readMessage(
  view: DataView,
  offset: number,
  definition: MessageDef,
  compressed: boolean,
): { cursor: number; values: Map<number, number | string | undefined> } {
  const values = new Map<number, number | string | undefined>();
  let cursor = offset;

  for (const [index, field] of definition.fields.entries()) {
    // Un message à horodatage comprimé n'écrit pas son champ `timestamp`.
    if (compressed && index === 0 && field.number === 253) {
      cursor += fieldSize(field);
      continue;
    }
    const value = readField(view, cursor, field, definition.little);
    cursor += fieldSize(field);
    if (value === undefined) continue;
    if (typeof value === 'number' && INVALID[field.baseType] === value) continue;
    values.set(field.number, value);
  }

  return { cursor, values };
}

function numberOf(values: Map<number, number | string | undefined>, field: number): number | undefined {
  const value = values.get(field);
  return typeof value === 'number' ? value : undefined;
}

function collect(
  global: number,
  values: Map<number, number | string | undefined>,
  records: RecordPoint[],
  sessions: SessionSummary[],
): void {
  if (global === 20) {
    const lat = numberOf(values, 0);
    const lng = numberOf(values, 1);
    const altitude = numberOf(values, 2);
    const heartRate = numberOf(values, 3);
    const time = numberOf(values, 253);
    if (lat !== undefined && lng !== undefined) {
      // Les coordonnées FIT sont des demi-cercles signés.
      records.push({
        lat: (lat * 180) / 2 ** 31,
        lng: (lng * 180) / 2 ** 31,
        time,
        altitude: altitude !== undefined ? altitude / 5 - 500 : undefined,
        heartRate,
      });
    } else if (time !== undefined || heartRate !== undefined || altitude !== undefined) {
      // Un point sans position garde quand même son horodatage et son cœur.
      records.push({
        time,
        heartRate,
        altitude: altitude !== undefined ? altitude / 5 - 500 : undefined,
      });
    }
    return;
  }

  if (global === 18) {
    sessions.push({
      start: numberOf(values, 2),
      sport: numberOf(values, 5),
      elapsedMs: numberOf(values, 7),
      timerMs: numberOf(values, 8),
      distanceCm: numberOf(values, 9),
      calories: numberOf(values, 11),
    });
  }
}
