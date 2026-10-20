import { useState, type CSSProperties } from 'react';
import { usePulse } from '../store';
import { useUi } from '../lib/uiStore';
import { sleepSeries, sleepStats } from '../lib/analytics';
import { formatLong, relativeDay, todayISO } from '../lib/dates';
import { fmtMinutes, fmtSleep } from '../lib/format';
import { PageHeader, SectionCard, StatTile, EmptyState, SourceBadge } from '../components/Page';
import { BarChart, STAGE_COLORS, StageBar, ProgressBar } from '../components/Charts';
import { SleepModal } from '../components/Forms';
import { Icon } from '../components/Icon';
import { sleepScore } from '../lib/core';

function Quality({ value }: { value: number }) {
  return (
    <span className="quality" aria-label={`Qualité ${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <i key={star} className={star <= value ? 'is-on' : ''} aria-hidden>
          ★
        </i>
      ))}
    </span>
  );
}

function HistoryRow({ id }: { id: string }) {
  const entry = usePulse((state) => state.sleeps.find((item) => item.id === id));
  const removeSleep = usePulse((state) => state.removeSleep);
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
        <strong>{fmtMinutes(entry.durationMin)}</strong>
        <Quality value={entry.quality} />
      </span>
      <span className="datarow__meta">
        {entry.bedtime && entry.wake ? `${entry.bedtime} → ${entry.wake}` : '—'}
        <SourceBadge source={entry.source} />
      </span>
      {confirming ? (
        <span className="datarow__confirm">
          <button
            type="button"
            className="btn btn--danger btn--small"
            onClick={() => {
              removeSleep(entry.id);
              notify('Nuit supprimée.', 'info');
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
          aria-label={`Supprimer la nuit du ${formatLong(entry.date)}`}
        >
          <Icon name="trash" size={16} />
        </button>
      )}
    </li>
  );
}

export function SleepPage() {
  const data = usePulse();
  const today = todayISO();
  const stats = sleepStats(data, today, 14);
  const [open, setOpen] = useState(false);
  const last = stats.last;
  const score = last ? sleepScore(last.durationMin, last.quality, data.goals.sleepHours) : null;
  const series = sleepSeries(data, today, 14);
  const history = data.sleeps
    .filter((entry) => entry.date <= today)
    .slice(0, 30);

  const scoreTone = score === null ? 'var(--ink-3)' : score >= 80 ? 'var(--brand)' : score >= 60 ? 'var(--amber)' : 'var(--coral)';

  return (
    <div className="page">
      <PageHeader
        eyebrow="Récupération"
        title={
          <>
            Sommeil<span className="title-dot">.</span>
          </>
        }
        subtitle={
          last
            ? `Moyenne de ${fmtMinutes(stats.avgMin)} sur ${stats.nights} nuits · régularité ${stats.consistency}/100`
            : 'Le sommeil est le premier levier de progression. Notez vos nuits pour voir la tendance.'
        }
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setOpen(true)}>
            <Icon name="plus" size={17} /> Enregistrer une nuit
          </button>
        }
      />

      {!last ? (
        <SectionCard>
          <EmptyState
            icon="moon"
            title="Aucune nuit enregistrée"
            text="Ajoutez votre dernière nuit, ou importez votre export Apple Health / Samsung Health : les nuits seront rattachées à leur jour de réveil."
            action={
              <button type="button" className="btn btn--primary btn--small" onClick={() => setOpen(true)}>
                Enregistrer une nuit
              </button>
            }
          />
        </SectionCard>
      ) : (
        <>
          <div className="sleep-grid">
            <section className="card sleep-hero">
              <header className="card__head">
                <div>
                  <h2>La nuit dernière</h2>
                  <p className="card__sub">{relativeDay(last.date)} · {formatLong(last.date)}</p>
                </div>
                <SourceBadge source={last.source} />
              </header>

              <div className="sleeptime">
                <span className="sleeptime__num">{fmtSleep(last.durationMin).hours}</span>
                <span className="sleeptime__unit">h</span>
                <span className="sleeptime__num sleeptime__num--small">{fmtSleep(last.durationMin).minutes}</span>
                <div className="sleeptime__side">
                  <Quality value={last.quality} />
                  <span>
                    {last.bedtime ?? '—'} → {last.wake ?? '—'}
                  </span>
                </div>
              </div>

              {last.deepMin || last.remMin ? (
                <>
                  <StageBar deep={last.deepMin ?? 0} rem={last.remMin ?? 0} total={last.durationMin} />
                  <ul className="stagelegend">
                    <li><i style={{ background: STAGE_COLORS.deep }} /> Profond <strong>{fmtMinutes(last.deepMin ?? 0)}</strong></li>
                    <li><i style={{ background: STAGE_COLORS.rem }} /> REM <strong>{fmtMinutes(last.remMin ?? 0)}</strong></li>
                    <li>
                      <i style={{ background: STAGE_COLORS.light }} /> Léger{' '}
                      <strong>
                        {fmtMinutes(
                          Math.max(0, last.durationMin - (last.deepMin ?? 0) - (last.remMin ?? 0))
                        )}
                      </strong>
                    </li>
                  </ul>
                </>
              ) : (
                <p className="sleep-nostages">
                  Les stades de sommeil ne sont pas fournis par cette source. La durée et la qualité
                  suffisent déjà à suivre la tendance.
                </p>
              )}
            </section>

            <section className="card sleep-scorecard">
              <header className="card__head">
                <div>
                  <h2>Score de la nuit</h2>
                  <p className="card__sub">Durée et qualité ressentie</p>
                </div>
              </header>
              <div className="scoreline">
                <div
                  className="gauge gauge--small"
                  style={{ ['--score' as string]: `${score ?? 0}%`, ['--gauge' as string]: scoreTone } as CSSProperties}
                >
                  <div className="gauge__inner">
                    <strong>{score ?? '—'}</strong>
                    <span>/ 100</span>
                  </div>
                </div>
                <p>
                  {score === null
                    ? 'Ajoutez une nuit pour calculer le score.'
                    : score >= 80
                      ? 'Nuit réparatrice. La journée peut être active.'
                      : score >= 60
                        ? 'Nuit correcte, sans excès. Gardez un lever régulier.'
                        : 'Nuit courte ou agitée : réduisez l’intensité aujourd’hui.'}
                </p>
              </div>
              <div className="scorefacts">
                <div>
                  <span>Durée</span>
                  <strong>{fmtMinutes(last.durationMin)}</strong>
                </div>
                <div>
                  <span>Qualité</span>
                  <strong>{last.quality}/5</strong>
                </div>
                <div>
                  <span>Objectif</span>
                  <strong>{data.goals.sleepHours} h</strong>
                </div>
              </div>
            </section>
          </div>

          <div className="stats-grid stats-grid--three">
            <StatTile label="Moyenne 14 nuits" value={fmtSleep(stats.avgMin).hours} unit={`h ${fmtSleep(stats.avgMin).minutes}`} icon="moon" tone="var(--violet)" detail={`${stats.nights} nuits`} />
            <StatTile label="Dette de sommeil" value={stats.debtHours.toFixed(1).replace('.', ',')} unit="h" icon="alert" tone="var(--amber)" detail="sur les 7 dernières nuits" />
            <StatTile label="Régularité" value={stats.consistency || '—'} unit={stats.consistency ? '/100' : undefined} icon="clock" tone="var(--cyan)" detail="heure de coucher" />
          </div>

          <SectionCard
            title="Les 14 dernières nuits"
            subtitle={`Objectif : ${data.goals.sleepHours} h`}
            className="chartcard"
          >
            <BarChart
              points={series}
              color="var(--violet)"
              height={190}
              goal={data.goals.sleepHours * 60}
              formatValue={(value) => fmtMinutes(value)}
              label="Durée de sommeil des 14 dernières nuits"
              emptyLabel="Aucune nuit sur la période"
              highlightLast
            />
          </SectionCard>

          <SectionCard
            title="Historique"
            subtitle={`${history.length} nuit${history.length > 1 ? 's' : ''} enregistrée${history.length > 1 ? 's' : ''}`}
            action={
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setOpen(true)}>
                <Icon name="plus" size={15} /> Ajouter
              </button>
            }
          >
            <ul className="datalist">
              {history.map((entry) => (
                <HistoryRow key={entry.id} id={entry.id} />
              ))}
            </ul>
          </SectionCard>
        </>
      )}

      <div className="sleep-tip">
        <span className="sleep-tip__icon"><Icon name="spark" size={18} /></span>
        <div>
          <strong>Un levier simple</strong>
          <p>
            Un lever à heure fixe, même le week-end, stabilise l’horloge biologique plus efficacement
            qu’un coucher forcé. Visez d’abord la régularité, la durée suivra.
          </p>
        </div>
        <ProgressBar
          value={Math.min(100, stats.consistency || 0)}
          goal={100}
          color="var(--violet)"
          label="Régularité du sommeil"
        />
      </div>

      <SleepModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
