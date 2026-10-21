import { useMemo } from 'react';
import type { Activity, DayLog, Source } from '../types';
import { SOURCE_LABELS, sportGlyph, sportLabel } from '../types';
import { formatDistance, formatDuration, formatNumber } from '../lib/dates';
import { records, sportSplit, weekBuckets, weekStats } from '../lib/analytics';
import { Consistency, SplitBars } from '../components/Visuals';
import { Icon } from '../components/Icons';

const SOURCES: Source[] = ['apple', 'samsung', 'manuel'];

export function Progress({
  activities,
  days,
  goalMin,
}: {
  activities: Activity[];
  days: DayLog[];
  goalMin: number;
}) {
  const marks = useMemo(() => records(activities), [activities]);
  const buckets = useMemo(() => weekBuckets(activities, 8), [activities]);
  const slices = useMemo(
    () =>
      sportSplit(activities, 30).map((slice) => ({
        label: sportLabel(slice.sport),
        glyph: sportGlyph(slice.sport),
        minutes: slice.minutes,
        sessions: slice.sessions,
      })),
    [activities],
  );
  const splitTotal = slices.reduce((sum, slice) => sum + slice.minutes, 0);
  const week = weekStats(activities, days, undefined, goalMin);
  const weekRatio = goalMin > 0 ? week.minutes / goalMin : 0;
  const totalSteps = days.reduce((sum, day) => sum + (day.steps ?? 0), 0);
  const sourceCounts = useMemo(() => {
    const map = new Map<Source, number>();
    for (const activity of activities) {
      map.set(activity.source, (map.get(activity.source) ?? 0) + 1);
    }
    return map;
  }, [activities]);
  const bestSport = slices[0];

  if (activities.length === 0 && days.length === 0) {
    return (
      <section className="screen">
        <header className="screen__head">
          <p className="eyebrow">Progrès</p>
          <h1 className="screen__title">
            Les courbes viendront après.
          </h1>
          <p className="screen__lede">
            Dès la première séance, cette page montre la régularité, les distances
            et les records. Rien à configurer.
          </p>
        </header>
        <div className="empty empty--compact">
          <div className="empty__mark">
            <Icon name="chart" size={24} />
          </div>
          <h2>Pas encore de courbe.</h2>
          <p>Ajoutez une séance ou importez un export pour commencer à mesurer.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="screen">
      <header className="screen__head">
        <p className="eyebrow">Progrès</p>
        <h1 className="screen__title">
          La régularité, pas le record.
        </h1>
        <p className="screen__lede">
          Huit semaines de recul, les disciplines qui prennent le plus de place et
          ce que les appareils ont réellement mesuré.
        </p>
      </header>

      <div className="tiles">
        <article className="tile">
          <span className="micro">Séances</span>
          <strong>{marks.totalActivities}</strong>
          <p>depuis le premier import</p>
        </article>
        <article className="tile">
          <span className="micro">Temps actif</span>
          <strong>{formatDuration(marks.totalMinutes)}</strong>
          <p>{formatNumber(totalSteps)} pas enregistrés</p>
        </article>
        <article className="tile">
          <span className="micro">Distance</span>
          <strong>{formatDistance(marks.totalDistanceKm)}</strong>
          <p>
            dont {formatDistance(marks.longestKm)} sur une seule sortie
          </p>
        </article>
        <article className="tile">
          <span className="micro">Série</span>
          <strong>
            {marks.streakDays} <em>j</em>
          </strong>
          <p>jours consécutifs avec une séance</p>
        </article>
      </div>

      <div className="progress-grid">
        <section className="card card--wide">
          <header className="card__head">
            <span className="card__label">Huit semaines</span>
            <span className="card__meta">
              moyenne {formatDuration(
                Math.round(buckets.reduce((sum, bucket) => sum + bucket.minutes, 0) / buckets.length),
              )}
            </span>
          </header>
          <Consistency weeks={buckets} goal={goalMin} />
          <footer className="card__foot">
            <span>
              Meilleure semaine : <strong>{formatDuration(marks.bestWeekMin)}</strong>
            </span>
            <span className="card__foot-key">
              <i aria-hidden="true" /> Objectif : <strong>{formatDuration(goalMin)}</strong> / semaine
            </span>
          </footer>
        </section>

        <section className="card">
          <header className="card__head">
            <span className="card__label">Répartition</span>
            <span className="card__meta">30 derniers jours</span>
          </header>
          {slices.length > 0 ? (
            <>
              <SplitBars slices={slices} total={splitTotal} />
              <p className="card__note">
                {bestSport
                  ? `${bestSport.label} occupe ${Math.round((bestSport.minutes / splitTotal) * 100)} % du temps actif.`
                  : 'Aucune séance sur la période.'}
              </p>
            </>
          ) : (
            <p className="no-result">Aucune séance sur les 30 derniers jours.</p>
          )}
        </section>

        <section className="card">
          <header className="card__head">
            <span className="card__label">Cette semaine</span>
            <span className="card__meta">7 jours glissants</span>
          </header>
          <div className="mini-stats">
            <div>
              <span className="micro">Actif</span>
              <strong>{formatDuration(week.minutes)}</strong>
            </div>
            <div>
              <span className="micro">Séances</span>
              <strong>{week.sessions}</strong>
            </div>
            <div>
              <span className="micro">Calories</span>
              <strong>{formatNumber(week.calories)}</strong>
            </div>
            <div>
              <span className="micro">Pas</span>
              <strong>{formatNumber(week.steps)}</strong>
            </div>
          </div>
          <div className="weekbar">
            <i style={{ width: `${Math.min(100, Math.round(weekRatio * 100))}%` }} />
          </div>
          <p className="card__note">
            {Math.round(weekRatio * 100)} % de l’objectif hebdomadaire.
          </p>
        </section>

        <section className="card">
          <header className="card__head">
            <span className="card__label">D’où viennent les données</span>
            <span className="card__meta">sources</span>
          </header>
          <ul className="sources-list">
            {SOURCES.map((source) => {
              const count = sourceCounts.get(source) ?? 0;
              return (
                <li key={source}>
                  <span className="sources-list__badge" data-source={source}>
                    {SOURCE_LABELS[source]}
                  </span>
                  <span className="sources-list__track">
                    <i
                      style={{
                        width: `${activities.length > 0 ? (count / activities.length) * 100 : 0}%`,
                      }}
                    />
                  </span>
                  <strong>{count}</strong>
                </li>
              );
            })}
          </ul>
          <p className="card__note">
            {days.length} journée{days.length > 1 ? 's' : ''} de pas conservée
            {days.length > 1 ? 's' : ''} — le maximum par jour, jamais la somme des
            appareils.
          </p>
        </section>
      </div>
    </section>
  );
}
