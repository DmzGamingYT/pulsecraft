import { describe, expect, it } from 'vitest';
import { DEFAULT_GOALS, DEFAULT_PROFILE, type Workout } from '../types';
import { buildExport, exportSummary, parseExport, workoutsCsv } from './export';

const workout: Workout = {
  id: 'w1',
  date: '2026-05-04',
  time: '07:30',
  type: 'Course',
  durationMin: 45,
  distanceKm: 8,
  rpe: 6,
  notes: 'Sortie avec "côte"; vent',
  source: 'manuel',
};

const bundle = buildExport({
  profile: DEFAULT_PROFILE,
  goals: DEFAULT_GOALS,
  workouts: [workout],
  sleeps: [],
  body: [],
  meals: [],
  days: { '2026-05-04': { steps: 8_000 } },
});

describe('sauvegarde Battement', () => {
  it('relit une sauvegarde exportée', () => {
    const parsed = parseExport(JSON.stringify(bundle));
    expect(parsed.app).toBe('Battement');
    expect(parsed.workouts).toHaveLength(1);
    expect(parsed.workouts[0]?.distanceKm).toBe(8);
    expect(parsed.days['2026-05-04']?.steps).toBe(8_000);
    expect(parsed.profile.name).toBe(DEFAULT_PROFILE.name);
  });

  it('refuse un JSON invalide ou un fichier étranger', () => {
    expect(() => parseExport('{')).toThrow(/JSON/);
    expect(() => parseExport('{"app":"Autre"}')).toThrow(/Battement/);
    expect(() => parseExport('null')).toThrow();
  });

  it('refuse une sauvegarde incomplète', () => {
    const { workouts: _workouts, ...withoutWorkouts } = bundle;
    expect(() => parseExport(JSON.stringify(withoutWorkouts))).toThrow(/séances/);
  });

  it('tolère une sauvegarde sans repas ni pas', () => {
    const { meals: _meals, days: _days, ...minimal } = bundle;
    const parsed = parseExport(JSON.stringify(minimal));
    expect(parsed.meals).toEqual([]);
    expect(parsed.days).toEqual({});
  });

  it('résume ce qui va être restauré', () => {
    expect(exportSummary(bundle)).toBe('1 séance · 0 nuit · 0 mesure · 0 repas');
  });

  it('échappe le CSV pour Excel en français', () => {
    const csv = workoutsCsv([workout]);
    expect(csv.startsWith('\uFEFFdate;heure;type')).toBe(true);
    expect(csv).toContain('"Sortie avec ""côte""; vent"');
    expect(csv).toContain('Course;45;8;');
  });
});
