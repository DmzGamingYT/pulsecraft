import { useMemo, useState } from 'react';
import type { Activity, Sport } from '../types';
import { SOURCE_LABELS, SPORTS, sportLabel } from '../types';
import { datePart, dayHeading, formatDistance, formatDuration } from '../lib/dates';
import { SessionRow } from '../components/SessionRow';
import { Icon } from '../components/Icons';

type SportFilter = 'tout' | Sport;

export function ActivityJournal({
  activities,
  onAdd,
  onImport,
  onDelete,
}: {
  activities: Activity[];
  onAdd: () => void;
  onImport: () => void;
  onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<SportFilter>('tout');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const counts = useMemo(() => {
    const map = new Map<Sport, number>();
    for (const activity of activities) {
      map.set(activity.sport, (map.get(activity.sport) ?? 0) + 1);
    }
    return map;
  }, [activities]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return activities.filter((activity) => {
      if (filter !== 'tout' && activity.sport !== filter) return false;
      if (!needle) return true;
      return [activity.title, activity.notes, SOURCE_LABELS[activity.source]]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(needle));
    });
  }, [activities, filter, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const activity of filtered) {
      const key = datePart(activity.date);
      const list = map.get(key) ?? [];
      list.push(activity);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const totalMinutes = filtered.reduce((sum, activity) => sum + activity.durationMin, 0);
  const totalKm = filtered.reduce((sum, activity) => sum + (activity.distanceKm ?? 0), 0);

  return (
    <section className="screen">
      <header className="screen__head screen__head--row">
        <div>
          <p className="eyebrow">Journal</p>
          <h1 className="screen__title">Toutes les séances.</h1>
          <p className="screen__lede">
            {activities.length === 0
              ? 'Rien à afficher pour l’instant. Une séance ajoutée à la main ou importée apparaîtra ici.'
              : `${activities.length} séance${activities.length > 1 ? 's' : ''} · ${formatDuration(
                  activities.reduce((sum, activity) => sum + activity.durationMin, 0),
                )} au total.`}
          </p>
        </div>
      </header>

      {activities.length === 0 ? (
        <div className="empty empty--compact">
          <div className="empty__mark">
            <Icon name="activity" size={24} />
          </div>
          <h2>Le journal attend sa première ligne.</h2>
          <p>Ajoutez une séance, ou importez vos données Apple Santé / Samsung Health.</p>
          <div className="empty__actions">
            <button type="button" className="btn btn--primary" onClick={onAdd}>
              <Icon name="plus" size={17} /> Ajouter une séance
            </button>
            <button type="button" className="btn btn--ghost" onClick={onImport}>
              <Icon name="import" size={17} /> Importer
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="filters">
            <div className="filters__chips" role="group" aria-label="Filtrer par discipline">
              <button
                type="button"
                className={`chip${filter === 'tout' ? ' is-on' : ''}`}
                onClick={() => setFilter('tout')}
                aria-pressed={filter === 'tout'}
              >
                Tout <i>{activities.length}</i>
              </button>
              {SPORTS.filter((sport) => (counts.get(sport.id) ?? 0) > 0).map((sport) => (
                <button
                  key={sport.id}
                  type="button"
                  className={`chip${filter === sport.id ? ' is-on' : ''}`}
                  onClick={() => setFilter(sport.id)}
                  aria-pressed={filter === sport.id}
                >
                  <span aria-hidden="true">{sport.glyph}</span> {sport.label}{' '}
                  <i>{counts.get(sport.id)}</i>
                </button>
              ))}
            </div>
            <label className={`search${searchOpen ? ' is-open' : ''}`}>
              <Icon name="search" size={15} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher une séance"
                aria-label="Rechercher une séance"
              />
            </label>
            <button
              type="button"
              className="iconbtn filters__search-toggle"
              onClick={() => setSearchOpen((open) => !open)}
              aria-expanded={searchOpen}
              aria-label={searchOpen ? 'Fermer la recherche' : 'Rechercher une séance'}
            >
              <Icon name={searchOpen ? 'close' : 'search'} size={17} />
            </button>
          </div>

          <p className="filters__summary">
            {filtered.length} séance{filtered.length > 1 ? 's' : ''} ·{' '}
            {formatDuration(totalMinutes)}
            {totalKm > 0 ? ` · ${formatDistance(totalKm)}` : ''}
            {filter !== 'tout' ? ` · ${sportLabel(filter)}` : ''}
          </p>

          {groups.length === 0 ? (
            <p className="no-result">Aucune séance ne correspond à ce filtre.</p>
          ) : (
            <div className="days">
              {groups.map(([day, list]) => (                <section className="day" key={day}>
                  <header className="day__head">
                    <h2>{dayHeading(day)}</h2>
                    <span>
                      {list.length} séance{list.length > 1 ? 's' : ''} ·{' '}
                      {formatDuration(list.reduce((sum, activity) => sum + activity.durationMin, 0))}
                    </span>
                  </header>
                  <ul className="sessions sessions--roomy">
                    {list.map((activity) => (
                      <SessionRow key={activity.id} activity={activity} onDelete={onDelete} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
