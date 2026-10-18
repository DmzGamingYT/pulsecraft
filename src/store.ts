/**
 * État global de PulseCraft, persisté dans IndexedDB.
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
  Profile,
  Settings,
  SleepEntry,
  Source,
  TrainingPlan,
  Workout,
} from './types';
import { DEFAULT_GOALS, DEFAULT_PROFILE, DEFAULT_SETTINGS } from './types';
import { todayISO } from './lib/dates';
import { makeDemoData } from './lib/demo';
import { newId } from './lib/id';
import { idbStorage } from './lib/idbStorage';
import { togglePlanSession } from './lib/plan';

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
  onboardingDone: boolean;

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
  completeOnboarding: (payload: {
    intake: PlanIntake;
    plan: TrainingPlan;
    profile?: Partial<Profile>;
    goals?: Partial<Goals>;
  }) => void;
  skipOnboarding: () => void;
  toggleTrainingSession: (weekIndex: number, sessionId: string, done: boolean) => void;
  resetTrainingPlan: () => void;
  importData: (payload: ImportPayload, options?: { real?: boolean }) => ImportSummary;
  loadDemo: () => void;
  resetData: () => void;
  clearEverything: () => void;
}

const byDateDesc = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? 1 : -1);

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
      onboardingDone: false,

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

      completeOnboarding: ({ intake, plan, profile, goals }) =>
        set((state) => ({
          intake,
          trainingPlan: plan,
          onboardingDone: true,
          profile: { ...state.profile, ...profile },
          goals: {
            ...state.goals,
            sleepHours: intake.sleepHours,
            ...(intake.targetWeightKg ? { weightKg: intake.targetWeightKg } : {}),
            ...goals,
          },
        })),

      skipOnboarding: () => set({ onboardingDone: true }),

      toggleTrainingSession: (weekIndex, sessionId, done) =>
        set((state) => {
          if (!state.trainingPlan) return {};
          const session = state.trainingPlan.weeks
            .find((week) => week.index === weekIndex)
            ?.sessions.find((item) => item.id === sessionId);
          if (!session) return {};

          const externalId = `plan:${state.trainingPlan.createdAt}:${sessionId}`;
          let workouts = state.workouts;

          if (done && session.type !== 'Repos' && session.type !== 'Mobilité') {
            if (!workouts.some((item) => item.externalId === externalId)) {
              workouts = [
                ...workouts,
                {
                  id: newId('w'),
                  date: todayISO(),
                  type: session.type,
                  durationMin: session.minutes,
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
          };
        }),

      resetTrainingPlan: () => set({ trainingPlan: null, intake: null }),

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
        });
      },

      resetData: () =>
        set({
          demo: false,
          workouts: [],
          sleeps: [],
          body: [],
          meals: [],
          days: {},
          chat: [],
          plan: null,
        }),

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
          onboardingDone: false,
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
        onboardingDone: state.onboardingDone,
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
