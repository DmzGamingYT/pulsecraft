import { useEffect, useRef } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Onboarding } from './components/Onboarding';
import { AppIcon } from './components/AppIcon';
import { useHydrated, usePulse } from './store';
import { useUi } from './lib/uiStore';
import { applyTheme, watchSystemTheme } from './lib/theme';
import { TodayPage } from './pages/Today';
import { ActivityPage } from './pages/Activity';
import { SleepPage } from './pages/Sleep';
import { BodyPage } from './pages/Body';
import { NutritionPage } from './pages/Nutrition';
import { CoachPage } from './pages/Coach';
import { ProgressPage } from './pages/Progress';
import { PlanPage } from './pages/Plan';
import { SettingsPage } from './pages/Settings';

const TITLES: Record<string, string> = {
  '/': "Aujourd'hui — Battement",
  '/activite': 'Activité — Battement',
  '/sommeil': 'Sommeil — Battement',
  '/corps': 'Corps — Battement',
  '/nutrition': 'Nutrition — Battement',
  '/coach': 'Coach IA — Battement',
  '/plan': 'Plan long terme — Battement',
  '/progres': 'Progrès — Battement',
  '/reglages': 'Réglages — Battement',
};

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    document.title = TITLES[pathname] ?? 'Battement';
  }, [pathname]);
  return null;
}

function Splash() {
  return (
    <div className="splash" role="status" aria-live="polite">
      <AppIcon size={84} />
      <p className="splash__name">Battement</p>
      <p className="splash__text">Ouverture de votre journal local…</p>
      <span className="splash__bar" aria-hidden>
        <i />
      </span>
    </div>
  );
}

function NotFound() {
  return (
    <div className="page notfound">
      <p className="kicker">404</p>
      <h1>Cette page n’existe pas.</h1>
      <p>Le lien est peut-être ancien, ou l’adresse a été mal recopiée.</p>
      <Link to="/" className="btn btn--primary">
        Revenir au tableau de bord
      </Link>
    </div>
  );
}

export function App() {
  const hydrated = useHydrated();
  const theme = usePulse((state) => state.settings.theme);
  const onboardingDone = usePulse((state) => state.onboardingDone);
  const wizardOpen = useUi((state) => state.wizardOpen);
  const openWizard = useUi((state) => state.openWizard);
  const closeWizard = useUi((state) => state.closeWizard);
  const askedRef = useRef(false);

  // Le bilan s'ouvre une seule fois, après la réhydratation : pas de flash, et
  // pas de rappel à chaque visite s'il a été reporté.
  useEffect(() => {
    if (!hydrated || onboardingDone || askedRef.current) return;
    askedRef.current = true;
    openWizard();
  }, [hydrated, onboardingDone, openWizard]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => watchSystemTheme(() => usePulse.getState().settings.theme), []);

  if (!hydrated) return <Splash />;

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TodayPage />} />
          <Route path="activite" element={<ActivityPage />} />
          <Route path="sommeil" element={<SleepPage />} />
          <Route path="corps" element={<BodyPage />} />
          <Route path="nutrition" element={<NutritionPage />} />
          <Route path="coach" element={<CoachPage />} />
          <Route path="plan" element={<PlanPage />} />
          <Route path="progres" element={<ProgressPage />} />
          <Route path="reglages" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Onboarding open={wizardOpen} onClose={closeWizard} />
    </>
  );
}
