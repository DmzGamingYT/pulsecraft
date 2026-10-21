import type { Activity, DayLog } from '../types';
import type { Theme } from '../store';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icons';

export function Settings({
  activities,
  days,
  theme,
  goalMin,
  stepGoal,
  onTheme,
  onGoal,
  onStepGoal,
  onLoadDemo,
  onClear,
  onClose,
}: {
  activities: Activity[];
  days: DayLog[];
  theme: Theme;
  goalMin: number;
  stepGoal: number;
  onTheme: (theme: Theme) => void;
  onGoal: (minutes: number) => void;
  onStepGoal: (steps: number) => void;
  onLoadDemo: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  function exportJson() {
    const payload = {
      app: 'battement',
      version: 1,
      exportedAt: new Date().toISOString(),
      activities,
      days,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `battement-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal title="Réglages" eyebrow="Battement" onClose={onClose}>
      <div className="settings">
        <section className="settings__block">
          <h3>Objectifs</h3>
          <label className="field">
            <span className="field__label">
              Minutes actives par semaine <em>{goalMin} min</em>
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
          <label className="field">
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
            L’objectif de l’OMS est de 150 minutes d’activité modérée par semaine.
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
            {activities.length} séance{activities.length > 1 ? 's' : ''} et {days.length}{' '}
            journée{days.length > 1 ? 's' : ''} dans ce navigateur. Le journal n’est
            copié nulle part.
          </p>
          <div className="settings__actions">
            <button type="button" className="btn btn--ghost" onClick={exportJson}>
              <Icon name="upload" size={16} /> Exporter en JSON
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                if (
                  (activities.length > 0 || days.length > 0) &&
                  !window.confirm(
                    'Remplacer le journal actuel par la démonstration ? Vos séances ne seront pas conservées.',
                  )
                ) {
                  return;
                }
                onLoadDemo();
              }}
            >
              <Icon name="activity" size={16} /> Voir la démonstration
            </button>
          </div>
          <button
            type="button"
            className="btn btn--danger btn--full"
            onClick={() => {
              if (
                window.confirm(
                  'Effacer toutes les séances et les pas de ce navigateur ? Cette action est définitive.',
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
            Battement 0.1.0 · MIT · local-first. Les imports Apple Santé et Samsung
            Health sont lus sur l’appareil, jamais envoyés.
          </p>
        </footer>
      </div>
    </Modal>
  );
}
