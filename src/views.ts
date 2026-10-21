import type { IconName } from './components/Icons';

export type View = 'today' | 'activity' | 'import' | 'progress';

export const VIEWS: { id: View; label: string; icon: IconName; meta: string }[] = [
  { id: 'today', label: 'Aujourd’hui', icon: 'home', meta: 'le journal du jour' },
  { id: 'activity', label: 'Activité', icon: 'activity', meta: 'toutes les séances' },
  { id: 'import', label: 'Importer', icon: 'import', meta: 'Apple Santé · Samsung Health' },
  { id: 'progress', label: 'Progrès', icon: 'chart', meta: 'semaines et records' },
];

export function viewLabel(view: View): string {
  return VIEWS.find((item) => item.id === view)?.label ?? 'Journal';
}
