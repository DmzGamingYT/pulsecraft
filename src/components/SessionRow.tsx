import type { Activity } from '../types';
import { SOURCE_LABELS, sportIcon } from '../types';
import {
  datePart,
  formatDistance,
  formatDuration,
  movementLabel,
  shortDate,
} from '../lib/dates';
import { Icon } from './Icons';

function timeOf(iso: string): string {
  return iso.slice(11, 16);
}

/**
 * Une ligne du journal. Toute la ligne ouvre la fiche séance ; le mode
 * sélection ajoute une case à cocher, sans changer le reste.
 */
export function SessionRow({
  activity,
  onOpen,
  showDate = false,
  selectable = false,
  selected = false,
  onSelect,
}: {
  activity: Activity;
  onOpen?: (activity: Activity) => void;
  /** Affiche la date courte : utile hors des groupes « par jour ». */
  showDate?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const movement = movementLabel(activity.sport, activity.durationMin, activity.distanceKm);

  return (
    <li className={`session${selected ? ' is-selected' : ''}${selectable ? ' is-selectable' : ''}`}>
      {selectable ? (
        <input
          type="checkbox"
          className="session__check"
          checked={selected}
          onChange={() => onSelect?.(activity.id)}
          aria-label={`Sélectionner ${activity.title || 'la séance'}`}
        />
      ) : null}
      <button
        type="button"
        className="session__open"
        onClick={() => onOpen?.(activity)}
        aria-label={`${activity.title || 'Séance'} — ouvrir la fiche`}
      >
        <span className="session__glyph" data-sport={activity.sport} aria-hidden="true">
          <Icon name={sportIcon(activity.sport)} size={18} />
        </span>
        <span className="session__body">
          <span className="session__title">{activity.title || 'Séance'}</span>
          <span className="session__meta">
            {showDate ? <span>{shortDate(datePart(activity.date))}</span> : null}
            <span>{formatDuration(activity.durationMin)}</span>
            {activity.distanceKm ? <span>{formatDistance(activity.distanceKm)}</span> : null}
            {movement ? <span className="session__pace">{movement}</span> : null}
            {activity.avgHr ? <span>{activity.avgHr} bpm</span> : null}
            {activity.rpe ? <span>RPE {activity.rpe}</span> : null}
            <span className="session__source" data-source={activity.source}>
              {SOURCE_LABELS[activity.source]}
            </span>
          </span>
        </span>
        <span className="session__time">{timeOf(activity.date)}</span>
      </button>
    </li>
  );
}
