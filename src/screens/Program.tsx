import { useMemo, useState } from 'react';
import type { Activity, DayLog } from '../types';
import { sportIcon, sportLabel } from '../types';
import { datePart, parseDay, todayISO, weekdayOf } from '../lib/dates';
import {
  adjustmentFor,
  buildProfile,
  checkInDue,
  currentWeekIndex,
  cycleComplete,
  cycleSummary,
  DAY_INITIALS,
  doneInWeek,
  GOALS,
  INTENSITY_LABELS,
  MAX_PLAN_FACTOR,
  MIN_PLAN_FACTOR,
  RHYTHMS,
  sessionContent,
  weekdayLong,
  weekdayShort,
  type Answers,
  type CheckIn,
  type Feel,
  type Goal,
  type PaceReference,
  type PlanSession,
  type PlanWeek,
  type Profile,
  type Program,
  type Rhythm,
} from '../lib/coach';
import { sportRecords } from '../lib/analytics';
import { buildProgramIcs } from '../lib/ics';
import { Icon } from '../components/Icons';
import { Modal } from '../components/Modal';

/**
 * Le programme du coach.
 *
 * La page ne cache pas son fonctionnement : la lecture du journal est affichée
 * avant le plan, le plan dit pourquoi il est là, et le point de suivi annonce
 * ce qu'il va changer. C'est la partie « suivi » qui distingue un programme
 * d'une liste de séances.
 */
export function ProgramScreen({
  activities,
  days,
  program,
  done,
  onStart,
  onToggle,
  onCheckIn,
  onStop,
  onNextCycle,
  onDoSession,
}: {
  activities: Activity[];
  days: DayLog[];
  program: Program | null;
  done: string[];
  onStart: (answers: Answers) => void;
  onToggle: (date: string) => void;
  onCheckIn: (checkIn: CheckIn) => void;
  onStop: () => void;
  onNextCycle: () => void;
  onDoSession: (session: PlanSession) => void;
}) {
  const today = todayISO();
  const profile = useMemo(() => buildProfile(activities, days, today), [activities, days, today]);
  const [setupOpen, setSetupOpen] = useState(false);
  const [checkInWeek, setCheckInWeek] = useState<number | null>(null);
  const [sheet, setSheet] = useState<PlanSession | null>(null);

  // Les allures proposées viennent des sorties déjà au journal, par discipline.
  const references = useMemo(() => {
    const map = new Map<string, PaceReference>();
    for (const record of sportRecords(activities)) {
      map.set(record.sport, {
        paceMinPerKm: record.bestPace ?? undefined,
        speedKmh: record.bestSpeed ?? undefined,
      });
    }
    return map;
  }, [activities]);

  // Une séance déjà au journal compte comme faite : on ne demande pas de la
  // cocher une deuxième fois. Le marquage manuel reste pour le reste.
  const journalDays = useMemo(
    () => new Set(activities.map((activity) => datePart(activity.date))),
    [activities],
  );
  const doneSet = useMemo(
    () => new Set([...done, ...journalDays]),
    [done, journalDays],
  );
  const due = program ? checkInDue(program, today) : null;
  const currentWeek = program ? currentWeekIndex(program, today) : 0;
  const finished = program ? cycleComplete(program, today) : false;
  const [weekIndex, setWeekIndex] = useState(currentWeek);
  const shown = program?.weeks[weekIndex] ?? program?.weeks[0] ?? null;
  const checked = checkInWeek !== null ? program?.weeks[checkInWeek] ?? null : null;

  return (
    <section className="screen">
      <header className="screen__head">
        <p className="eyebrow">Programme</p>
        <h1 className="screen__title">
          Un plan qui part de vos <em>données</em>.
        </h1>
        <p className="screen__lede">
          La lecture du journal et le plan se calculent sur cet appareil, sans compte ni
          serveur. Un point par semaine ajuste la suite : plus léger si la fatigue monte,
          un peu plus long si tout passe.
        </p>
      </header>

      {!program ? (
        <StartBlock profile={profile} onCreate={() => setSetupOpen(true)} />
      ) : (
        <div className="coach">
          <div className="coach-strip">
            <div className="coach-stat">
              <span className="micro">Charge</span>
              <strong>{profile.load.label}</strong>
              <p>
                {profile.load.recent} min sur 7 j · base {profile.load.baseline} min
              </p>
            </div>
            <div className="coach-stat">
              <span className="micro">Énergie</span>
              <strong>{profile.readiness}</strong>
              <p>{energyWord(profile.readiness)}</p>
            </div>
            <div className="coach-stat">
              <span className="micro">Adhérence</span>
              <strong>
                {doneInWeek(program.weeks[currentWeek] ?? program.weeks[0]!, doneSet)}/
                {program.weeks[currentWeek]?.sessions.length ?? 0}
              </strong>
              <p>séances de la semaine</p>
            </div>
          </div>

          {finished ? (
            <div className="cycle-done">
              <div>
                <p className="micro">Cycle {program.cycle ?? 1} terminé</p>
                <strong>
                  {cycleSummary(program, doneSet).done} séances faites sur{' '}
                  {cycleSummary(program, doneSet).planned}
                </strong>
                <p>
                  Le journal garde tout. La suite repart d’un plan neuf, recalculé sur vos
                  quatre dernières semaines.
                </p>
              </div>
              <div className="cycle-done__actions">
                <button
                  type="button"
                  className="btn btn--primary btn--small"
                  onClick={() => {
                    onNextCycle();
                    setWeekIndex(0);
                  }}
                >
                  <Icon name="sparkle" size={15} /> Prolonger d’un cycle
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => setSetupOpen(true)}
                >
                  Changer d’objectif
                </button>
              </div>
            </div>
          ) : null}

          {due ? (
            <div className="coach-due">
              <div>
                <p className="micro">Le point</p>
                <strong>Semaine {due.index + 1} terminée</strong>
                <p>Trois questions, trente secondes. La semaine suivante s’ajuste après.</p>
              </div>
              <button
                type="button"
                className="btn btn--primary btn--small"
                onClick={() => setCheckInWeek(due.index)}
              >
                <Icon name="sparkle" size={15} />
                Faire le point
              </button>
            </div>
          ) : null}

          {shown ? (
            <article className="card coach-week">
              <header className="card__head">
                <div>
                  <p className="micro">
                    Cycle {program.cycle ?? 1} · semaine {shown.index + 1} sur {program.weeks.length}
                  </p>
                  <h2 className="coach-week__focus">{shown.focus}</h2>
                </div>
                <span className="card__meta">
                  {shown.sessions.length} séances · {shown.minutes} min
                </span>
              </header>

              <div className="segmented coach-weeks" role="group" aria-label="Choisir la semaine">
                {program.weeks.map((week) => (
                  <button
                    key={week.index}
                    type="button"
                    className={week.index === shown.index ? 'is-on' : ''}
                    aria-pressed={week.index === shown.index}
                    onClick={() => setWeekIndex(week.index)}
                  >
                    S{week.index + 1}
                  </button>
                ))}
              </div>

              <ul className="coach-sessions">
                {shown.sessions.map((session) => {
                  const inJournal = journalDays.has(session.date);
                  const isDone = doneSet.has(session.date);
                  const isFuture = session.date > today;
                  return (
                    <li
                      key={session.date}
                      className={`coach-session${isDone ? ' is-done' : ''}${isFuture ? ' is-future' : ''}`}
                    >
                      <span className="coach-session__day">
                        <b>{weekdayShort(weekdayOf(session.date))}</b>
                        <em>{dayMonth(session.date)}</em>
                      </span>
                      <span className="coach-session__glyph" aria-hidden="true">
                        <Icon name={sportIcon(session.sport)} size={16} />
                      </span>
                      <span className="coach-session__body">
                        <button
                          type="button"
                          className="coach-session__title"
                          onClick={() => setSheet(session)}
                          title="Voir le contenu de la séance"
                        >
                          {session.title}
                        </button>
                        <em>
                          {session.minutes} min · {INTENSITY_LABELS[session.intensity]}
                          {session.kind === 'cle' ? ' · séance clé' : ''}
                        </em>
                      </span>
                      {inJournal ? (
                        <span className="coach-session__auto" title="Séance présente dans le journal">
                          <Icon name="check" size={13} />
                          Au journal
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="coach-session__check"
                          aria-pressed={isDone}
                          aria-label={`${session.title} — marquer comme faite`}
                          disabled={isFuture}
                          onClick={() => onToggle(session.date)}
                        >
                          <Icon name="check" size={13} />
                          {isFuture ? 'À venir' : isDone ? 'Fait' : 'Marquer'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>

              {shown.index === 0 && shown.sessions.length < program.answers.sessionsPerWeek ? (
                <p className="coach-week__empty">
                  Semaine déjà entamée : les séances passées avant aujourd’hui ne sont pas
                  rattrapées, le plan démarre à la prochaine.
                </p>
              ) : null}
            </article>
          ) : null}

          <article className="card coach-why">
            <header className="card__head">
              <span className="card__label">Pourquoi ce plan</span>
              <span className="card__meta">lecture locale</span>
            </header>
            <ul>
              {program.rationale.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="card__note">
              Aucune donnée ne sort d’ici : le plan est recalculé à partir de
              {' '}
              {program.profile.sessions} séance{program.profile.sessions > 1 ? 's' : ''} du journal.
            </p>
          </article>

          {program.checkIns.length > 0 ? (
            <article className="card coach-log">
              <header className="card__head">
                <span className="card__label">Les points</span>
                <span className="card__meta">{program.checkIns.length} sur 4</span>
              </header>
              <ul>
                {program.checkIns.map((entry) => (
                  <li key={entry.week}>
                    <span className="coach-log__week">S{entry.week + 1}</span>
                    <span className="coach-log__body">
                      <strong>{feelLabel(entry.feel)} · fatigue {entry.fatigue}/5</strong>
                      <em>{entry.summary}</em>
                    </span>
                    <span className="coach-log__count">
                      {entry.done}/{entry.planned}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ) : null}

          <div className="coach-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setSetupOpen(true)}>
              Nouveau programme
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => exportIcs(program)}
            >
              <Icon name="upload" size={16} /> Exporter l’agenda
            </button>
            {due ? null : (
              <span className="coach-actions__hint">
                {program.answers.rhythm === 'none'
                  ? 'Aucun suivi demandé : le plan reste tel quel.'
                  : 'Le prochain point apparaîtra à la fin de la semaine en cours.'}
              </span>
            )}
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                if (window.confirm('Arrêter le programme ? Le journal garde vos séances.')) {
                  onStop();
                  setWeekIndex(0);
                }
              }}
            >
              Arrêter
            </button>
          </div>
        </div>
      )}

      {setupOpen ? (
        <SetupModal
          profile={profile}
          onClose={() => setSetupOpen(false)}
          onCreate={(answers) => {
            onStart(answers);
            setWeekIndex(0);
            setSetupOpen(false);
          }}
        />
      ) : null}

      {checked ? (
        <CheckInModal
          week={checked}
          done={doneSet}
          onClose={() => setCheckInWeek(null)}
          onSave={(checkIn) => {
            onCheckIn(checkIn);
            setCheckInWeek(null);
            setWeekIndex(Math.min(3, checked.index + 1));
          }}
        />
      ) : null}

      {sheet ? (
        <SessionSheet
          session={sheet}
          reference={references.get(sheet.sport)}
          marked={doneSet.has(sheet.date)}
          onClose={() => setSheet(null)}
          onDo={() => {
            setSheet(null);
            onDoSession(sheet);
          }}
          onMark={() => {
            onToggle(sheet.date);
            setSheet(null);
          }}
        />
      ) : null}
    </section>
  );
}

/** Télécharge le programme au format iCalendar. */
function exportIcs(program: Program): void {
  const blob = new Blob([buildProgramIcs(program)], {
    type: 'text/calendar;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `battement-programme-${program.start}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Le détail d'une séance : contenu, allure située, et les deux gestes utiles. */
function SessionSheet({
  session,
  reference,
  marked,
  onClose,
  onDo,
  onMark,
}: {
  session: PlanSession;
  reference?: PaceReference;
  marked: boolean;
  onClose: () => void;
  onDo: () => void;
  onMark: () => void;
}) {
  const content = sessionContent(session, reference);
  return (
    <Modal
      title={session.title}
      eyebrow={`${session.minutes} min · ${INTENSITY_LABELS[session.intensity]}`}
      onClose={onClose}
    >
      <div className="session-sheet">
        <p className="session-sheet__purpose">{content.purpose}</p>
        {content.target ? (
          <p className="session-sheet__target">
            <Icon name="trend" size={15} />
            {content.target}
          </p>
        ) : null}

        <section>
          <p className="micro">Échauffement</p>
          <p>{content.warmup}</p>
        </section>
        <section>
          <p className="micro">Corps de séance</p>
          <ul>
            {content.main.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <section>
          <p className="micro">Retour au calme</p>
          <p>{content.cooldown}</p>
        </section>

        <div className="setup__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Fermer
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onMark}
            disabled={marked}
          >
            <Icon name="check" size={15} /> {marked ? 'Déjà au journal' : 'Marquer faite'}
          </button>
          <button type="button" className="btn btn--primary" onClick={onDo}>
            <Icon name="plus" size={15} /> Faire cette séance
          </button>
        </div>
      </div>
    </Modal>
  );
}

const DAY_MONTH = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

/** « 25 oct. » — le jour de semaine est déjà dans la colonne de gauche. */
function dayMonth(date: string): string {
  return DAY_MONTH.format(parseDay(date)).replace('.', '');
}

function energyWord(score: number): string {
  if (score >= 78) return 'de la marge';
  if (score >= 58) return 'prêt à bouger';
  return 'à recharger';
}

function feelLabel(feel: Feel): string {
  if (feel === 'facile') return 'Facile';
  if (feel === 'dur') return 'Dur';
  return 'Juste';
}

/** Avant le premier plan : ce que le coach lit, et ce qu'il demande. */
function StartBlock({ profile, onCreate }: { profile: Profile; onCreate: () => void }) {
  const dominant = profile.dominant ? sportLabel(profile.dominant) : null;
  return (
    <div className="coach-start">
      <article className="card coach-read">
        <header className="card__head">
          <span className="card__label">Ce que le coach lit</span>
          <span className="card__meta">sur votre appareil</span>
        </header>
        <dl className="coach-read__grid">
          <div>
            <dt>Journal</dt>
            <dd>
              {profile.weeks > 0
                ? `${profile.weeks} sem. · ${profile.sessions} séances`
                : 'encore vide'}
            </dd>
          </div>
          <div>
            <dt>Rythme</dt>
            <dd>
              {profile.sessions > 0
                ? `${profile.sessionsPerWeek.toLocaleString('fr-FR')} séances / sem.`
                : 'à découvrir'}
            </dd>
          </div>
          <div>
            <dt>Discipline</dt>
            <dd>{dominant ?? 'aucune dominante'}</dd>
          </div>
          <div>
            <dt>Séance</dt>
            <dd>{profile.avgMinutes > 0 ? `${profile.avgMinutes} min en moyenne` : '—'}</dd>
          </div>
          <div>
            <dt>Jours</dt>
            <dd>
              {profile.activeDays.length > 0
                ? profile.activeDays.map((day) => weekdayLong(day)).join(', ')
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Charge</dt>
            <dd>
              {profile.load.label}
              {profile.load.baseline > 0 ? ` · ×${profile.load.ratio.toLocaleString('fr-FR')}` : ''}
            </dd>
          </div>
        </dl>
        <p className="card__note">
          {profile.sessions > 0
            ? 'Le plan reprend vos habitudes au lieu de vous en imposer d’autres. Il s’adapte ensuite, semaine après semaine.'
            : 'Sans séance dans le journal, le plan démarre prudent : trois semaines pour prendre le rythme, puis il se cale sur vos retours.'}
        </p>
      </article>

      <div className="coach-invite">
        <p className="micro">Le suivi, avant le plan</p>
        <h2>Deux minutes, et un point par semaine.</h2>
        <p>
          Le programme se construit après trois choix : votre objectif, votre disponibilité,
          et la cadence du point de suivi. Ce point ne décore pas la page : il allège ou
          prolonge la semaine suivante.
        </p>
        <button type="button" className="btn btn--primary" onClick={onCreate}>
          <Icon name="sparkle" size={16} />
          Créer mon programme
        </button>
        <p className="coach-invite__foot">Sans compte · sans réseau · modifiable à tout moment</p>
      </div>
    </div>
  );
}

const MINUTE_CHOICES = [20, 30, 45, 60];

/** La mise en place : objectif, disponibilité, puis le suivi — le plan vient après. */
function SetupModal({
  profile,
  onClose,
  onCreate,
}: {
  profile: Profile;
  onClose: () => void;
  onCreate: (answers: Answers) => void;
}) {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal>('regularite');
  const [perWeek, setPerWeek] = useState(() => {
    const value = Math.round(profile.sessionsPerWeek || 3);
    return Math.min(5, Math.max(2, value));
  });
  const [minutes, setMinutes] = useState(() => {
    const value = profile.avgMinutes || 30;
    return MINUTE_CHOICES.reduce((best, choice) =>
      Math.abs(choice - value) < Math.abs(best - value) ? choice : best,
    );
  });
  const [days, setDays] = useState<number[]>(() => {
    const base = profile.activeDays.length > 0 ? [...profile.activeDays] : [2, 4, 6];
    const pool = [...base, 1, 3, 5, 6, 0];
    const chosen: number[] = [];
    for (const day of pool) {
      if (chosen.length >= Math.min(5, Math.max(2, Math.round(profile.sessionsPerWeek || 3)))) break;
      if (!chosen.includes(day)) chosen.push(day);
    }
    return chosen.sort((a, b) => a - b);
  });
  const [rhythm, setRhythm] = useState<Rhythm>('weekly');

  function setSessionCount(count: number) {
    setPerWeek(count);
    setDays((current) => {
      const next = current.slice(0, count);
      const pool = [...profile.activeDays, 1, 3, 5, 6, 0, 2, 4];
      for (const day of pool) {
        if (next.length >= count) break;
        if (!next.includes(day)) next.push(day);
      }
      return next.sort((a, b) => a - b);
    });
  }

  function toggleDay(day: number) {
    setDays((current) => {
      if (current.includes(day)) {
        return current.length <= 2 ? current : current.filter((entry) => entry !== day);
      }
      return current.length >= perWeek ? current : [...current, day].sort((a, b) => a - b);
    });
  }

  const readyDays = days.length === perWeek;
  const canContinue = step === 0 || (step === 1 && readyDays);

  return (
    <Modal
      title={step === 0 ? 'Votre objectif' : step === 1 ? 'Votre disponibilité' : 'Le point de suivi'}
      eyebrow={`Étape ${step + 1} sur 3 · coach local`}
      onClose={onClose}
      wide
    >
      <div className="setup">
        <ol className="setup__steps" aria-hidden="true">
          {['Objectif', 'Disponibilité', 'Suivi'].map((label, index) => (
            <li key={label} className={index === step ? 'is-on' : index < step ? 'is-past' : ''}>
              <span>{index + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <div className="setup__goals" role="group" aria-label="Objectif">
            {GOALS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`setup-goal${goal === option.id ? ' is-on' : ''}`}
                aria-pressed={goal === option.id}
                onClick={() => setGoal(option.id)}
              >
                <strong>{option.label}</strong>
                <span>{option.body}</span>
              </button>
            ))}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="form">
            <div className="field">
              <span className="field__label">Séances par semaine</span>
              <div className="segmented" role="group" aria-label="Séances par semaine">
                {[2, 3, 4, 5].map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={perWeek === count ? 'is-on' : ''}
                    aria-pressed={perWeek === count}
                    onClick={() => setSessionCount(count)}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field__label">
                Durée d’une séance <em>minutes</em>
              </span>
              <div className="segmented" role="group" aria-label="Durée">
                {MINUTE_CHOICES.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    className={minutes === choice ? 'is-on' : ''}
                    aria-pressed={minutes === choice}
                    onClick={() => setMinutes(choice)}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field__label">
                Les jours <em>{days.length} / {perWeek} choisis</em>
              </span>
              <div className="setup-days" role="group" aria-label="Jours">
                {DAY_INITIALS.map((initial, day) => (
                  <button
                    key={day}
                    type="button"
                    className={days.includes(day) ? 'is-on' : ''}
                    aria-pressed={days.includes(day)}
                    aria-label={weekdayLong(day)}
                    onClick={() => toggleDay(day)}
                  >
                    {initial}
                  </button>
                ))}
              </div>
              <p className="setup__hint">
                {readyDays
                  ? `Le plan posera les séances le ${days.map((day) => weekdayLong(day)).join(', ')}.`
                  : `Choisissez encore ${perWeek - days.length} jour${perWeek - days.length > 1 ? 's' : ''}.`}
              </p>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="form">
            <div className="setup__rhythms" role="group" aria-label="Cadence du suivi">
              {RHYTHMS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`setup-rhythm${rhythm === option.id ? ' is-on' : ''}`}
                  aria-pressed={rhythm === option.id}
                  onClick={() => setRhythm(option.id)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.body}</span>
                </button>
              ))}
            </div>

            <div className="setup__ask">
              <p className="micro">Ce que le point demande</p>
              <ul>
                <li>Comment c’était : facile, juste, dur.</li>
                <li>La fatigue, de 1 à 5.</li>
                <li>Les séances faites, décomptées depuis le journal.</li>
              </ul>
            </div>

            <div className="setup__recap">
              <p className="micro">Le plan partira de</p>
              <p>
                {GOALS.find((option) => option.id === goal)?.label} · {perWeek} séances de{' '}
                {minutes} min · {days.map((day) => weekdayShort(day)).join(', ')}
              </p>
              <p className="setup__recap-note">
                {profile.sessions > 0
                  ? `${profile.sessions} séances lues sur ${profile.weeks} semaines, ${profile.dominant ? sportLabel(profile.dominant) : 'sans dominante'} en tête.`
                  : 'Journal vide : le plan démarrera prudent.'}
              </p>
            </div>

            <div className="setup__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setStep(1)}>
                Retour
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => onCreate({ goal, sessionsPerWeek: perWeek, minutes, days, rhythm })}
              >
                <Icon name="sparkle" size={16} />
                Créer le programme
              </button>
            </div>
          </div>
        ) : null}

        {step < 2 ? (
          <div className="setup__actions">
            {step > 0 ? (
              <button type="button" className="btn btn--ghost" onClick={() => setStep(step - 1)}>
                Retour
              </button>
            ) : (
              <span className="setup__hint">Rien n’est envoyé : tout se calcule ici.</span>
            )}
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canContinue}
              onClick={() => setStep(step + 1)}
            >
              Continuer
              <Icon name="arrow" size={15} />
            </button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

/** Le point de la semaine : deux réponses, et la suite change. */
function CheckInModal({
  week,
  done,
  onClose,
  onSave,
}: {
  week: PlanWeek;
  done: Set<string>;
  onClose: () => void;
  onSave: (checkIn: CheckIn) => void;
}) {
  const [feel, setFeel] = useState<Feel>('juste');
  const [fatigue, setFatigue] = useState(3);
  const doneCount = doneInWeek(week, done);
  const preview = adjustmentFor({ feel, fatigue, done: doneCount, planned: week.sessions.length });

  return (
    <Modal title={`Le point · semaine ${week.index + 1}`} eyebrow="Suivi" onClose={onClose}>
      <div className="form">
        <div className="coach-mini">
          <span>
            <b>{doneCount}</b> / {week.sessions.length} séances faites
          </span>
          <span>{week.minutes} min planifiées</span>
        </div>

        <div className="field">
          <span className="field__label">C’était</span>
          <div className="segmented" role="group" aria-label="Ressenti">
            {(['facile', 'juste', 'dur'] as Feel[]).map((option) => (
              <button
                key={option}
                type="button"
                className={feel === option ? 'is-on' : ''}
                aria-pressed={feel === option}
                onClick={() => setFeel(option)}
              >
                {feelLabel(option)}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field__label">
            Fatigue <em>1 = frais · 5 = épuisé</em>
          </span>
          <div className="coach-fatigue" role="group" aria-label="Fatigue">
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                type="button"
                className={fatigue === level ? 'is-on' : ''}
                aria-pressed={fatigue === level}
                onClick={() => setFatigue(level)}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <p className="coach-preview">
          <Icon name="sparkle" size={15} />
          {preview.note}
        </p>

        <p className="setup__hint">
          Le plan reste entre −{Math.round((1 - MIN_PLAN_FACTOR) * 100)} % et +
          {Math.round((MAX_PLAN_FACTOR - 1) * 100)} % de sa version initiale. Un point
          ne touche jamais une séance déjà passée.
        </p>

        <div className="setup__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Plus tard
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() =>
              onSave({
                week: week.index,
                date: todayISO(),
                feel,
                fatigue,
                done: doneCount,
                planned: week.sessions.length,
              })
            }
          >
            Enregistrer le point
          </button>
        </div>
      </div>
    </Modal>
  );
}
