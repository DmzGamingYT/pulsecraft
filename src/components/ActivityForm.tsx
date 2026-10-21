import { useState, type FormEvent } from 'react';
import { SPORTS, sportLabel, type DraftActivity, type Sport } from '../types';
import { Modal } from './Modal';

function localInputValue(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function toNumber(value: string): number | undefined {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function ActivityForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (draft: DraftActivity) => void;
}) {
  const [sport, setSport] = useState<Sport>('course');
  const [date, setDate] = useState(localInputValue());
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('45');
  const [distance, setDistance] = useState('');
  const [calories, setCalories] = useState('');
  const [avgHr, setAvgHr] = useState('');
  const [maxHr, setMaxHr] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const minutes = toNumber(duration);
    if (!date) {
      setError('Choisissez une date et une heure.');
      return;
    }
    if (minutes === undefined || minutes <= 0) {
      setError('La durée doit être supérieure à zéro.');
      return;
    }
    if (minutes > 24 * 60) {
      setError('Une séance ne peut pas durer plus de 24 heures.');
      return;
    }
    const km = toNumber(distance);
    if (km !== undefined && km < 0) {
      setError('La distance ne peut pas être négative.');
      return;
    }

    onSave({
      date: `${date.slice(0, 16)}:00`,
      sport,
      title: title.trim() || sportLabel(sport),
      durationMin: Math.round(minutes),
      distanceKm: km,
      calories: toNumber(calories),
      avgHr: toNumber(avgHr),
      maxHr: toNumber(maxHr),
      notes: notes.trim() || undefined,
      source: 'manuel',
    });
    onClose();
  }

  return (
    <Modal title="Nouvelle séance" eyebrow="Journal manuel" onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <fieldset className="field field--sports">
          <legend className="field__label">Discipline</legend>
          <div className="sports">
            {SPORTS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`sport${sport === item.id ? ' is-on' : ''}`}
                onClick={() => setSport(item.id)}
                aria-pressed={sport === item.id}
              >
                <i aria-hidden="true">{item.glyph}</i>
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Début</span>
            <input
              type="datetime-local"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Durée (min)</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="1440"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              required
            />
          </label>
        </div>

        <label className="field">
          <span className="field__label">Titre <em>facultatif</em></span>
          <input
            type="text"
            value={title}
            maxLength={80}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={sportLabel(sport)}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Distance (km)</span>
            <input
              type="text"
              inputMode="decimal"
              value={distance}
              onChange={(event) => setDistance(event.target.value)}
              placeholder="7,4"
            />
          </label>
          <label className="field">
            <span className="field__label">Calories (kcal)</span>
            <input
              type="text"
              inputMode="numeric"
              value={calories}
              onChange={(event) => setCalories(event.target.value)}
              placeholder="420"
            />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span className="field__label">FC moyenne</span>
            <input
              type="text"
              inputMode="numeric"
              value={avgHr}
              onChange={(event) => setAvgHr(event.target.value)}
              placeholder="148"
            />
          </label>
          <label className="field">
            <span className="field__label">FC max</span>
            <input
              type="text"
              inputMode="numeric"
              value={maxHr}
              onChange={(event) => setMaxHr(event.target.value)}
              placeholder="172"
            />
          </label>
        </div>

        <label className="field">
          <span className="field__label">Notes <em>facultatif</em></span>
          <textarea
            rows={3}
            value={notes}
            maxLength={500}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Sensations, parcours, météo…"
          />
        </label>

        {error ? (
          <p className="form__error" role="alert">
            {error}
          </p>
        ) : null}

        <footer className="form__foot">
          <p>Cette séance reste sur cet appareil. Aucun envoi, aucun compte.</p>
          <div className="form__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn btn--primary">
              Ajouter au journal
            </button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}
