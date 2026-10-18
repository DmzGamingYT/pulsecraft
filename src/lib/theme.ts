import type { Theme } from '../types';

const KEY = 'pc.theme';

function resolve(theme: Theme): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Applique le thème et mémorise le choix explicite (ou son absence = système). */
export function applyTheme(theme: Theme): void {
  const resolved = resolve(theme);
  document.documentElement.dataset.theme = resolved;
  try {
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    /* stockage indisponible : le thème vaut pour la session */
  }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = resolved === 'dark' ? '#0b0d0c' : '#f4f2ec';
}

/** Suit les changements de thème du système tant que le choix est « système ». */
export function watchSystemTheme(getTheme: () => Theme): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (getTheme() === 'system') applyTheme('system');
  };
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
