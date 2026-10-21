/**
 * GPX et TCX : les fichiers que produisent montres et compteurs.
 *
 * Ils ne demandent aucun compte et contiennent exactement ce qu'un journal
 * attend : le départ, la durée, la distance, le dénivelé, la fréquence
 * cardiaque et le tracé. On calcule la distance par la formule de haversine
 * quand le fichier ne la donne pas, et on garde une centaine de points pour
 * dessiner le parcours sans carte.
 */

import type { DraftActivity, ParsedImport, Sport } from '../../types';
import { downsample, pointsFromTrack, serializeRoute, type RoutePoint } from '../route';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Un horodatage ISO ramené dans le fuseau de l'appareil. */
function localIso(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const date = new Date(raw.trim());
  if (Number.isNaN(date.getTime())) return undefined;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function sportFrom(raw: string | undefined, fallbackTitle?: string): { sport: Sport; title: string } {
  const value = (raw ?? '').toLowerCase();
  if (/run|trail|jog/.test(value)) return { sport: 'course', title: fallbackTitle || 'Course à pied' };
  if (/cycl|bik|vélo|velo/.test(value)) return { sport: 'velo', title: fallbackTitle || 'Vélo' };
  if (/hik|randonn/.test(value)) return { sport: 'rando', title: fallbackTitle || 'Randonnée' };
  if (/walk|marche/.test(value)) return { sport: 'marche', title: fallbackTitle || 'Marche' };
  if (/swim|nage/.test(value)) return { sport: 'natation', title: fallbackTitle || 'Natation' };
  return { sport: 'autre', title: fallbackTitle || 'Sortie' };
}

export function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const radius = 6371;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceOf(points: RoutePoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (previous && current) total += haversineKm(previous, current);
  }
  return Math.round(total * 100) / 100;
}

export function elevationGain(elevations: number[]): number {
  let gain = 0;
  for (let index = 1; index < elevations.length; index += 1) {
    const delta = (elevations[index] ?? 0) - (elevations[index - 1] ?? 0);
    if (delta > 0.5) gain += delta;
  }
  return Math.round(gain);
}

function minutesBetween(start: string | undefined, end: string | undefined): number {
  if (!start || !end) return 0;
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, Math.round((to - from) / 60_000));
}

export function isGpx(text: string): boolean {
  return /<gpx\b/i.test(text) || /<trkpt\b/i.test(text);
}

export function isTcx(text: string): boolean {
  return /<TrainingCenterDatabase\b/i.test(text);
}

/** Le contenu d'un fichier GPX, prêt pour le journal. */
export function parseGpx(text: string, fileName = 'sortie.gpx'): ParsedImport {
  const warnings: string[] = [];
  const points: RoutePoint[] = [];
  const elevations: number[] = [];
  const times: string[] = [];
  const heartRates: number[] = [];

  const block = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/gi;
  let match: RegExpExecArray | null;
  while ((match = block.exec(text))) {
    const attrs = match[1] ?? '';
    const lat = Number(/\blat="([-\d.]+)"/.exec(attrs)?.[1]);
    const lon = Number(/\blon="([-\d.]+)"/.exec(attrs)?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    points.push({ lat, lng: lon });
    const body = match[2] ?? '';
    const elevation = /<ele>([-\d.]+)<\/ele>/i.exec(body)?.[1];
    if (elevation !== undefined && Number.isFinite(Number(elevation))) {
      elevations.push(Number(elevation));
    }
    const time = /<time>([^<]+)<\/time>/i.exec(body)?.[1];
    if (time) times.push(time);
    const heart = /<(?:\w+:)?hr>(\d+)<\/(?:\w+:)?hr>/i.exec(body)?.[1];
    if (heart) heartRates.push(Number(heart));
  }

  if (points.length < 2) {
    warnings.push('Aucun point de parcours lisible dans ce fichier GPX.');
    return { source: 'fichier', fileName, activities: [], days: [], warnings };
  }

  const name = /<name>([^<]+)<\/name>/i.exec(text)?.[1];
  const type = /<type>([^<]+)<\/type>/i.exec(text)?.[1];
  const mapped = sportFrom(type, name?.trim());
  const start = localIso(times[0]);
  const end = localIso(times[times.length - 1]);
  const duration = minutesBetween(times[0], times[times.length - 1]) || 1;
  const distance = distanceOf(points);
  const elevationM = elevationGain(elevations);
  const average =
    heartRates.length > 0
      ? Math.round(heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length)
      : undefined;

  if (!start) {
    warnings.push('Ce fichier GPX n’a pas d’horodatage : la date n’a pas pu être lue.');
    return { source: 'fichier', fileName, activities: [], days: [], warnings };
  }

  const activity: DraftActivity = {
    date: start,
    sport: mapped.sport,
    title: mapped.title,
    durationMin: duration,
    distanceKm: distance > 0.05 ? distance : undefined,
    elevationM: elevationM > 0 ? elevationM : undefined,
    avgHr: average,
    maxHr: heartRates.length > 0 ? Math.max(...heartRates) : undefined,
    source: 'fichier',
    externalId: `gpx:${start}:${Math.round(distance * 100)}`,
    route: serializeRoute(downsample(points)),
  };

  if (end && end === start) {
    warnings.push('La sortie dure moins d’une minute : vérifiez le fichier.');
  }

  return { source: 'fichier', fileName, activities: [activity], days: [], warnings };
}

/** Le contenu d'un fichier TCX (Garmin, Polar, Wahoo…). */
export function parseTcx(text: string, fileName = 'sortie.tcx'): ParsedImport {
  const warnings: string[] = [];
  const activities: DraftActivity[] = [];

  const activityPattern = /<Activity\b([^>]*)>([\s\S]*?)<\/Activity>/gi;
  let match: RegExpExecArray | null;

  while ((match = activityPattern.exec(text))) {
    const attrs = match[1] ?? '';
    const body = match[2] ?? '';
    const sportAttr = /Sport="([^"]+)"/i.exec(attrs)?.[1];
    const laps = [...body.matchAll(/<Lap\b([^>]*)>([\s\S]*?)<\/Lap>/gi)];

    let seconds = 0;
    let distance = 0;
    let calories = 0;
    let average: number | undefined;
    let maximum: number | undefined;
    const points: RoutePoint[] = [];
    const elevations: number[] = [];
    const times: string[] = [];
    const heartRates: number[] = [];

    for (const [, lapAttrs = '', lapBody = ''] of laps) {
      seconds += Number(/<TotalTimeSeconds>([\d.]+)<\/TotalTimeSeconds>/i.exec(lapBody)?.[1] ?? 0);
      distance += Number(/<DistanceMeters>([\d.]+)<\/DistanceMeters>/i.exec(lapBody)?.[1] ?? 0);
      calories += Number(/<Calories>(\d+)<\/Calories>/i.exec(lapBody)?.[1] ?? 0);
      average ??= Number(
        /<AverageHeartRateBpm[^>]*>[\s\S]*?<Value>(\d+)<\/Value>/i.exec(lapBody)?.[1],
      );
      maximum ??= Number(
        /<MaximumHeartRateBpm[^>]*>[\s\S]*?<Value>(\d+)<\/Value>/i.exec(lapBody)?.[1],
      );

      for (const [, pointBody = ''] of lapBody.matchAll(/<Trackpoint\b[^>]*>([\s\S]*?)<\/Trackpoint>/gi)) {
        const time = /<Time>([^<]+)<\/Time>/i.exec(pointBody)?.[1];
        if (time) times.push(time);
        const heart = /<HeartRateBpm[^>]*>[\s\S]*?<Value>(\d+)<\/Value>/i.exec(pointBody)?.[1];
        if (heart) heartRates.push(Number(heart));
        const altitude = /<AltitudeMeters>([-\d.]+)<\/AltitudeMeters>/i.exec(pointBody)?.[1];
        if (altitude !== undefined && Number.isFinite(Number(altitude))) {
          elevations.push(Number(altitude));
        }
        const lat = /<LatitudeDegrees>([-\d.]+)<\/LatitudeDegrees>/i.exec(pointBody)?.[1];
        const lon = /<LongitudeDegrees>([-\d.]+)<\/LongitudeDegrees>/i.exec(pointBody)?.[1];
        if (lat && lon) points.push({ lat: Number(lat), lng: Number(lon) });
      }

      // Le départ d'un TCX est sur la première lap, pas dans un point.
      if (!times[0] && lapAttrs) {
        const lapStart = /StartTime="([^"]+)"/i.exec(lapAttrs)?.[1];
        if (lapStart) times.unshift(lapStart);
      }
    }

    const start = localIso(times[0]);
    if (!start) continue;
    const mapped = sportFrom(sportAttr, /<Notes>([^<]+)<\/Notes>/i.exec(body)?.[1]?.trim());
    const duration = seconds > 0 ? Math.round(seconds / 60) : minutesBetween(times[0], times[times.length - 1]);
    if (duration <= 0) continue;
    const traveled = distance > 0 ? Math.round(distance) / 1000 : distanceOf(points);
    const elevationM = elevationGain(elevations);

    activities.push({
      date: start,
      sport: mapped.sport,
      title: mapped.title,
      durationMin: duration,
      distanceKm: traveled > 0.05 ? Math.round(traveled * 100) / 100 : undefined,
      elevationM: elevationM > 0 ? elevationM : undefined,
      calories: calories > 0 ? Math.round(calories) : undefined,
      avgHr:
        average !== undefined && Number.isFinite(average)
          ? Math.round(average)
          : heartRates.length > 0
            ? Math.round(heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length)
            : undefined,
      maxHr:
        maximum !== undefined && Number.isFinite(maximum)
          ? Math.round(maximum)
          : heartRates.length > 0
            ? Math.max(...heartRates)
            : undefined,
      source: 'fichier',
      externalId: `tcx:${start}:${Math.round(traveled * 100)}`,
      route: points.length > 1 ? serializeRoute(downsample(points)) : undefined,
    });
  }

  if (activities.length === 0) {
    warnings.push('Aucune activité lisible dans ce fichier TCX.');
  }

  return { source: 'fichier', fileName, activities, days: [], warnings };
}

/** Les points d'un GPX ou TCX, pour un aperçu de tracé. */
export function trackPoints(text: string): RoutePoint[] {
  const points = pointsFromTrack(text);
  if (points.length > 0) return points;
  const lat = [...text.matchAll(/<LatitudeDegrees>([-\d.]+)<\/LatitudeDegrees>/gi)];
  const lon = [...text.matchAll(/<LongitudeDegrees>([-\d.]+)<\/LongitudeDegrees>/gi)];
  return lat
    .map((entry, index) => ({
      lat: Number(entry[1]),
      lng: Number(lon[index]?.[1]),
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}
