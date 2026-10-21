import { useCallback, useEffect, useRef, useState } from 'react';
import { useJournal } from './store';
import { isDemoRequest } from './lib/demoEntry';
import { isEmptyJournal } from './store';
import { VIEWS, viewLabel, type View } from './views';
import { Icon, BattementMark } from './components/Icons';
import { ActivityForm } from './components/ActivityForm';
import { SessionDetail } from './components/SessionDetail';
import { DayForm } from './components/DayForm';
import { Toaster } from './components/Toaster';
import { Settings } from './screens/Settings';
import { Today } from './screens/Today';
import { ActivityJournal } from './screens/Activity';
import { ImportScreen } from './screens/Import';
import { ProgramScreen } from './screens/Program';
import { Progress } from './screens/Progress';
import { localStamp, todayISO } from './lib/dates';
import { requestPersistence } from './lib/storage';
import { useToast } from './lib/toast';
import type { Activity, DayLog, DraftActivity } from './types';
import type { PlanSession } from './lib/coach';
import type { ParsedBackup } from './lib/backup';

const SLUGS: Record<View, string> = {
  today: 'aujourd-hui',
  program: 'programme',
  activity: 'activite',
  import: 'importer',
  progress: 'progres',
};

function viewFromHash(): View | null {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return (Object.keys(SLUGS) as View[]).find((view) => SLUGS[view] === raw) ?? null;
}

type FormState =
  | { mode: 'create' }
  | { mode: 'edit'; activity: Activity }
  | { mode: 'prefill'; draft: DraftActivity; planDate?: string };

export function App() {
  const activities = useJournal((state) => state.activities);
  const days = useJournal((state) => state.days);
  const demo = useJournal((state) => state.demo);
  const settings = useJournal((state) => state.settings);
  const hydrated = useJournal((state) => state.hydrated);
  const addActivity = useJournal((state) => state.addActivity);
  const updateActivity = useJournal((state) => state.updateActivity);
  const duplicateActivity = useJournal((state) => state.duplicateActivity);
  const deleteActivity = useJournal((state) => state.deleteActivity);
  const restoreActivities = useJournal((state) => state.restoreActivities);
  const importParsed = useJournal((state) => state.importParsed);
  const importBackup = useJournal((state) => state.importBackup);
  const loadDemo = useJournal((state) => state.loadDemo);
  const clearAll = useJournal((state) => state.clearAll);
  const setTheme = useJournal((state) => state.setTheme);
  const setDayLog = useJournal((state) => state.setDayLog);
  const setSessionsGoal = useJournal((state) => state.setSessionsGoal);
  const setDistanceGoal = useJournal((state) => state.setDistanceGoal);
  const setSportGoal = useJournal((state) => state.setSportGoal);
  const setMaxHr = useJournal((state) => state.setMaxHr);
  const program = useJournal((state) => state.program);
  const programDone = useJournal((state) => state.programDone);
  const startProgram = useJournal((state) => state.startProgram);
  const startNextCycle = useJournal((state) => state.startNextCycle);
  const toggleProgramSession = useJournal((state) => state.toggleProgramSession);
  const recordCheckIn = useJournal((state) => state.recordCheckIn);
  const stopProgram = useJournal((state) => state.stopProgram);
  const setGoal = useJournal((state) => state.setGoal);
  const setStepGoal = useJournal((state) => state.setStepGoal);
  const show = useToast((state) => state.show);

  const [view, setView] = useState<View>(() => viewFromHash() ?? 'today');
  const [form, setForm] = useState<FormState | null>(null);
  const [detail, setDetail] = useState<Activity | null>(null);
  const [dayForm, setDayForm] = useState<{ day?: DayLog } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const navigate = useCallback((next: View) => {
    setView(next);
    const target = `#/${SLUGS[next]}`;
    if (window.location.hash !== target) window.history.pushState(null, '', target);
  }, []);

  // Le hash est la source de vérité : le bouton retour et un lien partagé
  // ramènent sur le bon écran, et le rechargement ne repart plus d'Aujourd'hui.
  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, '', `#/${SLUGS[view]}`);
    }
    const sync = () => setView(viewFromHash() ?? 'today');
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, [view]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [view]);

  // `?demo=1` ouvre le journal d'exemple de la vitrine. Un journal déjà
  // rempli n'est jamais remplacé : la démo ne concerne que la première visite.
  // On attend la relecture d'IndexedDB, sinon un journal existant paraîtrait
  // vide une fraction de seconde — et serait écrasé par la démonstration.
  useEffect(() => {
    if (!hydrated) return;
    if (isDemoRequest(window.location.search) && isEmptyJournal({ activities, days })) {
      loadDemo();
    }
    void requestPersistence();
    // Volontairement une seule fois, à la relecture du journal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', settings.theme === 'dark' ? '#12110f' : '#f4f1e9');
  }, [settings.theme]);

  // Raccourcis : `n` pour une séance, `/` pour la recherche. Rien ne se
  // déclenche quand on écrit dans un champ.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'n') {
        event.preventDefault();
        setForm({ mode: 'create' });
      } else if (event.key === '/') {
        event.preventDefault();
        navigate('activity');
        window.dispatchEvent(new Event('battement:search'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  function remove(activity: Activity) {
    deleteActivity(activity.id);
    setDetail(null);
    show(`« ${activity.title || 'Séance'} » supprimée.`, {
      label: 'Annuler',
      run: () => restoreActivities([activity]),
    });
  }

  function saveDraft(draft: DraftActivity) {
    if (form?.mode === 'edit') {
      updateActivity(form.activity.id, draft);
      show('Séance mise à jour.');
      return;
    }
    addActivity(draft);
    if (form?.mode === 'prefill' && form.planDate) {
      if (!programDone.includes(form.planDate)) toggleProgramSession(form.planDate);
      show('Séance ajoutée — le programme la compte comme faite.');
      return;
    }
    show('Séance ajoutée au journal.');
    navigate('today');
  }

  function repeat(activity: Activity) {
    addActivity({
      date: localStamp(),
      sport: activity.sport,
      title: activity.title,
      durationMin: activity.durationMin,
      distanceKm: activity.distanceKm,
      elevationM: activity.elevationM,
      calories: activity.calories,
      avgHr: activity.avgHr,
      maxHr: activity.maxHr,
      rpe: activity.rpe,
      notes: activity.notes,
      source: 'manuel',
    });
    setDetail(null);
    show('Séance refaite aujourd’hui.');
  }

  function saveDay(date: string, patch: Partial<Omit<DayLog, 'date'>>, previousDate?: string) {
    if (previousDate && previousDate !== date) {
      setDayLog(previousDate, {
        steps: undefined,
        activeCalories: undefined,
        sleepMin: undefined,
        restingHr: undefined,
        vo2max: undefined,
      });
    }
    setDayLog(date, patch);
    show('Journée enregistrée.');
  }

  function restore(backup: ParsedBackup) {
    const counts = importBackup(backup);
    show(
      `${counts.activities} séance${counts.activities > 1 ? 's' : ''} restaurée${
        counts.activities > 1 ? 's' : ''
      }.`,
    );
  }

  if (!hydrated) {
    return (
      <div className="boot">
        <BattementMark size={38} />
        <p>Ouverture du journal local…</p>
      </div>
    );
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
              data-view={item.id}
              onClick={() => navigate(item.id)}
              aria-current={view === item.id ? 'page' : undefined}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="rail__foot">
          <span className="locality">
            <i aria-hidden="true" />
            Données locales
          </span>
          <span className="rail__version">v0.2 · MIT</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar" data-view={view}>
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
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={() => setForm({ mode: 'create' })}
            >
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
                sessionsGoal={settings.sessionsGoal}
                distanceGoalKm={settings.distanceGoalKm}
                sportGoals={settings.sportGoals}
                demo={demo}
                onNavigate={navigate}
                onAdd={() => setForm({ mode: 'create' })}
                onOpen={setDetail}
                onEditDay={(day) => setDayForm({ day })}
              />
            ) : null}

            {view === 'program' ? (
              <ProgramScreen
                activities={activities}
                days={days}
                program={program}
                done={programDone}
                onStart={startProgram}
                onToggle={toggleProgramSession}
                onCheckIn={recordCheckIn}
                onStop={stopProgram}
                onNextCycle={startNextCycle}
                onDoSession={(session: PlanSession) =>
                  setForm({
                    mode: 'prefill',
                    draft: {
                      date: localStamp(),
                      sport: session.sport,
                      title: session.title,
                      durationMin: session.minutes,
                      source: 'manuel',
                    },
                    planDate: session.date,
                  })
                }
              />
            ) : null}

            {view === 'activity' ? (
              <ActivityJournal
                activities={activities}
                onAdd={() => setForm({ mode: 'create' })}
                onImport={() => navigate('import')}
                onOpen={setDetail}
              />
            ) : null}

            {view === 'import' ? (
              <ImportScreen onImport={importParsed} hasData={!isEmptyJournal({ activities, days })} />
            ) : null}

            {view === 'progress' ? (
              <Progress
                activities={activities}
                days={days}
                goalMin={settings.goalMin}
                sessionsGoal={settings.sessionsGoal}
                distanceGoalKm={settings.distanceGoalKm}
                sportGoals={settings.sportGoals}
                maxHr={settings.maxHr}
              />
            ) : null}

            <footer className="app-foot">
              <span>Battement · journal sportif local-first</span>
              <span className="app-foot__keys">
                <kbd>n</kbd> séance · <kbd>/</kbd> rechercher
              </span>
              <span>MIT · aucun compte · aucune télémétrie</span>
            </footer>
          </div>
        </div>
      </main>

      {form ? (
        <ActivityForm
          initial={form.mode === 'edit' ? form.activity : undefined}
          prefill={form.mode === 'prefill' ? form.draft : undefined}
          onClose={() => setForm(null)}
          onSave={saveDraft}
        />
      ) : null}

      {detail ? (
        <SessionDetail
          activity={detail}
          onClose={() => setDetail(null)}
          onEdit={(activity) => {
            setDetail(null);
            setForm({ mode: 'edit', activity });
          }}
          onDuplicate={(activity) => {
            duplicateActivity(activity.id);
            setDetail(null);
            show('Séance dupliquée.');
          }}
          onDelete={remove}
          onRepeat={repeat}
        />
      ) : null}

      {dayForm ? (
        <DayForm
          day={dayForm.day}
          onClose={() => setDayForm(null)}
          onSave={saveDay}
        />
      ) : null}

      {settingsOpen ? (
        <Settings
          activities={activities}
          days={days}
          program={program}
          programDone={programDone}
          theme={settings.theme}
          goalMin={settings.goalMin}
          stepGoal={settings.stepGoal}
          sessionsGoal={settings.sessionsGoal}
          distanceGoalKm={settings.distanceGoalKm}
          sportGoals={settings.sportGoals}
          maxHr={settings.maxHr}
          onTheme={setTheme}
          onGoal={setGoal}
          onStepGoal={setStepGoal}
          onSessionsGoal={setSessionsGoal}
          onDistanceGoal={setDistanceGoal}
          onSportGoal={setSportGoal}
          onMaxHr={setMaxHr}
          onRestore={restore}
          onLoadDemo={() => {
            loadDemo();
            navigate('today');
            setSettingsOpen(false);
          }}
          onClear={clearAll}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      <Toaster />
    </div>
  );
}
