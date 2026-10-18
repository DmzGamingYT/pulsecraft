const numberFR = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimalFR = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export function fmtNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return numberFR.format(Math.round(value));
}

export function fmtDecimal(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return decimalFR.format(value);
}

/** « 1 h 25 » ou « 45 min ». */
export function fmtMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 min';
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${String(rest).padStart(2, '0')}`;
}

/** « 7 h 42 » à partir de minutes de sommeil, pour les gros chiffres. */
export function fmtSleep(minutes: number): { hours: string; minutes: string } {
  const total = Math.max(0, Math.round(minutes));
  return {
    hours: String(Math.floor(total / 60)),
    minutes: String(total % 60).padStart(2, '0'),
  };
}

/** « 5:42 /km » ; allure en minutes décimales. */
export function fmtPace(minutesPerKm: number): string {
  if (!(minutesPerKm > 0)) return '—';
  const minutes = Math.floor(minutesPerKm);
  const seconds = Math.round((minutesPerKm - minutes) * 60);
  if (seconds === 60) return `${minutes + 1}:00 /km`;
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
}

export function fmtDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes * 60));
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function pct(value: number, goal: number): number {
  if (!(goal > 0)) return 0;
  return Math.max(0, Math.min(1, value / goal));
}

export function signed(value: number, digits = 1): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(digits).replace('.', ',')}`;
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count > 1 ? pluralForm : singular;
}
