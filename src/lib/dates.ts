/** Dates locales, sans dépendance : le journal vit dans le fuseau de l'appareil. */

const DAY = 86_400_000;

export function isoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO(): string {
  return isoDate();
}

/** La date (YYYY-MM-DD) d'un horodatage ISO, sans passer par UTC. */
export function datePart(iso: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return match?.[1] ?? isoDate();
}

export function parseDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1);
}

export function addDays(day: string, delta: number): string {
  return isoDate(new Date(parseDay(day).getTime() + delta * DAY));
}

/** Les `count` derniers jours, du plus ancien au plus récent, en terminant par `end`. */
export function lastDays(count: number, end = todayISO()): string[] {
  const days: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) days.push(addDays(end, -index));
  return days;
}

const SHORT = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' });
const LONG = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

export function shortDate(day: string): string {
  return SHORT.format(parseDay(day)).replace('.', '');
}

export function longDate(day: string): string {
  return LONG.format(parseDay(day));
}

const DAY_HEADING = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** « Aujourd’hui », « Hier » ou « lundi 20 octobre » — pour les groupes du journal. */
export function dayHeading(day: string, today = todayISO()): string {
  if (day === today) return 'Aujourd’hui';
  if (day === addDays(today, -1)) return 'Hier';
  const label = DAY_HEADING.format(parseDay(day));
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  return parseDay(day).getFullYear() === parseDay(today).getFullYear()
    ? capitalized
    : `${capitalized} ${parseDay(day).getFullYear()}`;
}

export function monthLabel(day: string): string {
  return MONTH.format(parseDay(day));
}

export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${String(rest).padStart(2, '0')}`;
}

export function formatDistance(km: number | undefined): string {
  if (km === undefined || !Number.isFinite(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km >= 10 ? 0 : 1).replace('.', ',')} km`;
}

export function formatNumber(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('fr-FR').format(Math.round(value));
}
