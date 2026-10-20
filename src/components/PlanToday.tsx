import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePulse } from '../store';
import { useUi } from '../lib/uiStore';
import { GOALS, nextSession, planPhaseFor, planStats, sessionForDate, weekIndexFor } from '../lib/plan';
import { formatWeekday, todayISO } from '../lib/dates';
import type { PlanSession } from '../types';
import { Icon } from './Icon';
import { SessionSheet } from './SessionSheet';

const INTENSITY: Record<PlanSession['intensity'], string> = {
  faible: 'facile',
  modérée: 'modérée',
  soutenue: 'soutenue',
};

function iconFor(type: PlanSession['type']) {
  if (type === 'Mobilité' || type === 'Yoga') return 'yoga' as const;
  if (type === 'Course') return 'run' as const;
  if (type === 'Marche') return 'walk' as const;
  if (type === 'Vélo') return 'bike' as const;
  if (type === 'Natation') return 'swim' as const;
  if (type === 'Musculation') return 'strength' as const;
  if (type === 'HIIT') return 'hiit' as const;
  if (type === 'Rameur') return 'row' as const;
  return 'activity' as const;
}

/**
 * Séance prévue aujourd'hui, ou la prochaine dans les deux semaines.
 * Cocher ici fait exactement la même chose que dans la page Plan : la séance
 * entre dans le journal, et l'anneau « entraînement » se remplit.
 */
export function PlanToday() {
  const plan = usePulse((state) => state.trainingPlan);
  const toggle = usePulse((state) => state.toggleTrainingSession);
  const notify = useUi((state) => state.notify);
  const openWizard = useUi((state) => state.openWizard);
  const [sheet, setSheet] = useState<{ weekIndex: number; id: string } | null>(null);

  if (!plan) {
    return (
      <section className="card pt pt--empty">
        <div className="pt__head">
          <span className="pt__kicker">
            <Icon name="target" size={15} /> Programme personnel
          </span>
          <Link to="/plan" className="textlink">
            Le plan <Icon name="arrow" size={15} />
          </Link>
        </div>
        <div className="pt__body">
          <span className="pt__icon">
            <Icon name="strength" size={24} />
          </span>
          <div className="pt__text">
            <h2>Commencez aujourd’hui, à votre rythme.</h2>
            <p>
              Poids du corps, maison ou salle : le bilan de 2 minutes place une première séance
              dans votre journée, avec les mouvements détaillés.
            </p>
          </div>
          <div className="pt__actions">
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={openWizard}
            >
              <Icon name="spark" size={15} /> Créer mon plan
            </button>
          </div>
        </div>
      </section>
    );
  }

  const today = todayISO();
  const weekIndex = weekIndexFor(plan, today);
  const todaySession = sessionForDate(plan, today);
  const upcoming = todaySession ? null : nextSession(plan, today);
  const session = todaySession ?? upcoming?.session ?? null;
  if (!session) return null;

  const phase = weekIndex === null ? plan.phases[0] : planPhaseFor(plan, weekIndex);
  const stats = planStats(plan, today);
  const goal = GOALS[plan.goal];
  const done = Boolean(session.doneAt);
  const isToday = Boolean(todaySession);
  const sheetSession = sheet
    ? plan.weeks[sheet.weekIndex]?.sessions.find((item) => item.id === sheet.id) ?? null
    : null;

  return (
    <section className="card pt">
      <div className="pt__head">
        <span className="pt__kicker">
          <Icon name="target" size={15} />
          {isToday ? 'Séance du jour' : 'Prochaine séance'}
          {phase ? <em>{phase.name}</em> : null}
        </span>
        <Link to="/plan" className="textlink">
          Le plan <Icon name="arrow" size={15} />
        </Link>
      </div>

      <div className="pt__body">
        <span className={`pt__icon${done ? ' is-done' : ''}`}>
          <Icon name={done ? 'check' : iconFor(session.type)} size={24} />
        </span>
        <div className="pt__text">
          <h2>{session.title}</h2>
          <p>
            {isToday
              ? "Aujourd'hui"
              : formatWeekday(upcoming ? upcoming.date : today)}{' '}
            · {session.minutes} min · intensité {INTENSITY[session.intensity]} · {goal.label.toLowerCase()}
          </p>
          <span className="pt__detail">{session.detail}</span>
          {session.exercises?.length ? (
            <span className="pt__exercises">
              {session.exercises.slice(0, 3).map((exercise) => exercise.name).join(' · ')}
              {session.exercises.length > 3 ? ` · +${session.exercises.length - 3}` : ''}
            </span>
          ) : null}
        </div>
        <div className="pt__actions">
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => {
              const index = isToday ? weekIndex : upcoming ? upcoming.weekIndex : null;
              if (index === null) return;
              setSheet({ weekIndex: index, id: session.id });
            }}
          >
            <Icon name="strength" size={15} /> Voir la séance
          </button>
          {isToday || upcoming ? (
            <button
              type="button"
              className={`btn btn--small ${done ? 'btn--ghost' : 'btn--primary'}`}
              aria-pressed={done}
              onClick={() => {
                const index = isToday ? weekIndex : upcoming ? upcoming.weekIndex : null;
                if (index === null) return;
                toggle(index, session.id, !done);
                notify(
                  done ? 'Séance retirée du journal.' : `${session.title} ajoutée au journal.`,
                  done ? 'info' : 'success'
                );
              }}
            >
              <Icon name={done ? 'close' : 'check'} size={15} />
              {done ? 'Annuler' : 'Marquer faite'}
            </button>
          ) : null}
        </div>
      </div>

      <footer className="pt__foot">
        <span>
          {stats.done}/{stats.total} séances cochées
        </span>
        <span className="pt__bar" aria-hidden>
          <i style={{ width: `${Math.min(100, stats.adherence)}%` }} />
        </span>
        <span>{stats.adherence} % du plan</span>
      </footer>

      <SessionSheet
        open={Boolean(sheet)}
        onClose={() => setSheet(null)}
        plan={plan}
        weekIndex={sheet?.weekIndex ?? 0}
        session={sheetSession}
      />
    </section>
  );
}
