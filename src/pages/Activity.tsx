import { useMemo, useState } from 'react';
import { usePulse } from '../store';
import { useUi } from '../lib/uiStore';
import { loadSeries, summary, typeBreakdown } from '../lib/analytics';
import { formatLong, relativeDay, todayISO } from '../lib/dates';
import { fmtDecimal, fmtMinutes, fmtNumber } from '../lib/format';
import { PageHeader, SectionCard, StatTile, EmptyState } from '../components/Page';
import { BarChart, ProgressBar } from '../components/Charts';
import { WorkoutRow } from '../components/WorkoutRow';
import { WorkoutModal } from '../components/Forms';
import { Icon } from '../components/Icon';
import { WORKOUT_COLORS } from '../types';

export function ActivityPage() {
  const data = usePulse();
  const removeWorkout = usePulse((state) => state.removeWorkout);
  const loadDemo = usePulse((state) => state.loadDemo);
  const notify = useUi((state) => state.notify);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('Toutes');
  const today = todayISO();
  const week = summary(data, today, 7);
  const load = loadSeries(data, today, 14);
  const types = typeBreakdown(data, today, 28);

  const filtered = useMemo(
    () => data.workouts.filter((workout) => filter === 'Toutes' || workout.type === filter),
    [data.workouts, filter]
  );

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const workout of filtered) {
      const list = map.get(workout.date) ?? [];
      list.push(workout);
      map.set(workout.date, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const availableTypes = useMemo(
    () => [...new Set(data.workouts.map((workout) => workout.type))].sort(),
    [data.workouts]
  );

  return (
    <div className="page">
      <PageHeader
        eyebrow="Journal"
        title={
          <>
            Activité<span className="title-dot">.</span>
          </>
        }
        subtitle={
          week.sessions > 0
            ? `${week.sessions} séance${week.sessions > 1 ? 's' : ''} ces 7 derniers jours · ${Math.round(
                week.minutes
              )} min · ${fmtDecimal(week.distanceKm)} km`
            : 'Chaque séance compte. Commencez par une marche, une course ou une séance de renforcement.'
        }
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setOpen(true)}>
            <Icon name="plus" size={17} /> Nouvelle séance
          </button>
        }
      />

      <div className="stats-grid">
        <StatTile label="Séances (7 j)" value={week.sessions} icon="activity" tone="var(--coral)" detail={`${week.activeDays} jours actifs`} />
        <StatTile label="Durée" value={Math.round(week.minutes)} unit="min" icon="clock" tone="var(--brand)" detail={`moy. ${week.sessions ? Math.round(week.minutes / week.sessions) : 0} min`} />
        <StatTile label="Distance" value={fmtDecimal(week.distanceKm)} unit="km" icon="route" tone="var(--cyan)" />
        <StatTile label="Charge" value={fmtNumber(week.load)} unit="pts" icon="flame" tone="var(--amber)" detail={`${fmtNumber(week.calories)} kcal`} />
      </div>

      <div className="two-col">
        <SectionCard
          title="Charge des 14 derniers jours"
          subtitle="Plus la barre est haute, plus la journée a pesé"
          className="chartcard"
        >
          <BarChart
            points={load}
            color="var(--brand)"
            height={170}
            formatValue={(value) => `${fmtNumber(value)} pts`}
            label="Charge d’entraînement des 14 derniers jours"
            emptyLabel="Aucune charge enregistrée sur la période"
            highlightLast
          />
        </SectionCard>

        <SectionCard title="Répartition sur 28 jours" subtitle="Temps par activité" className="chartcard">
          {types.length === 0 ? (
            <EmptyState
              icon="activity"
              title="Pas encore de répartition"
              text="Ajoutez quelques séances pour voir où passe votre temps d’entraînement."
            />
          ) : (
            <ul className="breakdown">
              {types.slice(0, 5).map((type) => {
                const max = types[0]?.minutes ?? 1;
                return (
                  <li key={type.type}>
                    <div className="breakdown__head">
                      <span>{type.type}</span>
                      <em>
                        {fmtMinutes(type.minutes)} · {type.sessions} séance{type.sessions > 1 ? 's' : ''}
                      </em>
                    </div>
                    <ProgressBar
                      value={type.minutes}
                      goal={max}
                      color={WORKOUT_COLORS[type.type as keyof typeof WORKOUT_COLORS] ?? 'var(--brand)'}
                      label={`Temps de ${type.type}`}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="filterbar">
        <div className="chips" role="group" aria-label="Filtrer par activité">
          {['Toutes', ...availableTypes].map((type) => (
            <button
              key={type}
              type="button"
              className={`chip${filter === type ? ' is-active' : ''}`}
              onClick={() => setFilter(type)}
              aria-pressed={filter === type}
            >
              {type}
            </button>
          ))}
        </div>
        <span className="filterbar__count">
          {filtered.length} séance{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      {groups.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon="activity"
            title={data.workouts.length === 0 ? 'Votre journal est vide' : 'Aucune séance pour ce filtre'}
            text={
              data.workouts.length === 0
                ? 'Ajoutez votre première séance, importez un fichier GPX ou chargez la démonstration.'
                : 'Essayez « Toutes » ou choisissez une autre activité.'
            }
            action={
              data.workouts.length === 0 ? (
                <div className="empty__buttons">
                  <button type="button" className="btn btn--primary btn--small" onClick={() => setOpen(true)}>
                    Ajouter une séance
                  </button>
                  <button type="button" className="btn btn--ghost btn--small" onClick={loadDemo}>
                    Voir la démo
                  </button>
                </div>
              ) : undefined
            }
          />
        </SectionCard>
      ) : (
        <div className="daygroups">
          {groups.map(([date, workouts]) => (
            <section className="daygroup" key={date}>
              <header className="daygroup__head">
                <h3>{relativeDay(date)}</h3>
                <span>{formatLong(date)}</span>
                <em>
                  {workouts.reduce((total, workout) => total + workout.durationMin, 0)} min
                </em>
              </header>
              <div className="workout-list">
                {workouts.map((workout) => (
                  <WorkoutRow
                    key={workout.id}
                    workout={workout}
                    onDelete={(id) => {
                      removeWorkout(id);
                      notify('Séance supprimée.', 'info');
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <WorkoutModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
