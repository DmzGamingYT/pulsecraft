import { Icon } from './Icon';
import { SectionCard } from './Page';
import { usePulse } from '../store';
import { useUi } from '../lib/uiStore';
import { weekIndexFor } from '../lib/plan';
import { isMonthOver, MONTH_CONTEXT, MONTH_RHYTHM } from '../lib/monthly';
import { addDays, formatMedium, todayISO } from '../lib/dates';
import type { TrainingPlan } from '../types';

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/**
 * Le rythme du programme du mois, mis à plat : quatre créneaux fixes, l'atelier
 * de 14 h à 18 h laissé intact, les études tout autour. Le bloc de séances est
 * lu dans la semaine en cours pour savoir ce qui est déjà coché.
 */
export function MonthCard({ plan }: { plan: TrainingPlan }) {
  const today = todayISO();
  const roll = usePulse((state) => state.rollMonthlyProgram);
  const notify = useUi((state) => state.notify);

  const weekIndex = weekIndexFor(plan, today);
  const week = weekIndex === null ? null : plan.weeks[weekIndex] ?? null;
  const done = new Map((week?.sessions ?? []).map((session) => [session.day, session.doneAt]));
  const over = isMonthOver(plan, today);
  const monthNumber = (plan.monthIndex ?? 0) + 1;
  const lastWeek = plan.weeks[plan.weeks.length - 1];

  return (
    <SectionCard
      className="lp-month"
      title="Le mois, calé sur votre semaine"
      subtitle="Atelier 14 h–18 h · études autour · 4 séances de 40 min, poids du corps et haltères légers"
      action={<span className="lp-badge">Mois {monthNumber}</span>}
    >
      <ul className="lp-month__slots">
        {MONTH_RHYTHM.map((slot) => {
          const doneAt = done.get(slot.day);
          return (
            <li key={slot.day} className={doneAt ? 'is-done' : ''}>
              <span className="lp-month__when">
                <span className="lp-month__day">{DAY_NAMES[slot.day]}</span>
                <span className="lp-month__time">{slot.time}</span>
              </span>
              <div className="lp-month__body">
                <strong>{slot.title}</strong>
                <span>{slot.window} · {slot.minutes} min</span>
              </div>
              {doneAt ? (
                <span className="lp-month__state is-done">
                  <Icon name="check" size={12} /> fait
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      <ul className="lp-month__context">
        {MONTH_CONTEXT.map((row) => (
          <li key={`${row.time}-${row.label}`} className={`is-${row.kind}`}>
            <span className="lp-month__ctx-time">{row.time}</span>
            <span>{row.label}</span>
          </li>
        ))}
      </ul>

      {over ? (
        <div className="lp-month__next">
          <div>
            <strong>Le mois est terminé.</strong>
            <p>
              Le mois suivant reprend le même rythme avec une variante plus difficile sur chaque
              mouvement. Le bloc précédent s’est terminé
              {lastWeek ? ` le ${formatMedium(addDays(lastWeek.startDate, 6))}` : ''} : le journal
              garde les séances cochées.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--primary btn--small"
            onClick={() => {
              roll();
              notify('Nouveau mois installé, variante plus difficile.', 'success');
            }}
          >
            <Icon name="arrow" size={15} /> Enchaîner le mois {monthNumber + 1}
          </button>
        </div>
      ) : (
        <p className="lp-month__foot">
          Aucune séance entre 14 h et 18 h : c’est l’atelier. Le reste de la journée reste aux
          études, la séance tient en 40 min, échauffement compris.
        </p>
      )}
    </SectionCard>
  );
}
