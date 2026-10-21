import { useEffect, useMemo, useRef, useState } from 'react';
import type { Activity, Sport } from '../types';
import { SOURCE_LABELS, SPORTS, sportLabel } from '../types';
import {
  addDays,
  datePart,
  dayHeading,
  formatDistance,
  formatDuration,
  todayISO,
} from '../lib/dates';
import { SessionRow } from '../components/SessionRow';
import { Icon } from '../components/Icons';
import { useJournal } from '../store';
import { useToast } from '../lib/toast';

type SportFilter = 'tout' | Sport;
type Period = '7' | '30' | '90' | 'all';
type Sort = 'recent' | 'oldest' | 'duration' | 'distance';

const PERIODS: { id: Period; label: string }[] = [
  { id: '7', label: '7 jours' },
  { id: '30', label: '30 jours' },
  { id: '90', label: '90 jours' },
  { id: 'all', label: 'Tout' },
];

const SORTS: { id: Sort; label: string }[] = [
  { id: 'recent', label: 'Plus récentes' },
  { id: 'oldest', label: 'Plus anciennes' },
  { id: 'duration', label: 'Durée' },
  { id: 'distance', label: 'Distance' },
];

export function ActivityJournal({
  activities,
  onAdd,
  onImport,
  onOpen,
}: {
  activities: Activity[];
  onAdd: () => void;
  onImport: () => void;
  onOpen: (activity: Activity) => void;
}) {
  const [filter, setFilter] = useState<SportFilter>('tout');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [period, setPeriod] = useState<Period>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  const removeActivities = useJournal((state) => state.removeActivities);
  const restoreActivities = useJournal((state) => state.restoreActivities);
  const mergeActivities = useJournal((state) => state.mergeActivities);
  const show = useToast((state) => state.show);

  useEffect(() => {
    const focus = () => {
      setSearchOpen(true);
      window.setTimeout(() => searchRef.current?.focus(), 30);
    };
    window.addEventListener('battement:search', focus);
    return () => window.removeEventListener('battement:search', focus);
  }, []);

  const counts = useMemo(() => {
    const map = new Map<Sport, number>();
    for (const activity of activities) {
      map.set(activity.sport, (map.get(activity.sport) ?? 0) + 1);
    }
    return map;
  }, [activities]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const start = period === 'all' ? null : addDays(todayISO(), -(Number(period) - 1));
    const list = activities.filter((activity) => {
      if (filter !== 'tout' && activity.sport !== filter) return false;
      if (start && datePart(activity.date) < start) return false;
      if (!needle) return true;
      return [activity.title, activity.notes, SOURCE_LABELS[activity.source]]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(needle));
    });

    const sorted = [...list];
    if (sort === 'oldest') sorted.sort((a, b) => a.date.localeCompare(b.date));
    else if (sort === 'duration') sorted.sort((a, b) => b.durationMin - a.durationMin);
    else if (sort === 'distance')
      sorted.sort((a, b) => (b.distanceKm ?? 0) - (a.distanceKm ?? 0));
    else sorted.sort((a, b) => b.date.localeCompare(a.date));
    return sorted;
  }, [activities, filter, query, period, sort]);

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
  const dateSort = sort === 'recent' || sort === 'oldest';

  function toggleSelect(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  function deleteSelected() {
    const removed = activities.filter((activity) => selected.has(activity.id));
    if (removed.length === 0) return;
    removeActivities(removed.map((activity) => activity.id));
    stopSelecting();
    show(
      `${removed.length} séance${removed.length > 1 ? 's' : ''} supprimée${
        removed.length > 1 ? 's' : ''
      }.`,
      { label: 'Annuler', run: () => restoreActivities(removed) },
    );
  }

  function mergeSelected() {
    if (selected.size < 2) return;
    if (
      !window.confirm(
        `Fusionner ${selected.size} séances en une seule ? La ligne importée sert de base, les autres sont retirées.`,
      )
    ) {
      return;
    }
    mergeActivities([...selected]);
    stopSelecting();
    show('Doublons fusionnés.');
  }

  const hasFilters = filter !== 'tout' || period !== 'all' || query.trim() !== '';

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
        {activities.length > 0 ? (
          <div className="screen__head-actions">
            <button
              type="button"
              className={`btn btn--ghost btn--small${selecting ? ' is-on' : ''}`}
              onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
              aria-pressed={selecting}
            >
              <Icon name={selecting ? 'close' : 'check'} size={15} />
              {selecting ? 'Annuler' : 'Sélectionner'}
            </button>
          </div>
        ) : null}
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
                  data-sport={sport.id}
                  onClick={() => setFilter(sport.id)}
                  aria-pressed={filter === sport.id}
                >
                  <Icon name={sport.icon} size={14} /> {sport.label}{' '}
                  <i>{counts.get(sport.id)}</i>
                </button>
              ))}
            </div>
            <label className={`search${searchOpen ? ' is-open' : ''}`}>
              <Icon name="search" size={15} />
              <input
                ref={searchRef}
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

          <div className="filters filters--secondary">
            <label className="select">
              <span className="micro">Période</span>
              <select value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
                {PERIODS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="select">
              <span className="micro">Trier</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
                {SORTS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="filters__summary">
              {filtered.length} séance{filtered.length > 1 ? 's' : ''} ·{' '}
              {formatDuration(totalMinutes)}
              {totalKm > 0 ? ` · ${formatDistance(totalKm)}` : ''}
              {filter !== 'tout' ? ` · ${sportLabel(filter)}` : ''}
            </p>
            {hasFilters ? (
              <button
                type="button"
                className="textlink filters__reset"
                onClick={() => {
                  setFilter('tout');
                  setPeriod('all');
                  setQuery('');
                }}
              >
                Réinitialiser
              </button>
            ) : null}
          </div>

          {selecting ? (
            <div className="selbar" role="region" aria-label="Sélection">
              <span>
                {selected.size} séance{selected.size > 1 ? 's' : ''} sélectionnée
                {selected.size > 1 ? 's' : ''}
              </span>
              <div className="selbar__actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() =>
                    setSelected(
                      selected.size === filtered.length
                        ? new Set()
                        : new Set(filtered.map((activity) => activity.id)),
                    )
                  }
                >
                  {selected.size === filtered.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={mergeSelected}
                  disabled={selected.size < 2}
                >
                  <Icon name="journal" size={14} /> Fusionner
                </button>
                <button
                  type="button"
                  className="btn btn--danger btn--small"
                  onClick={deleteSelected}
                  disabled={selected.size === 0}
                >
                  <Icon name="trash" size={14} /> Supprimer
                </button>
              </div>
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <p className="no-result">Aucune séance ne correspond à ces filtres.</p>
          ) : dateSort ? (
            <div className="days">
              {groups.map(([day, list]) => (
                <section className="day" key={day}>
                  <header className="day__head">
                    <h2>{dayHeading(day)}</h2>
                    <span>
                      {list.length} séance{list.length > 1 ? 's' : ''} ·{' '}
                      {formatDuration(
                        list.reduce((sum, activity) => sum + activity.durationMin, 0),
                      )}
                    </span>
                  </header>
                  <ul className="sessions sessions--roomy">
                    {list.map((activity) => (
                      <SessionRow
                        key={activity.id}
                        activity={activity}
                        onOpen={onOpen}
                        selectable={selecting}
                        selected={selected.has(activity.id)}
                        onSelect={toggleSelect}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <ul className="sessions sessions--roomy sessions--flat">
              {filtered.map((activity) => (
                <SessionRow
                  key={activity.id}
                  activity={activity}
                  showDate
                  onOpen={onOpen}
                  selectable={selecting}
                  selected={selected.has(activity.id)}
                  onSelect={toggleSelect}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
