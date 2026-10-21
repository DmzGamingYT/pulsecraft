import { useState } from 'react';
import type { DayLog } from '../types';
import { todayISO } from '../lib/dates';
import { Icon } from './Icons';
import { Modal } from './Modal';

function number(value: string): number | undefined {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function text(value: number | undefined, decimals = 0): string {
  if (value === undefined) return '';
  return decimals > 0
    ? value.toFixed(decimals).replace('.', ',')
    : String(Math.round(value));
}

/**
 * Les journées ne viennent pas seulement des imports : une montre mal réglée,
 * un téléphone oublié, et les pas d'un jour sont faux. Ce formulaire laisse
 * corriger la ligne — et la supprimer en vidant les champs.
 */
export function DayForm({
  day,
  onClose,
  onSave,
}: {
  day?: DayLog;
  onClose: () => void;
  onSave: (date: string, patch: Partial<Omit<DayLog, 'date'>>, previousDate?: string) => void;
}) {
  const [date, setDate] = useState(day?.date ?? todayISO());
  const [steps, setSteps] = useState(text(day?.steps));
  const [activeCalories, setActiveCalories] = useState(text(day?.activeCalories));
  const [sleep, setSleep] = useState(text(day?.sleepMin ? day.sleepMin / 60 : undefined, 1));
  const [restingHr, setRestingHr] = useState(text(day?.restingHr));
  const [vo2max, setVo2max] = useState(text(day?.vo2max, 1));
  const [error, setError] = useState('');

  function submit() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Choisissez une date.');
      return;
    }
    const stepValue = number(steps);
    const sleepHours = number(sleep);
    if (
      [stepValue, number(activeCalories), sleepHours, number(restingHr), number(vo2max)].some(
        (value) => value !== undefined && value < 0,
      )
    ) {
      setError('Les valeurs ne peuvent pas être négatives.');
      return;
    }

    onSave(
      date,
      {
        steps: stepValue === undefined ? undefined : Math.round(stepValue),
        activeCalories:
          number(activeCalories) === undefined ? undefined : Math.round(number(activeCalories)!),
        sleepMin: sleepHours === undefined ? undefined : Math.round(sleepHours * 60),
        restingHr: number(restingHr) === undefined ? undefined : Math.round(number(restingHr)!),
        vo2max: number(vo2max),
      },
      day?.date,
    );
    onClose();
  }

  return (
    <Modal
      title={day ? 'Corriger la journée' : 'Ajouter une journée'}
      eyebrow="Pas, sommeil, cœur"
      onClose={onClose}
    >
      <div className="form">
        <label className="field">
          <span className="field__label">Date</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Pas</span>
            <input
              type="text"
              inputMode="numeric"
              value={steps}
              onChange={(event) => setSteps(event.target.value)}
              placeholder="8 000"
            />
          </label>
          <label className="field">
            <span className="field__label">Calories actives</span>
            <input
              type="text"
              inputMode="numeric"
              value={activeCalories}
              onChange={(event) => setActiveCalories(event.target.value)}
              placeholder="420"
            />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span className="field__label">
              Sommeil <em>heures</em>
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={sleep}
              onChange={(event) => setSleep(event.target.value)}
              placeholder="7,5"
            />
          </label>
          <label className="field">
            <span className="field__label">
              FC de repos <em>bpm</em>
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={restingHr}
              onChange={(event) => setRestingHr(event.target.value)}
              placeholder="52"
            />
          </label>
        </div>

        <label className="field">
          <span className="field__label">
            VO2 max <em>mL/kg/min, facultatif</em>
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={vo2max}
            onChange={(event) => setVo2max(event.target.value)}
            placeholder="46,2"
          />
        </label>

        <p className="setup__hint">
          Vider tous les champs supprime la journée. Les valeurs saisies ici priment sur un
          réimport, sauf pour les pas, où le maximum est gardé.
        </p>

        {error ? (
          <p className="form__error" role="alert">
            {error}
          </p>
        ) : null}

        <footer className="form__foot">
          <p>Rien ne quitte l’appareil.</p>
          <div className="form__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              <Icon name="close" size={15} /> Annuler
            </button>
            <button type="button" className="btn btn--primary" onClick={submit}>
              Enregistrer la journée
            </button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}
