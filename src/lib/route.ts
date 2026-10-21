/**
 * Un tracé de sortie, sans carte et sans réseau.
 *
 * Les fichiers GPX/TCX donnent des milliers de points ; on en garde une
 * centaine, assez pour dessiner la silhouette du parcours dans une fiche. La
 * forme est stockée en texte (« lat,lng;… »), reste lisible dans une
 * sauvegarde JSON et ne pèse que quelques kilo-octets.
 */

export interface RoutePoint {
  lat: number;
  lng: number;
}

/** Le nombre de points conservés dans une séance. */
export const ROUTE_POINTS = 120;

export function parseRoute(raw: string | undefined): RoutePoint[] {
  if (!raw) return [];
  const points: RoutePoint[] = [];
  for (const pair of raw.split(';')) {
    const [lat, lng] = pair.split(',');
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    points.push({ lat: latitude, lng: longitude });
  }
  return points;
}

export function serializeRoute(points: RoutePoint[]): string | undefined {
  if (points.length < 2) return undefined;
  return points
    .map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`)
    .join(';');
}

/** Garde au plus `count` points, répartis régulièrement sur le parcours. */
export function downsample(points: RoutePoint[], count = ROUTE_POINTS): RoutePoint[] {
  if (points.length <= count) return points;
  const step = (points.length - 1) / (count - 1);
  const kept: RoutePoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const point = points[Math.round(index * step)];
    if (point) kept.push(point);
  }
  return kept;
}

/** Les points utiles d'un fichier GPX ou TCX, dans l'ordre du parcours. */
export function pointsFromTrack(raw: string): RoutePoint[] {
  const points: RoutePoint[] = [];
  const pattern = /<trkpt\b[^>]*\blat="([-\d.]+)"[^>]*\blon="([-\d.]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw))) {
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    points.push({ lat, lng });
  }
  return points;
}

/**
 * Un chemin SVG normalisé, avec la latitude corrigée par le cosinus pour ne
 * pas écraser le parcours : un degré de longitude vaut moins de kilomètres
 * qu'un degré de latitude dès qu'on s'éloigne de l'équateur.
 */
export function routePath(points: RoutePoint[], size = 100, padding = 4): string {
  if (points.length < 2) return '';
  const middle = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const scaleX = Math.cos((middle * Math.PI) / 180);
  const projected = points.map((point) => ({ x: point.lng * scaleX, y: point.lat }));
  const xs = projected.map((point) => point.x);
  const ys = projected.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const span = Math.max(width, height);
  const offsetX = padding + (span - width) / 2;
  const offsetY = padding + (span - height) / 2;
  const scale = (size - padding * 2) / span;

  return projected
    .map((point, index) => {
      const x = (offsetX + (point.x - minX) * scale).toFixed(2);
      // L'axe SVG descend ; la latitude monte.
      const y = (size - (offsetY + (point.y - minY) * scale)).toFixed(2);
      return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
    })
    .join(' ');
}
