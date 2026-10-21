import { useEffect, useRef, useState } from 'react';
import { useJournal } from './store';
import { isDemoRequest } from './lib/demoEntry';
import { isEmptyJournal } from './store';
import { VIEWS, viewLabel, type View } from './views';
import { Icon, BattementMark } from './components/Icons';
import { ActivityForm } from './components/ActivityForm';
import { Settings } from './screens/Settings';
import { Today } from './screens/Today';
import { ActivityJournal } from './screens/Activity';
import { ImportScreen } from './screens/Import';
import { Progress } from './screens/Progress';
import { todayISO } from './lib/dates';

export function App() {
  const activities = useJournal((state) => state.activities);
  const days = useJournal((state) => state.days);
  const demo = useJournal((state) => state.demo);
  const settings = useJournal((state) => state.settings);
  const addActivity = useJournal((state) => state.addActivity);
  const deleteActivity = useJournal((state) => state.deleteActivity);
  const importParsed = useJournal((state) => state.importParsed);
  const loadDemo = useJournal((state) => state.loadDemo);
  const clearAll = useJournal((state) => state.clearAll);
  const setTheme = useJournal((state) => state.setTheme);
  const setGoal = useJournal((state) => state.setGoal);
  const setStepGoal = useJournal((state) => state.setStepGoal);

  const [view, setView] = useState<View>('today');
  const [adding, setAdding] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [view]);

  // `?demo=1` ouvre le journal d'exemple de la vitrine. Un journal déjà
  // rempli n'est jamais remplacé : la démo ne concerne que la première visite.
  useEffect(() => {
    if (isDemoRequest(window.location.search) && isEmptyJournal({ activities, days })) {
      loadDemo();
    }
    // Volontairement une seule fois, à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', settings.theme === 'dark' ? '#12110f' : '#f4f1e9');
  }, [settings.theme]);

  function remove(id: string) {
    const activity = activities.find((item) => item.id === id);
    const label = activity?.title || 'cette séance';
    if (window.confirm(`Supprimer « ${label} » du journal ?`)) deleteActivity(id);
  }

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail__brand">
          <span className="rail__mark">
            <BattementMark size={30} />
          </span>
          <span className="rail__wordmark">
            <strong>Battement</strong>
            <em>journal local</em>
          </span>
        </div>

        <nav className="rail__nav" aria-label="Sections">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rail__link${view === item.id ? ' is-on' : ''}`}
              onClick={() => setView(item.id)}
              aria-current={view === item.id ? 'page' : undefined}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="rail__foot">
          <span className="locality">
            <i aria-hidden="true" />
            Données locales
          </span>
          <span className="rail__version">v0.1 · MIT</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <span className="topbar__brand">
            <BattementMark size={22} /> Battement
          </span>
          <div className="topbar__titles">
            <span className="topbar__screen">{viewLabel(view)}</span>
            <span className="topbar__meta">
              {demo ? <em className="tag tag--demo">démo</em> : null}
              {view === 'today' ? todayISO() : VIEWS.find((item) => item.id === view)?.meta}
            </span>
          </div>
          <div className="topbar__actions">
            <button
              type="button"
              className="iconbtn"
              onClick={() => setTheme(settings.theme === 'dark' ? 'light' : 'dark')}
              aria-label={
                settings.theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'
              }
            >
              <Icon name={settings.theme === 'dark' ? 'sun' : 'moon'} size={17} />
            </button>
            <button
              type="button"
              className="iconbtn"
              onClick={() => setSettingsOpen(true)}
              aria-label="Réglages"
            >
              <Icon name="settings" size={17} />
            </button>
            <button type="button" className="btn btn--primary btn--small" onClick={() => setAdding(true)}>
              <Icon name="plus" size={16} />
              <span className="topbar__addlabel">Séance</span>
            </button>
          </div>
        </header>

        <div className="main__scroll" ref={scrollRef}>
          <div className="view" key={view}>
            {view === 'today' ? (
              <Today
                activities={activities}
                days={days}
                goalMin={settings.goalMin}
                stepGoal={settings.stepGoal}
                demo={demo}
                onNavigate={setView}
                onAdd={() => setAdding(true)}
              />
            ) : null}

            {view === 'activity' ? (
              <ActivityJournal
                activities={activities}
                onAdd={() => setAdding(true)}
                onImport={() => setView('import')}
                onDelete={remove}
              />
            ) : null}

            {view === 'import' ? (
              <ImportScreen onImport={importParsed} hasData={!isEmptyJournal({ activities, days })} />
            ) : null}

            {view === 'progress' ? (
              <Progress activities={activities} days={days} goalMin={settings.goalMin} />
            ) : null}

            <footer className="app-foot">
              <span>Battement · journal sportif local-first</span>
              <span>MIT · aucun compte · aucune télémétrie</span>
            </footer>
          </div>
        </div>
      </main>

      {adding ? (
        <ActivityForm
          onClose={() => setAdding(false)}
          onSave={(draft) => {
            addActivity(draft);
            setView('today');
          }}
        />
      ) : null}

      {settingsOpen ? (
        <Settings
          activities={activities}
          days={days}
          theme={settings.theme}
          goalMin={settings.goalMin}
          stepGoal={settings.stepGoal}
          onTheme={setTheme}
          onGoal={setGoal}
          onStepGoal={setStepGoal}
          onLoadDemo={() => {
            loadDemo();
            setView('today');
            setSettingsOpen(false);
          }}
          onClear={clearAll}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  );
}
