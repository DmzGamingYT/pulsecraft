/**
 * Un message court, en bas de l'écran, avec une action possible.
 *
 * Sert surtout à annuler une suppression : le journal ne demande plus de
 * confirmation bloquante, il laisse faire puis laisse revenir en arrière.
 */

import { create } from 'zustand';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  action?: ToastAction;
}

interface ToastState {
  toast: Toast | null;
  show: (message: string, action?: ToastAction) => void;
  dismiss: () => void;
}

const DURATION = 6500;
let timer: ReturnType<typeof setTimeout> | null = null;

export const useToast = create<ToastState>((set) => ({
  toast: null,
  show: (message, action) => {
    if (timer) clearTimeout(timer);
    set({ toast: { id: Date.now(), message, action } });
    timer = setTimeout(() => set({ toast: null }), DURATION);
  },
  dismiss: () => {
    if (timer) clearTimeout(timer);
    set({ toast: null });
  },
}));
