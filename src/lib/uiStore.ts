import { create } from 'zustand';
import { newId } from './id';

export type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

interface UiState {
  toast: Toast | null;
  /** Bilan de démarrage, ouvert au premier lancement ou depuis les réglages. */
  wizardOpen: boolean;
  openWizard: () => void;
  closeWizard: () => void;
  /** Écran de séance guidée (le run lui-même est dans le store principal). */
  runOpen: boolean;
  openRun: () => void;
  closeRun: () => void;
  notify: (message: string, tone?: ToastTone) => void;
  dismiss: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useUi = create<UiState>((set) => ({
  toast: null,
  wizardOpen: false,
  openWizard: () => set({ wizardOpen: true }),
  closeWizard: () => set({ wizardOpen: false }),
  runOpen: false,
  openRun: () => set({ runOpen: true }),
  closeRun: () => set({ runOpen: false }),
  notify: (message, tone = 'success') => {
    if (timer) clearTimeout(timer);
    const toast = { id: newId('toast'), message, tone };
    set({ toast });
    timer = setTimeout(() => set({ toast: null }), 4200);
  },
  dismiss: () => {
    if (timer) clearTimeout(timer);
    set({ toast: null });
  },
}));
