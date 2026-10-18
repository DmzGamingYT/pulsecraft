import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { usePulse } from '../store';
import { useUi } from '../lib/uiStore';
import { askCoach, fetchPlan, localCoachReply, localPlan } from '../lib/ai';
import { readinessFor, sleepStats, summary } from '../lib/analytics';
import { formatTime, todayISO } from '../lib/dates';
import { fmtMinutes, fmtNumber } from '../lib/format';
import { PageHeader, CoachText } from '../components/Page';
import { ProgressBar } from '../components/Charts';
import { Icon, PulseMark } from '../components/Icon';
import type { ChatMessage } from '../types';

const SUGGESTIONS = [
  "Que faire aujourd'hui ?",
  'Analyse ma semaine',
  'Comment améliorer mon sommeil ?',
  "Plan d'entraînement sur 7 jours",
];

function Message({ message }: { message: ChatMessage }) {
  const assistant = message.role === 'assistant';
  return (
    <div className={`msg${assistant ? ' msg--assistant' : ' msg--user'}`}>
      {assistant ? (
        <span className="msg__avatar">
          <PulseMark size={28} />
        </span>
      ) : null}
      <div className="msg__bubble">
        {assistant ? <CoachText text={message.content} /> : <p>{message.content}</p>}
        <span className="msg__meta">
          {formatTime(message.at)}
          {assistant && message.local ? <em>analyse locale</em> : null}
          {assistant && !message.local ? <em>IA</em> : null}
        </span>
      </div>
    </div>
  );
}

export function CoachPage() {
  const data = usePulse();
  const addChat = usePulse((state) => state.addChat);
  const clearChat = usePulse((state) => state.clearChat);
  const setPlan = usePulse((state) => state.setPlan);
  const aiEnabled = usePulse((state) => state.settings.aiEnabled);
  const notify = useUi((state) => state.notify);

  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const planAbortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const today = todayISO();
  const readiness = readinessFor(data, today);
  const sleep = sleepStats(data, today, 14);
  const week = summary(data, today, 7);
  const plan = data.plan;
  const score = readiness.score;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [data.chat.length, busy]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      planAbortRef.current?.abort();
    },
    []
  );

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setDraft('');
    addChat({ role: 'user', content: question });
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const store = usePulse.getState();
      const reply = await askCoach(store.chat, store, {
        enabled: aiEnabled,
        signal: controller.signal,
        config: store.settings.ai,
        plan: store.trainingPlan,
      });
      if (!controller.signal.aborted) {
        addChat({ role: 'assistant', content: reply.text, local: reply.local });
      }
    } catch {
      if (!controller.signal.aborted) {
        addChat({
          role: 'assistant',
          content: localCoachReply(question, usePulse.getState()),
          local: true,
        });
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const generatePlan = async () => {
    if (planBusy) return;
    if (!aiEnabled) {
      setPlan({ generatedAt: new Date().toISOString(), content: localPlan(data), local: true });
      notify('Plan local généré.', 'info');
      return;
    }
    planAbortRef.current?.abort();
    const controller = new AbortController();
    planAbortRef.current = controller;
    setPlanBusy(true);
    try {
      const text = await fetchPlan(
        usePulse.getState(),
        controller.signal,
        usePulse.getState().settings.ai
      );
      if (controller.signal.aborted) return;
      setPlan({ generatedAt: new Date().toISOString(), content: text });
      notify('Plan de la semaine généré.', 'success');
    } catch {
      if (!controller.signal.aborted) {
        setPlan({ generatedAt: new Date().toISOString(), content: localPlan(data), local: true });
        notify('IA indisponible : plan local proposé.', 'info');
      }
    } finally {
      if (!controller.signal.aborted) setPlanBusy(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send(draft);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Assistant"
        title={
          <>
            Coach IA<span className="title-dot">.</span>
          </>
        }
        subtitle={
          aiEnabled
            ? 'Un coach qui lit vos agrégats, jamais vos notes personnelles. Il ne remplace pas un professionnel de santé.'
            : 'L’IA est désactivée : les réponses sont calculées localement, sans réseau.'
        }
        actions={
          <Link to="/reglages" className="btn btn--ghost">
            <Icon name="settings" size={16} /> Réglages IA
          </Link>
        }
      />

      {!aiEnabled ? (
        <div className="notice">
          <Icon name="alert" size={18} />
          <p>
            <strong>Mode local.</strong> Les réponses s’appuient sur vos données et des règles
            déterministes. Activez l’IA dans les réglages pour des réponses conversationnelles.
          </p>
          <Link to="/reglages" className="textlink">
            Activer <Icon name="arrow" size={15} />
          </Link>
        </div>
      ) : null}

      <div className="coach-grid">
        <section className="card coach-chat">
          <header className="card__head">
            <div className="briefing__title">
              <span className="briefing__spark">
                <Icon name="spark" size={17} />
              </span>
              <h2>Conversation</h2>
              <span className={`aibadge${aiEnabled ? ' aibadge--on' : ''}`}>
                {aiEnabled ? 'Pollinations' : 'Local'}
              </span>
            </div>
            {data.chat.length > 0 ? (
              <div className="card__action">
                <button type="button" className="btn btn--ghost btn--small" onClick={clearChat}>
                  Effacer
                </button>
              </div>
            ) : null}
          </header>

          <div className="chat" aria-live="polite">
            {data.chat.length === 0 ? (
              <div className="chat-welcome">
                <span className="chat-welcome__mark">
                  <PulseMark size={42} />
                </span>
                <h3>Votre coach, sans cloud inutile.</h3>
                <p>
                  Il voit votre charge d’entraînement, votre sommeil, votre hydratation et vos
                  objectifs. Il ne voit ni votre nom, ni vos notes de séance, ni vos repas.
                </p>
                <div className="chat-chips">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="chip chip--soft"
                      onClick={() => void send(suggestion)}
                      disabled={busy}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="messages">
                {data.chat.map((message) => (
                  <Message key={message.id} message={message} />
                ))}
                {busy ? (
                  <div className="msg msg--assistant">
                    <span className="msg__avatar">
                      <PulseMark size={28} />
                    </span>
                    <div className="msg__bubble typing" aria-label="Le coach rédige">
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                ) : null}
                <div ref={endRef} />
              </div>
            )}
          </div>

          {data.chat.length > 0 && !busy ? (
            <div className="chat-suggestions">
              {SUGGESTIONS.slice(0, 3).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="chip chip--ghost"
                  onClick={() => void send(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          <form className="composer" onSubmit={onSubmit}>
            <textarea
              rows={2}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send(draft);
                }
              }}
              placeholder="Demandez un avis, un plan, une explication…"
              aria-label="Message au coach"
              maxLength={2000}
            />
            <button
              type="submit"
              className="composer__send"
              disabled={busy || draft.trim().length === 0}
              aria-label="Envoyer"
            >
              <Icon name="send" size={19} />
            </button>
          </form>
          <p className="composer__note">
            <Icon name="heart" size={13} />
            Douleur, malaise, trouble alimentaire : consultez un professionnel de santé. Le coach
            PulseCraft reste un outil de suivi, pas un avis médical.
          </p>
        </section>

        <aside className="coach-side">
          <section className="card snapshot">
            <header className="card__head">
              <div>
                <h2>Contexte du jour</h2>
                <p className="card__sub">Ce que le coach peut voir</p>
              </div>
            </header>
            <div className="snapshot__score">
              <div
                className="gauge gauge--small"
                style={
                  {
                    ['--score' as string]: `${score ?? 0}%`,
                    ['--gauge' as string]:
                      score === null
                        ? 'var(--ink-3)'
                        : score >= 70
                          ? 'var(--brand)'
                          : score >= 50
                            ? 'var(--amber)'
                            : 'var(--coral)',
                  } as CSSProperties
                }
              >
                <div className="gauge__inner">
                  <strong>{score ?? '—'}</strong>
                  <span>/ 100</span>
                </div>
              </div>
              <div>
                <strong>{readiness.label}</strong>
                <p>
                  {score === null
                    ? 'Données insuffisantes pour calculer la forme.'
                    : `Charge ${Math.round(readiness.acute)} pts sur 7 j · ratio ${readiness.ratio.toString().replace('.', ',')}`}
                </p>
              </div>
            </div>

            <div className="snapshot__rows">
              <div>
                <span>Sommeil (14 nuits)</span>
                <strong>{sleep.avgMin ? fmtMinutes(sleep.avgMin) : '—'}</strong>
              </div>
              <div>
                <span>Dette</span>
                <strong>{sleep.debtHours ? `${sleep.debtHours} h` : '—'}</strong>
              </div>
              <div>
                <span>7 derniers jours</span>
                <strong>{week.sessions} séances</strong>
              </div>
              <div>
                <span>Volume</span>
                <strong>{Math.round(week.minutes)} min</strong>
              </div>
              <div>
                <span>Eau aujourd’hui</span>
                <strong>{fmtNumber(data.days[today]?.waterMl ?? 0)} ml</strong>
              </div>
              <div>
                <span>Pas</span>
                <strong>{fmtNumber(data.days[today]?.steps ?? 0)}</strong>
              </div>
            </div>

            <div className="snapshot__bar">
              <span>Hydratation</span>
              <ProgressBar
                value={data.days[today]?.waterMl ?? 0}
                goal={data.goals.waterMl}
                color="var(--cyan)"
                label="Hydratation"
              />
            </div>
            <Link to="/" className="textlink">
              Voir le tableau de bord <Icon name="arrow" size={15} />
            </Link>
          </section>

          <section className="card plancard">
            <header className="card__head">
              <div>
                <h2>Plan de la semaine</h2>
                <p className="card__sub">Indicatif, ajustable</p>
              </div>
            </header>
            {plan ? (
              <>
                <div className="plancard__body">
                  <CoachText text={plan.content} />
                </div>
                <div className="plancard__foot">
                  <span>
                    {plan.local ? 'Généré localement' : 'Généré par l’IA'} ·{' '}
                    {formatTime(plan.generatedAt)}
                  </span>
                  <div>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      onClick={() => {
                        navigator.clipboard?.writeText(plan.content).then(
                          () => notify('Plan copié.', 'success'),
                          () => notify('Copie impossible.', 'error')
                        );
                      }}
                    >
                      Copier
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      onClick={() => void generatePlan()}
                      disabled={planBusy}
                    >
                      {planBusy ? '…' : 'Régénérer'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      onClick={() => setPlan(null)}
                    >
                      Effacer
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="plancard__intro">
                  Un plan sur 7 jours, calibré sur votre charge récente et votre sommeil. Vous pouvez
                  le suivre, l’adapter ou l’ignorer : c’est une proposition.
                </p>
                <button
                  type="button"
                  className="btn btn--primary btn--wide"
                  onClick={() => void generatePlan()}
                  disabled={planBusy}
                >
                  {planBusy ? 'Génération…' : 'Générer mon plan'}
                  {!planBusy ? <Icon name="spark" size={16} /> : null}
                </button>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
