import { describe, expect, it } from 'vitest';
import { addDays, isoDate, parseDay } from './dates';

function weekday(day: string): number {
  return parseDay(day).getDay();
}

describe('addDays', () => {
  it('avance et recule d’un jour', () => {
    expect(addDays('2026-10-21', 1)).toBe('2026-10-22');
    expect(addDays('2026-10-21', -1)).toBe('2026-10-20');
  });

  it('franchit les fins de mois et d’année', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('garde le même jour de semaine sur soixante jours', () => {
    // Le piège : ajouter des millisecondes traverse le changement d’heure et
    // fait glisser la date d’un jour. Ce test vaut dans tous les fuseaux.
    let day = '2026-03-01';
    const base = weekday(day);
    for (let index = 0; index < 60; index += 1) {
      day = addDays(day, 1);
      expect(weekday(day)).toBe((base + index + 1) % 7);
    }
  });

  it('donne la date locale, sans heure parasite', () => {
    expect(isoDate(parseDay('2026-10-25'))).toBe('2026-10-25');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });
});
