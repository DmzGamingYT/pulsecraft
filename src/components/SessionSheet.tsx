import { Modal } from './Modal';
import { Icon } from './Icon';
import { usePulse } from '../store';
import { useUi } from '../lib/uiStore';
import { addDays, formatMedium } from '../lib/dates';
import { EQUIPMENT_LABELS } from '../lib/plan';
import type { PlanSession, TrainingPlan } from '../types';

const INTENSITY: Record<PlanSession['intensity'], string> = {
  faible: 'facile',
  modérée: 'modérée',
  soutenue: 'soutenue',
};

/**
 * Fiche d'une séance : les mouvements prescrits, les séries, les répétitions et
 * le repos. C'est le même plan que dans « Plan », mais lisible juste avant de
 * s'entraîner — notamment pour les séances au poids du corps (dips, pompes,
 * rowing sous table).
 */
export function SessionSheet({
  open,
  onClose,
  plan,
  weekIndex,
  session,
}: {
  open: boolean;
  onClose: () => void;
  plan: TrainingPlan;
  weekIndex: number;
  session: PlanSession | null;
}) {
  const toggle = usePulse((state) => state.toggleTrainingSession);
  const startSessionRun = usePulse((state) => state.startSessionRun);
  const run = usePulse((state) => state.sessionRun);
  const notify = useUi((state) => state.notify);
  const openRun = useUi((state) => state.openRun);

  if (!session) return null;

  const week = plan.weeks[weekIndex];
  const date = week ? addDays(week.startDate, session.day) : null;
  const done = Boolean(session.doneAt);
  // Le programme du mois n'utilise que le poids du corps et des haltères légers,
  // quelle que soit la famille de matériel choisie ailleurs dans l'application.
  const equipment =
    plan.preset === 'monthly-muscle'
      ? 'Poids du corps & haltères légers'
      : EQUIPMENT_LABELS[plan.intake.equipment];
  const activeRun = Boolean(
    run &&
      plan.createdAt === run.planCreatedAt &&
      run.weekIndex === weekIndex &&
      run.sessionId === session.id
  );
  // Une seule séance guidée à la fois : ne pas écraser une séance en cours.
  const otherRun = Boolean(run && plan.createdAt === run.planCreatedAt && !activeRun);
  // Repos et mobilité ne créent pas de séance dans le journal : le chrono
  // guidé n'aurait rien à valider à la fin.
  const canGuide = session.type !== 'Repos' && session.type !== 'Mobilité';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      eyebrow={
        date
          ? `${formatMedium(date)}${session.time ? ` · ${session.time}` : ''} · ${session.minutes} min`
          : `${session.minutes} min`
      }
      title={session.title}
      footer={
        done ? (
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => {
              toggle(weekIndex, session.id, false);
              notify('Séance retirée du journal.', 'info');
              onClose();
            }}
          >
            <Icon name="close" size={15} /> Retirer du journal
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => {
                toggle(weekIndex, session.id, true);
                notify(`${session.title} ajoutée au journal.`, 'success');
                onClose();
              }}
            >
              <Icon name="check" size={15} /> Marquer faite
            </button>
            {canGuide ? (
              <button
                type="button"
                className="btn btn--primary btn--small"
                onClick={() => {
                  if (!activeRun && !otherRun) {
                    startSessionRun(plan.createdAt, weekIndex, session);
                  }
                  openRun();
                  onClose();
                }}
              >
                <Icon name={activeRun || otherRun ? 'run' : 'target'} size={15} />
                {activeRun
                  ? 'Reprendre la séance'
                  : otherRun
                    ? 'Reprendre la séance en cours'
                    : 'Démarrer la séance'}
              </button>
            ) : null}
          </>
        )
      }
    >
      <div className="sess">
        <div className="sess__badges">
          <span className={`sess__badge sess__badge--${session.intensity}`}>
            Intensité {INTENSITY[session.intensity]}
          </span>
          <span className="sess__badge">
            <Icon name="clock" size={13} /> {session.minutes} min
          </span>
          {session.exercises?.length ? (
            <span className="sess__badge">
              <Icon name="strength" size={13} /> {equipment}
            </span>
          ) : null}
          {done ? (
            <span className="sess__badge sess__badge--done">
              <Icon name="check" size={13} /> Faite
            </span>
          ) : null}
        </div>

        <p className="sess__detail">{session.detail}</p>

        {otherRun ? (
          <p className="sess__notice">
            <Icon name="alert" size={14} /> Une autre séance est en cours. Reprenez-la, terminez-la
            ou abandonnez-la avant d’en démarrer une nouvelle.
          </p>
        ) : null}

        {session.exercises?.length ? (
          <>
            <div className="sess__head">
              <h3>Mouvements</h3>
              <span>
                {session.exercises.length} exercices · repos indiqué entre les séries
              </span>
            </div>
            <ol className="sess__list">
              {session.exercises.map((exercise, index) => (
                <li className="sess__exercise" key={`${exercise.name}-${index}`}>
                  <span className="sess__num" aria-hidden>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="sess__exerciseBody">
                    <strong>{exercise.name}</strong>
                    <span className="sess__prescription">
                      {exercise.sets} séries × {exercise.reps}
                    </span>
                    <span className="sess__rest">repos {exercise.restSec} s</span>
                    {exercise.note ? <em>{exercise.note}</em> : null}
                  </div>
                </li>
              ))}
            </ol>
          </>
        ) : null}

        <div className="sess__tip">
          <Icon name="alert" size={15} />
          <p>
            Échauffez-vous 5 minutes avant la première série. Arrêtez en cas de douleur vive ;
            une gêne qui persiste mérite un avis médical.
          </p>
        </div>
      </div>
    </Modal>
  );
}
