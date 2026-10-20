import { describe, expect, it } from 'vitest';
import type { PlanIntake } from '../types';
import { addDays } from './dates';
import {
  buildPlan,
  nextSession,
  planPromptContext,
  planStats,
  rebuildPlan,
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

  it('détaille les séances de renforcement au poids du corps, dips compris', () => {
    const plan = buildPlan(
      intake({ goal: 'force', experience: 'intermediaire', equipment: 'aucun' }),
      { today }
    );
    const strength = plan.weeks[0]!.sessions.filter((session) => session.type === 'Musculation');
    expect(strength.length).toBeGreaterThan(0);
    const exercises = strength.flatMap((session) => session.exercises ?? []);
    expect(exercises.length).toBeGreaterThan(0);
    const dips = exercises.find((exercise) => exercise.name.includes('Dips'));
    expect(dips).toBeDefined();
    expect(dips?.sets).toBeGreaterThanOrEqual(3);
    expect(dips?.reps).toContain('6–10');
    expect(dips?.restSec).toBe(90);
    expect(dips?.note).toBeTruthy();
  });

  it('adapte les mouvements au matériel et au niveau', () => {
    const bodyweight = buildPlan(
      intake({ goal: 'force', experience: 'debutant', equipment: 'aucun' }),
      { today }
    );
    const gym = buildPlan(
      intake({ goal: 'force', experience: 'avance', equipment: 'salle' }),
      { today }
    );
    const bodyDips = bodyweight.weeks[0]!.sessions
      .flatMap((session) => session.exercises ?? [])
      .find((exercise) => exercise.name.includes('Dips'));
    const gymDips = gym.weeks[0]!.sessions
      .flatMap((session) => session.exercises ?? [])
      .find((exercise) => exercise.name.includes('Dips'));
    expect(bodyDips?.name).toBe('Dips sur banc, pieds au sol');
    expect(gymDips?.name).toBe('Dips lestées');
    expect(bodyDips?.name).not.toBe(gymDips?.name);
  });

  it('démarre aujourd’hui quand le bilan est fait en semaine', () => {
    const tuesday = '2026-05-05';
    const plan = buildPlan(intake({ goal: 'force', daysPerWeek: 3 }), {
      today: tuesday,
      startToday: true,
    });
    expect(plan.weeks[0]?.sessions.some((session) => session.day === 1)).toBe(true);
    expect(sessionForDate(plan, tuesday)).not.toBeNull();
    expect(plan.weeks[0]?.sessions.every((session) => session.day >= 1)).toBe(true);
    expect(plan.weeks[0]?.sessions.length).toBeLessThan(3);
    expect(plan.weeks[0]?.focus).toContain('Mise en route');
  });

  it('allège aussi les séries de renforcement en semaine 4', () => {
    const plan = buildPlan(
      intake({ goal: 'force', experience: 'intermediaire', equipment: 'aucun' }),
      { today }
    );
    const first = plan.weeks[0]!.sessions.flatMap((session) => session.exercises ?? [])[0];
    const deload = plan.weeks[3]!.sessions.flatMap((session) => session.exercises ?? [])[0];
    expect(first).toBeDefined();
    expect(deload).toBeDefined();
    expect(deload!.sets).toBeLessThan(first!.sets);
  });

  it('ajuste le plan sans décaler le calendrier ni perdre les séances cochées', () => {
    const base = buildPlan(
      intake({ goal: 'force', experience: 'intermediaire', equipment: 'aucun' }),
      { today }
    );
    const session = base.weeks[0]!.sessions[0]!;
    const done = togglePlanSession(base, 0, session.id, true);
    const adjusted = rebuildPlan(done, { ...done.intake, equipment: 'salle' }, { today });

    expect(adjusted.weeks[0]!.startDate).toBe(base.weeks[0]!.startDate);
    expect(adjusted.intake.equipment).toBe('salle');
    expect(adjusted.weeks[0]!.sessions.find((item) => item.day === session.day)?.doneAt).toBeTruthy();
    expect(planStats(adjusted, today).done).toBe(1);
    const names = adjusted.weeks[0]!.sessions
      .flatMap((item) => item.exercises ?? [])
      .map((exercise) => exercise.name);
    expect(names.some((name) => name.includes('Dips'))).toBe(true);
  });

  it('garde les semaines passées intactes et n’applique le matériel qu’aux séances à venir', () => {
    const start = '2026-04-20';
    const now = '2026-05-04';
    const base = buildPlan(
      intake({ goal: 'force', experience: 'intermediaire', equipment: 'aucun' }),
      { today: start }
    );
    const done = togglePlanSession(base, 0, base.weeks[0]!.sessions[0]!.id, true);
    const adjusted = rebuildPlan(done, { ...done.intake, equipment: 'salle' }, { today: now });

    expect(adjusted.weeks[0]!.startDate).toBe(start);
    expect(weekIndexFor(adjusted, now)).toBe(2);
    expect(adjusted.weeks[0]!.sessions[0]!.doneAt).toBeTruthy();
    const pastNames = adjusted.weeks[0]!.sessions
      .flatMap((session) => session.exercises ?? [])
      .map((exercise) => exercise.name);
    const futureNames = adjusted.weeks[2]!.sessions
      .flatMap((session) => session.exercises ?? [])
      .map((exercise) => exercise.name);
    expect(pastNames).toContain('Dips entre deux chaises');
    expect(futureNames).toContain('Dips aux barres');
  });

  it('garde une séance cochée même si la nouvelle fréquence l’exclut', () => {
    const base = buildPlan(intake({ goal: 'force', daysPerWeek: 3 }), { today });
    const done = togglePlanSession(base, 0, base.weeks[0]!.sessions[0]!.id, true);
    const adjusted = rebuildPlan(done, { ...done.intake, daysPerWeek: 2 }, { today });

    const planned = adjusted.weeks[0]!.sessions.filter((session) => !session.id.endsWith('_done'));
    const kept = adjusted.weeks[0]!.sessions.filter((session) => session.id.endsWith('_done'));
    expect(planned).toHaveLength(2);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.doneAt).toBeTruthy();
    expect(planStats(adjusted, today).done).toBe(1);
  });

  it('applique une nouvelle fréquence et une nouvelle durée', () => {
    const base = buildPlan(intake({ goal: 'force', daysPerWeek: 3, sessionMin: 45 }), { today });
    const adjusted = rebuildPlan(
      base,
      { ...base.intake, daysPerWeek: 5, sessionMin: 30 },
      { today }
    );
    expect(adjusted.weeks[0]!.sessions).toHaveLength(5);
    expect(adjusted.weeks[0]!.sessions.every((session) => session.minutes >= 20)).toBe(true);
    expect(adjusted.intake.sessionMin).toBe(30);
    expect(adjusted.intake.daysPerWeek).toBe(5);
  });

  it('repart de la semaine en cours quand le plan est terminé', () => {
    const base = buildPlan(intake({ targetDate: '2026-06-01' }), { today });
    const finished = {
      ...base,
      weeks: base.weeks.map((week) => ({ ...week, startDate: addDays(week.startDate, -56) })),
    };
    const adjusted = rebuildPlan(finished, { ...finished.intake, goal: 'force' }, { today });
    expect(adjusted.weeks[0]!.startDate).toBe(today);
    expect(weekIndexFor(adjusted, today)).toBe(0);
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
