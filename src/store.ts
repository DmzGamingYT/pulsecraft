/**
 * État global de Battement, persisté dans IndexedDB.
 *
 * Aucun compte, aucun serveur : chaque action écrit localement. Les données
 * d'exemple portent `demo: true` et un badge visible ; un import réel remplace
 * la démo au lieu de s'y mélanger.
 */

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  BodyEntry,
  ChatMessage,
  CoachPlan,
  DayLog,
  Goals,
  ImportPayload,
  Meal,
  PlanIntake,
  PlanSession,
  Profile,
  SessionRun,
  Settings,
  SleepEntry,
  Source,
  TrainingPlan,
  Workout,
} from './types';
import { DEFAULT_GOALS, DEFAULT_PROFILE, DEFAULT_SETTINGS } from './types';
import { addDays, todayISO } from './lib/dates';
import { makeDemoData } from './lib/demo';
import { newId } from './lib/id';
import { idbStorage } from './lib/idbStorage';
import { togglePlanSession } from './lib/plan';
import { buildMonthlyProgram, nextMonthlyProgram } from './lib/monthly';
import type { ExportBundle } from './lib/export';

export type WorkoutInput = Omit<Workout, 'id' | 'source'> & {
  source?: Source;
  externalId?: string;
};
export type SleepInput = Omit<SleepEntry, 'id' | 'source'> & { source?: Source };
export type BodyInput = Omit<BodyEntry, 'id' | 'source'> & { source?: Source };
export type MealInput = Omit<Meal, 'id'>;

export interface ImportSummary {
  workouts: number;
  sleeps: number;
  body: number;
}

interface PulseState {
  demo: boolean;
  profile: Profile;
  goals: Goals;
  settings: Settings;
  workouts: Workout[];
  sleeps: SleepEntry[];
  body: BodyEntry[];
  meals: Meal[];
  days: Record<string, DayLog>;
  chat: ChatMessage[];
  /** Plan de la semaine rédigé par le coach (texte). */
  plan: CoachPlan | null;
  /** Programme long terme structuré, issu du bilan de démarrage. */
  trainingPlan: TrainingPlan | null;
  intake: PlanIntake | null;
  /** Séance guidée en cours, reprise après fermeture ou rechargement. */
  sessionRun: SessionRun | null;
  onboardingDone: boolean;
  /** Le plan a été effacé volontairement : ne pas réinstaller le mois tout seul. */
  planDismissed: boolean;

  addWorkout: (input: WorkoutInput) => void;
  removeWorkout: (id: string) => void;
  addSleep: (input: SleepInput) => void;
  removeSleep: (id: string) => void;
  addBody: (input: BodyInput) => void;
  removeBody: (id: string) => void;
  addMeal: (input: MealInput) => void;
  removeMeal: (id: string) => void;
  addWater: (milliliters: number) => void;
  updateDay: (date: string, patch: DayLog) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  updateGoals: (patch: Partial<Goals>) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  addChat: (message: Omit<ChatMessage, 'id' | 'at'>) => void;
  clearChat: () => void;
  setPlan: (plan: CoachPlan | null) => void;
  setTrainingPlan: (plan: TrainingPlan | null) => void;
  /** Remplace le plan après un ajustement, en gardant l'objectif d'entraînement à jour. */
  applyTrainingPlan: (plan: TrainingPlan) => void;
  /** Installe le programme du mois s'il n'y a encore aucun plan. */
  ensureMonthlyProgram: () => void;
  /** (Ré)installe le programme du mois, premier bloc, à partir d'aujourd'hui. */
  installMonthlyProgram: () => void;
  /** Enchaîne le mois suivant du programme du mois. */
  rollMonthlyProgram: () => void;
  /** Restaure une sauvegarde JSON exportée par l'app (remplace le journal). */
  restoreExport: (bundle: ExportBundle) => void;
  completeOnboarding: (payload: {
    intake: PlanIntake;
    plan: TrainingPlan;
    profile?: Partial<Profile>;
    goals?: Partial<Goals>;
  }) => void;
  skipOnboarding: () => void;
  toggleTrainingSession: (
    weekIndex: number,
    sessionId: string,
    done: boolean,
    durationMin?: number
  ) => void;
  startSessionRun: (planCreatedAt: string, weekIndex: number, session: PlanSession) => void;
  setExerciseSets: (exerciseIndex: number, count: number) => void;
  startRest: (seconds: number, exerciseIndex: number) => void;
  extendRest: (seconds: number) => void;
  clearRest: () => void;
  finishSessionRun: (durationMin: number) => void;
  discardSessionRun: () => void;
  resetTrainingPlan: () => void;
  importData: (payload: ImportPayload, options?: { real?: boolean }) => ImportSummary;
  loadDemo: () => void;
  resetData: () => void;
  clearEverything: () => void;
}

const byDateDesc = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? 1 : -1);

/**
 * Le journal est effacé ou remplacé : les séances du plan ne peuvent plus
 * rester cochées, sinon le plan affiche des séances faites sans séance source.
 */
function clearPlanProgress(plan: TrainingPlan | null): TrainingPlan | null {
  if (!plan) return plan;
  return {
    ...plan,
    weeks: plan.weeks.map((week) => ({
      ...week,
      sessions: week.sessions.map((session) => ({ ...session, doneAt: undefined })),
    })),
  };
}

function mergeWorkouts(existing: Workout[], incoming: Workout[]): { items: Workout[]; added: number } {
  const key = (w: Workout) =>
    w.externalId ?? `${w.date}|${w.type}|${Math.round(w.durationMin)}|${w.distanceKm ?? ''}`;
  const map = new Map(existing.map((item) => [key(item), item]));
  let added = 0;
  for (const item of incoming) {
    const id = key(item);
    if (!map.has(id)) {
      map.set(id, item);
      added += 1;
    }
  }
  return { items: [...map.values()].sort(byDateDesc), added };
}

function mergeSleeps(existing: SleepEntry[], incoming: SleepEntry[]): { items: SleepEntry[]; added: number } {
  const map = new Map(existing.map((item) => [item.date, item]));
  let added = 0;
  for (const item of incoming) {
    if (!map.has(item.date)) added += 1;
    map.set(item.date, item);
  }
  return { items: [...map.values()].sort(byDateDesc), added };
}

function mergeBody(existing: BodyEntry[], incoming: BodyEntry[]): { items: BodyEntry[]; added: number } {
  const key = (entry: BodyEntry) =>
    `${entry.date}|${entry.weightKg ?? ''}|${entry.bodyFatPct ?? ''}|${entry.muscleKg ?? ''}`;
  const map = new Map(existing.map((item) => [key(item), item]));
  let added = 0;
  for (const item of incoming) {
    const id = key(item);
    if (!map.has(id)) {
      map.set(id, item);
      added += 1;
    }
  }
  return { items: [...map.values()].sort(byDateDesc), added };
}

export const usePulse = create<PulseState>()(
  persist(
    (set, get) => ({
      demo: false,
      profile: DEFAULT_PROFILE,
      goals: DEFAULT_GOALS,
      settings: DEFAULT_SETTINGS,
      workouts: [],
      sleeps: [],
      body: [],
      meals: [],
      days: {},
      chat: [],
      plan: null,
      trainingPlan: null,
      intake: null,
      sessionRun: null,
      onboardingDone: false,
      planDismissed: false,

      addWorkout: (input) =>
        set((state) => ({
          workouts: [
            ...state.workouts,
            {
              ...input,
              id: newId('w'),
              source: input.source ?? 'manuel',
            },
          ].sort(byDateDesc),
        })),

      removeWorkout: (id) =>
        set((state) => ({ workouts: state.workouts.filter((item) => item.id !== id) })),

      addSleep: (input) =>
        set((state) => {
          const entry: SleepEntry = { ...input, id: newId('s'), source: input.source ?? 'manuel' };
          return {
            sleeps: [entry, ...state.sleeps.filter((item) => item.date !== entry.date)].sort(
              byDateDesc
            ),
          };
        }),

      removeSleep: (id) =>
        set((state) => ({ sleeps: state.sleeps.filter((item) => item.id !== id) })),

      addBody: (input) =>
        set((state) => ({
          body: [
            ...state.body,
            { ...input, id: newId('b'), source: input.source ?? 'manuel' },
          ].sort(byDateDesc),
        })),

      removeBody: (id) => set((state) => ({ body: state.body.filter((item) => item.id !== id) })),

      addMeal: (input) =>
        set((state) => ({
          meals: [...state.meals, { ...input, id: newId('m') }].sort(byDateDesc),
        })),

      removeMeal: (id) => set((state) => ({ meals: state.meals.filter((item) => item.id !== id) })),

      addWater: (milliliters) =>
        set((state) => {
          const today = todayISO();
          const current = state.days[today]?.waterMl ?? 0;
          const next = Math.max(0, Math.min(10_000, current + milliliters));
          return {
            days: { ...state.days, [today]: { ...state.days[today], waterMl: next } },
          };
        }),

      updateDay: (date, patch) =>
        set((state) => ({
          days: { ...state.days, [date]: { ...state.days[date], ...patch } },
        })),

      updateProfile: (patch) =>
        set((state) => ({ profile: { ...state.profile, ...patch } })),

      updateGoals: (patch) => set((state) => ({ goals: { ...state.goals, ...patch } })),

      updateSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),

      addChat: (message) =>
        set((state) => ({
          chat: [
            ...state.chat,
            { ...message, id: newId('c'), at: new Date().toISOString() },
          ].slice(-40),
        })),

      clearChat: () => set({ chat: [] }),

      setPlan: (plan) => set({ plan }),

      setTrainingPlan: (trainingPlan) => set({ trainingPlan }),

      applyTrainingPlan: (trainingPlan) =>
        set((state) => ({
          trainingPlan,
          intake: trainingPlan.intake,
          planDismissed: false,
          goals: { ...state.goals, exerciseMin: trainingPlan.intake.sessionMin },
          // Une séance guidée liée à l'ancien plan ne doit pas reprendre.
          sessionRun: null,
        })),

      ensureMonthlyProgram: () => {
        // Un plan effacé à la main ne revient pas au rechargement suivant.
        if (get().trainingPlan || get().planDismissed) return;
        get().applyTrainingPlan(buildMonthlyProgram());
      },

      installMonthlyProgram: () => get().applyTrainingPlan(buildMonthlyProgram()),

      restoreExport: (bundle) =>
        set({
          demo: false,
          profile: { ...DEFAULT_PROFILE, ...bundle.profile },
          goals: { ...DEFAULT_GOALS, ...bundle.goals },
          workouts: [...bundle.workouts].sort(byDateDesc),
          sleeps: [...bundle.sleeps].sort(byDateDesc),
          body: [...bundle.body].sort(byDateDesc),
          meals: [...bundle.meals].sort(byDateDesc),
          days: bundle.days,
          chat: [],
          plan: null,
          sessionRun: null,
          // Le plan d'entraînement n'est pas dans la sauvegarde : il reste en
          // place, mais son historique de cases cochées est remis à zéro.
          trainingPlan: clearPlanProgress(get().trainingPlan),
        }),

      rollMonthlyProgram: () => {
        const current = get().trainingPlan;
        if (!current || current.preset !== 'monthly-muscle') return;
        get().applyTrainingPlan(nextMonthlyProgram(current));
      },

      completeOnboarding: ({ intake, plan, profile, goals }) =>
        set((state) => ({
          intake,
          trainingPlan: plan,
          onboardingDone: true,
          planDismissed: false,
          sessionRun: null,
          profile: { ...state.profile, ...profile },
          goals: {
            ...state.goals,
            sleepHours: intake.sleepHours,
            ...(intake.targetWeightKg ? { weightKg: intake.targetWeightKg } : {}),
            ...goals,
          },
        })),

      skipOnboarding: () => set({ onboardingDone: true }),

      toggleTrainingSession: (weekIndex, sessionId, done, durationMin) =>
        set((state) => {
          if (!state.trainingPlan) return {};
          const week = state.trainingPlan.weeks.find((item) => item.index === weekIndex);
          const session = week?.sessions.find((item) => item.id === sessionId);
          if (!session) return {};

          // La séance entre dans le journal à SA date, pas à celle du jour :
          // cocher mercredi un lundi ne doit pas déplacer la séance. Une séance
          // faite en avance est enregistrée aujourd'hui.
          const today = todayISO();
          const scheduled = week ? addDays(week.startDate, session.day) : today;
          const workoutDate = scheduled > today ? today : scheduled;
          const externalId = `plan:${state.trainingPlan.createdAt}:${sessionId}`;
          let workouts = state.workouts;

          if (done && session.type !== 'Repos' && session.type !== 'Mobilité') {
            if (!workouts.some((item) => item.externalId === externalId)) {
              workouts = [
                ...workouts,
                {
                  id: newId('w'),
                  date: workoutDate,
                  type: session.type,
                  durationMin: Math.max(1, Math.round(durationMin ?? session.minutes)),
                  rpe: session.intensity === 'soutenue' ? 8 : session.intensity === 'modérée' ? 6 : 4,
                  notes: `Plan : ${session.title}`,
                  source: 'manuel' as Source,
                  externalId,
                },
              ].sort(byDateDesc);
            }
          } else if (!done) {
            workouts = workouts.filter((item) => item.externalId !== externalId);
          }

          return {
            workouts,
            trainingPlan: togglePlanSession(state.trainingPlan, weekIndex, sessionId, done),
            // Cocher la séance depuis la fiche termine aussi la séance guidée.
            sessionRun:
              done &&
              state.sessionRun?.weekIndex === weekIndex &&
              state.sessionRun.sessionId === sessionId
                ? null
                : state.sessionRun,
          };
        }),

      startSessionRun: (planCreatedAt, weekIndex, session) =>
        set((state) => {
          const current = state.sessionRun;
          if (current) {
            const same =
              current.planCreatedAt === planCreatedAt &&
              current.weekIndex === weekIndex &&
              current.sessionId === session.id;
            // Reprendre la même séance ne la réinitialise pas ; une autre séance
            // du même plan ne l'écrase pas non plus (l'interface propose de la reprendre).
            if (same || current.planCreatedAt === state.trainingPlan?.createdAt) return {};
          }
          return {
            sessionRun: {
              planCreatedAt,
              weekIndex,
              sessionId: session.id,
              startedAt: new Date().toISOString(),
              sets: (session.exercises ?? []).map(() => 0),
            },
          };
        }),

      setExerciseSets: (exerciseIndex, count) =>
        set((state) => {
          if (!state.sessionRun) return {};
          const sets = [...state.sessionRun.sets];
          sets[exerciseIndex] = Math.max(0, count);
          return { sessionRun: { ...state.sessionRun, sets } };
        }),

      startRest: (seconds, exerciseIndex) =>
        set((state) =>
          state.sessionRun
            ? {
                sessionRun: {
                  ...state.sessionRun,
                  restUntil: new Date(Date.now() + seconds * 1000).toISOString(),
                  restExerciseIndex: exerciseIndex,
                },
              }
            : {}
        ),

      extendRest: (seconds) =>
        set((state) => {
          if (!state.sessionRun) return {};
          const until = state.sessionRun.restUntil
            ? Math.max(Date.now(), Date.parse(state.sessionRun.restUntil))
            : Date.now();
          return {
            sessionRun: {
              ...state.sessionRun,
              restUntil: new Date(until + seconds * 1000).toISOString(),
            },
          };
        }),

      clearRest: () =>
        set((state) =>
          state.sessionRun
            ? {
                sessionRun: {
                  ...state.sessionRun,
                  restUntil: undefined,
                  restExerciseIndex: undefined,
                },
              }
            : {}
        ),

      finishSessionRun: (durationMin) => {
        const run = get().sessionRun;
        if (run) {
          get().toggleTrainingSession(run.weekIndex, run.sessionId, true, durationMin);
        }
        set({ sessionRun: null });
      },

      discardSessionRun: () => set({ sessionRun: null }),

      resetTrainingPlan: () =>
        set({ trainingPlan: null, intake: null, sessionRun: null, planDismissed: true }),

      importData: (payload, options) => {
        const state = get();
        // Un import réel remplace les données d'exemple : on ne mélange jamais
        // des séances fictives avec de vraies mesures.
        const base =
          options?.real && state.demo
            ? { workouts: [], sleeps: [], body: [], days: {} }
            : {
                workouts: state.workouts,
                sleeps: state.sleeps,
                body: state.body,
                days: state.days,
              };

        const workouts = mergeWorkouts(base.workouts, payload.workouts ?? []);
        const sleeps = mergeSleeps(base.sleeps, payload.sleeps ?? []);
        const body = mergeBody(base.body, payload.body ?? []);
        const days: Record<string, DayLog> = { ...base.days };
        for (const [date, log] of Object.entries(payload.days ?? {})) {
          days[date] = { ...days[date], ...log };
        }

        set({
          workouts: workouts.items,
          sleeps: sleeps.items,
          body: body.items,
          days,
          ...(options?.real ? { demo: false } : {}),
        });

        return { workouts: workouts.added, sleeps: sleeps.added, body: body.added };
      },

      loadDemo: () => {
        const demo = makeDemoData();
        set({
          demo: true,
          workouts: demo.workouts,
          sleeps: demo.sleeps,
          body: demo.body,
          meals: demo.meals,
          days: demo.days,
          chat: [],
          plan: null,
          sessionRun: null,
        });
      },

      resetData: () =>
        set((state) => ({
          demo: false,
          workouts: [],
          sleeps: [],
          body: [],
          meals: [],
          days: {},
          chat: [],
          plan: null,
          sessionRun: null,
          trainingPlan: clearPlanProgress(state.trainingPlan),
        })),

      clearEverything: () =>
        set({
          demo: false,
          profile: DEFAULT_PROFILE,
          goals: DEFAULT_GOALS,
          settings: DEFAULT_SETTINGS,
          workouts: [],
          sleeps: [],
          body: [],
          meals: [],
          days: {},
          chat: [],
          plan: null,
          trainingPlan: null,
          intake: null,
          sessionRun: null,
          onboardingDone: false,
          planDismissed: false,
        }),
    }),
    {
      name: 'pulsecraft-v1',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        demo: state.demo,
        profile: state.profile,
        goals: state.goals,
        settings: state.settings,
        workouts: state.workouts,
        sleeps: state.sleeps,
        body: state.body,
        meals: state.meals,
        days: state.days,
        chat: state.chat,
        plan: state.plan,
        trainingPlan: state.trainingPlan,
        intake: state.intake,
        sessionRun: state.sessionRun,
        onboardingDone: state.onboardingDone,
        planDismissed: state.planDismissed,
      }),
      // Les états enregistrés avant l'arrivée des fournisseurs IA n'ont pas de
      // bloc `settings.ai` : on le complète au lieu de planter au premier accès.
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<PulseState>;
        return {
          ...current,
          ...stored,
          settings: {
            ...current.settings,
            ...stored.settings,
            ai: { ...current.settings.ai, ...stored.settings?.ai },
          },
        };
      },
    }
  )
);

/** Attend la réhydratation IndexedDB avant d'afficher les chiffres. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => usePulse.persist.hasHydrated());

  useEffect(() => {
    const onFinish = usePulse.persist.onFinishHydration(() => setHydrated(true));
    const onStart = usePulse.persist.onHydrate(() => setHydrated(false));
    if (usePulse.persist.hasHydrated()) setHydrated(true);
    return () => {
      onFinish();
      onStart();
    };
  }, []);

  return hydrated;
}
