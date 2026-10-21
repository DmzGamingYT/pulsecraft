import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Activity,
  DayLog,
  DraftActivity,
  ImportSummary,
  ParsedImport,
} from './types';
import { makeDemoData } from './lib/demo';

export type Theme = 'light' | 'dark';

interface Settings {
  theme: Theme;
  /** Objectif hebdomadaire de minutes actives. */
  goalMin: number;
  /** Objectif quotidien de pas, pour la jauge de la journée. */
  stepGoal: number;
}

interface JournalState {
  activities: Activity[];
  days: DayLog[];
  settings: Settings;
  demo: boolean;
  setTheme: (theme: Theme) => void;
  setGoal: (goalMin: number) => void;
  setStepGoal: (stepGoal: number) => void;
  addActivity: (draft: DraftActivity) => void;
  deleteActivity: (id: string) => void;
  importParsed: (parsed: ParsedImport) => ImportSummary;
  loadDemo: () => void;
  clearAll: () => void;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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
    // et deux sources ne s'additionnent pas pour une même journée.
    const next: DayLog = {
      date: log.date,
      steps: Math.max(existing.steps ?? 0, log.steps ?? 0) || undefined,
      activeCalories:
        Math.max(existing.activeCalories ?? 0, log.activeCalories ?? 0) || undefined,
    };
    if (next.steps !== existing.steps || next.activeCalories !== existing.activeCalories) {
      byDate.set(log.date, next);
      changed += 1;
    }
  }

  return {
    days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    changed,
  };
}

export const useJournal = create<JournalState>()(
  persist(
    (set, get) => ({
      activities: [],
      days: [],
      settings: { theme: 'light', goalMin: 150, stepGoal: 8000 },
      demo: false,

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

      addActivity: (draft) =>
        set((state) => {
          // Une séance réelle remplace la démonstration : on ne mélange pas un
          // journal d'exemple avec les données de l'utilisateur.
          const base = state.demo ? [] : state.activities;
          return {
            activities: [{ ...draft, id: newId() }, ...base].sort((a, b) =>
              b.date.localeCompare(a.date),
            ),
            days: state.demo ? [] : state.days,
            demo: false,
          };
        }),

      deleteActivity: (id) =>
        set((state) => ({ activities: state.activities.filter((activity) => activity.id !== id) })),

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
          activities: [...added, ...currentActivities].sort((a, b) => b.date.localeCompare(a.date)),
          days: merged.days,
          demo: false,
        });

        return {
          activities: added.length,
          days: merged.changed,
          skipped,
          warnings: parsed.warnings,
        };
      },

      loadDemo: () => {
        const demo = makeDemoData();
        set({ activities: demo.activities, days: demo.days, demo: true });
      },

      clearAll: () => set({ activities: [], days: [], demo: false }),
    }),
    {
      name: 'battement.v1',
      version: 2,
      // v1 → v2 : l'objectif de pas est apparu après la première version.
      migrate: (persisted) => {
        const saved = (persisted ?? {}) as Partial<JournalState>;
        return {
          ...saved,
          settings: {
            theme: saved.settings?.theme ?? 'light',
            goalMin: saved.settings?.goalMin ?? 150,
            stepGoal: saved.settings?.stepGoal ?? 8000,
          },
        } as JournalState;
      },
      // Et pour un état déjà en v2 mais incomplet (réglages futurs), on
      // complète avec les valeurs courantes au lieu de laisser des trous.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<JournalState>;
        return {
          ...current,
          ...saved,
          settings: { ...current.settings, ...saved.settings },
        };
      },
      partialize: (state) => ({
        activities: state.activities,
        days: state.days,
        settings: state.settings,
        demo: state.demo,
      }),
    },
  ),
);

export function isEmptyJournal(state: Pick<JournalState, 'activities' | 'days'>): boolean {
  return state.activities.length === 0 && state.days.length === 0;
}
