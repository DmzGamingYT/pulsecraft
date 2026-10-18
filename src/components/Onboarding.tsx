import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { usePulse } from '../store';
import { useUi } from '../lib/uiStore';
import { fetchPlanNarrative } from '../lib/ai';
import { aiReady, PROVIDER_HINTS, PROVIDER_LABELS, testProvider, type TestResult } from '../lib/llm';
import { buildPlan, EXPERIENCE_LABELS, GOALS, localPlanNote } from '../lib/plan';
import type {
  AiConfig,
  AiProvider,
  Equipment,
  Experience,
  GoalKind,
  PlanIntake,
  Sex,
  TrainingPlan,
} from '../types';
import { AppIcon } from './AppIcon';
import { Icon } from './Icon';

/**
 * Bilan de démarrage.
 *
 * Six étapes, une seule fois : profil, objectif, rythme réel, fournisseur IA,
 * puis un plan long terme calculé localement (et commenté par l'IA si elle est
 * configurée). Rien n'est envoyé pour construire le plan : les réponses sont
 * des choix fermés, et le texte libre des contraintes reste sur l'appareil.
 */

const STEPS = ['Bienvenue', 'Profil', 'Objectif', 'Rythme', 'Coach IA', 'Votre plan'];
const LAST = STEPS.length - 1;

interface FormState {
  name: string;
  sex: Sex;
  birthYear: string;
  heightCm: string;
  weightKg: string;
  restingHr: string;
  goal: GoalKind;
  experience: Experience;
  daysPerWeek: number;
  sessionMin: number;
  equipment: Equipment;
  sleepHours: number;
  targetWeightKg: string;
  targetDate: string;
  constraints: string;
}

function initialForm(state: ReturnType<typeof usePulse.getState>): FormState {
  return {
    name: state.profile.name === 'Vous' ? '' : state.profile.name,
    sex: state.profile.sex,
    birthYear: state.profile.birthYear ? String(state.profile.birthYear) : '',
    heightCm: state.profile.heightCm ? String(state.profile.heightCm) : '',
    weightKg: String(state.profile.weightKg),
    restingHr: String(state.profile.restingHr),
    goal: state.intake?.goal ?? 'sante',
    experience: state.intake?.experience ?? 'debutant',
    daysPerWeek: state.intake?.daysPerWeek ?? 3,
    sessionMin: state.intake?.sessionMin ?? 45,
    equipment: state.intake?.equipment ?? 'aucun',
    sleepHours: state.intake?.sleepHours ?? state.goals.sleepHours,
    targetWeightKg: state.goals.weightKg ? String(state.goals.weightKg) : '',
    targetDate: state.intake?.targetDate ?? '',
    constraints: state.intake?.constraints ?? '',
  };
}

export function Onboarding({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const notify = useUi((state) => state.notify);
  const completeOnboarding = usePulse((state) => state.completeOnboarding);
  const updateSettings = usePulse((state) => state.updateSettings);
  const skipOnboarding = usePulse((state) => state.skipOnboarding);

  const [form, setForm] = useState<FormState>(() => initialForm(usePulse.getState()));
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<TrainingPlan | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [aiOn, setAiOn] = useState(() => usePulse.getState().settings.aiEnabled);
  const [config, setConfig] = useState<AiConfig>(() => ({ ...usePulse.getState().settings.ai }));
  const [test, setTest] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const patch = (values: Partial<FormState>) => setForm((current) => ({ ...current, ...values }));

  useEffect(() => {
    if (!open) {
      setStep(0);
      setPreview(null);
      setTest(null);
      setNoteError(null);
      setForm(initialForm(usePulse.getState()));
    }
  }, [open]);

  const intake = useMemo<PlanIntake>(
    () => ({
      goal: form.goal,
      experience: form.experience,
      daysPerWeek: form.daysPerWeek,
      sessionMin: form.sessionMin,
      equipment: form.equipment,
      sleepHours: form.sleepHours,
      targetWeightKg: form.targetWeightKg ? Number(form.targetWeightKg) : undefined,
      targetDate: form.targetDate || undefined,
      constraints: form.constraints.trim() || undefined,
      createdAt: new Date().toISOString(),
    }),
    [form]
  );

  // Le plan est calculé dès l'arrivée sur la dernière étape : l'utilisateur voit
  // quelque chose d'utile immédiatement, l'IA ne fait qu'enrichir le commentaire.
  useEffect(() => {
    if (!open || step !== LAST || preview) return;
    const base = buildPlan(intake, { note: localPlanNote(intake) });
    setPreview(base);

    const settings = usePulse.getState().settings;
    if (!aiOn || !settings.aiEnabled || !aiReady(config)) return;

    const controller = new AbortController();
    setNoteLoading(true);
    setNoteError(null);
    fetchPlanNarrative(intake, base, config, controller.signal)
      .then((note) => {
        if (controller.signal.aborted) return;
        setPreview((current) => (current ? { ...current, note, noteSource: 'ai' } : current));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setNoteError(error instanceof Error ? error.message : 'Le coach IA n’a pas répondu.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setNoteLoading(false);
      });

    return () => controller.abort();
  }, [open, step, preview, intake, aiOn, config]);

  if (!open) return null;

  const validate = (index: number): string | null => {
    if (index === 1) {
      const weight = Number(form.weightKg);
      const height = form.heightCm ? Number(form.heightCm) : 0;
      const year = form.birthYear ? Number(form.birthYear) : 0;
      if (!Number.isFinite(weight) || weight < 25 || weight > 350) {
        return 'Indiquez un poids entre 25 et 350 kg.';
      }
      if (height && (height < 100 || height > 250)) return 'Indiquez une taille entre 100 et 250 cm.';
      if (year && (year < 1930 || year > new Date().getFullYear() - 10)) {
        return 'Cette année de naissance ne semble pas valide.';
      }
    }
    if (index === 2 && form.targetWeightKg) {
      const target = Number(form.targetWeightKg);
      if (!Number.isFinite(target) || target < 25 || target > 350) {
        return 'Le poids visé doit être compris entre 25 et 350 kg.';
      }
    }
    if (index === 3) {
      if (form.daysPerWeek < 2 || form.daysPerWeek > 6) return 'Choisissez entre 2 et 6 séances.';
      if (form.sessionMin < 20 || form.sessionMin > 120) return 'Choisissez une durée de 20 à 120 min.';
    }
    if (index === 4 && aiOn && config.provider === 'openai' && !aiReady(config)) {
      return 'Ajoutez votre clé API, ou repassez au fournisseur gratuit.';
    }
    return null;
  };

  const next = () => {
    const error = validate(step);
    if (error) {
      notify(error, 'error');
      return;
    }
    setStep((current) => Math.min(LAST, current + 1));
  };

  const back = () => {
    // Revenir en arrière invalide l'aperçu : le plan sera recalculé avec les
    // nouvelles réponses au lieu d'en garder un obsolète.
    if (step === LAST) setPreview(null);
    setStep((current) => Math.max(0, current - 1));
  };

  const finish = () => {
    if (!preview) return;
    updateSettings({ ai: config, aiEnabled: aiOn });
    completeOnboarding({
      intake: preview.intake,
      plan: preview,
      profile: {
        name: form.name.trim() || 'Vous',
        sex: form.sex,
        birthYear: form.birthYear ? Number(form.birthYear) : undefined,
        heightCm: form.heightCm ? Number(form.heightCm) : undefined,
        weightKg: Number(form.weightKg) || 72,
        restingHr: Number(form.restingHr) || 58,
      },
      goals: {
        exerciseMin: form.sessionMin,
        sleepHours: form.sleepHours,
        ...(form.targetWeightKg ? { weightKg: Number(form.targetWeightKg) } : {}),
      },
    });
    notify('Plan créé. Il vous attend dans « Plan ».', 'success');
    onClose();
    navigate('/plan');
  };

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    const result = await testProvider(config);
    setTest(result);
    setTesting(false);
  };

  return createPortal(
    <div className="onb-root" role="dialog" aria-modal="true" aria-labelledby="onb-title">
      <div className="onb-backdrop" aria-hidden="true" />

      <div className="onb">
        <header className="onb__head">
          <div className="onb__brand">
            <AppIcon size={34} animated={false} />
            <span>PulseCraft</span>
          </div>
          <ol className="onb__steps" aria-label="Étapes du bilan">
            {STEPS.map((label, index) => (
              <li
                key={label}
                className={index === step ? 'is-current' : index < step ? 'is-done' : ''}
                aria-current={index === step ? 'step' : undefined}
              >
                <i aria-hidden />
                <span>{label}</span>
              </li>
            ))}
          </ol>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Fermer le bilan">
            <Icon name="close" />
          </button>
        </header>

        <div className="onb__body">
          {step === 0 ? (
            <div className="onb-welcome">
              <div className="onb-welcome__icon">
                <AppIcon size={132} />
              </div>
              <div className="onb-welcome__text">
                <p className="kicker">Bilan de départ · 2 minutes</p>
                <h2 id="onb-title">
                  Un plan qui vous ressemble,
                  <br />
                  pas un programme générique<span className="title-dot">.</span>
                </h2>
                <p>
                  Quelques questions sur votre objectif et votre disponibilité réelle. PulseCraft
                  construit ensuite un programme de plusieurs semaines, avec des phases, des
                  semaines allégées et des repères concrets.
                </p>
                <ul className="onb-welcome__list">
                  <li>
                    <Icon name="target" size={17} /> Un plan calculé sur votre rythme, pas sur un
                    idéal
                  </li>
                  <li>
                    <Icon name="heart" size={17} /> Tout reste sur cet appareil, y compris vos
                    contraintes
                  </li>
                  <li>
                    <Icon name="spark" size={17} /> Le coach IA commente le plan, il ne l’invente
                    pas
                  </li>
                </ul>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <section className="onb-step">
              <p className="kicker">Étape 1 · Profil</p>
              <h2 id="onb-title">Vos repères de calcul</h2>
              <p className="onb-step__sub">
                Ils servent aux zones cardiaques, aux calories et à l’IMC. Aucun n’est transmis à
                l’IA.
              </p>
              <div className="onb-grid">
                <label className="field">
                  <span className="field__label">Prénom affiché (facultatif)</span>
                  <input
                    type="text"
                    value={form.name}
                    maxLength={40}
                    placeholder="Vous"
                    onChange={(event) => patch({ name: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span className="field__label">Sexe</span>
                  <select
                    value={form.sex}
                    onChange={(event) => patch({ sex: event.target.value as Sex })}
                  >
                    <option value="femme">Femme</option>
                    <option value="homme">Homme</option>
                    <option value="autre">Autre / non précisé</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">Année de naissance</span>
                  <input
                    type="number"
                    min={1930}
                    max={new Date().getFullYear() - 10}
                    value={form.birthYear}
                    placeholder="1994"
                    onChange={(event) => patch({ birthYear: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span className="field__label">Taille (cm)</span>
                  <input
                    type="number"
                    min={100}
                    max={250}
                    value={form.heightCm}
                    placeholder="175"
                    onChange={(event) => patch({ heightCm: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span className="field__label">Poids (kg)</span>
                  <input
                    type="number"
                    min={25}
                    max={350}
                    step="0.1"
                    value={form.weightKg}
                    onChange={(event) => patch({ weightKg: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span className="field__label">FC de repos (bpm)</span>
                  <input
                    type="number"
                    min={30}
                    max={120}
                    value={form.restingHr}
                    onChange={(event) => patch({ restingHr: event.target.value })}
                  />
                </label>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="onb-step">
              <p className="kicker">Étape 2 · Objectif</p>
              <h2 id="onb-title">Où voulez-vous aller ?</h2>
              <p className="onb-step__sub">
                Un seul objectif principal : le plan sera plus lisible, et plus facile à tenir.
              </p>
              <div className="onb-goals">
                {(Object.keys(GOALS) as GoalKind[]).map((goal) => {
                  const meta = GOALS[goal];
                  return (
                    <button
                      key={goal}
                      type="button"
                      className={`onb-goal${form.goal === goal ? ' is-active' : ''}`}
                      style={{ ['--goal' as string]: meta.accent }}
                      onClick={() => patch({ goal })}
                      aria-pressed={form.goal === goal}
                    >
                      <span className="onb-goal__dot" aria-hidden />
                      <strong>{meta.label}</strong>
                      <em>{meta.tagline}</em>
                      <p>{meta.detail}</p>
                    </button>
                  );
                })}
              </div>
              <div className="onb-grid onb-grid--tight">
                <label className="field">
                  <span className="field__label">Poids visé (kg, facultatif)</span>
                  <input
                    type="number"
                    min={25}
                    max={350}
                    step="0.1"
                    value={form.targetWeightKg}
                    placeholder="aucun"
                    onChange={(event) => patch({ targetWeightKg: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span className="field__label">Échéance (facultatif)</span>
                  <input
                    type="date"
                    value={form.targetDate}
                    onChange={(event) => patch({ targetDate: event.target.value })}
                  />
                </label>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="onb-step">
              <p className="kicker">Étape 3 · Rythme</p>
              <h2 id="onb-title">Ce que vous pouvez réellement tenir</h2>
              <p className="onb-step__sub">
                Mieux vaut un plan modeste tenu qu’un programme ambitieux abandonné en trois
                semaines.
              </p>

              <div className="onb-slider">
                <div className="onb-slider__head">
                  <span>Séances par semaine</span>
                  <strong>{form.daysPerWeek}</strong>
                </div>
                <input
                  type="range"
                  min={2}
                  max={6}
                  step={1}
                  value={form.daysPerWeek}
                  onChange={(event) => patch({ daysPerWeek: Number(event.target.value) })}
                  aria-label="Séances par semaine"
                />
                <div className="onb-slider__ticks" aria-hidden>
                  {[2, 3, 4, 5, 6].map((value) => (
                    <span key={value}>{value}</span>
                  ))}
                </div>
              </div>

              <div className="onb-slider">
                <div className="onb-slider__head">
                  <span>Durée d’une séance</span>
                  <strong>{form.sessionMin} min</strong>
                </div>
                <input
                  type="range"
                  min={20}
                  max={120}
                  step={5}
                  value={form.sessionMin}
                  onChange={(event) => patch({ sessionMin: Number(event.target.value) })}
                  aria-label="Durée d’une séance en minutes"
                />
              </div>

              <div className="onb-choice">
                <span className="field__label">Niveau actuel</span>
                <div className="onb-choice__row">
                  {(Object.keys(EXPERIENCE_LABELS) as Experience[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={form.experience === level ? 'is-active' : ''}
                      onClick={() => patch({ experience: level })}
                      aria-pressed={form.experience === level}
                    >
                      {EXPERIENCE_LABELS[level]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="onb-choice">
                <span className="field__label">Matériel disponible</span>
                <div className="onb-choice__row">
                  {(
                    [
                      ['aucun', 'Aucun / poids du corps'],
                      ['maison', 'Maison (élastiques, haltères)'],
                      ['salle', 'Salle de sport'],
                    ] as Array<[Equipment, string]>
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={form.equipment === value ? 'is-active' : ''}
                      onClick={() => patch({ equipment: value })}
                      aria-pressed={form.equipment === value}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="onb-grid onb-grid--tight">
                <label className="field">
                  <span className="field__label">Sommeil habituel (h)</span>
                  <input
                    type="number"
                    min={4}
                    max={12}
                    step="0.25"
                    value={form.sleepHours}
                    onChange={(event) => patch({ sleepHours: Number(event.target.value) })}
                  />
                </label>
                <label className="field">
                  <span className="field__label">Contrainte ou douleur (facultatif)</span>
                  <input
                    type="text"
                    value={form.constraints}
                    maxLength={140}
                    placeholder="genou sensible, horaires décalés…"
                    onChange={(event) => patch({ constraints: event.target.value })}
                  />
                </label>
              </div>
              <p className="onb-note">
                <Icon name="heart" size={14} /> Cette note reste sur votre appareil : elle n’est
                jamais incluse dans les prompts.
              </p>
            </section>
          ) : null}

          {step === 4 ? (
            <section className="onb-step">
              <p className="kicker">Étape 4 · Coach IA</p>
              <h2 id="onb-title">Quel modèle doit vous accompagner ?</h2>
              <p className="onb-step__sub">
                Le plan est calculé sans IA. Le modèle sert à commenter, ajuster et répondre dans le
                temps. Vous pouvez changer d’avis à tout moment.
              </p>

              <label className="onb-switch">
                <input
                  type="checkbox"
                  checked={aiOn}
                  onChange={(event) => setAiOn(event.target.checked)}
                />
                <span aria-hidden />
                <div>
                  <strong>Utiliser le coach IA</strong>
                  <em>Désactivé, tout reste local et le plan est rédigé par PulseCraft.</em>
                </div>
              </label>

              <div className={`onb-providers${aiOn ? '' : ' is-disabled'}`}>
                {(Object.keys(PROVIDER_LABELS) as AiProvider[]).map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    className={`onb-provider${config.provider === provider ? ' is-active' : ''}`}
                    onClick={() => {
                      setConfig((current) => ({ ...current, provider }));
                      setTest(null);
                    }}
                    aria-pressed={config.provider === provider}
                    disabled={!aiOn}
                  >
                    <span className="onb-provider__radio" aria-hidden />
                    <strong>{PROVIDER_LABELS[provider]}</strong>
                    <em>{PROVIDER_HINTS[provider]}</em>
                  </button>
                ))}
              </div>

              {config.provider !== 'pollinations' && aiOn ? (
                <div className="onb-grid">
                  <label className="field">
                    <span className="field__label">
                      {config.provider === 'local' ? 'URL du serveur local' : 'URL de base (compatible OpenAI)'}
                    </span>
                    <input
                      type="url"
                      value={config.baseUrl}
                      placeholder={
                        config.provider === 'local'
                          ? 'http://127.0.0.1:11434/v1'
                          : 'https://api.openai.com/v1'
                      }
                      onChange={(event) =>
                        setConfig((current) => ({ ...current, baseUrl: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Modèle</span>
                    <input
                      type="text"
                      value={config.model}
                      placeholder={config.provider === 'local' ? 'llama3.1' : 'gpt-4o-mini'}
                      onChange={(event) =>
                        setConfig((current) => ({ ...current, model: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field onb-grid__wide">
                    <span className="field__label">
                      Clé API{config.provider === 'local' ? ' (facultative)' : ''}
                    </span>
                    <input
                      type="password"
                      value={config.apiKey}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={config.provider === 'local' ? 'aucune' : 'sk-…'}
                      onChange={(event) =>
                        setConfig((current) => ({ ...current, apiKey: event.target.value }))
                      }
                    />
                    <span className="field__hint">
                      Stockée dans IndexedDB, sur cet appareil uniquement. Jamais dans un export.
                    </span>
                  </label>
                </div>
              ) : null}

              <div className="onb-test">
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => void runTest()}
                  disabled={!aiOn || testing}
                >
                  {testing ? 'Test en cours…' : 'Tester la connexion'}
                </button>
                {test ? (
                  <span className={test.ok ? 'onb-test__ok' : 'onb-test__ko'}>
                    <Icon name={test.ok ? 'check' : 'alert'} size={15} /> {test.message}
                  </span>
                ) : (
                  <span className="onb-test__idle">
                    Le test n’envoie qu’un « ok », aucune donnée de santé.
                  </span>
                )}
              </div>
            </section>
          ) : null}

          {step === LAST ? (
            <section className="onb-step onb-step--plan">
              <p className="kicker">Étape 5 · Votre plan</p>
              <h2 id="onb-title">
                {GOALS[form.goal].label} sur {preview?.horizonWeeks ?? 12} semaines
                <span className="title-dot">.</span>
              </h2>
              <p className="onb-step__sub">
                {form.daysPerWeek} séances de {form.sessionMin} min, avec une semaine allégée toutes
                les quatre semaines.
              </p>

              {preview ? (
                <>
                  <div className="onb-phases">
                    {preview.phases.map((phase) => (
                      <article key={phase.id} className="onb-phase">
                        <span>
                          S{phase.fromWeek + 1}–S{phase.toWeek + 1}
                        </span>
                        <strong>{phase.name}</strong>
                        <p>{phase.objective}</p>
                      </article>
                    ))}
                  </div>

                  <div className="onb-week">
                    <header>
                      <strong>Semaine type</strong>
                      <span>{preview.weeks[0]?.targetMinutes ?? 0} min prévues</span>
                    </header>
                    <ul>
                      {preview.weeks[0]?.sessions.map((session) => (
                        <li key={session.id}>
                          <i className={`onb-week__badge onb-week__badge--${session.intensity}`} />
                          <span>{session.title}</span>
                          <em>{session.minutes} min</em>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="onb-coach">
                    <header>
                      <span className="briefing__spark">
                        <Icon name="spark" size={16} />
                      </span>
                      <strong>Le mot du coach</strong>
                      <span className={`aibadge${preview.noteSource === 'ai' ? ' aibadge--on' : ''}`}>
                        {noteLoading ? 'IA…' : preview.noteSource === 'ai' ? 'IA' : 'Local'}
                      </span>
                    </header>
                    {preview.note.split('\n\n').map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                    {noteError ? (
                      <p className="onb-coach__error">
                        <Icon name="alert" size={14} /> {noteError} Le plan local reste valable.
                      </p>
                    ) : null}
                  </div>

                  <p className="onb-note">
                    <Icon name="alert" size={14} /> Ce plan est un repère d’entraînement, pas un
                    avis médical. En cas de douleur ou de maladie, arrêtez et consultez.
                  </p>
                </>
              ) : (
                <div className="onb-loading" role="status" aria-live="polite">
                  <span className="onb-loading__ring" aria-hidden />
                  <p>Construction du plan…</p>
                </div>
              )}
            </section>
          ) : null}
        </div>

        <footer className="onb__foot">
          <div className="onb__left">
            {step > 0 ? (
              <button type="button" className="btn btn--ghost btn--small" onClick={back}>
                Retour
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => {
                  skipOnboarding();
                  onClose();
                  notify('Bilan reporté. Vous pouvez le reprendre dans les réglages.', 'info');
                }}
              >
                Plus tard
              </button>
            )}
          </div>
          <div className="onb__right">
            <span className="onb__count">
              {String(step + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
            </span>
            {step < LAST ? (
              <button type="button" className="btn btn--primary" onClick={next}>
                Continuer <Icon name="arrow" size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary"
                onClick={finish}
                disabled={!preview}
              >
                Adopter ce plan <Icon name="check" size={16} />
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}
