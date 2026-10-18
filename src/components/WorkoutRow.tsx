import { useState, type CSSProperties } from 'react';
import { WORKOUT_COLORS, WORKOUT_META, type Workout } from '../types';
import { workoutCalories, workoutLoad } from '../lib/analytics';
import { usePulse } from '../store';
import { relativeDay } from '../lib/dates';
import { fmtDecimal, fmtMinutes, fmtNumber, fmtPace } from '../lib/format';
import { coreStatus } from '../lib/core';
import { Icon } from './Icon';
import { SourceBadge } from './Page';

export function WorkoutRow({
  workout,
  showDate = false,
  onDelete,
}: {
  workout: Workout;
  showDate?: boolean;
  onDelete?: (id: string) => void;
}) {
  const profile = usePulse((state) => state.profile);
  const body = usePulse((state) => state.body);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const meta = WORKOUT_META[workout.type];
  const color = WORKOUT_COLORS[workout.type];
  const weight = body[0]?.weightKg ?? profile.weightKg;
  const calories = workoutCalories(workout, weight);
  const load = workoutLoad(workout, profile);
  const paceValue =
    workout.distanceKm && workout.distanceKm > 0.5
      ? fmtPace(workout.durationMin / workout.distanceKm)
      : null;

  return (
    <article
      className={`workout${open ? ' is-open' : ''}`}
      style={{ ['--wc' as string]: color } as CSSProperties}
    >
      <button
        type="button"
        className="workout__main"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="workout__icon">
          <Icon name={meta.icon} size={21} />
        </span>
        <span className="workout__title">
          <strong>{workout.type}</strong>
          <span>
            {showDate ? `${relativeDay(workout.date)} · ` : ''}
            {workout.time ? `${workout.time} · ` : ''}
            {workout.distanceKm ? `${fmtDecimal(workout.distanceKm)} km` : ''}
            {workout.distanceKm ? ' · ' : ''}
            {workout.rpe ? `effort ${workout.rpe}/10` : workout.distanceKm ? '' : 'séance'}
          </span>
        </span>
        <span className="workout__metrics">
          <span>
            <b>{fmtMinutes(workout.durationMin)}</b>
            <em>durée</em>
          </span>
          {paceValue ? (
            <span>
              <b>{paceValue.replace(' /km', '')}</b>
              <em>allure</em>
            </span>
          ) : null}
          <span>
            <b>{fmtNumber(calories)}</b>
            <em>kcal</em>
          </span>
          <span className="workout__load">
            <b>{fmtNumber(load)}</b>
            <em>charge</em>
          </span>
        </span>
        <Icon name="chevron" size={18} className="workout__chevron" />
      </button>

      {open ? (
        <div className="workout__detail">
          <div className="workout__detailgrid">
            <div>
              <span>Distance</span>
              <strong>{workout.distanceKm ? `${fmtDecimal(workout.distanceKm)} km` : '—'}</strong>
            </div>
            <div>
              <span>FC moyenne</span>
              <strong>{workout.avgHr ? `${Math.round(workout.avgHr)} bpm` : '—'}</strong>
            </div>
            <div>
              <span>FC max</span>
              <strong>{workout.maxHr ? `${Math.round(workout.maxHr)} bpm` : '—'}</strong>
            </div>
            <div>
              <span>Effort perçu</span>
              <strong>{workout.rpe ? `${workout.rpe}/10` : '—'}</strong>
            </div>
            <div>
              <span>Dénivelé</span>
              <strong>{workout.elevationM ? `${Math.round(workout.elevationM)} m` : '—'}</strong>
            </div>
            <div>
              <span>Source</span>
              <strong>
                <SourceBadge source={workout.source} />
                {workout.source === 'manuel' ? 'Manuel' : ''}
              </strong>
            </div>
          </div>

          {workout.notes ? <p className="workout__notes">{workout.notes}</p> : null}

          {onDelete ? (
            <div className="workout__actions">
              {confirming ? (
                <>
                  <span>Supprimer cette séance ?</span>
                  <button
                    type="button"
                    className="btn btn--danger btn--small"
                    onClick={() => onDelete(workout.id)}
                  >
                    Oui, supprimer
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => setConfirming(false)}
                  >
                    Annuler
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => setConfirming(true)}
                >
                  <Icon name="trash" size={15} /> Supprimer
                </button>
              )}
              {coreStatus() === 'wasm' ? <em className="workout__engine">calcul Rust</em> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
