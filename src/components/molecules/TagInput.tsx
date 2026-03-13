/**
 * TagInput — inline input for adding tags to a session.
 *
 * Appears when clicking "+" on a session item. Supports:
 * - Comma-separated entry (type "debug, deploy" and hit Enter)
 * - Autocomplete suggestions from existing tags
 * - Escape to cancel
 */

import { cn } from '@jaskier/ui';
import { Plus } from 'lucide-react';
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface TagInputProps {
  /** Existing tags for this session (to avoid duplicates in UI) */
  existingTags: string[];
  /** All available tags for suggestions */
  suggestedTags?: string[];
  /** Called when tags are submitted */
  onSubmit: (tags: string[]) => void;
  /** Called when the input is cancelled */
  onCancel: () => void;
  /** Dark mode */
  isDark?: boolean;
}

export function TagInput({ existingTags, suggestedTags = [], onSubmit, onCancel, isDark = true }: TagInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filteredSuggestions = suggestedTags
    .filter(
      (tag) =>
        !existingTags.includes(tag) &&
        tag.toLowerCase().includes(value.trim().toLowerCase()) &&
        value.trim().length > 0,
    )
    .slice(0, 5);

  const handleSubmit = useCallback(() => {
    const tags = value
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && t.length <= 50 && !existingTags.includes(t));

    if (tags.length > 0) {
      onSubmit(tags);
    }
    setValue('');
  }, [value, existingTags, onSubmit]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleSuggestionClick = (tag: string) => {
    onSubmit([tag]);
    setValue('');
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setShowSuggestions(true);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Delay to allow suggestion click
            setTimeout(() => {
              if (value.trim()) handleSubmit();
              else onCancel();
            }, 150);
          }}
          placeholder={t('tags.addPlaceholder', 'Add tag...')}
          className={cn(
            'w-full text-[10px] py-0.5 px-1.5 rounded border',
            isDark
              ? 'bg-white/5 border-white/10 text-white/80 placeholder:text-white/30'
              : 'bg-black/5 border-black/10 text-black/80 placeholder:text-black/30',
            'focus:outline-none focus:ring-1',
            isDark ? 'focus:ring-white/20' : 'focus:ring-black/20',
          )}
          aria-label={t('tags.addLabel', 'Add tags (comma-separated)')}
        />
      </div>

      {/* Autocomplete suggestions */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          className={cn(
            'absolute left-0 right-0 top-full mt-0.5 z-50 rounded border shadow-lg',
            isDark ? 'bg-[var(--matrix-bg-primary)] border-white/10' : 'bg-white border-black/10',
          )}
        >
          {filteredSuggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur
                handleSuggestionClick(tag);
              }}
              className={cn(
                'w-full text-left text-[10px] px-2 py-1 transition-colors',
                isDark ? 'text-white/70 hover:bg-white/10' : 'text-black/70 hover:bg-black/5',
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add Tag Button (trigger for TagInput) ────────────────────────────────

interface AddTagButtonProps {
  onClick: () => void;
  isDark?: boolean;
}

export function AddTagButton({ onClick, isDark = true }: AddTagButtonProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border text-[9px] px-1 py-0 leading-4',
        'transition-colors',
        isDark
          ? 'border-white/10 text-white/30 hover:text-white/60 hover:border-white/20'
          : 'border-black/10 text-black/30 hover:text-black/60 hover:border-black/20',
      )}
      title={t('tags.add', 'Add tag')}
      aria-label={t('tags.add', 'Add tag')}
    >
      <Plus size={8} />
    </button>
  );
}
