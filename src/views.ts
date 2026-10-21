import type { IconName } from './components/Icons';

export type View = 'today' | 'program' | 'activity' | 'import' | 'progress';

export const VIEWS: { id: View; label: string; icon: IconName; meta: string }[] = [
  { id: 'today', label: 'Aujourd’hui', icon: 'today', meta: 'le journal du jour' },
  { id: 'program', label: 'Programme', icon: 'sparkle', meta: 'coach local' },
  { id: 'activity', label: 'Activité', icon: 'journal', meta: 'toutes les séances' },
  { id: 'import', label: 'Importer', icon: 'import', meta: 'Apple Santé · Samsung Health' },
  { id: 'progress', label: 'Progrès', icon: 'trend', meta: 'semaines et records' },
];

export function viewLabel(view: View): string {
  return VIEWS.find((item) => item.id === view)?.label ?? 'Journal';
}
