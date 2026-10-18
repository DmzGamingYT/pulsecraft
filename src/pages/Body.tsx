import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePulse } from '../store';
import { useUi } from '../lib/uiStore';
import { bodyMetrics, weightSeries } from '../lib/analytics';
import { formatLong, relativeDay, todayISO } from '../lib/dates';
import { fmtDecimal, signed } from '../lib/format';
import { PageHeader, SectionCard, StatTile, EmptyState, SourceBadge } from '../components/Page';
import { LineChart, ProgressBar } from '../components/Charts';
import { BodyModal } from '../components/Forms';
import { Icon } from '../components/Icon';

function HistoryRow({ id }: { id: string }) {
  const entry = usePulse((state) => state.body.find((item) => item.id === id));
  const removeBody = usePulse((state) => state.removeBody);
  const notify = useUi((state) => state.notify);
  const [confirming, setConfirming] = useState(false);
  if (!entry) return null;

  return (
    <li className="datarow">
      <span className="datarow__date">
        <strong>{relativeDay(entry.date)}</strong>
        <em>{formatLong(entry.date)}</em>
      </span>
      <span className="datarow__main">
        <strong>{entry.weightKg ? `${fmtDecimal(entry.weightKg)} kg` : '—'}</strong>
        <SourceBadge source={entry.source} />
      </span>
      <span className="datarow__meta">
        {entry.bodyFatPct ? `${fmtDecimal(entry.bodyFatPct)} % MG` : '—'}
        {entry.muscleKg ? ` · ${fmtDecimal(entry.muscleKg)} kg muscle` : ''}
        {entry.waistCm ? ` · ${fmtDecimal(entry.waistCm)} cm taille` : ''}
      </span>
      {confirming ? (
        <span className="datarow__confirm">
          <button
            type="button"
            className="btn btn--danger btn--small"
            onClick={() => {
              removeBody(entry.id);
              notify('Mesure supprimée.', 'info');
            }}
          >
            Supprimer
          </button>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirming(false)}>
            Annuler
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="iconbtn iconbtn--danger"
          onClick={() => setConfirming(true)}
          aria-label={`Supprimer la mesure du ${formatLong(entry.date)}`}
        >
          <Icon name="trash" size={16} />
        </button>
      )}
    </li>
  );
}

export function BodyPage() {
  const data = usePulse();
  const today = todayISO();
  const metrics = bodyMetrics(data);
  const [open, setOpen] = useState(false);
  const series = weightSeries(data, today, 90);
  const history = data.body.filter((entry) => entry.date <= today).slice(0, 30);
  const first = series.find((point) => point.value !== null);
  const target = data.goals.weightKg;
  const targetDelta =
    target && metrics.weight ? Math.round((metrics.weight - target) * 10) / 10 : null;
  const startWeight = first?.value ?? metrics.weight;
  const gained =
    target && startWeight
      ? Math.max(0, Math.min(1, Math.abs(startWeight - target) > 0 ? Math.abs(startWeight - metrics.weight) / Math.abs(startWeight - target) : 1))
      : 0;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Composition"
        title={
          <>
            Corps<span className="title-dot">.</span>
          </>
        }
        subtitle={
          metrics.latest
            ? `Dernière mesure ${relativeDay(metrics.latest.date)} · ${fmtDecimal(metrics.weight)} kg`
            : 'Suivez votre poids et vos mesures sans jugement, pour voir la tendance de fond.'
        }
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setOpen(true)}>
            <Icon name="plus" size={17} /> Nouvelle mesure
          </button>
        }
      />

      <div className="stats-grid">
        <StatTile
          label="Poids"
          value={fmtDecimal(metrics.weight)}
          unit="kg"
          icon="body"
          tone="var(--coral)"
          detail={
            metrics.delta === 0 ? (
              'stable'
            ) : (
              <span className={metrics.delta < 0 ? 'delta--down' : 'delta--up'}>{signed(metrics.delta)} kg</span>
            )
          }
        />
        <StatTile
          label="IMC"
          value={metrics.bmi || '—'}
          icon="target"
          tone="var(--brand)"
          detail={metrics.bmiLabel}
        />
        <StatTile
          label="Masse grasse"
          value={metrics.latest?.bodyFatPct ? fmtDecimal(metrics.latest.bodyFatPct) : '—'}
          unit={metrics.latest?.bodyFatPct ? '%' : undefined}
          icon="flame"
          tone="var(--amber)"
          detail={metrics.latest?.bodyFatPct ? 'dernière mesure' : 'non renseignée'}
        />
        <StatTile
          label="Masse musculaire"
          value={metrics.latest?.muscleKg ? fmtDecimal(metrics.latest.muscleKg) : '—'}
          unit={metrics.latest?.muscleKg ? 'kg' : undefined}
          icon="strength"
          tone="var(--violet)"
          detail={metrics.latest?.waistCm ? `taille ${fmtDecimal(metrics.latest.waistCm)} cm` : 'non renseignée'}
        />
      </div>

      <div className="two-col two-col--wide">
        <SectionCard
          title="Tendance du poids"
          subtitle="90 derniers jours"
          className="chartcard"
          action={
            target ? (
              <span className="goalline">Objectif {fmtDecimal(target)} kg</span>
            ) : (
              <Link to="/reglages" className="textlink">
                Définir un objectif <Icon name="arrow" size={15} />
              </Link>
            )
          }
        >
          <LineChart
            points={series}
            color="var(--coral)"
            height={230}
            goal={target}
            formatValue={(value) => `${fmtDecimal(value)} kg`}
            label="Évolution du poids sur 90 jours"
            emptyLabel="Ajoutez au moins deux mesures pour tracer la tendance"
          />
        </SectionCard>

        <SectionCard title="Objectif" subtitle="Un cap, pas une obligation" className="goalcard">
          {target ? (
            <>
              <div className="goalcard__big">
                <strong>{fmtDecimal(target)}</strong>
                <span>kg</span>
              </div>
              <p>
                {targetDelta === null
                  ? 'Ajoutez une mesure pour suivre l’écart.'
                  : targetDelta === 0
                    ? 'Objectif atteint. Maintenez vos habitudes.'
                    : targetDelta > 0
                      ? `Encore ${fmtDecimal(Math.abs(targetDelta))} kg pour atteindre votre objectif.`
                      : `Vous êtes ${fmtDecimal(Math.abs(targetDelta))} kg sous votre objectif.`}
              </p>
              <ProgressBar
                value={gained * 100}
                goal={100}
                color="var(--coral)"
                label="Progression vers l’objectif de poids"
              />
              <div className="goalcard__meta">
                <span>Départ {startWeight ? `${fmtDecimal(startWeight)} kg` : '—'}</span>
                <span>Actuel {fmtDecimal(metrics.weight)} kg</span>
              </div>
              <Link to="/reglages" className="btn btn--ghost btn--small">
                Modifier l’objectif
              </Link>
            </>
          ) : (
            <EmptyState
              icon="target"
              title="Pas encore d’objectif"
              text="Un objectif de poids est facultatif. Si vous en définissez un, PulseCraft suit l’écart sans vous presser."
              action={
                <Link to="/reglages" className="btn btn--ghost btn--small">
                  Définir un objectif
                </Link>
              }
            />
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Historique des mesures"
        subtitle={history.length ? `${history.length} mesure${history.length > 1 ? 's' : ''}` : 'Aucune mesure'}
        action={
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setOpen(true)}>
            <Icon name="plus" size={15} /> Ajouter
          </button>
        }
      >
        {history.length === 0 ? (
          <EmptyState
            icon="body"
            title="Votre première mesure"
            text="Le poids seul ne raconte pas tout : masse grasse, masse musculaire et tour de taille donnent une image plus juste."
            action={
              <button type="button" className="btn btn--primary btn--small" onClick={() => setOpen(true)}>
                Ajouter une mesure
              </button>
            }
          />
        ) : (
          <ul className="datalist">
            {history.map((entry) => (
              <HistoryRow key={entry.id} id={entry.id} />
            ))}
          </ul>
        )}
      </SectionCard>

      {data.profile.heightCm ? (
        <p className="pagenote">
          IMC calculé avec {fmtDecimal(data.profile.heightCm)} cm. L’IMC est un repère populationnel,
          pas un diagnostic : il ne distingue pas masse musculaire et masse grasse.
          {' '}
          {metrics.bmi ? `Dernier indice : ${metrics.bmi} (${metrics.bmiLabel}).` : ''}
          {metrics.latest?.waistCm ? ` Tour de taille : ${fmtDecimal(metrics.latest.waistCm)} cm.` : ''}
        </p>
      ) : (
        <p className="pagenote">
          Renseignez votre taille dans les réglages pour calculer votre IMC.
        </p>
      )}

      <BodyModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
