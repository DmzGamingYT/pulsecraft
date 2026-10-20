import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { usePulse } from '../store';
import { useUi } from '../lib/uiStore';
import { useBriefing } from '../lib/useBriefing';
import {
  bodyMetrics,
  latestSleep,
  readinessFor,
  ringStats,
} from '../lib/analytics';
import { formatLong, todayISO } from '../lib/dates';
import { fmtDecimal, fmtMinutes, fmtNumber, fmtSleep, signed } from '../lib/format';
import { PageHeader, SectionCard, StatTile, EmptyState, CoachText } from '../components/Page';
import { Rings } from '../components/Rings';
import { ProgressBar } from '../components/Charts';
import { Icon } from '../components/Icon';
import { WorkoutRow } from '../components/WorkoutRow';
import { WorkoutModal, SleepModal, BodyModal, MealModal } from '../components/Forms';
import { PlanToday } from '../components/PlanToday';
import { sessionForDate } from '../lib/plan';
import { ResumeSessionCard } from '../components/SessionRun';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'Bonne nuit';
  if (hour < 12) return 'Bonjour';
  if (hour < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

export function TodayPage() {
  const data = usePulse();
  const addWater = usePulse((state) => state.addWater);
  const loadDemo = usePulse((state) => state.loadDemo);
  const notify = useUi((state) => state.notify);
  const briefing = useBriefing();
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [mealOpen, setMealOpen] = useState(false);

  const today = todayISO();
  const rings = ringStats(data, today);
  const readiness = readinessFor(data, today);
  const sleep = latestSleep(data, today);
  const body = bodyMetrics(data);
  const day = data.days[today];
  const recent = data.workouts.slice(0, 3);
  const score = readiness.score;
  const scoreTone =
    score === null ? 'var(--ink-3)' : score >= 70 ? 'var(--brand)' : score >= 50 ? 'var(--amber)' : 'var(--coral)';
  const firstName =
    data.profile.name && data.profile.name !== 'Vous' ? data.profile.name.split(/\s+/)[0] : '';

  const planSession = data.trainingPlan ? sessionForDate(data.trainingPlan, today) : null;

  const subtitle =
    data.workouts.length === 0 && data.sleeps.length === 0
      ? data.trainingPlan
        ? planSession
          ? 'Votre programme est prêt : la séance du jour vous attend, avec ses mouvements et ses séries.'
          : 'Votre programme est prêt : la prochaine séance apparaît ci-dessous, avec ses mouvements et ses séries.'
        : 'Votre journal est prêt. Ajoutez une première séance ou importez votre historique.'
      : score === null
        ? 'Encore quelques données et votre forme du jour sera calculée.'
        : `Forme à ${score}/100 — ${readiness.label.toLowerCase()}. ${
            score >= 82
              ? 'Une séance soutenue est la bienvenue.'
              : score >= 62
                ? 'Restez régulier, sans forcer.'
                : 'Écoutez-vous et privilégiez la récupération.'
          }`;

  const waterGoal = rings.water.goal;
  const waterLeft = Math.max(0, waterGoal - rings.water.value);

  return (
    <div className="page">
      <PageHeader
        eyebrow={formatLong(today)}
        title={
          <>
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
            <span className="title-dot">.</span>
          </>
        }
        subtitle={subtitle}
        actions={
          <>
            <button type="button" className="btn btn--primary" onClick={() => setWorkoutOpen(true)}>
              <Icon name="plus" size={17} /> Séance
            </button>
          </>
        }
      />

      <ResumeSessionCard />
      <PlanToday />

      <div className="today-grid">
        <SectionCard
          className="card--rings"
          title="Vos objectifs du jour"
          subtitle="Bouger, s’entraîner, s’hydrater"
          action={
            <Link to="/progres" className="textlink">
              Progrès <Icon name="arrow" size={15} />
            </Link>
          }
        >
          <Rings
            rings={[
              { label: 'Bouger', value: rings.move.value, goal: rings.move.goal, color: 'var(--coral)', unit: 'kcal' },
              { label: 'Entraînement', value: rings.exercise.value, goal: rings.exercise.goal, color: 'var(--brand)', unit: 'min' },
              { label: 'Hydratation', value: rings.water.value, goal: rings.water.goal, color: 'var(--cyan)', unit: 'ml' },
            ]}
            subtitle={
              data.demo
                ? 'Données d’exemple : explorez les anneaux sans conséquence.'
                : 'Les anneaux se remplissent avec vos séances et votre hydratation.'
            }
          />
        </SectionCard>

        <section className="card readiness">
          <header className="card__head">
            <div>
              <h2>Forme du jour</h2>
              <p className="card__sub">Sommeil, charge, FC de repos</p>
            </div>
            <span className="score-pill" style={{ ['--tone' as string]: scoreTone } as CSSProperties}>
              {readiness.label}
            </span>
          </header>

          {score === null ? (
            <div className="readiness__empty">
              <span className="readiness__ghost">?</span>
              <p>
                Ajoutez une nuit de sommeil ou une séance pour que le noyau calcule votre forme.
              </p>
              <div className="readiness__emptyactions">
                <button type="button" className="btn btn--ghost btn--small" onClick={() => setSleepOpen(true)}>
                  Sommeil
                </button>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => setWorkoutOpen(true)}>
                  Séance
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="readiness__main">
                <div
                  className="gauge"
                  style={{ ['--score' as string]: `${score}%`, ['--gauge' as string]: scoreTone } as CSSProperties}
                >
                  <div className="gauge__inner">
                    <strong>{Math.round(score)}</strong>
                    <span>/ 100</span>
                  </div>
                </div>
                <div className="readiness__side">
                  <p>
                    {score >= 82
                      ? 'Vous pouvez pousser aujourd’hui.'
                      : score >= 62
                        ? 'Une séance modérée est bien dosée.'
                        : 'La récupération prime sur la performance.'}
                  </p>
                  <span className="readiness__ratio">
                    Charge 7 j / 28 j&nbsp;: <strong>{readiness.ratio.toString().replace('.', ',')}</strong>
                    <em>
                      {readiness.ratio > 1.5
                        ? 'progression rapide'
                        : readiness.ratio < 0.8
                          ? 'charge allégée'
                          : 'zone favorable'}
                    </em>
                  </span>
                </div>
              </div>

              <div className="factors">
                {[
                  { label: 'Sommeil', value: readiness.sleepScore, color: 'var(--violet)' },
                  { label: 'Charge', value: readiness.loadScore, color: 'var(--brand)' },
                  { label: 'FC repos', value: readiness.rhrScore, color: 'var(--cyan)' },
                ].map((factor) => (
                  <div className="factor" key={factor.label}>
                    <span>{factor.label}</span>
                    <ProgressBar value={factor.value} goal={100} color={factor.color} label={factor.label} />
                    <strong>{factor.value}</strong>
                  </div>
                ))}
              </div>

              <p className="readiness__foot">
                {readiness.sleepMin > 0
                  ? `${fmtMinutes(readiness.sleepMin)} de sommeil · qualité ${readiness.sleepQuality}/5`
                  : 'Pas de nuit enregistrée'}
                <span>·</span>
                {readiness.restingHr} bpm au repos
              </p>
            </>
          )}
        </section>
      </div>

      <section className="card briefing">
        <header className="card__head briefing__head">
          <div className="briefing__title">
            <span className="briefing__spark">
              <Icon name="spark" size={17} />
            </span>
            <h2>Briefing du coach</h2>
            <span className={`aibadge${briefing.source === 'ai' ? ' aibadge--on' : ''}`}>
              {briefing.loading ? 'IA…' : briefing.source === 'ai' ? 'IA' : 'Local'}
            </span>
          </div>
          <div className="card__action">
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => void briefing.regenerate(true)}
              disabled={briefing.loading}
            >
              {briefing.loading ? 'Génération…' : 'Régénérer'}
            </button>
            <Link to="/coach" className="btn btn--ghost btn--small">
              Ouvrir le coach <Icon name="arrow" size={15} />
            </Link>
          </div>
        </header>
        <div className={briefing.loading ? 'briefing__body is-loading' : 'briefing__body'}>
          <CoachText text={briefing.text} />
        </div>
        <footer className="briefing__foot">
          <p>
            <Icon name="heart" size={14} />
            {briefing.source === 'ai'
              ? 'Analyse générée à partir d’agrégats anonymes. Aucun nom, aucune note n’est envoyée.'
              : 'Analyse locale, sans réseau. Activez ou coupez l’IA dans les réglages.'}
          </p>
          <span>Jamais un avis médical.</span>
        </footer>
      </section>

      <div className="stats-grid">
        <StatTile
          label="Pas"
          value={day?.steps ? fmtNumber(day.steps) : '—'}
          icon="activity"
          tone="var(--lime-soft)"
          detail={day?.steps ? 'aujourd’hui' : 'non renseignés'}
          to="/progres"
        />
        <StatTile
          label="Sommeil"
          value={sleep ? fmtSleep(sleep.durationMin).hours : '—'}
          unit={sleep ? `h ${fmtSleep(sleep.durationMin).minutes}` : undefined}
          icon="moon"
          tone="var(--violet)"
          detail={sleep ? `qualité ${sleep.quality}/5` : 'aucune nuit'}
          to="/sommeil"
        />
        <StatTile
          label="Poids"
          value={fmtDecimal(body.weight)}
          unit="kg"
          icon="body"
          tone="var(--coral)"
          detail={
            body.delta === 0 ? 'stable' : <span className={body.delta < 0 ? 'delta--down' : 'delta--up'}>{signed(body.delta)} kg</span>
          }
          to="/corps"
        />
        <StatTile
          label="Eau"
          value={rings.water.value ? (rings.water.value / 1000).toFixed(2).replace('.', ',') : '0'}
          unit="L"
          icon="water"
          tone="var(--cyan)"
          detail={waterLeft > 0 ? `reste ${fmtNumber(waterLeft)} ml` : 'objectif atteint'}
          to="/nutrition"
        />
      </div>

      <div className="today-bottom">
        <SectionCard
          title="Dernières séances"
          subtitle={recent.length ? 'Votre journal récent' : 'Rien pour l’instant'}
          action={
            <Link to="/activite" className="textlink">
              Tout voir <Icon name="arrow" size={15} />
            </Link>
          }
        >
          {recent.length === 0 ? (
            <EmptyState
              icon="activity"
              title="Votre journal attend sa première séance"
              text="Ajoutez une séance manuellement, importez un fichier GPX, ou chargez des données d’exemple pour découvrir l’application."
              action={
                <div className="empty__buttons">
                  <button type="button" className="btn btn--primary btn--small" onClick={() => setWorkoutOpen(true)}>
                    Ajouter une séance
                  </button>
                  <button type="button" className="btn btn--ghost btn--small" onClick={loadDemo}>
                    Voir la démo
                  </button>
                </div>
              }
            />
          ) : (
            <div className="workout-list">
              {recent.map((workout) => (
                <WorkoutRow key={workout.id} workout={workout} showDate />
              ))}
            </div>
          )}
        </SectionCard>

        <section className="card quick">
          <header className="card__head">
            <div>
              <h2>Ajouter</h2>
              <p className="card__sub">En deux gestes, sans formulaire interminable</p>
            </div>
          </header>
          <div className="quick__grid">
            <button type="button" className="quickbtn" onClick={() => setWorkoutOpen(true)}>
              <span className="quickbtn__icon quickbtn__icon--coral">
                <Icon name="activity" size={19} />
              </span>
              <strong>Séance</strong>
              <em>durée, distance, FC</em>
            </button>
            <button type="button" className="quickbtn" onClick={() => setSleepOpen(true)}>
              <span className="quickbtn__icon quickbtn__icon--violet">
                <Icon name="moon" size={19} />
              </span>
              <strong>Nuit</strong>
              <em>coucher, réveil, qualité</em>
            </button>
            <button type="button" className="quickbtn" onClick={() => setBodyOpen(true)}>
              <span className="quickbtn__icon quickbtn__icon--lime">
                <Icon name="body" size={19} />
              </span>
              <strong>Mesure</strong>
              <em>poids, masse grasse</em>
            </button>
            <button type="button" className="quickbtn" onClick={() => setMealOpen(true)}>
              <span className="quickbtn__icon quickbtn__icon--cyan">
                <Icon name="nutrition" size={19} />
              </span>
              <strong>Repas</strong>
              <em>calories, macros</em>
            </button>
          </div>

          <div className="hydration">
            <div className="hydration__head">
              <span>
                <Icon name="water" size={17} /> Hydratation
              </span>
              <strong>
                {fmtNumber(rings.water.value)} / {fmtNumber(waterGoal)} ml
              </strong>
            </div>
            <ProgressBar
              value={rings.water.value}
              goal={waterGoal}
              color="var(--cyan)"
              label="Hydratation du jour"
            />
            <div className="hydration__actions">
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => {
                  addWater(250);
                  notify('+ 250 ml d’eau.', 'success');
                }}
              >
                + 250 ml
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => {
                  addWater(500);
                  notify('+ 500 ml d’eau.', 'success');
                }}
              >
                + 500 ml
              </button>
              <Link to="/nutrition" className="textlink">
                Détail
              </Link>
            </div>
          </div>
        </section>
      </div>

      <WorkoutModal open={workoutOpen} onClose={() => setWorkoutOpen(false)} />
      <SleepModal open={sleepOpen} onClose={() => setSleepOpen(false)} />
      <BodyModal open={bodyOpen} onClose={() => setBodyOpen(false)} />
      <MealModal open={mealOpen} onClose={() => setMealOpen(false)} />
    </div>
  );
}
