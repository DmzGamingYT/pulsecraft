import { useState, type FormEvent } from 'react';
import {
  SPORTS,
  sportLabel,
  type Activity,
  type DraftActivity,
  type Sport,
} from '../types';
import { movementLabel } from '../lib/dates';
import { Icon } from './Icons';
import { Modal } from './Modal';

function localInputValue(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function toInputValue(iso: string): string {
  return iso.slice(0, 16);
}

function toNumber(value: string): number | undefined {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function inputValue(value: number | undefined): string {
  return value === undefined ? '' : String(value).replace('.', ',');
}

/**
 * Le formulaire d'une séance sert aux trois gestes : ajouter, modifier, et
 * reprendre une séance du programme. C'est le même formulaire, prérempli.
 */
export function ActivityForm({
  initial,
  prefill,
  onClose,
  onSave,
}: {
  /** la séance à modifier */
  initial?: Activity;
  /** une séance proposée par le coach, sans identifiant */
  prefill?: DraftActivity;
  onClose: () => void;
  onSave: (draft: DraftActivity) => void;
}) {
  const source = initial ?? prefill;
  const [sport, setSport] = useState<Sport>(source?.sport ?? 'course');
  const [date, setDate] = useState(() =>
    source ? toInputValue(source.date) : localInputValue(),
  );
  const [title, setTitle] = useState(source?.title ?? '');
  const [duration, setDuration] = useState(String(source?.durationMin ?? 45));
  const [distance, setDistance] = useState(inputValue(source?.distanceKm));
  const [elevation, setElevation] = useState(inputValue(source?.elevationM));
  const [calories, setCalories] = useState(inputValue(source?.calories));
  const [avgHr, setAvgHr] = useState(inputValue(source?.avgHr));
  const [maxHr, setMaxHr] = useState(inputValue(source?.maxHr));
  const [rpe, setRpe] = useState(source?.rpe ? String(source.rpe) : '');
  const [notes, setNotes] = useState(source?.notes ?? '');
  const [error, setError] = useState('');

  const minutesPreview = toNumber(duration);
  const kmPreview = toNumber(distance);
  const movement =
    minutesPreview && kmPreview
      ? movementLabel(sport, minutesPreview, kmPreview)
      : undefined;

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
    const positive = (value: string) => {
      const parsed = toNumber(value);
      return parsed !== undefined && parsed > 0 ? parsed : undefined;
    };

    onSave({
      date: `${date.slice(0, 16)}:00`,
      sport,
      title: title.trim() || sportLabel(sport),
      durationMin: Math.round(minutes),
      distanceKm: km,
      elevationM: positive(elevation),
      calories: positive(calories),
      avgHr: positive(avgHr),
      maxHr: positive(maxHr),
      rpe: rpe ? Number(rpe) : undefined,
      notes: notes.trim() || undefined,
      source: initial?.source ?? prefill?.source ?? 'manuel',
      externalId: initial?.externalId ?? prefill?.externalId,
      route: initial?.route,
    });
    onClose();
  }

  return (
    <Modal
      title={initial ? 'Modifier la séance' : 'Nouvelle séance'}
      eyebrow={initial ? 'Journal · édition' : prefill ? 'Programme · séance prévue' : 'Journal manuel'}
      onClose={onClose}
      wide
    >
      <form className="form" onSubmit={submit}>
        <fieldset className="field field--sports">
          <legend className="field__label">Discipline</legend>
          <div className="sports">
            {SPORTS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`sport${sport === item.id ? ' is-on' : ''}`}
                data-sport={item.id}
                onClick={() => setSport(item.id)}
                aria-pressed={sport === item.id}
              >
                <Icon name={item.icon} size={16} />
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
          <span className="field__label">
            Titre <em>facultatif</em>
          </span>
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
            <span className="field__label">Dénivelé (m)</span>
            <input
              type="text"
              inputMode="numeric"
              value={elevation}
              onChange={(event) => setElevation(event.target.value)}
              placeholder="120"
            />
          </label>
        </div>

        {movement ? (
          <p className="form__movement">
            <Icon name="trend" size={15} />
            {movement}
          </p>
        ) : null}

        <div className="field-row">
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
        </div>

        <div className="field-row">
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
          <label className="field">
            <span className="field__label">
              Ressenti <em>RPE, facultatif</em>
            </span>
            <select value={rpe} onChange={(event) => setRpe(event.target.value)}>
              <option value="">Non renseigné</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                <option key={level} value={level}>
                  {level} / 10
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span className="field__label">
            Notes <em>facultatif</em>
          </span>
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
              {initial ? 'Enregistrer' : 'Ajouter au journal'}
            </button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}
