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
  const notify = useUi((state) => state.notify);

  if (!session) return null;

  const week = plan.weeks[weekIndex];
  const date = week ? addDays(week.startDate, session.day) : null;
  const done = Boolean(session.doneAt);
  const equipment = EQUIPMENT_LABELS[plan.intake.equipment];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      eyebrow={date ? `${formatMedium(date)} · ${session.minutes} min` : `${session.minutes} min`}
      title={session.title}
      footer={
        <>
          <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
            Fermer
          </button>
          <button
            type="button"
            className={`btn btn--small ${done ? 'btn--ghost' : 'btn--primary'}`}
            aria-pressed={done}
            onClick={() => {
              toggle(weekIndex, session.id, !done);
              notify(
                done ? 'Séance retirée du journal.' : `${session.title} ajoutée au journal.`,
                done ? 'info' : 'success'
              );
              onClose();
            }}
          >
            <Icon name={done ? 'close' : 'check'} size={15} />
            {done ? 'Retirer du journal' : 'Marquer la séance faite'}
          </button>
        </>
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
          <span className="sess__badge">
            <Icon name="strength" size={13} /> {equipment}
          </span>
          {done ? (
            <span className="sess__badge sess__badge--done">
              <Icon name="check" size={13} /> Faite
            </span>
          ) : null}
        </div>

        <p className="sess__detail">{session.detail}</p>

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
