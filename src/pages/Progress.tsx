import { useState } from 'react';
import { usePulse } from '../store';
import { useUi } from '../lib/uiStore';
import {
  activityHeatmap,
  loadSeries,
  records,
  sleepSeries,
  summary,
  typeBreakdown,
  weightSeries,
  type DataSlice,
  type SeriesPoint,
} from '../lib/analytics';
import { addDays, formatMedium, todayISO } from '../lib/dates';
import { fmtDecimal, fmtMinutes, fmtNumber } from '../lib/format';
import { buildExport, downloadFile, exportDate, workoutsCsv } from '../lib/export';
import { PageHeader, SectionCard, StatTile, EmptyState } from '../components/Page';
import { BarChart, Heatmap, LineChart, ProgressBar } from '../components/Charts';
import { Icon } from '../components/Icon';
import { WORKOUT_COLORS } from '../types';

const RANGES = [
  { label: '4 semaines', weeks: 4 },
  { label: '12 semaines', weeks: 12 },
  { label: '26 semaines', weeks: 26 },
];

function weeklyLoad(data: DataSlice, today: string, weeks: number): SeriesPoint[] {
  return Array.from({ length: weeks }, (_, index) => {
    const end = addDays(today, -(weeks - 1 - index) * 7);
    return { date: end, value: Math.round(loadSeries(data, end, 7).reduce((sum, point) => sum + (point.value ?? 0), 0)) };
  });
}

export function ProgressPage() {
  const data = usePulse();
  const notify = useUi((state) => state.notify);
  const [weeks, setWeeks] = useState(12);
  const today = todayISO();
  const days = weeks * 7;
  const totals = summary(data, today, days);
  const weekly = weeklyLoad(data, today, weeks);
  const sleep = sleepSeries(data, today, 30);
  const weight = weightSeries(data, today, 90);
  const heatmap = activityHeatmap(data, today, 18);
  const types = typeBreakdown(data, today, days);
  const bests = records(data, today);
  const hasData = data.workouts.length > 0 || data.sleeps.length > 0 || data.body.length > 0;

  const exportJson = () => {
    const bundle = buildExport({
      profile: data.profile,
      goals: data.goals,
      workouts: data.workouts,
      sleeps: data.sleeps,
      body: data.body,
      meals: data.meals,
      days: data.days,
    });
    downloadFile(
      `battement-${exportDate()}.json`,
      JSON.stringify(bundle, null, 2),
      'application/json'
    );
    notify('Export JSON téléchargé.', 'success');
  };

  const exportCsv = () => {
    if (data.workouts.length === 0) {
      notify('Aucune séance à exporter.', 'error');
      return;
    }
    downloadFile(`battement-seances-${exportDate()}.csv`, workoutsCsv(data.workouts), 'text/csv');
    notify('Export CSV téléchargé.', 'success');
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Tendances"
        title={
          <>
            Progrès<span className="title-dot">.</span>
          </>
        }
        subtitle="Les chiffres qui comptent sur la durée, pas ceux d’un seul jour."
        actions={
          <div className="head-actions">
            <button type="button" className="btn btn--ghost" onClick={exportCsv}>
              <Icon name="download" size={16} /> CSV
            </button>
            <button type="button" className="btn btn--primary" onClick={exportJson}>
              <Icon name="download" size={16} /> Exporter tout
            </button>
          </div>
        }
      />

      <div className="rangebar">
        <div className="chips" role="group" aria-label="Période analysée">
          {RANGES.map((range) => (
            <button
              key={range.weeks}
              type="button"
              className={`chip${weeks === range.weeks ? ' is-active' : ''}`}
              onClick={() => setWeeks(range.weeks)}
              aria-pressed={weeks === range.weeks}
            >
              {range.label}
            </button>
          ))}
        </div>
        <span className="rangebar__note">
          {totals.sessions} séance{totals.sessions > 1 ? 's' : ''} · {Math.round(totals.minutes)} min
        </span>
      </div>

      {!hasData ? (
        <SectionCard>
          <EmptyState
            icon="progress"
            title="Les tendances arrivent avec les données"
            text="Ajoutez quelques séances et nuits, ou importez votre historique Apple Health / Samsung Health. Les graphiques se construiront à partir de vos vraies mesures."
          />
        </SectionCard>
      ) : (
        <>
          <div className="stats-grid">
            <StatTile label="Séances" value={totals.sessions} icon="activity" tone="var(--coral)" detail={`${totals.activeDays} jours actifs`} />
            <StatTile label="Volume" value={Math.round(totals.minutes)} unit="min" icon="clock" tone="var(--brand)" detail={fmtMinutes(totals.minutes)} />
            <StatTile label="Distance" value={fmtDecimal(totals.distanceKm)} unit="km" icon="route" tone="var(--cyan)" />
            <StatTile label="Dépense" value={fmtNumber(totals.calories)} unit="kcal" icon="flame" tone="var(--amber)" detail={`${weeks} semaines`} />
          </div>

          <div className="two-col two-col--wide">
            <SectionCard
              title="Charge hebdomadaire"
              subtitle="Somme des points d’entraînement par semaine"
              className="chartcard"
            >
              <BarChart
                points={weekly}
                color="var(--brand)"
                height={200}
                formatValue={(value) => `${fmtNumber(value)} pts`}
                label={`Charge hebdomadaire sur ${weeks} semaines`}
                emptyLabel="Aucune charge sur la période"
                tickFormat={formatMedium}
                tickEvery={weeks > 12 ? 4 : 2}
              />
            </SectionCard>

            <SectionCard title="Temps par activité" subtitle={`${weeks} semaines`}>
              {types.length === 0 ? (
                <EmptyState icon="activity" title="Aucune activité" text="Rien à répartir sur cette période." />
              ) : (
                <ul className="breakdown">
                  {types.slice(0, 5).map((type) => (
                    <li key={type.type}>
                      <div className="breakdown__head">
                        <span>{type.type}</span>
                        <em>{fmtMinutes(type.minutes)}</em>
                      </div>
                      <ProgressBar
                        value={type.minutes}
                        goal={types[0]?.minutes ?? 1}
                        color={WORKOUT_COLORS[type.type as keyof typeof WORKOUT_COLORS] ?? 'var(--brand)'}
                        label={`Temps de ${type.type}`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          <div className="two-col">
            <SectionCard title="Sommeil" subtitle="30 dernières nuits" className="chartcard">
              <LineChart
                points={sleep}
                color="var(--violet)"
                height={190}
                goal={data.goals.sleepHours * 60}
                formatValue={(value) => fmtMinutes(value)}
                label="Sommeil des 30 dernières nuits"
                emptyLabel="Aucune nuit enregistrée"
              />
            </SectionCard>
            <SectionCard title="Poids" subtitle="90 derniers jours" className="chartcard">
              <LineChart
                points={weight}
                color="var(--coral)"
                height={190}
                goal={data.goals.weightKg}
                formatValue={(value) => `${fmtDecimal(value)} kg`}
                label="Poids sur 90 jours"
                emptyLabel="Ajoutez des mesures pour voir la tendance"
              />
            </SectionCard>
          </div>

          <SectionCard
            title="Régularité"
            subtitle="Chaque carré est un jour, 18 semaines"
          >
            <Heatmap days={heatmap} />
          </SectionCard>

          <SectionCard title="Records personnels" subtitle="Vos meilleurs repères, sans compétition">
            <div className="records">
              {bests.map((record) => (
                <article key={record.label} className="record">
                  <span>{record.label}</span>
                  <strong>{record.value}</strong>
                  <em>{record.detail}</em>
                </article>
              ))}
            </div>
          </SectionCard>
        </>
      )}

      <SectionCard title="Vos données" subtitle="Export, portabilité, aucune prise d’otage">
        <div className="exportrow">
          <div>
            <strong>Tout exporter en JSON</strong>
            <p>Profil, objectifs, séances, nuits, mesures, repas et pas quotidiens.</p>
          </div>
          <button type="button" className="btn btn--ghost" onClick={exportJson}>
            <Icon name="download" size={16} /> JSON
          </button>
        </div>
        <div className="exportrow">
          <div>
            <strong>Exporter les séances en CSV</strong>
            <p>Un tableau lisible dans Excel, Numbers ou LibreOffice.</p>
          </div>
          <button type="button" className="btn btn--ghost" onClick={exportCsv}>
            <Icon name="download" size={16} /> CSV
          </button>
        </div>
        <p className="pagenote">
          Aucun export ne part sur un serveur : le fichier est généré dans votre navigateur, puis
          téléchargé localement.
        </p>
      </SectionCard>
    </div>
  );
}
