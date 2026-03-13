/** Jaskier Shared Pattern — Message Compaction Settings Section */

import { useViewTheme } from '@jaskier/chat-module';
import { cn } from '@jaskier/ui';
import { Minus, PackageOpen, Plus } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/atoms';
import { apiPost } from '@/shared/api/client';
import type { Settings } from '@/shared/api/schemas';
import { useSettingsQuery } from '@/shared/hooks/useSettings';

const THRESHOLD_MIN = 10;
const THRESHOLD_MAX = 100;
const THRESHOLD_STEP = 5;

const KEEP_MIN = 5;
const KEEP_MAX = 50;
const KEEP_STEP = 5;

export const CompactionSection = memo(() => {
  const { t } = useTranslation();
  const theme = useViewTheme();
  const { data: settings, refetch } = useSettingsQuery();
  const [saving, setSaving] = useState(false);

  const threshold = settings?.compaction_threshold ?? 25;
  const keep = settings?.compaction_keep ?? 15;

  const save = useCallback(
    async (newThreshold: number, newKeep: number) => {
      const clampedThreshold = Math.max(THRESHOLD_MIN, Math.min(THRESHOLD_MAX, newThreshold));
      // Ensure keep < threshold
      const maxKeep = Math.min(KEEP_MAX, clampedThreshold - 1);
      const clampedKeep = Math.max(KEEP_MIN, Math.min(maxKeep, newKeep));

      setSaving(true);
      try {
        await apiPost<Settings>('/api/settings', {
          ...settings,
          compaction_threshold: clampedThreshold,
          compaction_keep: clampedKeep,
        });
        await refetch();
        toast.success(t('settings.compaction.saved', 'Compaction settings updated'));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setSaving(false);
      }
    },
    [refetch, t, settings],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <PackageOpen size={18} className="text-[var(--matrix-accent)]" />
        <h3 className={cn('text-sm font-semibold font-mono uppercase tracking-wider', theme.text)}>
          {t('settings.compaction.title', 'Message Compaction')}
        </h3>
      </div>

      <p className={cn('text-xs', theme.textMuted)}>
        {t(
          'settings.compaction.description',
          'Automatically compress older messages to save tokens and memory. When the message count exceeds the threshold, only the most recent messages are kept in the active context.',
        )}
      </p>

      {/* Threshold slider */}
      <div className="space-y-2">
        <span className={cn('text-xs font-mono font-semibold', theme.text)}>
          {t('settings.compaction.threshold', 'Compress after N messages')}
        </span>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => save(threshold - THRESHOLD_STEP, keep)}
            disabled={saving || threshold <= THRESHOLD_MIN}
            aria-label="Decrease threshold"
          >
            <Minus size={14} />
          </Button>

          <input
            type="range"
            min={THRESHOLD_MIN}
            max={THRESHOLD_MAX}
            step={THRESHOLD_STEP}
            value={threshold}
            onChange={(e) => save(Number(e.target.value), keep)}
            disabled={saving}
            className="flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-[var(--matrix-accent)] bg-[var(--matrix-glass)]"
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => save(threshold + THRESHOLD_STEP, keep)}
            disabled={saving || threshold >= THRESHOLD_MAX}
            aria-label="Increase threshold"
          >
            <Plus size={14} />
          </Button>

          <span className={cn('text-lg font-mono font-bold min-w-[3ch] text-center', theme.text)}>{threshold}</span>
        </div>
        <div className={cn('flex justify-between text-[10px] font-mono px-1', theme.textMuted)}>
          <span>{THRESHOLD_MIN} (aggressive)</span>
          <span>{THRESHOLD_MAX} (relaxed)</span>
        </div>
      </div>

      {/* Keep slider */}
      <div className="space-y-2">
        <span className={cn('text-xs font-mono font-semibold', theme.text)}>
          {t('settings.compaction.keep', 'Keep last N messages')}
        </span>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => save(threshold, keep - KEEP_STEP)}
            disabled={saving || keep <= KEEP_MIN}
            aria-label="Decrease keep"
          >
            <Minus size={14} />
          </Button>

          <input
            type="range"
            min={KEEP_MIN}
            max={Math.min(KEEP_MAX, threshold - 1)}
            step={KEEP_STEP}
            value={keep}
            onChange={(e) => save(threshold, Number(e.target.value))}
            disabled={saving}
            className="flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-[var(--matrix-accent)] bg-[var(--matrix-glass)]"
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => save(threshold, keep + KEEP_STEP)}
            disabled={saving || keep >= Math.min(KEEP_MAX, threshold - 1)}
            aria-label="Increase keep"
          >
            <Plus size={14} />
          </Button>

          <span className={cn('text-lg font-mono font-bold min-w-[3ch] text-center', theme.text)}>{keep}</span>
        </div>
        <div className={cn('flex justify-between text-[10px] font-mono px-1', theme.textMuted)}>
          <span>{KEEP_MIN} (minimal)</span>
          <span>{Math.min(KEEP_MAX, threshold - 1)} (max)</span>
        </div>
      </div>
    </div>
  );
});

CompactionSection.displayName = 'CompactionSection';
