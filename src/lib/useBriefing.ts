import { useCallback, useEffect, useRef, useState } from 'react';
import { usePulse } from '../store';
import {
  clearBriefingCache,
  fetchBriefing,
  localBriefing,
  readBriefingCache,
  writeBriefingCache,
} from './ai';

/**
 * Briefing du jour : le repli local s'affiche immédiatement, puis l'IA le
 * remplace si elle répond. Un échec réseau ne laisse jamais de trou.
 */
export function useBriefing() {
  const data = usePulse();
  const aiEnabled = usePulse((state) => state.settings.aiEnabled);
  const [text, setText] = useState(() => localBriefing(data));
  const [source, setSource] = useState<'local' | 'ai'>('local');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const regenerate = useCallback(async (force: boolean) => {
    if (force) clearBriefingCache();
    if (!usePulse.getState().settings.aiEnabled) {
      setText(localBriefing(usePulse.getState()));
      setSource('local');
      setLoading(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const state = usePulse.getState();
      const result = await fetchBriefing(
        state,
        controller.signal,
        state.settings.ai,
        state.trainingPlan
      );
      if (controller.signal.aborted) return;
      setText(result);
      setSource('ai');
      writeBriefingCache(result);
    } catch {
      if (!controller.signal.aborted) {
        setText(localBriefing(usePulse.getState()));
        setSource('local');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = readBriefingCache();
    if (cached) {
      setText(cached);
      setSource('ai');
      return;
    }
    if (!aiEnabled) {
      setText(localBriefing(data));
      setSource('local');
      return;
    }
    void regenerate(false);
    // Le briefing est volontairement calculé une fois par jour : il ne doit pas
    // se réécrire à chaque verre d'eau ajouté.
  }, [aiEnabled, regenerate]);

  // Le briefing suit les transitions vides → remplies (démo, import, effacement).
  // Un simple verre d'eau ne doit pas réécrire le texte du jour.
  const signature = `${data.demo}|${data.workouts.length > 0}|${data.sleeps.length > 0}|${data.body.length > 0}|${Object.keys(data.days).length > 0}`;
  const signatureRef = useRef(signature);
  useEffect(() => {
    if (signatureRef.current === signature) return;
    signatureRef.current = signature;
    if (source === 'ai') {
      clearBriefingCache();
      void regenerate(false);
    } else {
      setText(localBriefing(usePulse.getState()));
    }
  }, [signature, source, regenerate]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  return { text, source, loading, regenerate };
}
