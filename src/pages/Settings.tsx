import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { usePulse } from '../store';
import { useUi } from '../lib/uiStore';
import { applyTheme } from '../lib/theme';
import { useCoreStatus } from '../lib/core';
import { clearBriefingCache } from '../lib/ai';
import { EQUIPMENT_LABELS } from '../lib/plan';
import { aiReady, PROVIDER_HINTS, PROVIDER_LABELS, testProvider, type TestResult } from '../lib/llm';
import {
  buildExport,
  downloadFile,
  exportDate,
  exportSummary,
  parseExport,
  workoutsCsv,
  type ExportBundle,
} from '../lib/export';
import { parseAppleHealthFile } from '../lib/imports/appleHealth';
import { parseSamsungHealthCsv } from '../lib/imports/samsung';
import { parseGpx, parseTcx } from '../lib/imports/activityFiles';
import { APP_ISSUES, APP_LICENSE, APP_NAME, APP_REPO, APP_TAGLINE, APP_VERSION } from '../lib/meta';
import type { AiConfig, AiProvider, ImportPayload, Theme } from '../types';
import { PageHeader, SectionCard } from '../components/Page';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';

function Row({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="settingrow">
      <div className="settingrow__text">
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="settingrow__control">{children}</div>
    </div>
  );
}

function SettingField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}

interface Report {
  file: string;
  workouts: number;
  sleeps: number;
  body: number;
}

export function SettingsPage() {
  const data = usePulse();
  const updateProfile = usePulse((state) => state.updateProfile);
  const updateGoals = usePulse((state) => state.updateGoals);
  const updateSettings = usePulse((state) => state.updateSettings);
  const importData = usePulse((state) => state.importData);
  const loadDemo = usePulse((state) => state.loadDemo);
  const resetData = usePulse((state) => state.resetData);
  const clearEverything = usePulse((state) => state.clearEverything);
  const trainingPlan = usePulse((state) => state.trainingPlan);
  const resetTrainingPlan = usePulse((state) => state.resetTrainingPlan);
  const installMonthlyProgram = usePulse((state) => state.installMonthlyProgram);
  const restoreExport = usePulse((state) => state.restoreExport);
  const notify = useUi((state) => state.notify);
  const openWizard = useUi((state) => state.openWizard);
  const core = useCoreStatus();

  const [profile, setProfile] = useState(data.profile);
  const [goals, setGoals] = useState(data.goals);
  const [aiConfig, setAiConfig] = useState<AiConfig>(data.settings.ai);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [confirm, setConfirm] = useState<'reset' | 'clear' | 'resetPlan' | null>(null);
  const [pendingImport, setPendingImport] = useState<ExportBundle | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setProfile(data.profile), [data.profile]);
  useEffect(() => setGoals(data.goals), [data.goals]);
  useEffect(() => setAiConfig(data.settings.ai), [data.settings.ai]);

  const saveAi = () => {
    if (aiConfig.provider === 'openai' && !aiReady(aiConfig)) {
      notify('Ajoutez une clé API valide pour ce fournisseur.', 'error');
      return;
    }
    updateSettings({ ai: aiConfig });
    clearBriefingCache();
    setTestResult(null);
    notify('Fournisseur IA enregistré. Le prochain briefing l’utilisera.', 'success');
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testProvider(aiConfig);
    setTestResult(result);
    setTesting(false);
  };

  const saveProfile = () => {
    const name = profile.name.trim();
    if (name.length === 0) {
      notify('Le nom ne peut pas être vide.', 'error');
      return;
    }
    if (profile.heightCm !== undefined && (profile.heightCm < 100 || profile.heightCm > 250)) {
      notify('La taille doit être comprise entre 100 et 250 cm.', 'error');
      return;
    }
    if (profile.weightKg < 25 || profile.weightKg > 350) {
      notify('Le poids doit être compris entre 25 et 350 kg.', 'error');
      return;
    }
    updateProfile({
      ...profile,
      name,
      sex: profile.sex,
      restingHr: Math.max(30, Math.min(120, Math.round(profile.restingHr))),
      maxHr: profile.maxHr ? Math.max(100, Math.min(230, Math.round(profile.maxHr))) : undefined,
    });
    notify('Profil enregistré.', 'success');
  };

  const saveGoals = () => {
    if (goals.moveKcal <= 0 || goals.exerciseMin <= 0 || goals.waterMl <= 0) {
      notify('Les objectifs doivent être supérieurs à zéro.', 'error');
      return;
    }
    updateGoals({
      ...goals,
      moveKcal: Math.round(goals.moveKcal),
      exerciseMin: Math.round(goals.exerciseMin),
      waterMl: Math.round(goals.waterMl),
      dailyKcal: Math.round(goals.dailyKcal),
      sleepHours: Math.max(4, Math.min(12, goals.sleepHours)),
      weightKg: goals.weightKg && goals.weightKg > 0 ? Math.round(goals.weightKg * 10) / 10 : undefined,
    });
    notify('Objectifs enregistrés.', 'success');
  };

  const changeTheme = (theme: Theme) => {
    updateSettings({ theme });
    applyTheme(theme);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    setReport(null);
    try {
      const name = file.name.toLowerCase();
      let payload: ImportPayload;
      if (name.endsWith('.zip')) {
        throw new Error('Décompressez d’abord export.zip, puis sélectionnez export.xml.');
      }
      if (name.endsWith('.json')) {
        // Une sauvegarde remplace le journal : on demande confirmation avant
        // d'écrire quoi que ce soit.
        setPendingImport(parseExport(await file.text()));
        return;
      }
      if (name.endsWith('.xml')) {
        payload = await parseAppleHealthFile(file);
      } else if (name.endsWith('.csv')) {
        payload = parseSamsungHealthCsv(await file.text());
      } else if (name.endsWith('.gpx')) {
        payload = parseGpx(await file.text());
      } else if (name.endsWith('.tcx')) {
        payload = parseTcx(await file.text());
      } else {
        throw new Error('Format non reconnu. Choisissez un fichier .xml, .csv, .gpx ou .tcx.');
      }

      const result = importData(payload, { real: true });
      setReport({ file: file.name, ...result });
      notify(
        `Import terminé : ${result.workouts} séance${result.workouts > 1 ? 's' : ''}, ${result.sleeps} nuit${result.sleeps > 1 ? 's' : ''}, ${result.body} mesure${result.body > 1 ? 's' : ''}.`,
        'success'
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Import impossible.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const openFilePicker = () => fileRef.current?.click();

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
    downloadFile(`battement-${exportDate()}.json`, JSON.stringify(bundle, null, 2), 'application/json');
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

  const coreLabel =
    core === 'wasm' ? 'Noyau Rust actif (WebAssembly)' : core === 'js' ? 'Repli JavaScript actif' : 'Chargement du noyau…';

  return (
    <div className="page">
      <PageHeader
        eyebrow="Réglages"
        title={
          <>
            Votre Battement<span className="title-dot">.</span>
          </>
        }
        subtitle="Profil, objectifs, IA, imports et données. Tout se règle ici et reste sur cet appareil."
      />

      <div className="settings">
        <SectionCard title="Profil" subtitle="Utilisé pour estimer les calories, les zones et la forme">
          <div className="formgrid">
            <SettingField label="Nom affiché">
              <input
                type="text"
                value={profile.name}
                maxLength={40}
                onChange={(event) => setProfile({ ...profile, name: event.target.value })}
              />
            </SettingField>
            <SettingField label="Sexe">
              <select
                value={profile.sex}
                onChange={(event) =>
                  setProfile({ ...profile, sex: event.target.value as typeof profile.sex })
                }
              >
                <option value="femme">Femme</option>
                <option value="homme">Homme</option>
                <option value="autre">Autre / non précisé</option>
              </select>
            </SettingField>
            <SettingField label="Année de naissance" hint="Pour la FC max estimée">
              <input
                type="number"
                min={1900}
                max={new Date().getFullYear() - 10}
                value={profile.birthYear ?? ''}
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    birthYear: event.target.value ? Number(event.target.value) : undefined,
                  })
                }
              />
            </SettingField>
            <SettingField label="Taille (cm)">
              <input
                type="number"
                min={100}
                max={250}
                value={profile.heightCm ?? ''}
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    heightCm: event.target.value ? Number(event.target.value) : undefined,
                  })
                }
              />
            </SettingField>
            <SettingField label="Poids de référence (kg)" hint="Sert quand aucune mesure n’existe">
              <input
                type="number"
                min={25}
                max={350}
                step="0.1"
                value={profile.weightKg}
                onChange={(event) => setProfile({ ...profile, weightKg: Number(event.target.value) })}
              />
            </SettingField>
            <SettingField label="FC de repos (bpm)">
              <input
                type="number"
                min={30}
                max={120}
                value={profile.restingHr}
                onChange={(event) => setProfile({ ...profile, restingHr: Number(event.target.value) })}
              />
            </SettingField>
            <SettingField label="FC max (bpm)" hint="Facultatif — sinon estimée par l’âge">
              <input
                type="number"
                min={100}
                max={230}
                value={profile.maxHr ?? ''}
                placeholder="auto"
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    maxHr: event.target.value ? Number(event.target.value) : undefined,
                  })
                }
              />
            </SettingField>
          </div>
          <div className="settings__actions">
            <span className="settings__hint">Aucune donnée de profil n’est transmise, même à l’IA.</span>
            <button type="button" className="btn btn--primary" onClick={saveProfile}>
              Enregistrer le profil
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Objectifs" subtitle="Des repères quotidiens, modifiables à tout moment">
          <div className="formgrid">
            <SettingField label="Calories actives (kcal)">
              <input
                type="number"
                min={50}
                max={3000}
                value={goals.moveKcal}
                onChange={(event) => setGoals({ ...goals, moveKcal: Number(event.target.value) })}
              />
            </SettingField>
            <SettingField label="Exercice (min)">
              <input
                type="number"
                min={5}
                max={300}
                value={goals.exerciseMin}
                onChange={(event) => setGoals({ ...goals, exerciseMin: Number(event.target.value) })}
              />
            </SettingField>
            <SettingField label="Eau (ml)" hint={`${(goals.waterMl / 1000).toFixed(1)} L`}>
              <input
                type="number"
                min={500}
                max={6000}
                step={100}
                value={goals.waterMl}
                onChange={(event) => setGoals({ ...goals, waterMl: Number(event.target.value) })}
              />
            </SettingField>
            <SettingField label="Sommeil (h)" hint="Cible par nuit">
              <input
                type="number"
                min={4}
                max={12}
                step="0.25"
                value={goals.sleepHours}
                onChange={(event) => setGoals({ ...goals, sleepHours: Number(event.target.value) })}
              />
            </SettingField>
            <SettingField label="Calories alimentaires (kcal/j)">
              <input
                type="number"
                min={800}
                max={6000}
                step={50}
                value={goals.dailyKcal}
                onChange={(event) => setGoals({ ...goals, dailyKcal: Number(event.target.value) })}
              />
            </SettingField>
            <SettingField label="Poids cible (kg)" hint="Facultatif">
              <input
                type="number"
                min={25}
                max={350}
                step="0.1"
                value={goals.weightKg ?? ''}
                placeholder="aucun"
                onChange={(event) =>
                  setGoals({
                    ...goals,
                    weightKg: event.target.value ? Number(event.target.value) : undefined,
                  })
                }
              />
            </SettingField>
          </div>
          <div className="settings__actions">
            <span className="settings__hint">Les anneaux utilisent ces valeurs.</span>
            <button type="button" className="btn btn--primary" onClick={saveGoals}>
              Enregistrer les objectifs
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Apparence et IA" subtitle="Ce qui sort de l’appareil, et quand">
          <Row title="Thème" description="Suivre le système, ou forcer clair / sombre.">
            <div className="segmented" role="group" aria-label="Thème">
              {[
                { value: 'system', label: 'Système', icon: 'settings' as const },
                { value: 'light', label: 'Clair', icon: 'sun' as const },
                { value: 'dark', label: 'Sombre', icon: 'moon' as const },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={data.settings.theme === option.value ? 'is-active' : ''}
                  onClick={() => changeTheme(option.value as Theme)}
                  aria-pressed={data.settings.theme === option.value}
                >
                  <Icon name={option.icon} size={16} />
                  {option.label}
                </button>
              ))}
            </div>
          </Row>

          <Row
            title="Coach IA"
            description="Analyse conversationnelle via le fournisseur choisi ci-dessous. Seuls des agrégats anonymes sont envoyés : aucun nom, aucune note, aucun repas."
          >
            <label className="switch">
              <input
                type="checkbox"
                checked={data.settings.aiEnabled}
                onChange={(event) => {
                  updateSettings({ aiEnabled: event.target.checked });
                  clearBriefingCache();
                  notify(
                    event.target.checked
                      ? 'IA activée. Les agrégats anonymes peuvent être envoyés.'
                      : 'IA désactivée. Tout reste local.',
                    'info'
                  );
                }}
              />
              <span aria-hidden />
              <em>{data.settings.aiEnabled ? 'Activée' : 'Désactivée'}</em>
            </label>
          </Row>

          <Row
            title="Fournisseur du coach"
            description="Choisissez où partent les agrégats. Le plan d’entraînement, lui, est toujours calculé localement."
          >
            <div className="providerpick">
              {(Object.keys(PROVIDER_LABELS) as AiProvider[]).map((provider) => (
                <button
                  key={provider}
                  type="button"
                  className={aiConfig.provider === provider ? 'is-active' : ''}
                  onClick={() => {
                    setAiConfig({ ...aiConfig, provider });
                    setTestResult(null);
                  }}
                  aria-pressed={aiConfig.provider === provider}
                >
                  <strong>{provider === 'pollinations' ? 'Gratuit' : provider === 'openai' ? 'Ma clé' : 'Local'}</strong>
                  <em>{PROVIDER_LABELS[provider]}</em>
                </button>
              ))}
            </div>
            <p className="providerpick__hint">{PROVIDER_HINTS[aiConfig.provider]}</p>
          </Row>

          {aiConfig.provider !== 'pollinations' ? (
            <div className="providergrid">
              <SettingField
                label={aiConfig.provider === 'local' ? 'URL du serveur local' : 'URL de base (compatible OpenAI)'}
                hint="Toute API compatibles OpenAI : OpenAI, OpenRouter, Groq, Mistral, Ollama…"
              >
                <input
                  type="url"
                  value={aiConfig.baseUrl}
                  placeholder={
                    aiConfig.provider === 'local'
                      ? 'http://127.0.0.1:11434/v1'
                      : 'https://api.openai.com/v1'
                  }
                  onChange={(event) => setAiConfig({ ...aiConfig, baseUrl: event.target.value })}
                />
              </SettingField>
              <SettingField label="Modèle">
                <input
                  type="text"
                  value={aiConfig.model}
                  placeholder={aiConfig.provider === 'local' ? 'llama3.1' : 'gpt-4o-mini'}
                  onChange={(event) => setAiConfig({ ...aiConfig, model: event.target.value })}
                />
              </SettingField>
              <SettingField
                label={`Clé API${aiConfig.provider === 'local' ? ' (facultative)' : ''}`}
                hint="Stockée dans IndexedDB, jamais exportée, jamais envoyée à Battement."
              >
                <input
                  type="password"
                  value={aiConfig.apiKey}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={aiConfig.provider === 'local' ? 'aucune' : 'sk-…'}
                  onChange={(event) => setAiConfig({ ...aiConfig, apiKey: event.target.value })}
                />
              </SettingField>
            </div>
          ) : null}

          <div className="settings__actions">
            <span className="settings__hint">
              {testResult ? (
                <span className={testResult.ok ? 'providertest is-ok' : 'providertest is-ko'}>
                  <Icon name={testResult.ok ? 'check' : 'alert'} size={14} /> {testResult.message}
                </span>
              ) : (
                'Un test n’envoie qu’un « ok », aucune donnée de santé.'
              )}
            </span>
            <div className="settingrow__buttons">
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => void runTest()}
                disabled={testing || !data.settings.aiEnabled}
              >
                {testing ? 'Test…' : 'Tester'}
              </button>
              <button type="button" className="btn btn--primary btn--small" onClick={saveAi}>
                Enregistrer le fournisseur
              </button>
            </div>
          </div>

          <Row title="Moteur de calcul" description="Les formules de santé tournent en Rust compilé en WebAssembly, avec un repli JavaScript transparent.">
            <span className={`enginebadge enginebadge--${core}`}>
              <i aria-hidden />
              {coreLabel}
            </span>
          </Row>

          <Row title="Briefing en cache" description="Le briefing du jour est mémorisé dans la session pour économiser le quota gratuit.">
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => {
                clearBriefingCache();
                notify('Briefing en cache effacé. Il sera régénéré.', 'info');
              }}
            >
              Vider le cache
            </button>
          </Row>
        </SectionCard>

        <SectionCard
          title="Plan & bilan"
          subtitle="Le programme long terme se recalcule à partir de vos réponses"
        >
          <Row
            title="Bilan de départ"
            description={
              trainingPlan
                ? `Plan ${trainingPlan.horizonWeeks} semaines · ${trainingPlan.intake.daysPerWeek} séances de ${trainingPlan.intake.sessionMin} min · ${EQUIPMENT_LABELS[trainingPlan.intake.equipment].toLowerCase()}. Refaire le bilan remplace le plan et conserve le journal.`
                : 'Objectif, disponibilité, matériel : deux minutes pour obtenir un programme de plusieurs semaines.'
            }
          >
            <button type="button" className="btn btn--ghost btn--small" onClick={openWizard}>
              <Icon name="target" size={15} /> {trainingPlan ? 'Refaire le bilan' : 'Faire mon bilan'}
            </button>
          </Row>

          <Row
            title="Programme du mois"
            description="Quatre semaines de renforcement au poids du corps et aux haltères légers, avec les créneaux calés hors atelier (14 h–18 h). L’installer remplace le plan en cours."
          >
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => {
                installMonthlyProgram();
                notify('Programme du mois installé.', 'success');
              }}
            >
              <Icon name="strength" size={15} />
              {trainingPlan?.preset === 'monthly-muscle' ? 'Réinstaller le mois 1' : 'Installer le programme'}
            </button>
          </Row>

          <Row
            title="Effacer le plan"
            description="Le journal, le profil et les objectifs sont conservés. Le programme du mois ne revient pas tout seul : vous pouvez le réinstaller ici."
          >
            <button
              type="button"
              className="btn btn--danger btn--small"
              disabled={!trainingPlan}
              onClick={() => setConfirm('resetPlan')}
            >
              Effacer le plan
            </button>
          </Row>
        </SectionCard>

        <SectionCard
          title="Importer"
          subtitle="Les fichiers sont lus dans votre navigateur, jamais envoyés"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xml,.csv,.gpx,.tcx,.json"
            className="visuallyhidden"
            onChange={(event) => void handleFile(event)}
          />

          <div className="importgrid">
            <button type="button" className="importcard" onClick={openFilePicker} disabled={importing}>
              <span className="importcard__icon importcard__icon--apple">
                <Icon name="heart" size={20} />
              </span>
              <strong>Apple Health</strong>
              <p>Réglages → Santé → Exporter les données. Décompressez l’archive, puis choisissez export.xml.</p>
              <em>{importing ? 'Import en cours…' : 'Choisir export.xml'}</em>
            </button>
            <button type="button" className="importcard" onClick={openFilePicker} disabled={importing}>
              <span className="importcard__icon importcard__icon--samsung">
                <Icon name="activity" size={20} />
              </span>
              <strong>Samsung Health</strong>
              <p>Paramètres → Télécharger les données personnelles. Importez les CSV d’activité, de sommeil ou de poids.</p>
              <em>{importing ? 'Import en cours…' : 'Choisir un CSV'}</em>
            </button>
            <button type="button" className="importcard" onClick={openFilePicker} disabled={importing}>
              <span className="importcard__icon importcard__icon--gpx">
                <Icon name="route" size={20} />
              </span>
              <strong>GPX / TCX</strong>
              <p>Un parcours GPS ou une activité exportée par une montre. Distance, durée et dénivelé sont calculés.</p>
              <em>{importing ? 'Import en cours…' : 'Choisir .gpx ou .tcx'}</em>
            </button>
            <button type="button" className="importcard" onClick={openFilePicker} disabled={importing}>
              <span className="importcard__icon importcard__icon--backup">
                <Icon name="upload" size={20} />
              </span>
              <strong>Sauvegarde Battement</strong>
              <p>Un fichier JSON exporté depuis « Exporter tout ». Il remplace le journal après confirmation.</p>
              <em>{importing ? 'Lecture en cours…' : 'Choisir un .json'}</em>
            </button>
          </div>

          {report ? (
            <div className="report" role="status">
              <Icon name="check" size={18} />
              <div>
                <strong>Import terminé — {report.file}</strong>
                <p>
                  {report.workouts} séance{report.workouts > 1 ? 's' : ''} · {report.sleeps} nuit
                  {report.sleeps > 1 ? 's' : ''} · {report.body} mesure{report.body > 1 ? 's' : ''} ajoutées.
                  Les doublons connus ont été ignorés.
                </p>
              </div>
              <button
                type="button"
                className="iconbtn"
                onClick={() => setReport(null)}
                aria-label="Fermer le rapport"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          ) : null}

          <p className="pagenote">
            Un fichier Apple Health peut être volumineux : l’analyse est faite en flux, sans
            conserver le XML. Les pas et l’énergie quotidienne sont agrégés par jour. Les parcours
            GPS ne sont pas conservés, seul le résumé de la séance l’est.
          </p>
        </SectionCard>

        <SectionCard title="Données" subtitle="Export, démonstration, effacement">
          <Row title="Tout exporter" description="Un JSON lisible par Battement et par vous.">
            <div className="settingrow__buttons">
              <button type="button" className="btn btn--ghost btn--small" onClick={exportJson}>
                <Icon name="download" size={15} /> JSON
              </button>
              <button type="button" className="btn btn--ghost btn--small" onClick={exportCsv}>
                <Icon name="download" size={15} /> Séances CSV
              </button>
            </div>
          </Row>

          <Row
            title="Données d’exemple"
            description="42 jours de séances, nuits et mesures fictives. Pratique pour découvrir l’app — un import réel les remplace automatiquement."
          >
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => {
                loadDemo();
                notify('Données d’exemple chargées.', 'info');
              }}
            >
              Charger la démo
            </button>
          </Row>

          <Row
            title="Effacer le journal"
            description="Supprime séances, nuits, mesures, repas et pas. Le profil et les objectifs sont conservés."
          >
            <button type="button" className="btn btn--danger btn--small" onClick={() => setConfirm('reset')}>
              Effacer le journal
            </button>
          </Row>

          <Row
            title="Tout effacer"
            description="Profil, objectifs, réglages et journal. Cette action ne peut pas être annulée."
          >
            <button type="button" className="btn btn--danger btn--small" onClick={() => setConfirm('clear')}>
              Tout effacer
            </button>
          </Row>

          <Row title="Stockage" description="Vos données vivent dans IndexedDB, sur cet appareil et dans ce navigateur.">
            <span className="settingrow__mono">{data.workouts.length} séances · {data.sleeps.length} nuits</span>
          </Row>
        </SectionCard>

        <SectionCard title="À propos" subtitle={APP_TAGLINE}>
          <div className="about">
            <div className="about__brand">
              <strong>{APP_NAME}</strong>
              <span>version {APP_VERSION} · licence {APP_LICENSE}</span>
            </div>
            <ul className="about__stack">
              <li>React 18</li>
              <li>TypeScript strict</li>
              <li>Vite 8</li>
              <li>Rust → WebAssembly</li>
              <li>Tauri 2</li>
              <li>IndexedDB</li>
            </ul>
            <p>
              Battement est un projet indépendant, non affilié à Apple ni à Samsung. Apple Health
              et Samsung Health sont des marques de leurs propriétaires. Aucune donnée n’est
              revendue, aucun traqueur n’est chargé.
            </p>
            <div className="about__links">
              <a href={APP_REPO} target="_blank" rel="noreferrer noopener" className="textlink">
                Code source <Icon name="arrow" size={15} />
              </a>
              <a href={APP_ISSUES} target="_blank" rel="noreferrer noopener" className="textlink">
                Signaler un problème <Icon name="arrow" size={15} />
              </a>
            </div>
          </div>
        </SectionCard>
      </div>

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm === 'clear'
            ? 'Tout effacer ?'
            : confirm === 'resetPlan'
              ? 'Effacer le plan ?'
              : 'Effacer le journal ?'
        }
        eyebrow={confirm === 'resetPlan' ? 'Le journal reste intact' : 'Action irréversible'}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirm(null)}>
              Annuler
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                if (confirm === 'clear') {
                  clearEverything();
                  applyTheme('system');
                  notify('Toutes les données ont été effacées.', 'info');
                } else if (confirm === 'resetPlan') {
                  resetTrainingPlan();
                  notify('Plan effacé. Le programme du mois ne revient que si vous l’installez.', 'info');
                } else {
                  resetData();
                  notify('Journal effacé. Profil et objectifs conservés.', 'info');
                }
                setReport(null);
                setConfirm(null);
              }}
            >
              {confirm === 'clear'
                ? 'Tout effacer'
                : confirm === 'resetPlan'
                  ? 'Effacer le plan'
                  : 'Effacer le journal'}
            </button>
          </>
        }
      >
        <p className="modal__warning">
          {confirm === 'clear'
            ? 'Profil, objectifs, réglages, séances, nuits, mesures, repas et pas quotidiens seront supprimés. Aucune copie ne sera conservée.'
            : confirm === 'resetPlan'
              ? 'Le plan d’entraînement et la séance guidée en cours seront retirés. Les séances déjà cochées restent dans le journal, et vous pourrez refaire le bilan ou réinstaller le programme du mois.'
              : 'Séances, nuits, mesures, repas, pas quotidiens et conversation du coach seront supprimés. Votre profil et vos objectifs restent en place.'}
        </p>
        {confirm === 'resetPlan' ? null : (
          <p className="pagenote">
            Pensez à exporter vos données avant, si vous souhaitez les conserver.
          </p>
        )}
      </Modal>

      <Modal
        open={pendingImport !== null}
        onClose={() => setPendingImport(null)}
        title="Restaurer cette sauvegarde ?"
        eyebrow="Sauvegarde JSON"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setPendingImport(null)}>
              Annuler
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                if (!pendingImport) return;
                restoreExport(pendingImport);
                setPendingImport(null);
                setReport(null);
                notify('Sauvegarde restaurée.', 'success');
              }}
            >
              Restaurer
            </button>
          </>
        }
      >
        {pendingImport ? (
          <>
            <p className="modal__warning">
              Le journal actuel sera remplacé par : {exportSummary(pendingImport)}.
            </p>
            <p className="pagenote">
              Fichier exporté le{' '}
              {Number.isNaN(new Date(pendingImport.exportedAt).getTime())
                ? 'date inconnue'
                : new Date(pendingImport.exportedAt).toLocaleDateString('fr-FR')}
              . Le plan d’entraînement et les réglages de l’appareil restent en place.
            </p>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
