/** Jaskier Shared Pattern — Completion Feedback */

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const LS_SOUND_KEY = 'jaskier-completion-sound';
const LS_VOLUME_KEY = 'jaskier-completion-volume';

export function useCompletionFeedback() {
  const { t } = useTranslation();
  const [flashActive, setFlashActive] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerCompletion = useCallback(() => {
    // 1. Sonner toast
    toast.success(t('completion.taskDone', 'Task completed'));

    // 2. CSS flash animation
    setFlashActive(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashActive(false), 1500);

    // 3. Audio chime (Web Audio API)
    const soundEnabled = localStorage.getItem(LS_SOUND_KEY) !== 'false';
    if (!soundEnabled) return;

    const volumeStr = localStorage.getItem(LS_VOLUME_KEY);
    const volume = volumeStr ? Math.max(0, Math.min(1, Number(volumeStr))) : 0.3;

    try {
      const ctx = new AudioContext();

      // Tone 1: C5 (523.25 Hz)
      const gain1 = ctx.createGain();
      gain1.gain.setValueAtTime(volume, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      gain1.connect(ctx.destination);

      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc1.connect(gain1);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.15);

      // Tone 2: E5 (659.25 Hz) — starts 0.15s later
      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(volume, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      gain2.connect(ctx.destination);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15);
      osc2.connect(gain2);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.45);

      setTimeout(() => ctx.close().catch(() => {}), 700);
    } catch {
      // Web Audio API not available
    }
  }, [t]);

  return { triggerCompletion, flashActive };
}

// Utility functions for CompletionSoundSection settings
export function isCompletionSoundEnabled(): boolean {
  return localStorage.getItem(LS_SOUND_KEY) !== 'false';
}

export function setCompletionSoundEnabled(enabled: boolean): void {
  localStorage.setItem(LS_SOUND_KEY, String(enabled));
}

export function getCompletionVolume(): number {
  const v = localStorage.getItem(LS_VOLUME_KEY);
  return v ? Math.max(0, Math.min(1, Number(v))) : 0.3;
}

export function setCompletionVolume(volume: number): void {
  localStorage.setItem(LS_VOLUME_KEY, String(Math.max(0, Math.min(1, volume))));
}
