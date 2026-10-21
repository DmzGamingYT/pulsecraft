import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  Activity,
  DayLog,
  DraftActivity,
  ImportSummary,
  ParsedImport,
  Sport,
} from './types';
import { SPORTS } from './types';
import { makeDemoData } from './lib/demo';
import {
  applyCheckIn,
  buildProfile,
  buildProgram,
  type Answers,
  type CheckIn,
  type Program,
} from './lib/coach';
import { idbStorage } from './lib/idbStorage';
import type { ParsedBackup } from './lib/backup';

export type Theme = 'light' | 'dark';

export interface Settings {
  theme: Theme;
  /** Objectif hebdomadaire de minutes actives. */
  goalMin: number;
  /** Objectif quotidien de pas, pour la jauge de la journée. */
  stepGoal: number;
  /** Séances visées par semaine ; 0 = aucun objectif. */
  sessionsGoal: number;
  /** Distance visée par semaine, en km ; 0 = aucun objectif. */
  distanceGoalKm: number;
  /** Minutes visées par semaine et par discipline. */
  sportGoals: Partial<Record<Sport, number>>;
  /** FC max de référence pour les zones ; 0 = déduite du journal. */
  maxHr: number;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  goalMin: 150,
  stepGoal: 8000,
  sessionsGoal: 3,
  distanceGoalKm: 0,
  sportGoals: {},
  maxHr: 0,
};

interface JournalState {
  activities: Activity[];
  days: DayLog[];
  settings: Settings;
  demo: boolean;
  /** le programme du coach, calculé localement ; `null` avant le premier plan */
  program: Program | null;
  /** les dates des séances du plan marquées faites */
  programDone: string[];
  /** le journal a fini de se relire depuis IndexedDB */
  hydrated: boolean;
  setHydrated: () => void;

  startProgram: (answers: Answers) => void;
  startNextCycle: () => void;
  toggleProgramSession: (date: string) => void;
  recordCheckIn: (checkIn: CheckIn) => void;
  stopProgram: () => void;

  setTheme: (theme: Theme) => void;
  setGoal: (goalMin: number) => void;
  setStepGoal: (stepGoal: number) => void;
  setSessionsGoal: (sessions: number) => void;
  setDistanceGoal: (km: number) => void;
  setSportGoal: (sport: Sport, minutes: number) => void;
  setMaxHr: (bpm: number) => void;

  addActivity: (draft: DraftActivity) => void;
  updateActivity: (id: string, patch: Partial<DraftActivity>) => void;
  duplicateActivity: (id: string) => void;
  deleteActivity: (id: string) => void;
  restoreActivities: (activities: Activity[]) => void;
  removeActivities: (ids: string[]) => void;
  mergeActivities: (ids: string[]) => void;
  setDayLog: (date: string, patch: Partial<Omit<DayLog, 'date'>>) => void;

  importParsed: (parsed: ParsedImport) => ImportSummary;
  importBackup: (backup: ParsedBackup) => { activities: number; days: number };
  loadDemo: () => void;
  clearAll: () => void;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sortActivities(activities: Activity[]): Activity[] {
  return [...activities].sort((a, b) => b.date.localeCompare(a.date));
}

function maxDefined(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.max(a, b);
}

function mergeDays(current: DayLog[], incoming: DayLog[]): { days: DayLog[]; changed: number } {
  const byDate = new Map(current.map((day) => [day.date, day]));
  let changed = 0;

  for (const log of incoming) {
    const existing = byDate.get(log.date);
    if (!existing) {
      byDate.set(log.date, { ...log });
      changed += 1;
      continue;
    }
    // On garde le maximum : réimporter le même export ne gonfle pas les pas,
    // et deux sources ne s'additionnent pas pour une même journée. La FC de
    // repos et le VO2 max, eux, viennent de la dernière source qui les donne.
    const next: DayLog = {
      date: log.date,
      steps: Math.max(existing.steps ?? 0, log.steps ?? 0) || undefined,
      activeCalories:
        Math.max(existing.activeCalories ?? 0, log.activeCalories ?? 0) || undefined,
      sleepMin: Math.max(existing.sleepMin ?? 0, log.sleepMin ?? 0) || undefined,
      restingHr: log.restingHr ?? existing.restingHr,
      vo2max: maxDefined(existing.vo2max, log.vo2max),
    };
    if (
      next.steps !== existing.steps ||
      next.activeCalories !== existing.activeCalories ||
      next.sleepMin !== existing.sleepMin ||
      next.restingHr !== existing.restingHr ||
      next.vo2max !== existing.vo2max
    ) {
      byDate.set(log.date, next);
      changed += 1;
    }
  }

  return {
    days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    changed,
  };
}

/** Les réglages d'une sauvegarde, sans laisser passer n'importe quoi. */
function readSettings(raw: Record<string, unknown> | null): Partial<Settings> | null {
  if (!raw) return null;
  const settings: Partial<Settings> = {};
  if (raw.theme === 'light' || raw.theme === 'dark') settings.theme = raw.theme;
  for (const key of ['goalMin', 'stepGoal', 'sessionsGoal', 'distanceGoalKm', 'maxHr'] as const) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) settings[key] = value;
  }
  if (typeof raw.sportGoals === 'object' && raw.sportGoals !== null) {
    const goals: Partial<Record<Sport, number>> = {};
    for (const sport of SPORTS) {
      const value = (raw.sportGoals as Record<string, unknown>)[sport.id];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) goals[sport.id] = value;
    }
    settings.sportGoals = goals;
  }
  return settings;
}

export const useJournal = create<JournalState>()(
  persist(
    (set, get) => ({
      activities: [],
      days: [],
      settings: DEFAULT_SETTINGS,
      demo: false,
      program: null,
      programDone: [],
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),

      startProgram: (answers) =>
        set((state) => ({
          program: buildProgram(buildProfile(state.activities, state.days), answers),
          programDone: [],
        })),

      // Un cycle terminé se relance avec les mêmes réponses, mais un profil
      // recalculé : le journal des quatre dernières semaines a changé.
      startNextCycle: () =>
        set((state) => {
          if (!state.program) return {};
          const next = buildProgram(
            buildProfile(state.activities, state.days),
            state.program.answers,
          );
          return {
            program: { ...next, cycle: (state.program.cycle ?? 1) + 1 },
            programDone: [],
          };
        }),

      toggleProgramSession: (date) =>
        set((state) => ({
          programDone: state.programDone.includes(date)
            ? state.programDone.filter((entry) => entry !== date)
            : [...state.programDone, date],
        })),

      // Le point de suivi ne réécrit jamais les semaines passées : seules les
      // séances à venir bougent, et le journal garde la trace de la décision.
      recordCheckIn: (checkIn) =>
        set((state) => ({
          program: state.program ? applyCheckIn(state.program, checkIn) : null,
        })),

      stopProgram: () => set({ program: null, programDone: [] }),

      setTheme: (theme) => set((state) => ({ settings: { ...state.settings, theme } })),
      setGoal: (goalMin) =>
        set((state) => ({
          settings: { ...state.settings, goalMin: Math.max(30, Math.min(900, Math.round(goalMin))) },
        })),
      setStepGoal: (stepGoal) =>
        set((state) => ({
          settings: {
            ...state.settings,
            stepGoal: Math.max(1000, Math.min(50_000, Math.round(stepGoal))),
          },
        })),
      setSessionsGoal: (sessions) =>
        set((state) => ({
          settings: {
            ...state.settings,
            sessionsGoal: Math.max(0, Math.min(14, Math.round(sessions))),
          },
        })),
      setDistanceGoal: (km) =>
        set((state) => ({
          settings: {
            ...state.settings,
            distanceGoalKm: Math.max(0, Math.min(500, Math.round(km))),
          },
        })),
      setSportGoal: (sport, minutes) =>
        set((state) => {
          const sportGoals = { ...state.settings.sportGoals };
          if (minutes > 0) sportGoals[sport] = Math.max(15, Math.min(900, Math.round(minutes)));
          else delete sportGoals[sport];
          return { settings: { ...state.settings, sportGoals } };
        }),
      setMaxHr: (bpm) =>
        set((state) => ({
          settings: {
            ...state.settings,
            maxHr: Math.max(0, Math.min(230, Math.round(bpm))),
          },
        })),

      addActivity: (draft) =>
        set((state) => {
          // Une séance réelle remplace la démonstration : on ne mélange pas un
          // journal d'exemple avec les données de l'utilisateur.
          const base = state.demo ? [] : state.activities;
          return {
            activities: sortActivities([{ ...draft, id: newId() }, ...base]),
            days: state.demo ? [] : state.days,
            demo: false,
          };
        }),

      updateActivity: (id, patch) =>
        set((state) => ({
          activities: sortActivities(
            state.activities.map((activity) =>
              activity.id === id ? { ...activity, ...patch, id: activity.id } : activity,
            ),
          ),
        })),

      duplicateActivity: (id) =>
        set((state) => {
          const source = state.activities.find((activity) => activity.id === id);
          if (!source) return {};
          const copy: Activity = {
            ...source,
            id: newId(),
            title: source.title ? `${source.title} (copie)` : 'Copie',
            // Une copie est une séance neuve : elle ne doit pas bloquer un
            // futur import derrière l'identifiant de la source.
            externalId: undefined,
          };
          return { activities: sortActivities([copy, ...state.activities]) };
        }),

      deleteActivity: (id) =>
        set((state) => ({ activities: state.activities.filter((activity) => activity.id !== id) })),

      // L'annulation d'une suppression remet la séance telle quelle.
      restoreActivities: (restored) =>
        set((state) => {
          const known = new Set(state.activities.map((activity) => activity.id));
          const added = restored.filter((activity) => !known.has(activity.id));
          return { activities: sortActivities([...added, ...state.activities]) };
        }),

      removeActivities: (ids) =>
        set((state) => {
          const remove = new Set(ids);
          return { activities: state.activities.filter((activity) => !remove.has(activity.id)) };
        }),

      /**
       * Fusionne des doublons (une séance manuelle et son import, par exemple).
       * La ligne importée sert de base — elle a l'identifiant de source — et on
       * complète ses trous avec les autres, sans additionner deux fois.
       */
      mergeActivities: (ids) =>
        set((state) => {
          const chosen = ids
            .map((id) => state.activities.find((activity) => activity.id === id))
            .filter((activity): activity is Activity => Boolean(activity));
          if (chosen.length < 2) return {};
          const base = chosen.find((activity) => activity.externalId) ?? chosen[0]!;
          const merged: Activity = { ...base };
          for (const other of chosen) {
            merged.durationMin = Math.max(merged.durationMin, other.durationMin);
            merged.distanceKm = maxDefined(merged.distanceKm, other.distanceKm);
            merged.elevationM = maxDefined(merged.elevationM, other.elevationM);
            merged.calories = maxDefined(merged.calories, other.calories);
            merged.maxHr = maxDefined(merged.maxHr, other.maxHr);
            merged.avgHr = merged.avgHr ?? other.avgHr;
            merged.rpe = merged.rpe ?? other.rpe;
            merged.notes = merged.notes ?? other.notes;
            merged.route = merged.route ?? other.route;
            merged.title = merged.title ?? other.title;
            merged.externalId = merged.externalId ?? other.externalId;
          }
          const remove = new Set(ids);
          return {
            activities: sortActivities([
              merged,
              ...state.activities.filter((activity) => !remove.has(activity.id)),
            ]),
          };
        }),

      setDayLog: (date, patch) =>
        set((state) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return {};
          const byDate = new Map(state.days.map((day) => [day.date, day]));
          const existing = byDate.get(date) ?? { date };
          const next: DayLog = { ...existing, ...patch, date };
          const empty =
            next.steps === undefined &&
            next.activeCalories === undefined &&
            next.sleepMin === undefined &&
            next.restingHr === undefined &&
            next.vo2max === undefined;
          if (empty) byDate.delete(date);
          else byDate.set(date, next);
          return { days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) };
        }),

      importParsed: (parsed) => {
        const state = get();
        // Le premier import remplace la démonstration, il ne s'y ajoute pas.
        const currentActivities = state.demo ? [] : state.activities;
        const currentDays = state.demo ? [] : state.days;
        const known = new Set(
          currentActivities.map((activity) => activity.externalId).filter(Boolean) as string[],
        );
        const added: Activity[] = [];
        let skipped = 0;

        for (const draft of parsed.activities) {
          if (draft.externalId && known.has(draft.externalId)) {
            skipped += 1;
            continue;
          }
          if (draft.externalId) known.add(draft.externalId);
          added.push({ ...draft, id: newId() });
        }

        const merged = mergeDays(currentDays, parsed.days);

        set({
          activities: sortActivities([...added, ...currentActivities]),
          days: merged.days,
          demo: false,
          // Un import sur un journal de démonstration ne doit pas laisser le
          // plan calculé sur ces données d'exemple.
          program: state.demo ? null : state.program,
          programDone: state.demo ? [] : state.programDone,
        });

        return {
          activities: added.length,
          days: merged.changed,
          skipped,
          warnings: parsed.warnings,
          routes: added.filter((activity) => Boolean(activity.route)).length,
          sleepNights: merged.days.filter((day) => day.sleepMin !== undefined).length,
        };
      },

      importBackup: (backup) => {
        const current = get();
        set({
          activities: sortActivities(backup.activities),
          days: [...backup.days].sort((a, b) => a.date.localeCompare(b.date)),
          settings: { ...current.settings, ...(readSettings(backup.settings) ?? {}) },
          program: backup.program,
          programDone: backup.programDone,
          demo: false,
        });
        return { activities: backup.activities.length, days: backup.days.length };
      },

      loadDemo: () => {
        const demo = makeDemoData();
        set({
          activities: demo.activities,
          days: demo.days,
          demo: true,
          program: null,
          programDone: [],
        });
      },

      clearAll: () =>
        set({
          activities: [],
          days: [],
          demo: false,
          program: null,
          programDone: [],
        }),
    }),
    {
      name: 'battement.v1',
      version: 4,
      storage: createJSONStorage(() => idbStorage),
      // v1 → v2 : l'objectif de pas est apparu après la première version.
      // v2 → v3 : le programme du coach, absent des journaux précédents.
      // v3 → v4 : objectifs de séances/distance/disciplines, FC max, RPE,
      // tracés, sommeil, et persistance IndexedDB.
      migrate: (persisted) => {
        const saved = (persisted ?? {}) as Partial<JournalState>;
        return {
          ...saved,
          settings: {
            ...DEFAULT_SETTINGS,
            ...saved.settings,
            sportGoals: { ...(saved.settings?.sportGoals ?? {}) },
          },
          program: saved.program ? { ...saved.program, cycle: saved.program.cycle ?? 1 } : null,
          programDone: saved.programDone ?? [],
        } as JournalState;
      },
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<JournalState>;
        return {
          ...current,
          ...saved,
          settings: {
            ...DEFAULT_SETTINGS,
            ...current.settings,
            ...saved.settings,
            sportGoals: {
              ...(current.settings.sportGoals ?? {}),
              ...(saved.settings?.sportGoals ?? {}),
            },
          },
          program: saved.program ?? null,
          programDone: saved.programDone ?? [],
          hydrated: current.hydrated,
        };
      },
      // La relecture est asynchrone : l'interface attend ce drapeau avant
      // d'afficher un journal vide ou de charger la démonstration.
      onRehydrateStorage: () => () => {
        useJournal.setState({ hydrated: true });
      },
      partialize: (state) => ({
        activities: state.activities,
        days: state.days,
        settings: state.settings,
        demo: state.demo,
        program: state.program,
        programDone: state.programDone,
      }),
    },
  ),
);

export function isEmptyJournal(state: Pick<JournalState, 'activities' | 'days'>): boolean {
  return state.activities.length === 0 && state.days.length === 0;
}
