/**
 * FallbackBanner — Amber notification when the backend falls back to a lighter model.
 *
 * Shows the original and fallback model names with a reason.
 * Auto-dismisses after 10 seconds or can be closed manually.
 */

import { AlertTriangle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef } from 'react';

export interface FallbackBannerData {
  from: string;
  to: string;
  reason: string;
}

interface FallbackBannerProps {
  data: FallbackBannerData | null;
  onDismiss: () => void;
}

const REASON_LABELS: Record<string, string> = {
  rate_limited: 'limit zapytań',
  server_error: 'błąd serwera',
};

export function FallbackBanner({ data, onDismiss }: FallbackBannerProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (data) {
      clearTimer();
      timerRef.current = setTimeout(() => {
        onDismiss();
      }, 10_000);
    }
    return clearTimer;
  }, [data, onDismiss, clearTimer]);

  return (
    <AnimatePresence>
      {data && (
        <motion.div
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-sm font-mono mb-2">
            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
            <span className="flex-1">
              Przełączono z <strong>{data.from}</strong> na <strong>{data.to}</strong>
              {' — '}
              {REASON_LABELS[data.reason] ?? data.reason}
            </span>
            <button
              type="button"
              onClick={onDismiss}
              className="p-0.5 rounded hover:bg-amber-500/20 transition-colors shrink-0"
              aria-label="Zamknij"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
