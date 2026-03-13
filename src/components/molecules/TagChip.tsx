/**
 * TagChip — small rounded badge for session tags.
 *
 * Color is deterministic based on tag name hash so the same tag
 * always shows the same color across the UI.
 */

import { cn } from '@jaskier/ui';
import { X } from 'lucide-react';

// 12 distinct color palettes for tag chips
const TAG_COLORS = [
  { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30' },
  { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
  { bg: 'bg-lime-500/15', text: 'text-lime-400', border: 'border-lime-500/30' },
  { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30' },
] as const;

const TAG_COLORS_LIGHT = [
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
  { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
  { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
  { bg: 'bg-lime-100', text: 'text-lime-700', border: 'border-lime-200' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', border: 'border-fuchsia-200' },
] as const;

/** Simple string hash for deterministic color assignment. */
function hashTag(tag: string): number {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = ((hash << 5) - hash + tag.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface TagChipProps {
  tag: string;
  isDark?: boolean;
  /** Show remove button */
  removable?: boolean;
  /** Called when the remove button is clicked */
  onRemove?: () => void;
  /** Called when the chip itself is clicked (e.g., for filtering) */
  onClick?: () => void;
  /** Extra CSS classes */
  className?: string;
  /** Size variant */
  size?: 'xs' | 'sm';
}

export function TagChip({
  tag,
  isDark = true,
  removable = false,
  onRemove,
  onClick,
  className,
  size = 'xs',
}: TagChipProps) {
  const colorIndex = hashTag(tag) % TAG_COLORS.length;
  const palette = (isDark ? TAG_COLORS[colorIndex] : TAG_COLORS_LIGHT[colorIndex]) ?? TAG_COLORS[0];

  const sizeClasses = size === 'xs' ? 'text-[9px] px-1.5 py-0 leading-4' : 'text-[10px] px-2 py-0.5 leading-4';

  const sharedClasses = cn(
    'inline-flex items-center gap-0.5 rounded-full border font-medium select-none',
    palette.bg,
    palette.text,
    palette.border,
    sizeClasses,
    className,
  );

  const removeButton = removable ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onRemove?.();
      }}
      className="ml-0.5 rounded-full hover:opacity-70 transition-opacity"
      aria-label={`Remove tag: ${tag}`}
    >
      <X size={8} />
    </button>
  ) : null;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={cn(sharedClasses, 'cursor-pointer hover:opacity-80')}
      >
        {tag}
        {removeButton}
      </button>
    );
  }

  return (
    <span className={sharedClasses}>
      {tag}
      {removeButton}
    </span>
  );
}
