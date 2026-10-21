import type { Activity, DayLog } from '../types';
import {
  datePart,
  formatDistance,
  formatDuration,
  formatNumber,
  longDate,
  todayISO,
} from '../lib/dates';
import { records, weekStats } from '../lib/analytics';
import { GoalRing, WeekBars } from '../components/Visuals';
import { SessionRow } from '../components/SessionRow';
import { Icon } from '../components/Icons';
import type { View } from '../views';

export function Today({
  activities,
  days,
  goalMin,
  stepGoal,
  demo,
  onNavigate,
  onAdd,
}: {
  activities: Activity[];
  days: DayLog[];
  goalMin: number;
  stepGoal: number;
  demo: boolean;
  onNavigate: (view: View) => void;
  onAdd: () => void;
}) {
  const today = todayISO();
  const week = weekStats(activities, days, today, goalMin);
  const dayLog = days.find((day) => day.date === today);
  const todaySessions = activities.filter((activity) => datePart(activity.date) === today);
  const recent = activities.slice(0, 5);
  const marks = records(activities, today);
  const todaySteps = dayLog?.steps ?? 0;
  const stepRatio = stepGoal > 0 ? todaySteps / stepGoal : 0;
  const stepPct = Math.min(1, stepRatio);
  const empty = activities.length === 0 && days.length === 0;

  return (
    <section className="screen">
      <header className="screen__head">
        <p className="eyebrow">{longDate(today)}</p>
        <h1 className="screen__title">
          Votre <em>semaine</em> en un regard.
        </h1>
        <p className="screen__lede">
          {empty
            ? 'Ajoutez une séance à la main, ou importez ce que votre montre et votre téléphone ont déjà compté.'
            : `${week.sessions} séance${week.sessions > 1 ? 's' : ''} ces sept derniers jours, ${formatDistance(
                week.distanceKm,
              )} parcourus et ${formatNumber(week.steps)} pas.`}
        </p>
      </header>

      {demo ? (
        <p className="demo-banner">
          <i aria-hidden="true" />
          <span className="demo-banner__long">
            Données de démonstration — remplacez-les en important votre export ou en
            ajoutant une séance.
          </span>
          <span className="demo-banner__short">
            Démo — importez votre export ou ajoutez une séance.
          </span>
        </p>
      ) : null}

      {empty ? (
        <div className="empty">
          <div className="empty__mark">
            <Icon name="activity" size={26} />
          </div>
          <h2>Le journal est encore vierge.</h2>
          <p>
            Battement ne demande aucun compte et n’envoie rien. Il lit les exports
            que vous choisissez, sur votre appareil, et garde le reste ici.
          </p>
          <div className="empty__actions">
            <button type="button" className="btn btn--primary" onClick={onNavigate.bind(null, 'import')}>
              <Icon name="import" size={17} /> Importer mes données
            </button>
            <button type="button" className="btn btn--ghost" onClick={onAdd}>
              <Icon name="plus" size={17} /> Ajouter à la main
            </button>
          </div>
          <dl className="empty__facts">
            <div>
              <dt>Apple Santé</dt>
              <dd>le fichier export.zip</dd>
            </div>
            <div>
              <dt>Samsung Health</dt>
              <dd>les CSV de l’export personnel</dd>
            </div>
            <div>
              <dt>Stockage</dt>
              <dd>dans ce navigateur, uniquement</dd>
            </div>
          </dl>
        </div>
      ) : (
        <>
          <div className="today-grid">
            <article className="card card--goal">
              <header className="card__head">
                <span className="card__label">Objectif de la semaine</span>
                <span className="card__meta">7 jours glissants</span>
              </header>
              <div className="goal">
                <GoalRing value={week.minutes} goal={goalMin} />
                <div className="goal__numbers">
                  <p>
                    <strong>{formatDuration(week.minutes)}</strong>
                    <span>sur {formatDuration(goalMin)}</span>
                  </p>
                  <ul className="goal__list">
                    <li>
                      <Icon name="flame" size={15} />
                      {formatNumber(week.calories)} kcal
                    </li>
                    <li>
                      <Icon name="route" size={15} />
                      {formatDistance(week.distanceKm)}
                    </li>
                    <li>
                      <Icon name="heart" size={15} />
                      {week.sessions} séance{week.sessions > 1 ? 's' : ''}
                    </li>
                  </ul>
                </div>
              </div>
              <WeekBars bars={week.bars} goal={goalMin / 7} />
            </article>

            <article className="card card--today">
              <header className="card__head">
                <span className="card__label">Aujourd’hui</span>
                <span className="card__meta">pas et séances</span>
              </header>

              <div className="steps">
                <div className="steps__top">
                  <span className="steps__icon">
                    <Icon name="steps" size={18} />
                  </span>
                  <p>
                    <strong>{formatNumber(todaySteps)}</strong>
                    <span>pas</span>
                  </p>
                  <span className="steps__goal">
                    {Math.round(stepRatio * 100)}% de {formatNumber(stepGoal)}
                  </span>
                </div>
                <span className="steps__track">
                  <i style={{ width: `${stepPct * 100}%` }} />
                </span>
              </div>

              <div className="today__sessions">
                {todaySessions.length > 0 ? (
                  <ul className="sessions">
                    {todaySessions.map((activity) => (
                      <SessionRow key={activity.id} activity={activity} />
                    ))}
                  </ul>
                ) : (
                  <div className="today__none">
                    <p>Aucune séance enregistrée aujourd’hui.</p>
                    <button type="button" className="textlink" onClick={onAdd}>
                      Ajouter une séance <Icon name="arrow" size={15} />
                    </button>
                  </div>
                )}
              </div>

              <div className="today__week">
                <div>
                  <span className="micro">Série</span>
                  <strong>
                    {marks.streakDays} jour{marks.streakDays > 1 ? 's' : ''}
                  </strong>
                </div>
                <div>
                  <span className="micro">Cette semaine</span>
                  <strong>{formatDuration(week.minutes)}</strong>
                </div>
                <div>
                  <span className="micro">Pas</span>
                  <strong>{formatNumber(week.steps)}</strong>
                </div>
              </div>
            </article>
          </div>

          <div className="columns">
            <section className="card">
              <header className="card__head">
                <span className="card__label">Dernières séances</span>
                <button
                  type="button"
                  className="textlink"
                  onClick={() => onNavigate('activity')}
                >
                  Tout voir <Icon name="arrow" size={14} />
                </button>
              </header>
              <ul className="sessions sessions--roomy">
                {recent.map((activity) => (
                  <SessionRow key={activity.id} activity={activity} showDate />
                ))}
              </ul>
            </section>

            <aside className="card card--marks">
              <header className="card__head">
                <span className="card__label">Repères</span>
                <span className="card__meta">depuis le début</span>
              </header>
              <dl className="marks">
                <div>
                  <dt>Sorties</dt>
                  <dd>{marks.totalActivities}</dd>
                </div>
                <div>
                  <dt>Temps actif</dt>
                  <dd>{formatDuration(marks.totalMinutes)}</dd>
                </div>
                <div>
                  <dt>Plus longue</dt>
                  <dd>{formatDuration(marks.longestMin)}</dd>
                </div>
                <div>
                  <dt>Meilleure semaine</dt>
                  <dd>{formatDuration(marks.bestWeekMin)}</dd>
                </div>
              </dl>
              <button type="button" className="btn btn--ghost btn--full" onClick={() => onNavigate('progress')}>
                Voir les progrès <Icon name="chart" size={16} />
              </button>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
