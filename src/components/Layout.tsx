import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { usePulse } from '../store';
import { useUi } from '../lib/uiStore';
import { applyTheme } from '../lib/theme';
import { Icon, type IconName } from './Icon';
import { AppIcon } from './AppIcon';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

const MAIN_NAV: NavItem[] = [
  { to: '/', label: "Aujourd'hui", icon: 'today', end: true },
  { to: '/plan', label: 'Plan', icon: 'target' },
  { to: '/activite', label: 'Activité', icon: 'activity' },
  { to: '/sommeil', label: 'Sommeil', icon: 'sleep' },
  { to: '/corps', label: 'Corps', icon: 'body' },
  { to: '/nutrition', label: 'Nutrition', icon: 'nutrition' },
  { to: '/coach', label: 'Coach IA', icon: 'coach' },
  { to: '/progres', label: 'Progrès', icon: 'progress' },
];

const MOBILE_NAV: NavItem[] = [
  { to: '/', label: "Aujourd'hui", icon: 'today', end: true },
  { to: '/activite', label: 'Activité', icon: 'activity' },
  { to: '/coach', label: 'Coach', icon: 'coach' },
  { to: '/progres', label: 'Progrès', icon: 'progress' },
];

const MORE_NAV: NavItem[] = [
  { to: '/plan', label: 'Plan', icon: 'target' },
  { to: '/sommeil', label: 'Sommeil', icon: 'sleep' },
  { to: '/corps', label: 'Corps', icon: 'body' },
  { to: '/nutrition', label: 'Nutrition', icon: 'nutrition' },
  { to: '/reglages', label: 'Réglages', icon: 'settings' },
];

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '');
  return parts.join('') || 'PC';
}

function ToastHost() {
  const toast = useUi((state) => state.toast);
  const dismiss = useUi((state) => state.dismiss);
  if (!toast) return null;
  return (
    <div className={`toast toast--${toast.tone}`} role="status" aria-live="polite">
      <Icon name={toast.tone === 'error' ? 'alert' : 'check'} size={17} />
      <span>{toast.message}</span>
      <button type="button" onClick={dismiss} aria-label="Fermer la notification">
        <Icon name="close" size={15} />
      </button>
    </div>
  );
}

function DemoBanner() {
  const demo = usePulse((state) => state.demo);
  const resetData = usePulse((state) => state.resetData);
  const notify = useUi((state) => state.notify);
  if (!demo) return null;
  return (
    <div className="demobanner" role="status">
      <span className="demobanner__dot" aria-hidden />
      <p>
        <strong>Données d’exemple.</strong> Rien ici n’est réel. Importez votre historique ou
        commencez à zéro.
      </p>
      <div className="demobanner__actions">
        <Link to="/reglages" className="demobanner__link">
          Importer
        </Link>
        <button
          type="button"
          className="demobanner__link"
          onClick={() => {
            resetData();
            notify('Données d’exemple effacées.', 'info');
          }}
        >
          Effacer
        </button>
      </div>
    </div>
  );
}

export function Layout() {
  const location = useLocation();
  const demo = usePulse((state) => state.demo);
  const profile = usePulse((state) => state.profile);
  const theme = usePulse((state) => state.settings.theme);
  const updateSettings = usePulse((state) => state.updateSettings);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const moreActive = MORE_NAV.some((item) => item.to === location.pathname);

  const toggleTheme = () => {
    const resolved =
      theme === 'light'
        ? 'dark'
        : theme === 'dark'
          ? 'light'
          : document.documentElement.dataset.theme === 'dark'
            ? 'light'
            : 'dark';
    updateSettings({ theme: resolved });
    applyTheme(resolved);
  };

  return (
    <div className="app">
      <a className="skip" href="#contenu">
        Aller au contenu
      </a>

      <aside className="sidebar" aria-label="Navigation principale">
        <Link to="/" className="brand">
          <span className="brand__mark brand__mark--glass">
            <AppIcon size={36} animated={false} />
          </span>
          <span className="brand__text">
            <strong>PulseCraft</strong>
            <em>santé locale</em>
          </span>
        </Link>

        <nav className="side-nav">
          <p className="side-nav__label">Suivi</p>
          {MAIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `navlink${isActive ? ' is-active' : ''}`}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {item.to === '/coach' ? <i className="navlink__badge">IA</i> : null}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__spacer" />

        <div className={`localbadge${demo ? ' localbadge--demo' : ''}`}>
          <span aria-hidden />
          <div>
            <strong>{demo ? 'Mode démonstration' : '100 % local'}</strong>
            <span>{demo ? 'données fictives visibles' : 'aucune donnée envoyée'}</span>
          </div>
        </div>

        <Link to="/reglages" className="profilecard">
          <span className="avatar">{initials(profile.name)}</span>
          <span className="profilecard__text">
            <strong>{profile.name || 'Vous'}</strong>
            <em>Profil & réglages</em>
          </span>
          <Icon name="settings" size={17} />
        </Link>
      </aside>

      <div className="app__body">
        <header className="mobiletop">
          <Link to="/" className="mobiletop__brand" aria-label="PulseCraft, accueil">
            <AppIcon size={30} animated={false} />
            <strong>PulseCraft</strong>
          </Link>
          <div className="mobiletop__actions">
            <button type="button" className="iconbtn" onClick={toggleTheme} aria-label="Changer de thème">
              <Icon name={document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon'} size={19} />
            </button>
            <Link to="/reglages" className="iconbtn" aria-label="Réglages">
              <Icon name="settings" size={19} />
            </Link>
          </div>
        </header>

        <main className="main" id="contenu">
          <DemoBanner />
          <div className="route" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="bottomnav" aria-label="Navigation mobile">
        {MOBILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `bottomnav__item${isActive ? ' is-active' : ''}`}
          >
            <Icon name={item.icon} size={21} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`bottomnav__item${moreActive || moreOpen ? ' is-active' : ''}`}
          onClick={() => setMoreOpen((value) => !value)}
          aria-expanded={moreOpen}
          aria-controls="more-sheet"
        >
          <Icon name="menu" size={21} />
          <span>Plus</span>
        </button>
      </nav>

      {moreOpen ? (
        <div className="sheet-root">
          <div className="modal-backdrop" onClick={() => setMoreOpen(false)} aria-hidden="true" />
          <div className="sheet" id="more-sheet" role="dialog" aria-modal="true" aria-label="Plus de pages">
            <div className="sheet__handle" aria-hidden />
            <p className="kicker">Plus</p>
            <div className="sheet__grid">
              {MORE_NAV.map((item) => (
                <NavLink key={item.to} to={item.to} className="sheet__link">
                  <Icon name={item.icon} size={22} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <ToastHost />
    </div>
  );
}
