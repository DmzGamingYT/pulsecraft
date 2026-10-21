import { useMemo } from 'react';
import type { Activity, DayLog, Source, Sport } from '../types';
import { SOURCE_LABELS, sportIcon, sportLabel } from '../types';
import {
  formatDistance,
  formatDuration,
  formatNumber,
  formatPace,
  formatSpeed,
  monthLabel,
  shortDate,
  todayISO,
} from '../lib/dates';
import {
  goalStreak,
  goalWeeks,
  hrZones,
  monthStats,
  records,
  sportRecords,
  sportSplit,
  weekChange,
  weekStats,
  type SportRecord,
} from '../lib/analytics';
import { Consistency, SplitBars } from '../components/Visuals';
import { Icon } from '../components/Icons';

const SOURCES: Source[] = ['apple', 'samsung', 'manuel', 'fichier'];

export function Progress({
  activities,
  days,
  goalMin,
  sessionsGoal,
  distanceGoalKm,
  sportGoals,
  maxHr,
}: {
  activities: Activity[];
  days: DayLog[];
  goalMin: number;
  sessionsGoal: number;
  distanceGoalKm: number;
  sportGoals: Partial<Record<Sport, number>>;
  maxHr: number;
}) {
  const today = todayISO();
  const marks = useMemo(() => records(activities, today), [activities, today]);
  const weeks = useMemo(() => goalWeeks(activities, goalMin, 8, today), [activities, goalMin, today]);
  const slices = useMemo(
    () =>
      sportSplit(activities, 30, today).map((slice) => ({
        sport: slice.sport,
        label: sportLabel(slice.sport),
        icon: sportIcon(slice.sport),
        minutes: slice.minutes,
        sessions: slice.sessions,
      })),
    [activities, today],
  );
  const splitTotal = slices.reduce((sum, slice) => sum + slice.minutes, 0);
  const week = weekStats(activities, days, today, goalMin);
  const change = useMemo(() => weekChange(activities, days, today, goalMin), [activities, days, today, goalMin]);
  const totalSteps = days.reduce((sum, day) => sum + (day.steps ?? 0), 0);
  const streakWeeks = goalStreak(activities, goalMin, today);
  const sourceCounts = useMemo(() => {
    const map = new Map<Source, number>();
    for (const activity of activities) {
      map.set(activity.source, (map.get(activity.source) ?? 0) + 1);
    }
    return map;
  }, [activities]);
  const bestSport = slices[0];
  const perSport = useMemo(() => sportRecords(activities), [activities]);
  const zones = useMemo(() => hrZones(activities, maxHr), [activities, maxHr]);
  const zoneTotal = zones.zones.reduce((sum, zone) => sum + zone.minutes, 0);
  const month = useMemo(() => monthStats(activities, days, today, 0), [activities, days, today]);
  const previousMonth = useMemo(
    () => monthStats(activities, days, today, -1),
    [activities, days, today],
  );
  const sleepNights = days.filter((day) => day.sleepMin !== undefined).length;
  const averageSleep =
    sleepNights > 0
      ? Math.round(days.reduce((sum, day) => sum + (day.sleepMin ?? 0), 0) / sleepNights)
      : 0;
  const restingHrValues = days
    .map((day) => day.restingHr)
    .filter((value): value is number => value !== undefined);

  if (activities.length === 0 && days.length === 0) {
    return (
      <section className="screen">
        <header className="screen__head">
          <p className="eyebrow">Progrès</p>
          <h1 className="screen__title">Les courbes viendront après.</h1>
          <p className="screen__lede">
            Dès la première séance, cette page montre la régularité, les distances
            et les records. Rien à configurer.
          </p>
        </header>
        <div className="empty empty--compact">
          <div className="empty__mark">
            <Icon name="trend" size={24} />
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
        <h1 className="screen__title">La régularité, pas le record.</h1>
        <p className="screen__lede">
          Huit semaines de recul, les disciplines qui prennent le plus de place et
          ce que les appareils ont réellement mesuré.
        </p>
      </header>

      <div className="tiles">
        <article className="tile" data-tone="accent">
          <span className="tile__icon" aria-hidden="true">
            <Icon name="journal" size={17} />
          </span>
          <span className="micro">Séances</span>
          <strong>{marks.totalActivities}</strong>
          <p>depuis le premier import</p>
        </article>
        <article className="tile" data-tone="blue">
          <span className="tile__icon" aria-hidden="true">
            <Icon name="clock" size={17} />
          </span>
          <span className="micro">Temps actif</span>
          <strong>{formatDuration(marks.totalMinutes)}</strong>
          <p>{formatNumber(totalSteps)} pas enregistrés</p>
        </article>
        <article className="tile" data-tone="green">
          <span className="tile__icon" aria-hidden="true">
            <Icon name="route" size={17} />
          </span>
          <span className="micro">Distance</span>
          <strong>{formatDistance(marks.totalDistanceKm)}</strong>
          <p>dont {formatDistance(marks.longestKm)} sur une seule sortie</p>
        </article>
        <article className="tile" data-tone="rose">
          <span className="tile__icon" aria-hidden="true">
            <Icon name="flame" size={17} />
          </span>
          <span className="micro">Objectif tenu</span>
          <strong>{streakWeeks} sem.</strong>
          <p>
            {streakWeeks > 0
              ? 'semaines d’affilée dans l’objectif'
              : 'aucune semaine complète dans l’objectif'}
          </p>
        </article>
      </div>

      <article className="card card--wide delta-card">
        <header className="card__head">
          <span className="card__label">Cette semaine, face à la précédente</span>
          <span className="card__meta">7 jours glissants</span>
        </header>
        <div className="deltas">
          <Delta label="Temps actif" value={formatDuration(week.minutes)} change={change.minutes} />
          <Delta label="Séances" value={String(week.sessions)} change={change.sessions} />
          <Delta label="Distance" value={formatDistance(week.distanceKm)} change={change.distanceKm} />
          <Delta label="Pas" value={formatNumber(week.steps)} change={change.steps} />
        </div>
        <p className="card__note">
          Comparé aux sept jours qui précèdent ({formatDuration(change.previous.minutes)} d’activité).
        </p>
      </article>

      <div className="progress-grid">
        <section className="card card--wide">
          <header className="card__head">
            <span className="card__label">Huit semaines</span>
            <span className="card__meta">
              moyenne{' '}
              {formatDuration(
                Math.round(weeks.reduce((sum, bucket) => sum + bucket.minutes, 0) / weeks.length),
              )}
            </span>
          </header>
          <Consistency weeks={weeks} goal={goalMin} />
          <footer className="card__foot">
            <span>
              Meilleure semaine : <strong>{formatDuration(marks.bestWeekMin)}</strong>
            </span>
            <span className="card__foot-key">
              <i aria-hidden="true" /> Objectif : <strong>{formatDuration(goalMin)}</strong> / semaine
            </span>
          </footer>
          <ChartTable
            caption="Minutes actives par semaine"
            head={['Semaine du', 'Minutes', 'Séances', 'Objectif']}
            rows={weeks.map((entry) => [
              shortDate(entry.start),
              formatDuration(entry.minutes),
              String(entry.sessions),
              entry.met ? 'Tenu' : 'Non tenu',
            ])}
          />
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
                  ? `${bestSport.label} occupe ${Math.round(
                      (bestSport.minutes / splitTotal) * 100,
                    )} % du temps actif.`
                  : 'Aucune séance sur la période.'}
              </p>
              <ChartTable
                caption="Répartition sur trente jours"
                head={['Discipline', 'Temps', 'Séances']}
                rows={slices.map((slice) => [
                  slice.label,
                  formatDuration(slice.minutes),
                  String(slice.sessions),
                ])}
              />
            </>
          ) : (
            <p className="no-result">Aucune séance sur les 30 derniers jours.</p>
          )}
        </section>

        <section className="card">
          <header className="card__head">
            <span className="card__label">Objectifs</span>
            <span className="card__meta">cette semaine</span>
          </header>
          <ul className="goal-list">
            <GoalLine label="Minutes actives" value={week.minutes} goal={goalMin} />
            {sessionsGoal > 0 ? (
              <GoalLine label="Séances" value={week.sessions} goal={sessionsGoal} />
            ) : null}
            {distanceGoalKm > 0 ? (
              <GoalLine
                label="Distance"
                value={week.distanceKm}
                goal={distanceGoalKm}
                format={(value) => formatDistance(value)}
              />
            ) : null}
            {(Object.entries(sportGoals) as [Sport, number][])
              .filter(([, goal]) => goal > 0)
              .map(([sport, goal]) => (
                <GoalLine
                  key={sport}
                  label={sportLabel(sport)}
                  value={activities
                    .filter(
                      (activity) =>
                        activity.sport === sport &&
                        activity.date.slice(0, 10) >= week.start &&
                        activity.date.slice(0, 10) <= week.end,
                    )
                    .reduce((sum, activity) => sum + activity.durationMin, 0)}
                  goal={goal}
                />
              ))}
          </ul>
          <div className="weekbar">
            <i
              style={{
                width: `${Math.min(100, Math.round((week.minutes / Math.max(1, goalMin)) * 100))}%`,
              }}
            />
          </div>
          <p className="card__note">
            {Math.round((week.minutes / Math.max(1, goalMin)) * 100)} % de l’objectif hebdomadaire de
            minutes.
          </p>
        </section>

        <section className="card">
          <header className="card__head">
            <span className="card__label">Zones cardiaques</span>
            <span className="card__meta">FC max {zones.maxHr} bpm</span>
          </header>
          {zoneTotal > 0 ? (
            <>
              <ul className="zones">
                {zones.zones.map((zone) => (
                  <li key={zone.zone} data-zone={zone.zone}>
                    <span className="zones__label">
                      Z{zone.zone} · {zone.label}
                    </span>
                    <span className="zones__track">
                      <i style={{ width: `${Math.max(2, (zone.minutes / zoneTotal) * 100)}%` }} />
                    </span>
                    <span className="zones__value">{formatDuration(zone.minutes)}</span>
                  </li>
                ))}
              </ul>
              <p className="card__note">
                Estimation à partir de la FC moyenne de chaque séance. La FC max vient de vos
                séances, ou des réglages quand vous la connaissez.
              </p>
              <ChartTable
                caption="Temps par zone cardiaque"
                head={['Zone', 'Plage', 'Temps']}
                rows={zones.zones.map((zone) => [
                  `Z${zone.zone} ${zone.label}`,
                  zoneRange(zone.zone, zones.maxHr),
                  formatDuration(zone.minutes),
                ])}
              />
            </>
          ) : (
            <p className="no-result">
              Aucune séance avec fréquence cardiaque : les imports Apple et Samsung la donnent.
            </p>
          )}
        </section>

        <section className="card card--wide">
          <header className="card__head">
            <span className="card__label">Records par discipline</span>
            <span className="card__meta">depuis le début</span>
          </header>
          {perSport.length > 0 ? (
            <ul className="records">
              {perSport.map((record) => (
                <li key={record.sport} data-sport={record.sport}>
                  <span className="records__glyph" aria-hidden="true">
                    <Icon name={sportIcon(record.sport)} size={17} />
                  </span>
                  <span className="records__name">
                    <strong>{sportLabel(record.sport)}</strong>
                    <em>{record.sessions} séances</em>
                  </span>
                  <span className="records__stat">
                    <em>Plus longue</em>
                    <strong>{formatDuration(record.longestMin)}</strong>
                  </span>
                  <span className="records__stat">
                    <em>Plus loin</em>
                    <strong>{record.longestKm > 0 ? formatDistance(record.longestKm) : '—'}</strong>
                  </span>
                  <span className="records__stat">
                    <em>{record.sport === 'velo' ? 'Meilleure vitesse' : 'Meilleure allure'}</em>
                    <strong>{bestMovement(record)}</strong>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="card">
          <header className="card__head">
            <span className="card__label">Ce mois-ci</span>
            <span className="card__meta">{month.label}</span>
          </header>
          <div className="month">
            <div>
              <span className="micro">Séances</span>
              <strong>{month.sessions}</strong>
              <DeltaTag value={month.sessions} previous={previousMonth.sessions} />
            </div>
            <div>
              <span className="micro">Temps actif</span>
              <strong>{formatDuration(month.minutes)}</strong>
              <DeltaTag value={month.minutes} previous={previousMonth.minutes} />
            </div>
            <div>
              <span className="micro">Distance</span>
              <strong>{formatDistance(month.distanceKm)}</strong>
              <DeltaTag value={month.distanceKm} previous={previousMonth.distanceKm} />
            </div>
            <div>
              <span className="micro">Jours actifs</span>
              <strong>{month.activeDays}</strong>
              <DeltaTag value={month.activeDays} previous={previousMonth.activeDays} />
            </div>
          </div>
          <p className="card__note">
            {previousMonth.label} : {previousMonth.sessions} séances ·{' '}
            {formatDuration(previousMonth.minutes)}.
          </p>
        </section>

        <section className="card">
          <header className="card__head">
            <span className="card__label">Sommeil et cœur</span>
            <span className="card__meta">moyennes</span>
          </header>
          {sleepNights > 0 || restingHrValues.length > 0 ? (
            <dl className="health">
              {sleepNights > 0 ? (
                <div>
                  <dt>Sommeil</dt>
                  <dd>
                    {Math.floor(averageSleep / 60)} h{' '}
                    {String(averageSleep % 60).padStart(2, '0')}
                  </dd>
                  <em>{sleepNights} nuits importées</em>
                </div>
              ) : null}
              {restingHrValues.length > 0 ? (
                <div>
                  <dt>FC de repos</dt>
                  <dd>
                    {Math.round(
                      restingHrValues.reduce((sum, value) => sum + value, 0) /
                        restingHrValues.length,
                    )}{' '}
                    bpm
                  </dd>
                  <em>moyenne des jours importés</em>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="no-result">
              Importez un export Apple Santé ou Samsung Health récent pour voir le sommeil et la
              FC de repos.
            </p>
          )}
          <p className="card__note">
            {days.length} journée{days.length > 1 ? 's' : ''} conservée{days.length > 1 ? 's' : ''}.
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
                <li key={source} data-source={source}>
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
            {monthLabel(today)} · le maximum par jour est gardé pour les pas, jamais la somme des
            appareils.
          </p>
        </section>
      </div>
    </section>
  );
}

function Delta({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: number | null;
}) {
  return (
    <div className="delta">
      <span className="micro">{label}</span>
      <strong>{value}</strong>
      <DeltaTag pct={change} />
    </div>
  );
}

function DeltaTag({
  pct,
  value,
  previous,
}: {
  pct?: number | null;
  value?: number;
  previous?: number;
}) {
  const change =
    pct !== undefined
      ? pct
      : value !== undefined && previous !== undefined && previous > 0
        ? Math.round(((value - previous) / previous) * 100)
        : null;
  if (change === null) return <em className="delta__tag is-flat">nouveau</em>;
  if (change === 0) return <em className="delta__tag is-flat">stable</em>;
  return (
    <em className={`delta__tag ${change > 0 ? 'is-up' : 'is-down'}`}>
      {change > 0 ? '↑' : '↓'} {Math.abs(change)} %
    </em>
  );
}

function GoalLine({
  label,
  value,
  goal,
  format = (input: number) => formatDuration(input),
}: {
  label: string;
  value: number;
  goal: number;
  format?: (value: number) => string;
}) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <li>
      <span className="goal-list__label">{label}</span>
      <span className="goal-list__value">
        <strong>{format(value)}</strong> / {format(goal)}
      </span>
      <span className="goal-list__track">
        <i style={{ width: `${pct}%` }} />
      </span>
    </li>
  );
}

function ChartTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: string[][];
}) {
  return (
    <details className="chart-table">
      <summary>Voir les données</summary>
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join('|')}>
              {row.map((cell, index) =>
                index === 0 ? (
                  <th key={`${cell}-${index}`} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={`${cell}-${index}`}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** « 5:24 /km » ou « 23,4 km/h », selon la discipline. */
function bestMovement(record: SportRecord): string {
  if (record.sport === 'velo') {
    return record.bestSpeed ? formatSpeed(record.bestSpeed) : '—';
  }
  return record.bestPace ? formatPace(record.bestPace) : '—';
}

function zoneRange(zone: number, maxHr: number): string {
  const ranges: Record<number, [number, number]> = {
    1: [0, 0.6],
    2: [0.6, 0.7],
    3: [0.7, 0.8],
    4: [0.8, 0.9],
    5: [0.9, 1.2],
  };
  const [from, to] = ranges[zone] ?? [0, 1];
  return `${Math.round(from * maxHr)}–${Math.round(Math.min(1.2, to) * maxHr)} bpm`;
}
