/**
 * Dates locales, jamais UTC.
 *
 * Un entraînement du 2 mai à 23 h doit rester daté du 2 mai pour l'utilisateur,
 * pas du 3 mai parce que le serveur est ailleurs. Toutes les clés de jour sont
 * donc des chaînes `YYYY-MM-DD` construites en heure locale.
 */

export type ISODate = string;

export function toISODate(date: Date): ISODate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function parseISODate(iso: ISODate): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function addDays(iso: ISODate, days: number): ISODate {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function daysBetween(from: ISODate, to: ISODate): number {
  const a = parseISODate(from).getTime();
  const b = parseISODate(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Série de jours, du plus ancien au plus récent (bornes incluses). */
export function dateRange(endISO: ISODate, length: number): ISODate[] {
  return Array.from({ length }, (_, index) => addDays(endISO, index - (length - 1)));
}

export function startOfWeek(iso: ISODate): ISODate {
  const date = parseISODate(iso);
  const day = (date.getDay() + 6) % 7; // lundi = 0
  date.setDate(date.getDate() - day);
  return toISODate(date);
}

const LONG = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const MEDIUM = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const SHORT = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });

export function formatLong(iso: ISODate): string {
  return LONG.format(parseISODate(iso));
}

export function formatMedium(iso: ISODate): string {
  return MEDIUM.format(parseISODate(iso));
}

export function formatWeekday(iso: ISODate): string {
  return SHORT.format(parseISODate(iso)).replace('.', '');
}

export function relativeDay(iso: ISODate, today = todayISO()): string {
  const diff = daysBetween(iso, today);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Hier';
  if (diff === -1) return 'Demain';
  if (diff > 1 && diff < 7) return `Il y a ${diff} jours`;
  return formatMedium(iso);
}

/** Horodatage ISO complet, pour les messages du coach. */
export function nowISO(): string {
  return new Date().toISOString();
}

export function formatTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

/** « 2024-05-01 07:00:00.000 » (Samsung) → Date locale, sans décalage UTC. */
export function parseLooseDateTime(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/
  );
  if (match) {
    const [, y, m, d, h, min, s] = match;
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(h),
      Number(min),
      Number(s ?? 0)
    );
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isoDateTime(iso: ISODate, time = '08:00'): string {
  const [hours, minutes] = time.split(':').map(Number);
  const date = parseISODate(iso);
  date.setHours(hours ?? 8, minutes ?? 0, 0, 0);
  return date.toISOString();
}

export function ageFromBirthYear(birthYear?: number): number {
  if (!birthYear || birthYear < 1900) return 30;
  return Math.max(10, Math.min(100, new Date().getFullYear() - birthYear));
}
