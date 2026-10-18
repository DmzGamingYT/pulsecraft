/**
 * Import d'un parcours GPX ou d'une activité TCX.
 *
 * Ces formats ne contiennent qu'une séance : PulseCraft calcule la distance à
 * partir des coordonnées (formule de haversine), le dénivelé positif et la
 * durée entre le premier et le dernier point. Aucune trace n'est conservée :
 * seuls les agrégats de la séance sont enregistrés, pas le parcours complet.
 */

import type { ImportPayload, Workout, WorkoutType } from '../../types';
import { toISODate } from '../dates';

function haversine(a: [number, number], b: [number, number]): number {
  const radius = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function textOf(value: string | undefined): string {
  return (value ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function workoutTypeFrom(text: string): WorkoutType {
  const value = text.toLowerCase();
  if (/cycl|bike|biking|vélo|velo/.test(value)) return 'Vélo';
  if (/swim/.test(value)) return 'Natation';
  if (/walk|hike|marche/.test(value)) return 'Marche';
  if (/row/.test(value)) return 'Rameur';
  if (/run|course|jog/.test(value)) return 'Course';
  return 'Course';
}

function timeLabel(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function parseGpx(text: string): ImportPayload {
  const points: Array<{ lat: number; lon: number; ele?: number; time?: Date }> = [];

  for (const match of text.matchAll(/<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/gi)) {
    const attrs = match[1] ?? '';
    const body = match[2] ?? '';
    const lat = Number(attrs.match(/lat="([-\d.]+)"/i)?.[1]);
    const lon = Number(attrs.match(/lon="([-\d.]+)"/i)?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const eleMatch = body.match(/<ele>([-\d.]+)<\/ele>/i);
    const timeMatch = body.match(/<time>([^<]+)<\/time>/i);
    const time = timeMatch?.[1] ? new Date(timeMatch[1]) : undefined;
    points.push({
      lat,
      lon,
      ele: eleMatch?.[1] !== undefined ? Number(eleMatch[1]) : undefined,
      time: time && !Number.isNaN(time.getTime()) ? time : undefined,
    });
  }

  if (points.length < 2) {
    throw new Error('Ce fichier GPX ne contient pas de trace exploitable.');
  }

  let distanceM = 0;
  let elevation = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) continue;
    distanceM += haversine([previous.lat, previous.lon], [current.lat, current.lon]);
    if (previous.ele !== undefined && current.ele !== undefined) {
      const delta = current.ele - previous.ele;
      if (delta > 0 && delta < 50) elevation += delta;
    }
  }

  const timed = points.filter((point) => point.time);
  const start = timed[0]?.time;
  const end = timed[timed.length - 1]?.time;
  if (!start || !end || end <= start) {
    throw new Error('Ce GPX ne contient pas d’horodatage exploitable.');
  }

  const name = textOf(text.match(/<name>([^<]+)<\/name>/i)?.[1]);
  const type = workoutTypeFrom(`${name} ${text.slice(0, 2000)}`);
  const durationMin = Math.round(((end.getTime() - start.getTime()) / 60_000) * 10) / 10;
  const distanceKm = Math.round((distanceM / 1000) * 100) / 100;
  const date = toISODate(start);

  const workout: Workout = {
    id: `gpx_${start.toISOString()}`,
    date,
    time: timeLabel(start),
    type,
    durationMin,
    distanceKm: distanceKm > 0 ? distanceKm : undefined,
    elevationM: elevation > 0 ? Math.round(elevation) : undefined,
    notes: name ? `Parcours : ${name}` : 'Parcours importé depuis un fichier GPX.',
    source: 'gpx',
    externalId: `gpx_${start.toISOString()}`,
  };

  return { workouts: [workout] };
}

export function parseTcx(text: string): ImportPayload {
  const sport = text.match(/<Activity\b[^>]*Sport="([^"]+)"/i)?.[1] ?? '';
  const trackpoints: Array<{ time?: Date; distanceM?: number; hr?: number }> = [];

  for (const match of text.matchAll(/<Trackpoint\b[^>]*>([\s\S]*?)<\/Trackpoint>/gi)) {
    const body = match[1] ?? '';
    const timeValue = body.match(/<Time>([^<]+)<\/Time>/i)?.[1];
    const date = timeValue ? new Date(timeValue) : undefined;
    const distance = Number(body.match(/<DistanceMeters>([-\d.]+)<\/DistanceMeters>/i)?.[1]);
    const hr = Number(body.match(/<HeartRateBpm[^>]*>[\s\S]*?<Value>(\d+)<\/Value>/i)?.[1]);
    trackpoints.push({
      time: date && !Number.isNaN(date.getTime()) ? date : undefined,
      distanceM: Number.isFinite(distance) ? distance : undefined,
      hr: Number.isFinite(hr) ? hr : undefined,
    });
  }

  if (trackpoints.length === 0) {
    throw new Error('Ce fichier TCX ne contient pas de point exploitable.');
  }

  const timed = trackpoints.filter((point) => point.time);
  const start = timed[0]?.time;
  const end = timed[timed.length - 1]?.time;
  if (!start || !end || end <= start) {
    throw new Error('Ce TCX ne contient pas d’horodatage exploitable.');
  }

  const distances = trackpoints
    .map((point) => point.distanceM)
    .filter((value): value is number => value !== undefined);
  const distanceM = distances[distances.length - 1] ?? 0;
  const hearts = trackpoints.map((point) => point.hr).filter((value): value is number => value !== undefined && value > 0);
  const avgHr = hearts.length ? Math.round(hearts.reduce((sum, value) => sum + value, 0) / hearts.length) : undefined;
  const maxHr = hearts.length ? Math.max(...hearts) : undefined;
  const notes = textOf(text.match(/<Notes>([\s\S]*?)<\/Notes>/i)?.[1]).slice(0, 200);
  const date = toISODate(start);
  const durationMin = Math.round(((end.getTime() - start.getTime()) / 60_000) * 10) / 10;

  const workout: Workout = {
    id: `tcx_${start.toISOString()}`,
    date,
    time: timeLabel(start),
    type: workoutTypeFrom(sport),
    durationMin,
    distanceKm: distanceM > 0 ? Math.round((distanceM / 1000) * 100) / 100 : undefined,
    avgHr,
    maxHr,
    notes: notes || 'Activité importée depuis un fichier TCX.',
    source: 'gpx',
    externalId: `tcx_${start.toISOString()}`,
  };

  return { workouts: [workout] };
}
