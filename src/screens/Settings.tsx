import { useEffect, useRef, useState } from 'react';
import type { Activity, DayLog, Sport } from '../types';
import { SPORTS } from '../types';
import type { Settings as SettingsValues, Theme } from '../store';
import { makeBackup, parseBackup, type ParsedBackup } from '../lib/backup';
import type { Program } from '../lib/coach';
import { formatBytes, storageEstimate, type StorageEstimate } from '../lib/storage';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icons';

export function Settings({
  activities,
  days,
  program,
  programDone,
  theme,
  goalMin,
  stepGoal,
  sessionsGoal,
  distanceGoalKm,
  sportGoals,
  maxHr,
  onTheme,
  onGoal,
  onStepGoal,
  onSessionsGoal,
  onDistanceGoal,
  onSportGoal,
  onMaxHr,
  onRestore,
  onLoadDemo,
  onClear,
  onClose,
}: {
  activities: Activity[];
  days: DayLog[];
  program: Program | null;
  programDone: string[];
  theme: Theme;
  goalMin: number;
  stepGoal: number;
  sessionsGoal: number;
  distanceGoalKm: number;
  sportGoals: Partial<Record<Sport, number>>;
  maxHr: number;
  onTheme: (theme: Theme) => void;
  onGoal: (minutes: number) => void;
  onStepGoal: (steps: number) => void;
  onSessionsGoal: (sessions: number) => void;
  onDistanceGoal: (km: number) => void;
  onSportGoal: (sport: Sport, minutes: number) => void;
  onMaxHr: (bpm: number) => void;
  onRestore: (backup: ParsedBackup) => void;
  onLoadDemo: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);
  const [restoreError, setRestoreError] = useState('');
  const [restored, setRestored] = useState<{ activities: number; days: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void storageEstimate().then((value) => {
      if (alive) setEstimate(value);
    });
    return () => {
      alive = false;
    };
  }, [activities.length, days.length]);

  const presentSports = SPORTS.filter((sport) =>
    activities.some((activity) => activity.sport === sport.id),
  );

  function exportJson() {
    const payload = makeBackup({
      activities,
      days,
      program,
      programDone,
      settings: {
        theme,
        goalMin,
        stepGoal,
        sessionsGoal,
        distanceGoalKm,
        sportGoals,
        maxHr,
      } satisfies SettingsValues,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `battement-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function restoreFile(file: File) {
    setRestoreError('');
    setRestored(null);
    try {
      const parsed = parseBackup(await file.text());
      if (
        !window.confirm(
          `Remplacer le journal actuel par cette sauvegarde ? ${parsed.activities.length} séances et ${parsed.days.length} journées seront reprises.`,
        )
      ) {
        return;
      }
      onRestore(parsed);
      setRestored({ activities: parsed.activities.length, days: parsed.days.length });
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : 'Sauvegarde illisible.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <Modal title="Réglages" eyebrow="Battement" onClose={onClose}>
      <div className="settings">
        <section className="settings__block">
          <h3>Objectifs de la semaine</h3>
          <label className="field" data-tone="accent">
            <span className="field__label">
              Minutes actives <em>{goalMin} min</em>
            </span>
            <input
              type="range"
              min="60"
              max="600"
              step="15"
              value={goalMin}
              onChange={(event) => onGoal(Number(event.target.value))}
            />
          </label>
          <label className="field" data-tone="rose">
            <span className="field__label">
              Séances <em>{sessionsGoal > 0 ? `${sessionsGoal} par semaine` : 'aucun objectif'}</em>
            </span>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={sessionsGoal}
              onChange={(event) => onSessionsGoal(Number(event.target.value))}
            />
          </label>
          <label className="field" data-tone="blue">
            <span className="field__label">
              Distance{' '}
              <em>{distanceGoalKm > 0 ? `${distanceGoalKm} km par semaine` : 'aucun objectif'}</em>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={distanceGoalKm}
              onChange={(event) => onDistanceGoal(Number(event.target.value))}
            />
          </label>
          <label className="field" data-tone="green">
            <span className="field__label">
              Pas par jour <em>{new Intl.NumberFormat('fr-FR').format(stepGoal)}</em>
            </span>
            <input
              type="range"
              min="2000"
              max="20000"
              step="500"
              value={stepGoal}
              onChange={(event) => onStepGoal(Number(event.target.value))}
            />
          </label>
          <p className="settings__hint">
            L’objectif de l’OMS est de 150 minutes d’activité modérée par semaine. Les
            objectifs à zéro sont simplement ignorés.
          </p>
        </section>

        <section className="settings__block">
          <h3>Objectifs par discipline</h3>
          {presentSports.length > 0 ? (
            <>
              <p className="settings__hint">
                Des minutes par semaine, pour la discipline qui compte. Vider un champ retire
                l’objectif.
              </p>
              <div className="sport-goals">
                {presentSports.map((sport) => (
                  <label key={sport.id} className="sport-goal">
                    <span>
                      <Icon name={sport.icon} size={15} /> {sport.label}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="900"
                      step="15"
                      value={sportGoals[sport.id] ?? ''}
                      placeholder="—"
                      onChange={(event) => onSportGoal(sport.id, Number(event.target.value))}
                      aria-label={`Minutes de ${sport.label} par semaine`}
                    />
                    <em>min / sem.</em>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <p className="settings__hint">
              Ajoutez ou importez des séances : les disciplines présentes apparaîtront ici.
            </p>
          )}
        </section>

        <section className="settings__block">
          <h3>Cœur</h3>
          <label className="field">
            <span className="field__label">
              FC max de référence{' '}
              <em>{maxHr > 0 ? `${maxHr} bpm` : 'déduite de vos séances'}</em>
            </span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="230"
              value={maxHr || ''}
              placeholder="0 = automatique"
              onChange={(event) => onMaxHr(Number(event.target.value))}
            />
          </label>
          <p className="settings__hint">
            Elle sert aux zones cardiaques de la page Progrès. Laisser vide revient à prendre la
            plus haute fréquence observée.
          </p>
        </section>

        <section className="settings__block">
          <h3>Apparence</h3>
          <div className="segmented" role="group" aria-label="Thème">
            <button
              type="button"
              className={theme === 'light' ? 'is-on' : undefined}
              onClick={() => onTheme('light')}
              aria-pressed={theme === 'light'}
            >
              <Icon name="sun" size={15} /> Clair
            </button>
            <button
              type="button"
              className={theme === 'dark' ? 'is-on' : undefined}
              onClick={() => onTheme('dark')}
              aria-pressed={theme === 'dark'}
            >
              <Icon name="moon" size={15} /> Sombre
            </button>
          </div>
        </section>

        <section className="settings__block">
          <h3>Données</h3>
          <p className="settings__hint">
            {activities.length} séance{activities.length > 1 ? 's' : ''} et {days.length} journée
            {days.length > 1 ? 's' : ''} dans ce navigateur. Le journal n’est copié nulle part.
          </p>
          {estimate ? (
            <p className="settings__storage">
              <strong>{formatBytes(estimate.usage)}</strong> utilisés
              {estimate.quota > 0 ? ` sur ${formatBytes(estimate.quota)}` : ''} ·{' '}
              {estimate.persisted
                ? 'le navigateur s’engage à ne pas les effacer.'
                : 'le navigateur peut les effacer si la place manque.'}
            </p>
          ) : null}

          <div className="settings__actions">
            <button type="button" className="btn btn--ghost" onClick={exportJson}>
              <Icon name="upload" size={16} /> Exporter une sauvegarde
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => fileInput.current?.click()}>
              <Icon name="import" size={16} /> Restaurer une sauvegarde
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="visuallyhidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void restoreFile(file);
              }}
            />
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                if (
                  (activities.length > 0 || days.length > 0) &&
                  !window.confirm(
                    'Remplacer le journal actuel et le programme par la démonstration ? Ils ne seront pas conservés.',
                  )
                ) {
                  return;
                }
                onLoadDemo();
              }}
            >
              <Icon name="sparkle" size={16} /> Voir la démonstration
            </button>
          </div>

          {restoreError ? (
            <p className="form__error" role="alert">
              {restoreError}
            </p>
          ) : null}
          {restored ? (
            <p className="settings__restored">
              <Icon name="check" size={15} /> Sauvegarde restaurée : {restored.activities} séances,{' '}
              {restored.days} journées.
            </p>
          ) : null}

          <button
            type="button"
            className="btn btn--danger btn--full"
            onClick={() => {
              if (
                window.confirm(
                  'Effacer toutes les séances, les pas et le programme de ce navigateur ? Cette action est définitive — pensez à exporter une sauvegarde.',
                )
              ) {
                onClear();
                onClose();
              }
            }}
          >
            <Icon name="trash" size={16} /> Effacer le journal local
          </button>
        </section>

        <footer className="settings__foot">
          <p>
            Battement 0.2.0 · MIT · local-first. Les imports Apple Santé, Samsung Health et les
            fichiers GPX, TCX et FIT sont lus sur l’appareil, jamais envoyés. Les polices sont
            embarquées et la coquille est mise en cache : la page ne contacte aucun serveur.
          </p>
        </footer>
      </div>
    </Modal>
  );
}
