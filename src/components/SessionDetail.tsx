import type { Activity } from '../types';
import { SOURCE_LABELS, sportIcon, sportLabel } from '../types';
import {
  formatDistance,
  formatDuration,
  formatNumber,
  longDate,
  movementLabel,
} from '../lib/dates';
import { parseRoute, routePath } from '../lib/route';
import { Icon } from './Icons';
import { Modal } from './Modal';

/**
 * La fiche d'une séance : ce que la ligne du journal ne peut pas dire.
 * Notes, FC max, ressenti, allure et tracé — et les gestes qui vont avec.
 */
export function SessionDetail({
  activity,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  onRepeat,
}: {
  activity: Activity;
  onClose: () => void;
  onEdit: (activity: Activity) => void;
  onDuplicate: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
  onRepeat: (activity: Activity) => void;
}) {
  const points = parseRoute(activity.route);
  const trace = routePath(points, 240, 8);
  const movement = movementLabel(activity.sport, activity.durationMin, activity.distanceKm);
  const time = activity.date.slice(11, 16);

  return (
    <Modal title={activity.title || sportLabel(activity.sport)} eyebrow="Séance" onClose={onClose}>
      <div className="detail">
        <div className="detail__head">
          <span className="detail__glyph" data-sport={activity.sport} aria-hidden="true">
            <Icon name={sportIcon(activity.sport)} size={22} />
          </span>
          <div>
            <p className="detail__sport">
              {sportLabel(activity.sport)} · {longDate(activity.date.slice(0, 10))} à {time}
            </p>
            <p className="detail__source">
              <span data-source={activity.source}>{SOURCE_LABELS[activity.source]}</span>
              {activity.externalId ? <em>importé</em> : null}
            </p>
          </div>
        </div>

        <dl className="detail__stats">
          <div>
            <dt>Durée</dt>
            <dd>{formatDuration(activity.durationMin)}</dd>
          </div>
          <div>
            <dt>Distance</dt>
            <dd>{activity.distanceKm ? formatDistance(activity.distanceKm) : '—'}</dd>
          </div>
          <div>
            <dt>{activity.sport === 'velo' ? 'Vitesse' : 'Allure'}</dt>
            <dd>{movement ?? '—'}</dd>
          </div>
          <div>
            <dt>Dénivelé</dt>
            <dd>{activity.elevationM ? `${formatNumber(activity.elevationM)} m` : '—'}</dd>
          </div>
          <div>
            <dt>Calories</dt>
            <dd>{activity.calories ? `${formatNumber(activity.calories)} kcal` : '—'}</dd>
          </div>
          <div>
            <dt>FC moyenne</dt>
            <dd>{activity.avgHr ? `${activity.avgHr} bpm` : '—'}</dd>
          </div>
          <div>
            <dt>FC max</dt>
            <dd>{activity.maxHr ? `${activity.maxHr} bpm` : '—'}</dd>
          </div>
          <div>
            <dt>Ressenti</dt>
            <dd>{activity.rpe ? `${activity.rpe} / 10` : '—'}</dd>
          </div>
        </dl>

        {trace ? (
          <figure className="detail__route">
            <svg viewBox="0 0 240 240" role="img" aria-label="Tracé du parcours">
              <path d={trace} />
            </svg>
            <figcaption>Tracé enregistré dans le fichier importé, dessiné sans carte.</figcaption>
          </figure>
        ) : null}

        {activity.notes ? (
          <section className="detail__notes">
            <p className="micro">Notes</p>
            <p>{activity.notes}</p>
          </section>
        ) : null}

        <div className="detail__actions">
          <button type="button" className="btn btn--primary" onClick={() => onRepeat(activity)}>
            <Icon name="plus" size={16} /> Refaire aujourd’hui
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => onEdit(activity)}>
            <Icon name="settings" size={16} /> Modifier
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => onDuplicate(activity)}>
            <Icon name="file" size={16} /> Dupliquer
          </button>
          <button type="button" className="btn btn--danger" onClick={() => onDelete(activity)}>
            <Icon name="trash" size={16} /> Supprimer
          </button>
        </div>
      </div>
    </Modal>
  );
}
