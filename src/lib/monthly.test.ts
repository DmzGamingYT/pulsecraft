import { describe, expect, it } from 'vitest';
import {
  buildMonthlyProgram,
  isMonthOver,
  isMonthlyProgram,
  nextMonthlyProgram,
} from './monthly';
import { sessionForDate, weekIndexFor } from './plan';

const today = '2026-05-04'; // un lundi

/** « 7 h 30 » → 7.5 ; sert à vérifier qu'aucune séance ne tombe sur l'atelier. */
function hoursOf(time: string): number {
  const match = time.match(/(\d+)\s*h(?:\s*(\d+))?/);
  if (!match) return Number.NaN;
  return Number(match[1]) + Number(match[2] ?? 0) / 60;
}

describe('programme du mois', () => {
  it('produit quatre semaines, quatre séances et des créneaux horaires', () => {
    const plan = buildMonthlyProgram({ today });
    expect(plan.preset).toBe('monthly-muscle');
    expect(plan.horizonWeeks).toBe(4);
    expect(plan.weeks).toHaveLength(4);
    expect(plan.weeks.every((week) => week.sessions.length === 4)).toBe(true);
    expect(plan.weeks[0]?.startDate).toBe(today);
    expect(plan.phases).toHaveLength(3);
    expect(plan.milestones).toHaveLength(3);
    for (const session of plan.weeks.flatMap((week) => week.sessions)) {
      expect(session.time).toBeTruthy();
      expect(session.exercises?.length).toBeGreaterThan(0);
      expect(session.minutes).toBe(40);
    }
  });

  it('ne place aucune séance pendant l’atelier de 14 h à 18 h', () => {
    const plan = buildMonthlyProgram({ today });
    for (const session of plan.weeks.flatMap((week) => week.sessions)) {
      const hour = hoursOf(session.time ?? '');
      expect(Number.isNaN(hour)).toBe(false);
      expect(hour < 14 || hour >= 18).toBe(true);
    }
    const slots = plan.weeks[0]!.sessions.map((session) => session.time);
    expect(slots).toEqual(['7 h 30', '7 h 30', '19 h', '10 h']);
  });

  it('mélange poids du corps et haltères légers', () => {
    const names = buildMonthlyProgram({ today })
      .weeks.flatMap((week) => week.sessions)
      .flatMap((session) => session.exercises ?? [])
      .map((exercise) => exercise.name);
    expect(names.some((name) => name.includes('Pompes'))).toBe(true);
    expect(names.some((name) => name.includes('haltère'))).toBe(true);
    expect(names.some((name) => name.includes('fessier') || name.includes('Pont'))).toBe(true);
  });

  it('allège la quatrième semaine', () => {
    const plan = buildMonthlyProgram({ today });
    const first = plan.weeks[0]!.sessions.flatMap((session) => session.exercises ?? [])[0];
    const deload = plan.weeks[3]!.sessions.flatMap((session) => session.exercises ?? [])[0];
    expect(plan.weeks[3]?.deload).toBe(true);
    expect(plan.weeks[0]?.deload).toBe(false);
    expect(deload!.sets).toBeLessThan(first!.sets);
    expect(plan.weeks[3]!.targetMinutes).toBe(plan.weeks[0]!.targetMinutes);
  });

  it('ajoute une série sur les mouvements principaux en deuxième semaine', () => {
    const plan = buildMonthlyProgram({ today });
    const week1 = plan.weeks[0]!.sessions[0]!.exercises ?? [];
    const week2 = plan.weeks[1]!.sessions[0]!.exercises ?? [];
    expect(week2[0]!.sets).toBe(week1[0]!.sets + 1);
    expect(week2[4]!.sets).toBe(week1[4]!.sets);
  });

  it('démarre en semaine sur les seuls créneaux restants', () => {
    const wednesday = '2026-05-06';
    const plan = buildMonthlyProgram({ today: wednesday });
    expect(plan.weeks[0]?.startDate).toBe(today);
    expect(plan.weeks[0]?.sessions.map((session) => session.day)).toEqual([2, 4, 6]);
    expect(plan.weeks[0]?.focus).toContain('Mise en route');
    expect(plan.weeks[1]?.sessions).toHaveLength(4);
    expect(sessionForDate(plan, wednesday)?.time).toBe('7 h 30');
  });

  it('attend le lundi suivant quand il ne reste qu’un créneau', () => {
    const saturday = '2026-05-09';
    const plan = buildMonthlyProgram({ today: saturday });
    expect(plan.weeks[0]?.startDate).toBe('2026-05-11');
    expect(weekIndexFor(plan, saturday)).toBeNull();
    expect(plan.weeks[0]?.sessions).toHaveLength(4);
  });

  it('enchaîne le mois suivant avec une variante plus difficile', () => {
    const first = buildMonthlyProgram({ today });
    const second = nextMonthlyProgram(first, { today: '2026-06-01' });
    const third = nextMonthlyProgram(second, { today: '2026-06-29' });

    expect(first.monthIndex).toBe(0);
    expect(second.monthIndex).toBe(1);
    expect(third.monthIndex).toBe(2);
    expect(second.weeks[0]?.startDate).toBe('2026-06-01');

    const nameOf = (plan: ReturnType<typeof buildMonthlyProgram>) =>
      plan.weeks[0]!.sessions[0]!.exercises![0]!.name;
    expect(nameOf(first)).not.toBe(nameOf(second));
    expect(nameOf(second)).not.toBe(nameOf(third));
  });

  it('reconnaît le programme du mois et sa fin', () => {
    const plan = buildMonthlyProgram({ today });
    expect(isMonthlyProgram(plan)).toBe(true);
    expect(isMonthlyProgram(null)).toBe(false);
    expect(isMonthOver(plan, '2026-05-24')).toBe(false);
    expect(isMonthOver(plan, '2026-06-01')).toBe(true);
  });
});
