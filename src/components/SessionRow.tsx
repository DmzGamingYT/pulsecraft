import type { Activity } from '../types';
import { SOURCE_LABELS, sportGlyph } from '../types';
import { datePart, formatDistance, formatDuration, shortDate } from '../lib/dates';
import { Icon } from './Icons';

function timeOf(iso: string): string {
  return iso.slice(11, 16);
}

export function SessionRow({
  activity,
  onDelete,
  showDate = false,
}: {
  activity: Activity;
  onDelete?: (id: string) => void;
  /** Affiche la date courte : utile hors des groupes « par jour ». */
  showDate?: boolean;
}) {
  return (
    <li className="session">
      <span className="session__glyph" data-sport={activity.sport} aria-hidden="true">
        {sportGlyph(activity.sport)}
      </span>
      <div className="session__body">
        <p className="session__title">{activity.title || 'Séance'}</p>
        <p className="session__meta">
          {showDate ? <span>{shortDate(datePart(activity.date))}</span> : null}
          <span>{formatDuration(activity.durationMin)}</span>
          {activity.distanceKm ? <span>{formatDistance(activity.distanceKm)}</span> : null}
          {activity.avgHr ? <span>{activity.avgHr} bpm</span> : null}
          <span className="session__source" data-source={activity.source}>
            {SOURCE_LABELS[activity.source]}
          </span>
        </p>
      </div>
      <span className="session__time">{timeOf(activity.date)}</span>
      {onDelete ? (
        <button
          type="button"
          className="iconbtn iconbtn--tiny session__delete"
          onClick={() => onDelete(activity.id)}
          aria-label={`Supprimer ${activity.title || 'la séance'}`}
        >
          <Icon name="trash" size={14} />
        </button>
      ) : null}
    </li>
  );
}
