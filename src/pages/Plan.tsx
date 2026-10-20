import { useMemo, useState } from 'react';
import { usePulse } from '../store';
import { useUi } from '../lib/uiStore';
import { fetchPlanNarrative } from '../lib/ai';
import { aiReady } from '../lib/llm';
import { EQUIPMENT_LABELS, GOALS, planPhaseFor, planStats, weekIndexFor } from '../lib/plan';
import { addDays, formatMedium, formatWeekday, todayISO } from '../lib/dates';
import { fmtMinutes, fmtNumber } from '../lib/format';
import type { PlanSession } from '../types';
import { PageHeader, SectionCard, EmptyState } from '../components/Page';
import { ProgressBar } from '../components/Charts';
import { Icon } from '../components/Icon';
import { SessionSheet } from '../components/SessionSheet';

/**
 * Le plan long terme, rendu lisible.
 *
 * Les séances sont cochables une par une : cocher crée la séance correspondante
 * dans le journal (et la décocher la retire). Le plan lui-même reste calculé
 * localement ; l'IA ne fait que commenter.
 */

const INTENSITY_LABEL: Record<PlanSession['intensity'], string> = {
  faible: 'facile',
  modérée: 'modérée',
  soutenue: 'soutenue',
};

function sessionIcon(session: PlanSession) {
  if (session.type === 'Mobilité') return 'yoga' as const;
  if (session.type === 'Repos') return 'moon' as const;
  if (session.type === 'Course') return 'run' as const;
  if (session.type === 'Marche') return 'walk' as const;
  if (session.type === 'Vélo') return 'bike' as const;
  if (session.type === 'Natation') return 'swim' as const;
  if (session.type === 'Musculation') return 'strength' as const;
  if (session.type === 'HIIT') return 'hiit' as const;
  if (session.type === 'Yoga') return 'yoga' as const;
  if (session.type === 'Rameur') return 'row' as const;
  return 'activity' as const;
}

export function PlanPage() {
  const plan = usePulse((state) => state.trainingPlan);
  const settings = usePulse((state) => state.settings);
  const toggle = usePulse((state) => state.toggleTrainingSession);
  const setTrainingPlan = usePulse((state) => state.setTrainingPlan);
  const openWizard = useUi((state) => state.openWizard);
  const notify = useUi((state) => state.notify);

  const today = todayISO();
  const stats = useMemo(() => (plan ? planStats(plan, today) : null), [plan, today]);
  const [noteBusy, setNoteBusy] = useState(false);

  const currentWeek = plan ? weekIndexFor(plan, today) : null;
  const [openWeek, setOpenWeek] = useState<number | null>(null);
  const [openSession, setOpenSession] = useState<{ week: number; id: string } | null>(null);
  const activeWeek = openWeek ?? currentWeek ?? 0;

  if (!plan || !stats) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Plan"
          title={
            <>
              Votre plan long terme<span className="title-dot">.</span>
            </>
          }
          subtitle="Un programme de plusieurs semaines, avec des phases et des repères — calculé sur votre rythme réel."
        />
        <SectionCard>
          <EmptyState
            icon="target"
            title="Aucun plan pour l’instant"
            text="Le bilan de départ prend deux minutes : objectif, disponibilité, matériel. Battement en déduit un programme de 4 à 24 semaines, avec une semaine allégée toutes les quatre semaines."
            action={
              <button type="button" className="btn btn--primary" onClick={openWizard}>
                Faire mon bilan
              </button>
            }
          />
        </SectionCard>
      </div>
    );
  }

  const goal = GOALS[plan.goal];
  const phase = currentWeek === null ? plan.phases[0] ?? null : planPhaseFor(plan, currentWeek);
  const week = plan.weeks[activeWeek];
  const isCurrentWeek = activeWeek === currentWeek;
  const notStarted = currentWeek === null && Boolean(plan.weeks[0] && today < plan.weeks[0].startDate);
  const elapsedMilestones = plan.milestones.filter(
    (milestone) => currentWeek !== null && milestone.week <= currentWeek
  ).length;
  const hasExerciseDetail = plan.weeks.some((item) =>
    item.sessions.some((session) => Boolean(session.exercises?.length))
  );
  const sheetSession = openSession
    ? plan.weeks[openSession.week]?.sessions.find((item) => item.id === openSession.id) ?? null
    : null;
  const openSheet = (weekIndex: number, sessionId: string) =>
    setOpenSession({ week: weekIndex, id: sessionId });

  const askNarrative = async () => {
    setNoteBusy(true);
    try {
      const note = await fetchPlanNarrative(plan.intake, plan, settings.ai);
      setTrainingPlan({ ...plan, note, noteSource: 'ai' });
      notify('Commentaire du coach mis à jour.', 'success');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Le coach IA n’a pas répondu.',
        'error'
      );
    } finally {
      setNoteBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow={`Plan ${plan.horizonWeeks} semaines · ${goal.label}`}
        title={
          <>
            Votre cap<span className="title-dot">.</span>
          </>
        }
        subtitle={`${plan.intake.daysPerWeek} séances de ${plan.intake.sessionMin} min par semaine · ${EQUIPMENT_LABELS[plan.intake.equipment]} · ${goal.tagline.toLowerCase()}.`}
        actions={
          <>
            <button type="button" className="btn btn--ghost btn--small" onClick={openWizard}>
              <Icon name="settings" size={16} /> Refaire le bilan
            </button>
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={() => void askNarrative()}
              disabled={noteBusy || !aiReady(settings.ai) || !settings.aiEnabled}
              title={
                !settings.aiEnabled
                  ? 'Activez le coach IA dans les réglages.'
                  : 'Actualiser le commentaire du coach'
              }
            >
              <Icon name="spark" size={16} /> {noteBusy ? 'Analyse…' : 'Commenter'}
            </button>
          </>
        }
      />

      {!hasExerciseDetail ? (
        <div className="lp-upgrade">
          <span className="lp-upgrade__icon">
            <Icon name="spark" size={18} />
          </span>
          <div>
            <strong>Ce plan date d’avant les séances détaillées.</strong>
            <p>
              Refaites le bilan (2 minutes) pour obtenir les mouvements, les séries et les dips
              au poids du corps.
            </p>
          </div>
          <button type="button" className="btn btn--primary btn--small" onClick={openWizard}>
            Mettre à jour
          </button>
        </div>
      ) : null}

      <div className="lp-stats">
        <article className="lp-stat">
          <span className="lp-stat__label">Semaine</span>
          <strong>
            {currentWeek === null ? '—' : currentWeek + 1}
            <em>/{plan.horizonWeeks}</em>
          </strong>
          <span className="lp-stat__detail">
            {notStarted && plan.weeks[0]
              ? `début le ${formatMedium(plan.weeks[0].startDate)}`
              : phase?.name ?? 'Plan terminé'}
          </span>
        </article>
        <article className="lp-stat">
          <span className="lp-stat__label">Séances faites</span>
          <strong>
            {stats.done}
            <em>/{stats.total}</em>
          </strong>
          <span className="lp-stat__detail">lancées depuis le journal</span>
        </article>
        <article className="lp-stat">
          <span className="lp-stat__label">Régularité</span>
          <strong>
            {stats.adherence}
            <em>%</em>
          </strong>
          <ProgressBar value={stats.adherence} goal={100} color="var(--brand)" label="Régularité" />
        </article>
        <article className="lp-stat">
          <span className="lp-stat__label">Repères atteints</span>
          <strong>
            {elapsedMilestones}
            <em>/{plan.milestones.length}</em>
          </strong>
          <span className="lp-stat__detail">{fmtMinutes(stats.targetMinutes)} cette semaine</span>
        </article>
      </div>

      <div className="lp-grid">
        <SectionCard
          className="lp-week"
          title={week ? `Semaine ${week.index + 1}` : 'Semaine'}
          subtitle={
            week
              ? `${formatMedium(week.startDate)} · ${fmtMinutes(week.targetMinutes)} prévues${week.deload ? ' · semaine allégée' : ''}${week.index === 0 && notStarted ? ' · à venir' : ''}`
              : undefined
          }
          action={
            <div className="lp-weeknav">
              <button
                type="button"
                className="iconbtn"
                onClick={() => setOpenWeek(Math.max(0, activeWeek - 1))}
                disabled={activeWeek === 0}
                aria-label="Semaine précédente"
              >
                <Icon name="chevron" size={17} className="lp-flip" />
              </button>
              <button
                type="button"
                className="iconbtn"
                onClick={() =>
                  setOpenWeek(Math.min(plan.horizonWeeks - 1, activeWeek + 1))
                }
                disabled={activeWeek >= plan.horizonWeeks - 1}
                aria-label="Semaine suivante"
              >
                <Icon name="chevron" size={17} />
              </button>
            </div>
          }
        >
          {week ? (
            <>
              <p className="lp-week__focus">
                <Icon name="target" size={15} /> {week.focus}
                {isCurrentWeek ? <span className="lp-badge">Cette semaine</span> : null}
              </p>
              <ul className="lp-sessions">
                {week.sessions.map((session) => (
                  <li
                    key={session.id}
                    className={`lp-session${session.doneAt ? ' is-done' : ''}`}
                  >
                    <button
                      type="button"
                      className="lp-check"
                      aria-pressed={Boolean(session.doneAt)}
                      aria-label={`${session.doneAt ? 'Décocher' : 'Marquer comme faite'} : ${session.title}`}
                      onClick={() => {
                        const done = !session.doneAt;
                        toggle(week.index, session.id, done);
                        notify(
                          done
                            ? `${session.title} ajoutée au journal.`
                            : `${session.title} retirée du journal.`,
                          done ? 'success' : 'info'
                        );
                      }}
                    >
                      <Icon name="check" size={14} />
                    </button>
                    <span className="lp-session__icon">
                      <Icon name={sessionIcon(session)} size={17} />
                    </span>
                    <div className="lp-session__body">
                      <button
                        type="button"
                        className="lp-session__title"
                        onClick={() => openSheet(week.index, session.id)}
                      >
                        {session.title}
                      </button>
                      <span>{session.detail}</span>
                      {session.exercises?.length ? (
                        <button
                          type="button"
                          className="lp-session__exercises"
                          onClick={() => openSheet(week.index, session.id)}
                        >
                          {session.exercises.slice(0, 3).map((exercise) => exercise.name).join(' · ')}
                          {session.exercises.length > 3
                            ? ` · +${session.exercises.length - 3}`
                            : ''}
                        </button>
                      ) : null}
                    </div>
                    <div className="lp-session__meta">
                      <span>{formatWeekday(addDays(week.startDate, session.day))}</span>
                      <em>{session.minutes} min</em>
                      <i className={`lp-intensity lp-intensity--${session.intensity}`}>
                        {INTENSITY_LABEL[session.intensity]}
                      </i>
                      {session.exercises?.length ? (
                        <button
                          type="button"
                          className="textlink lp-session__open"
                          onClick={() => openSheet(week.index, session.id)}
                        >
                          Voir la séance <Icon name="arrow" size={14} />
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </SectionCard>

        <div className="lp-side">
          <SectionCard title="Le mot du coach" subtitle="Sur la structure, pas sur les séances">
            <div className={`lp-note${noteBusy ? ' is-loading' : ''}`}>
              {plan.note.split('\n\n').map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <p className="lp-note__foot">
              <span className={`aibadge${plan.noteSource === 'ai' ? ' aibadge--on' : ''}`}>
                {plan.noteSource === 'ai' ? 'IA' : 'Local'}
              </span>
              {plan.noteSource === 'ai'
                ? 'Rédigé à partir de choix fermés : objectif, fréquence, matériel, sommeil.'
                : 'Rédigé par Battement, sans réseau ni clé.'}
            </p>
          </SectionCard>

          <SectionCard title="Repères" subtitle="Des jalons mesurables, pas des promesses">
            <ol className="lp-milestones">
              {plan.milestones.map((milestone) => {
                const reached = currentWeek !== null && milestone.week <= currentWeek;
                return (
                  <li key={milestone.id} className={reached ? 'is-reached' : ''}>
                    <span className="lp-milestone__dot" aria-hidden>
                      {reached ? <Icon name="check" size={12} /> : null}
                    </span>
                    <div>
                      <strong>{milestone.label}</strong>
                      <p>{milestone.detail}</p>
                      <em>Semaine {milestone.week + 1}</em>
                    </div>
                  </li>
                );
              })}
            </ol>
          </SectionCard>
        </div>
      </div>

      <SectionCard
        title="Les phases"
        subtitle="Trois blocs, une semaine allégée toutes les quatre semaines"
      >
        <ol className="lp-phases">
          {plan.phases.map((item, index) => {
            const active = phase?.id === item.id;
            return (
              <li key={item.id} className={active ? 'is-active' : ''}>
                <span className="lp-phase__index">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.focus}</p>
                  <em>{item.objective}</em>
                </div>
                <span className="lp-phase__weeks">
                  S{item.fromWeek + 1}–S{item.toWeek + 1}
                </span>
              </li>
            );
          })}
        </ol>
      </SectionCard>

      <SectionCard
        title="Toutes les semaines"
        subtitle={`${fmtNumber(plan.weeks.reduce((sum, item) => sum + item.sessions.length, 0))} séances prévues`}
      >
        <div className="lp-weeks">
          {plan.weeks.map((item) => {
            const done = item.sessions.filter((session) => session.doneAt).length;
            return (
              <details key={item.index} open={item.index === activeWeek}>
                <summary>
                  <span className="lp-weeks__num">S{item.index + 1}</span>
                  <span className="lp-weeks__date">{formatMedium(item.startDate)}</span>
                  <span className="lp-weeks__focus">{item.focus}</span>
                  <span className="lp-weeks__count">
                    {done}/{item.sessions.length}
                  </span>
                  {item.deload ? <span className="lp-badge lp-badge--soft">allégée</span> : null}
                </summary>
                <ul>
                  {item.sessions.map((session) => (
                    <li key={session.id} className={session.doneAt ? 'is-done' : ''}>
                      <button
                        type="button"
                        className="lp-weeks__title"
                        onClick={() => openSheet(item.index, session.id)}
                      >
                        {session.title}
                      </button>
                      <em>{session.minutes} min</em>
                      <span>{formatWeekday(addDays(item.startDate, session.day))}</span>
                      <button
                        type="button"
                        className="textlink"
                        onClick={() => toggle(item.index, session.id, !session.doneAt)}
                      >
                        {session.doneAt ? 'Décocher' : 'Fait'}
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      </SectionCard>

      <p className="pagenote">
        Le plan est calculé sur votre appareil à partir de votre bilan. Il ne remplace pas un avis
        médical : en cas de douleur persistante, de malaise ou de fatigue inhabituelle, arrêtez la
        séance et consultez un professionnel de santé.
      </p>

      <SessionSheet
        open={Boolean(openSession)}
        onClose={() => setOpenSession(null)}
        plan={plan}
        weekIndex={openSession?.week ?? 0}
        session={sheetSession}
      />
    </div>
  );
}
