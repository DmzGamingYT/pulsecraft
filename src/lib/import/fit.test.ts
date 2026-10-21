import { describe, expect, it } from 'vitest';
import { isFit, parseFit } from './fit';

/** L'époque FIT, en secondes Unix. */
const FIT_EPOCH = 631_065_600;

function fitSeconds(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000) - FIT_EPOCH;
}

/** Un demi-cercle vaut 180° / 2^31. */
function semicircles(degrees: number): number {
  return Math.round((degrees * 2 ** 31) / 180);
}

function buildFit(): Uint8Array {
  const bytes: number[] = [];

  const uint32 = (value: number) => {
    for (let index = 0; index < 4; index += 1) bytes.push((value >>> (index * 8)) & 0xff);
  };
  const uint16 = (value: number) => {
    bytes.push(value & 0xff, (value >> 8) & 0xff);
  };

  // Une définition : octet d'en-tête, réservé, architecture, message global.
  const define = (local: number, global: number, fields: [number, number, number][]) => {
    bytes.push(0x40 | local, 0x00, 0x00);
    uint16(global);
    bytes.push(fields.length);
    for (const [number, size, baseType] of fields) bytes.push(number, size, baseType);
  };

  // Deux points de parcours, avec horodatage, altitude et fréquence cardiaque.
  define(1, 20, [
    [253, 4, 0x06],
    [0, 4, 0x05],
    [1, 4, 0x05],
    [2, 2, 0x04],
    [3, 1, 0x02],
  ]);
  const record = (time: number, lat: number, lng: number, altitude: number, heart: number) => {
    bytes.push(0x01);
    uint32(time);
    uint32(semicircles(lat));
    uint32(semicircles(lng));
    uint16(Math.round((altitude + 500) * 5));
    bytes.push(heart);
  };
  const start = fitSeconds('2026-10-20T12:00:00Z');
  record(start, 48.8566, 2.3522, 35, 140);
  record(start + 1800, 48.8666, 2.3622, 42, 160);

  // Le résumé de la séance : sport course, 60 min, 10 km, 620 kcal.
  define(0, 18, [
    [2, 4, 0x06],
    [5, 1, 0x00],
    [8, 4, 0x06],
    [9, 4, 0x06],
    [11, 2, 0x04],
  ]);
  bytes.push(0x00);
  uint32(start);
  bytes.push(1);
  uint32(60 * 60 * 1000);
  uint32(10 * 100_000);
  uint16(620);

  const dataSize = bytes.length;
  const header = [14, 0x10, 0x00, 0x00, 0, 0, 0, 0, 0x2e, 0x46, 0x49, 0x54, 0, 0];
  const view = new DataView(new Uint8Array(4).buffer);
  view.setUint32(0, dataSize, true);
  for (let index = 0; index < 4; index += 1) header[4 + index] = view.getUint8(index);
  return new Uint8Array([...header, ...bytes]);
}

describe('parseFit', () => {
  it('lit une séance avec son tracé et sa fréquence cardiaque', () => {
    const bytes = buildFit();
    expect(isFit(bytes)).toBe(true);

    const parsed = parseFit(bytes, 'sortie.fit');
    expect(parsed.warnings).toEqual([]);
    expect(parsed.activities).toHaveLength(1);

    const activity = parsed.activities[0]!;
    expect(activity.sport).toBe('course');
    expect(activity.durationMin).toBe(60);
    expect(activity.distanceKm).toBe(10);
    expect(activity.calories).toBe(620);
    expect(activity.avgHr).toBe(150);
    expect(activity.maxHr).toBe(160);
    expect(activity.elevationM).toBe(7);
    expect(activity.route?.split(';')).toHaveLength(2);
    expect(activity.externalId).toContain('fit:');
    expect(activity.date.slice(0, 10)).toBe('2026-10-20');
  });

  it('refuse un fichier qui n’est pas un FIT', () => {
    const parsed = parseFit(new Uint8Array(32), 'notes.fit');
    expect(parsed.activities).toEqual([]);
    expect(parsed.warnings[0]).toContain('FIT lisible');
  });

  it('ignore un en-tête tronqué sans lever d’exception', () => {
    const bytes = buildFit().slice(0, 20);
    const parsed = parseFit(bytes, 'tronque.fit');
    expect(parsed.activities).toHaveLength(0);
    expect(parsed.warnings.length).toBeGreaterThan(0);
  });
});
