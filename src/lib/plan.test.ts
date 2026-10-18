import { describe, expect, it } from 'vitest';
import type { PlanIntake } from '../types';
import {
  buildPlan,
  nextSession,
  planPromptContext,
  planStats,
  sessionForDate,
  togglePlanSession,
  weekIndexFor,
} from './plan';

const today = '2026-05-04'; // un lundi

function intake(overrides: Partial<PlanIntake> = {}): PlanIntake {
  return {
    goal: 'endurance',
    experience: 'debutant',
    daysPerWeek: 3,
    sessionMin: 45,
    equipment: 'aucun',
    sleepHours: 8,
    createdAt: '2026-05-04T08:00:00.000Z',
    ...overrides,
  };
}

describe('plan long terme', () => {
  it('produit 12 semaines, 3 séances par semaine et 3 phases', () => {
    const plan = buildPlan(intake(), { today });
    expect(plan.horizonWeeks).toBe(12);
    expect(plan.weeks).toHaveLength(12);
    expect(plan.weeks.every((week) => week.sessions.length === 3)).toBe(true);
    expect(plan.phases).toHaveLength(3);
    expect(plan.phases[0]?.fromWeek).toBe(0);
    expect(plan.phases.at(-1)?.toWeek).toBe(11);
  });

  it('allège le volume toutes les quatre semaines', () => {
    const plan = buildPlan(intake(), { today });
    const normal = plan.weeks[0]!.targetMinutes;
    const deload = plan.weeks[3]!.targetMinutes;
    expect(plan.weeks[3]?.deload).toBe(true);
    expect(deload).toBeLessThan(normal);
    expect(plan.weeks[7]?.deload).toBe(true);
  });

  it('respecte le nombre de séances demandé et la durée minimale', () => {
    const plan = buildPlan(intake({ daysPerWeek: 5, sessionMin: 30 }), { today });
    expect(plan.weeks[0]?.sessions).toHaveLength(5);
    for (const session of plan.weeks[0]!.sessions) {
      expect(session.minutes).toBeGreaterThanOrEqual(20);
      expect(session.minutes % 5).toBe(0);
    }
  });

  it('change les séances selon l’objectif', () => {
    const force = buildPlan(intake({ goal: 'force' }), { today });
    const sante = buildPlan(intake({ goal: 'sante' }), { today });
    const forceTypes = force.weeks[0]!.sessions.map((session) => session.type);
    const santeTypes = sante.weeks[0]!.sessions.map((session) => session.type);
    expect(forceTypes).toContain('Musculation');
    expect(santeTypes).toContain('Marche');
    expect(forceTypes).not.toEqual(santeTypes);
  });

  it('place tous les repères dans l’horizon du plan', () => {
    for (const targetDate of ['2026-05-25', '2026-07-27', '2027-01-04']) {
      const plan = buildPlan(intake({ targetDate }), { today });
      expect(plan.milestones.every((milestone) => milestone.week < plan.horizonWeeks)).toBe(true);
      expect(plan.milestones.every((milestone) => milestone.week >= 0)).toBe(true);
      expect(plan.milestones.at(-1)?.week).toBe(plan.horizonWeeks - 1);
    }
    expect(buildPlan(intake(), { today }).milestones.at(-1)?.week).toBe(11);
  });

  it('borne l’horizon entre 4 et 24 semaines', () => {
    expect(buildPlan(intake({ targetDate: '2026-05-10' }), { today }).horizonWeeks).toBe(4);
    const far = buildPlan(intake({ targetDate: '2028-05-01' }), { today });
    expect(far.horizonWeeks).toBe(24);
  });

  it('démarre au lundi suivant quand le bilan est fait le week-end', () => {
    const sunday = '2026-05-10';
    const plan = buildPlan(intake(), { today: sunday });
    expect(plan.weeks[0]?.startDate).toBe('2026-05-11');
    expect(weekIndexFor(plan, sunday)).toBeNull();
  });

  it('trouve la semaine et la séance d’une date', () => {
    const plan = buildPlan(intake(), { today });
    expect(weekIndexFor(plan, today)).toBe(0);
    expect(weekIndexFor(plan, '2026-05-11')).toBe(1);
    expect(weekIndexFor(plan, '2030-01-01')).toBeNull();

    const monday = sessionForDate(plan, today);
    expect(monday).not.toBeNull();
    expect(monday?.day).toBe(0);
    expect(sessionForDate(plan, '2026-05-06')?.day).toBe(2);
    expect(sessionForDate(plan, '2026-05-07')).toBeNull();
  });

  it('calcule la régularité sans muter le plan', () => {
    const plan = buildPlan(intake(), { today });
    const session = plan.weeks[0]!.sessions[0]!;
    const updated = togglePlanSession(plan, 0, session.id, true);
    expect(plan.weeks[0]!.sessions[0]!.doneAt).toBeUndefined();
    expect(updated.weeks[0]!.sessions[0]!.doneAt).toBeTruthy();
    expect(planStats(updated, today).done).toBe(1);
    expect(planStats(updated, today).total).toBe(36);
    expect(planStats(updated, today).adherence).toBe(3);

    const reverted = togglePlanSession(updated, 0, session.id, false);
    expect(reverted.weeks[0]!.sessions[0]!.doneAt).toBeUndefined();
  });

  it('propose une prochaine séance non réalisée', () => {
    const plan = buildPlan(intake(), { today });
    const first = nextSession(plan, '2026-05-06');
    expect(first).not.toBeNull();
    expect(first?.date).toBe('2026-05-06');
  });

  it('n’envoie jamais la note libre dans le contexte IA', () => {
    const secret = 'douleur au genou droit, ne pas oublier';
    const plan = buildPlan(intake({ constraints: secret }), { today });
    const context = planPromptContext(plan.intake, plan);
    expect(context).not.toContain(secret);
    expect(context).not.toContain('genou');
    expect(context).toContain('Endurance');
  });
});
