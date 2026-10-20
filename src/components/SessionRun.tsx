import { useEffect, useRef, useState } from 'react';
import { usePulse } from '../store';
import { useUi } from '../lib/uiStore';
import { formatTime } from '../lib/dates';
import type { PlanSession } from '../types';
import { Icon } from './Icon';

const INTENSITY: Record<PlanSession['intensity'], string> = {
  faible: 'facile',
  modérée: 'modérée',
  soutenue: 'soutenue',
};

function clock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function setsOf(session: PlanSession | null): number[] {
  return (session?.exercises ?? []).map((exercise) => exercise.sets);
}

/** Séance guidée : les séries se cochent une à une, le repos décompte. */
export function SessionRun() {
  const run = usePulse((state) => state.sessionRun);
  const plan = usePulse((state) => state.trainingPlan);
  const setExerciseSets = usePulse((state) => state.setExerciseSets);
  const startRest = usePulse((state) => state.startRest);
  const extendRest = usePulse((state) => state.extendRest);
  const clearRest = usePulse((state) => state.clearRest);
  const finishSessionRun = usePulse((state) => state.finishSessionRun);
  const discardSessionRun = usePulse((state) => state.discardSessionRun);
  const open = useUi((state) => state.runOpen);
  const closeRun = useUi((state) => state.closeRun);
  const notify = useUi((state) => state.notify);

  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const restNotified = useRef(false);
  const runRef = useRef<HTMLDivElement>(null);
  const restRef = useRef<HTMLDivElement>(null);

  const session =
    plan && run && run.planCreatedAt === plan.createdAt
      ? plan.weeks
          .find((week) => week.index === run.weekIndex)
          ?.sessions.find((item) => item.id === run.sessionId) ?? null
      : null;

  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      Array.from(
        runRef.current?.querySelectorAll<HTMLElement>('button, [href], input') ?? []
      ).filter((element) => !element.hasAttribute('disabled'));
    focusables()[0]?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRun();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open, closeRun]);

  useEffect(() => {
    if (!open) setConfirming(false);
  }, [open]);

  // Garder sous les yeux l'exercice en cours et le repos qui vient de démarrer.
  useEffect(() => {
    if (!open || !run) return;
    const current = runRef.current?.querySelector('.run__exercise.is-current');
    current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open, run?.sets]);

  useEffect(() => {
    if (!open || !run?.restUntil) return;
    restRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open, run?.restUntil]);

  const restRemaining = run?.restUntil
    ? Math.max(0, Math.ceil((Date.parse(run.restUntil) - now) / 1000))
    : 0;

  useEffect(() => {
    if (!open || !run?.restUntil) {
      restNotified.current = false;
      return;
    }
    if (restRemaining > 0 || restNotified.current) return;
    restNotified.current = true;
    clearRest();
    try {
      navigator.vibrate?.(120);
    } catch {
      // Certaines WebView refusent la vibration : sans conséquence.
    }
    notify('Repos terminé, c’est reparti.', 'info');
  }, [open, run?.restUntil, restRemaining, clearRest, notify]);

  if (!open || !run || !session) return null;

  const exercises = session.exercises ?? [];
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const doneSets = exercises.reduce(
    (sum, exercise, index) => sum + Math.min(run.sets[index] ?? 0, exercise.sets),
    0
  );
  const progress = totalSets === 0 ? 0 : Math.round((doneSets / totalSets) * 100);
  const currentIndex = exercises.findIndex(
    (exercise, index) => (run.sets[index] ?? 0) < exercise.sets
  );
  const elapsed = Math.max(0, Math.floor((now - Date.parse(run.startedAt)) / 1000));
  const restExercise =
    run.restExerciseIndex === undefined ? null : exercises[run.restExerciseIndex] ?? null;
  const restPct =
    restExercise && restExercise.restSec > 0
      ? Math.min(100, Math.round((restRemaining / restExercise.restSec) * 100))
      : 0;

  const toggleSet = (exerciseIndex: number, setIndex: number) => {
    const exercise = exercises[exerciseIndex];
    if (!exercise) return;
    const completed = run.sets[exerciseIndex] ?? 0;
    const next = setIndex < completed ? setIndex : Math.min(setIndex + 1, exercise.sets);
    setExerciseSets(exerciseIndex, next);
    if (next > completed) {
      // Le repos ne démarre qu'entre deux séries : la dernière enchaîne.
      if (next < exercise.sets) startRest(exercise.restSec, exerciseIndex);
      else clearRest();
    } else {
      clearRest();
    }
  };

  const finish = () => {
    const durationMin = Math.min(
      180,
      Math.max(1, Math.round((Date.now() - Date.parse(run.startedAt)) / 60_000))
    );
    finishSessionRun(durationMin);
    closeRun();
    notify(`${session.title} terminée — ajoutée au journal.`, 'success');
  };

  return (
    <div
      className="run-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="run-title"
      ref={runRef}
    >
      <div className="run">
        <header className="run__head">
          <div>
            <p className="kicker">Séance guidée · intensité {INTENSITY[session.intensity]}</p>
            <h1 id="run-title">{session.title}</h1>
            <p className="run__sub">
              {session.minutes} min prévues · {session.type}
              {exercises.length ? ` · ${exercises.length} exercices` : ''}
            </p>
          </div>
          <button
            type="button"
            className="iconbtn"
            onClick={closeRun}
            aria-label="Mettre la séance en pause"
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="run__stats">
          <div>
            <span>Depuis le début</span>
            <strong>{clock(elapsed)}</strong>
          </div>
          <div>
            <span>Séries</span>
            <strong>
              {doneSets}
              <em>/{totalSets}</em>
            </strong>
          </div>
          <div>
            <span>Repos</span>
            <strong>{restRemaining > 0 ? `${restRemaining}s` : '—'}</strong>
          </div>
        </div>

        <div
          className="run__bar"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progression de la séance"
        >
          <i style={{ width: `${progress}%` }} />
        </div>

        {restRemaining > 0 ? (
          <div className="run__rest" role="status" aria-live="polite" ref={restRef}>
            <span className="run__restRing" style={{ ['--rest' as string]: `${restPct}%` }}>
              <strong>{restRemaining}</strong>
              <em>s</em>
            </span>
            <div className="run__restText">
              <strong>Repos</strong>
              <p>{restExercise ? `Après ${restExercise.name}` : 'Récupération'}</p>
            </div>
            <div className="run__restActions">
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => extendRest(15)}
              >
                +15 s
              </button>
              <button type="button" className="btn btn--small" onClick={clearRest}>
                Passer
              </button>
            </div>
          </div>
        ) : null}

        {exercises.length ? (
          <ol className="run__list">
            {exercises.map((exercise, index) => {
              const done = Math.min(run.sets[index] ?? 0, exercise.sets);
              const current = index === currentIndex;
              return (
                <li
                  key={`${exercise.name}-${index}`}
                  className={`run__exercise${current ? ' is-current' : ''}${
                    done === exercise.sets ? ' is-done' : ''
                  }`}
                >
                  <div className="run__exerciseHead">
                    <span className="run__num" aria-hidden>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <strong>{exercise.name}</strong>
                      <span>
                        {exercise.reps} · repos {exercise.restSec} s
                      </span>
                    </div>
                    <em>
                      {done}/{exercise.sets}
                    </em>
                  </div>
                  <div className="run__sets">
                    {Array.from({ length: exercise.sets }, (_, setIndex) => (
                      <button
                        key={setIndex}
                        type="button"
                        className={`run__set${setIndex < done ? ' is-done' : ''}`}
                        aria-label={`Série ${setIndex + 1} sur ${exercise.sets} — ${exercise.name}`}
                        aria-pressed={setIndex < done}
                        onClick={() => toggleSet(index, setIndex)}
                      >
                        {setIndex < done ? <Icon name="check" size={13} /> : setIndex + 1}
                      </button>
                    ))}
                  </div>
                  {exercise.note ? <p className="run__note">{exercise.note}</p> : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="run__cardio">
            <span className="run__cardioIcon">
              <Icon name="clock" size={22} />
            </span>
            <div>
              <strong>Chrono en cours</strong>
              <p>{session.detail}</p>
            </div>
          </div>
        )}

        {totalSets > 0 && doneSets === totalSets ? (
          <p className="run__complete" role="status">
            <Icon name="check" size={16} /> Toutes les séries sont faites. Terminez pour ajouter la
            séance au journal.
          </p>
        ) : null}

        <footer className="run__foot">
          <button type="button" className="btn btn--ghost" onClick={closeRun}>
            Mettre en pause
          </button>
          <button type="button" className="btn btn--primary" onClick={finish}>
            <Icon name="check" size={16} /> Terminer la séance
          </button>
        </footer>

        {confirming ? (
          <div className="run__confirm" role="alertdialog" aria-label="Abandonner la séance">
            <p>Abandonner cette séance ? La progression sera perdue, rien ne sera ajouté au journal.</p>
            <div>
              <button
                type="button"
                className="btn btn--danger btn--small"
                onClick={() => {
                  discardSessionRun();
                  closeRun();
                  notify('Séance abandonnée.', 'info');
                }}
              >
                Oui, abandonner
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => setConfirming(false)}
              >
                Continuer
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="textlink run__discard"
            onClick={() => setConfirming(true)}
          >
            Abandonner la séance
          </button>
        )}
      </div>
    </div>
  );
}

/** Bandeau « reprendre » affiché sur Aujourd'hui quand une séance est ouverte. */
export function ResumeSessionCard() {
  const run = usePulse((state) => state.sessionRun);
  const plan = usePulse((state) => state.trainingPlan);
  const openRun = useUi((state) => state.openRun);

  if (!run || !plan || run.planCreatedAt !== plan.createdAt) return null;
  const session = plan.weeks
    .find((week) => week.index === run.weekIndex)
    ?.sessions.find((item) => item.id === run.sessionId);
  if (!session) return null;

  const max = setsOf(session);
  const done = max.reduce((sum, sets, index) => sum + Math.min(run.sets[index] ?? 0, sets), 0);
  const total = max.reduce((sum, sets) => sum + sets, 0);

  return (
    <section className="card resume">
      <span className="resume__icon">
        <Icon name="run" size={20} />
      </span>
      <div className="resume__body">
        <strong>Séance en cours</strong>
        <p>
          {session.title}
          {total > 0 ? ` · ${done}/${total} séries` : ''} · démarrée à{' '}
          {formatTime(run.startedAt)}
        </p>
      </div>
      <button type="button" className="btn btn--primary btn--small" onClick={openRun}>
        Reprendre <Icon name="arrow" size={15} />
      </button>
    </section>
  );
}
