import { describe, expect, it } from 'vitest';
import type { Activity } from '../types';
import { addDays } from './dates';
import {
  adjustmentFor,
  applyCheckIn,
  buildProfile,
  buildProgram,
  checkInDue,
  doneInWeek,
  MAX_PLAN_FACTOR,
  totalPlanned,
  type Answers,
} from './coach';

const TODAY = '2026-10-21'; // un mercredi

function activity(
  id: string,
  date: string,
  durationMin: number,
  sport: Activity['sport'] = 'course',
): Activity {
  return {
    id,
    date,
    sport,
    title: 'Séance',
    durationMin,
    calories: durationMin * 10,
    source: 'manuel',
  };
}

/** Huit semaines de course le lundi et le mercredi, 40 min (TODAY est un mercredi). */
function regularJournal(): Activity[] {
  const list: Activity[] = [];
  for (let week = 0; week < 8; week += 1) {
    const monday = addDays('2026-10-19', -week * 7);
    const wednesday = addDays('2026-10-21', -week * 7);
    list.push(activity(`m${week}`, `${monday}T07:00:00`, 40, 'course'));
    list.push(activity(`w${week}`, `${wednesday}T07:00:00`, 40, 'course'));
  }
  return list;
}

const ANSWERS: Answers = {
  goal: 'endurance',
  sessionsPerWeek: 3,
  minutes: 40,
  days: [1, 3, 5],
  rhythm: 'weekly',
};

describe('buildProfile', () => {
  it('lit la fréquence, la durée et la discipline dominante', () => {
    const profile = buildProfile(regularJournal(), [], TODAY);
    expect(profile.dominant).toBe('course');
    expect(profile.weeks).toBe(8);
    expect(profile.sessionsPerWeek).toBeGreaterThan(1);
    expect(profile.avgMinutes).toBe(40);
    expect(profile.dominantShare).toBe(1);
  });

  it('repère les jours les plus actifs', () => {
    const profile = buildProfile(regularJournal(), [], TODAY);
    expect(profile.activeDays.slice(0, 2).sort()).toEqual([1, 3]);
  });

  it('reste neutre sans journal', () => {
    const profile = buildProfile([], [], TODAY);
    expect(profile.sessions).toBe(0);
    expect(profile.dominant).toBeNull();
    expect(profile.weeks).toBe(0);
    expect(profile.load.label).toBe('faible');
    expect(profile.readiness).toBeGreaterThanOrEqual(30);
  });

  it('compare la charge récente à la base de quatre semaines', () => {
    const journal = regularJournal();
    const profile = buildProfile(journal, [], TODAY);
    expect(profile.load.recent).toBeGreaterThan(0);
    expect(profile.load.baseline).toBeGreaterThan(0);
    expect(['faible', 'équilibrée', 'élevée']).toContain(profile.load.label);
  });

  it('donne plus d’énergie après deux jours de repos qu’après une grosse semaine', () => {
    const repos = buildProfile([activity('r', '2026-10-18T09:00:00', 40)], [], TODAY);
    const grosse = buildProfile(
      [
        activity('a', '2026-10-20T09:00:00', 90),
        activity('b', '2026-10-19T09:00:00', 90),
        activity('c', '2026-10-18T09:00:00', 90),
        activity('d', '2026-10-17T09:00:00', 90),
      ],
      [],
      TODAY,
    );
    expect(repos.readiness).toBeGreaterThan(grosse.readiness);
  });
});

describe('buildProgram', () => {
  const profile = buildProfile(regularJournal(), [], TODAY);
  const program = buildProgram(profile, ANSWERS, TODAY);

  it('fait quatre semaines et respecte la disponibilité', () => {
    expect(program.weeks).toHaveLength(4);
    for (const week of program.weeks) {
      expect(week.sessions.length).toBeLessThanOrEqual(ANSWERS.sessionsPerWeek);
      for (const session of week.sessions) {
        expect(ANSWERS.days).toContain(new Date(`${session.date}T12:00:00`).getDay());
      }
    }
  });

  it('ne propose pas de séance déjà passée la première semaine', () => {
    for (const session of program.weeks[0]?.sessions ?? []) {
      expect(session.date >= TODAY).toBe(true);
    }
  });

  it('garde une séance longue et une séance soutenue en endurance', () => {
    const sessions = program.weeks[1]?.sessions ?? [];
    expect(sessions.some((session) => session.intensity === 'soutenu')).toBe(true);
    const longest = Math.max(...sessions.map((session) => session.minutes));
    const shortest = Math.min(...sessions.map((session) => session.minutes));
    expect(longest).toBeGreaterThan(shortest);
  });

  it('reste facile sur une reprise', () => {
    const reprise = buildProgram(profile, { ...ANSWERS, goal: 'reprise' }, TODAY);
    const intensities = reprise.weeks.flatMap((week) => week.sessions.map((session) => session.intensity));
    expect(intensities.every((intensity) => intensity === 'facile')).toBe(true);
  });

  it('alterne musculation et cardio sur un objectif de force', () => {
    const force = buildProgram(profile, { ...ANSWERS, goal: 'force' }, TODAY);
    const week = force.weeks[1]?.sessions ?? [];
    expect(week.filter((session) => session.sport === 'musculation').length).toBeGreaterThanOrEqual(2);
  });

  it('complète les jours manquants au lieu de rendre un plan vide', () => {
    const partiel = buildProgram(profile, { ...ANSWERS, days: [2] }, TODAY);
    expect(partiel.answers.days).toHaveLength(ANSWERS.sessionsPerWeek);
    expect(partiel.weeks[1]?.sessions).toHaveLength(ANSWERS.sessionsPerWeek);
  });

  it('explique ses choix', () => {
    expect(program.rationale.join(' ').toLowerCase()).toContain('course');
    expect(program.rationale.length).toBeGreaterThan(2);
  });

  it('est déterministe', () => {
    const bis = buildProgram(profile, ANSWERS, TODAY);
    expect(bis).toEqual(program);
  });

  it('propose toujours un plan sans aucune donnée', () => {
    const vide = buildProfile([], [], TODAY);
    const plan = buildProgram(vide, ANSWERS, TODAY);
    expect(plan.weeks.every((week) => week.sessions.length <= ANSWERS.sessionsPerWeek)).toBe(true);
    // La première semaine ne garde que les séances à venir, les trois autres sont pleines.
    expect(totalPlanned(plan)).toBeGreaterThanOrEqual(10);
    expect(totalPlanned(plan)).toBeLessThanOrEqual(12);
  });
});

describe('le point de suivi', () => {
  const profile = buildProfile(regularJournal(), [], TODAY);
  const program = buildProgram(profile, ANSWERS, TODAY);
  const done = new Set((program.weeks[1]?.sessions ?? []).map((session) => session.date));

  it('ne demande un point qu’une fois la semaine terminée', () => {
    const end = program.weeks[0]?.end ?? TODAY;
    expect(checkInDue(program, program.weeks[0]?.start ?? TODAY)).toBeNull();
    expect(checkInDue(program, end)).toBeNull();
    expect(checkInDue(program, addDays(end, 1))?.index).toBe(0);
  });

  it('allège la suite quand la semaine a été dure', () => {
    const before = program.weeks[2]?.minutes ?? 0;
    const next = applyCheckIn(program, {
      week: 1,
      date: TODAY,
      feel: 'dur',
      fatigue: 5,
      done: 1,
      planned: 3,
    });
    expect(next.weeks[2]?.minutes).toBeLessThan(before);
    expect(next.checkIns[0]?.summary).toContain('allégée');
    expect(next.weeks[0]).toEqual(program.weeks[0]);
  });

  it('progresse quand la semaine a été digérée', () => {
    const before = program.weeks[2]?.minutes ?? 0;
    const next = applyCheckIn(program, {
      week: 1,
      date: TODAY,
      feel: 'facile',
      fatigue: 2,
      done: 3,
      planned: 3,
    });
    expect(next.weeks[2]?.minutes).toBeGreaterThan(before);
    expect(next.checkIns[0]?.summary).toContain('Progression');
  });

  it('abaisse l’intensité quand elle est trop haute pour la fatigue', () => {
    const next = applyCheckIn(program, {
      week: 1,
      date: TODAY,
      feel: 'dur',
      fatigue: 4,
      done: 2,
      planned: 3,
    });
    const intensities = (next.weeks[2]?.sessions ?? []).map((session) => session.intensity);
    expect(intensities).not.toContain('soutenu');
  });

  it('ne redemande pas un point déjà fait', () => {
    const next = applyCheckIn(program, {
      week: 0,
      date: TODAY,
      feel: 'juste',
      fatigue: 3,
      done: 2,
      planned: 3,
    });
    expect(next.checkIns).toHaveLength(1);
    expect(checkInDue(next, '2026-11-30')?.index).toBe(1);
  });

  it('compte les séances faites dans une semaine', () => {
    expect(doneInWeek(program.weeks[1]!, done)).toBe(3);
  });

  it('résume la décision', () => {
    expect(adjustmentFor({ feel: 'juste', fatigue: 3, done: 3, planned: 3 }).note).toContain('cap');
    expect(adjustmentFor({ feel: 'facile', fatigue: 3, done: 3, planned: 3 }).factor).toBe(1);
  });

  it('ne réécrit pas une semaine déjà terminée, même avec un point tardif', () => {
    // Le point porte sur la semaine 1 mais arrive le 5 novembre : la semaine 2
    // est finie depuis le 1er, la semaine 3 est en cours.
    const late = '2026-11-05';
    const next = applyCheckIn(program, {
      week: 0,
      date: late,
      feel: 'dur',
      fatigue: 5,
      done: 0,
      planned: 3,
    });

    expect(next.weeks[0]).toEqual(program.weeks[0]);
    expect(next.weeks[1]).toEqual(program.weeks[1]);

    // La semaine en cours garde ses séances passées, n'ajuste que les suivantes.
    (next.weeks[2]?.sessions ?? []).forEach((session, index) => {
      const before = program.weeks[2]!.sessions[index]!;
      if (session.date < late) expect(session).toEqual(before);
      else expect(session.minutes).toBeLessThan(before.minutes);
    });
    expect(next.weeks[3]?.minutes).toBeLessThan(program.weeks[3]?.minutes ?? 0);
  });

  it('plafonne la progression à +15 % du plan initial', () => {
    const easy = (week: number, date: string) => ({
      week,
      date,
      feel: 'facile' as const,
      fatigue: 1,
      done: 3,
      planned: 3,
    });

    const two = applyCheckIn(
      applyCheckIn(program, easy(0, '2026-10-26')),
      easy(1, '2026-11-02'),
    );
    const three = applyCheckIn(two, easy(2, '2026-11-09'));
    const base = program.weeks[3]?.minutes ?? 0;

    expect(two.weeks[3]?.minutes).toBeGreaterThan(base);
    // 1,08³ dépasserait le plafond : le troisième point n'ajoute plus rien.
    expect(three.weeks[3]?.minutes).toBe(two.weeks[3]?.minutes);
    expect(three.weeks[3]?.minutes).toBeLessThanOrEqual(Math.ceil(base * MAX_PLAN_FACTOR));
    expect(three.checkIns[2]?.summary).toContain('Plafond');
  });

  it('plancher à −25 % : la fatigue répétée ne vide pas le programme', () => {
    const hard = (week: number, date: string) => ({
      week,
      date,
      feel: 'dur' as const,
      fatigue: 5,
      done: 0,
      planned: 3,
    });

    const two = applyCheckIn(
      applyCheckIn(program, hard(0, '2026-10-26')),
      hard(1, '2026-11-02'),
    );
    const three = applyCheckIn(two, hard(2, '2026-11-09'));
    const base = program.weeks[3]?.minutes ?? 0;

    expect(three.weeks[3]?.minutes).toBe(two.weeks[3]?.minutes);
    expect(three.weeks[3]?.minutes).toBeGreaterThan(base * 0.72);
    expect((three.weeks[3]?.sessions ?? []).every((session) => session.minutes >= 15)).toBe(true);
    // Le deuxième point est déjà partiellement borné, le troisième ne bouge plus.
    expect(two.checkIns[1]?.summary).toContain('Plancher');
    expect(two.checkIns[1]?.summary).toContain('limité');
    expect(three.checkIns[2]?.summary).toContain('Plancher');
    expect(three.checkIns[2]?.summary).toContain('ne baisse plus');
  });

  it('revient en arrière quand la semaine suivante est digérée', () => {
    const afterHard = applyCheckIn(program, {
      week: 0,
      date: '2026-10-26',
      feel: 'dur',
      fatigue: 5,
      done: 0,
      planned: 3,
    });
    const afterEasy = applyCheckIn(afterHard, {
      week: 1,
      date: '2026-11-02',
      feel: 'facile',
      fatigue: 1,
      done: 3,
      planned: 3,
    });

    expect(afterHard.weeks[2]?.minutes).toBeLessThan(program.weeks[2]?.minutes ?? 0);
    expect(afterEasy.weeks[2]?.minutes).toBeGreaterThan(afterHard.weeks[2]?.minutes ?? 0);

    // La séance soutenue revient : elle n'a pas été rétrogradée à vie.
    expect((afterHard.weeks[2]?.sessions ?? []).map((session) => session.intensity)).toContain(
      'modere',
    );
    expect((afterEasy.weeks[2]?.sessions ?? []).map((session) => session.intensity)).toContain(
      'soutenu',
    );
  });

  it('ne réécrit pas le résumé d’un point plus tard', () => {
    const hard = (week: number, date: string) => ({
      week,
      date,
      feel: 'dur' as const,
      fatigue: 5,
      done: 0,
      planned: 3,
    });

    const two = applyCheckIn(
      applyCheckIn(program, hard(0, '2026-10-26')),
      hard(1, '2026-11-02'),
    );

    expect(two.checkIns[0]?.summary).toBe('Semaine allégée de 15 % : la fatigue est haute.');
    expect(two.checkIns[1]?.summary).toContain('Plancher');
  });

  it('ne compte qu’une fois un point rejoué', () => {
    const point = {
      week: 0,
      date: '2026-10-26',
      feel: 'dur' as const,
      fatigue: 5,
      done: 1,
      planned: 3,
    };
    const once = applyCheckIn(program, point);
    const twice = applyCheckIn(once, point);

    expect(twice.checkIns).toHaveLength(1);
    expect(twice.weeks).toEqual(once.weeks);
  });

  it('laisse le plan intact quand le point garde le cap', () => {
    const next = applyCheckIn(program, {
      week: 1,
      date: '2026-10-26',
      feel: 'juste',
      fatigue: 3,
      done: 3,
      planned: 3,
    });
    expect(next.weeks).toEqual(program.weeks);
  });
});
