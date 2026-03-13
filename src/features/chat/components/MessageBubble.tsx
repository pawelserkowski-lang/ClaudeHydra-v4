import { useViewTheme } from '@jaskier/chat-module';
import { AgentAvatar, BaseMessageBubble, cn } from '@jaskier/ui';
import { RefreshCw } from 'lucide-react';
import { type MouseEvent, memo, useDeferredValue, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentSession } from '@/stores/viewStore';
import { ErrorBoundary } from './ErrorBoundary';
import { MessageRating } from './MessageRating';
import type { ToolSegment } from './messageParser';
import { splitToolOutput, stripParallelHeader } from './messageParser';
import { ToolResultRenderer } from './ToolResultRenderer';

export interface ToolInteraction {
  id: string;
  toolName: string;
  toolInput?: unknown;
  result?: string;
  isError?: boolean;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export interface ChatMessage {
  id?: string;
  role: string;
  content: string;
  timestamp?: number;
  error?: boolean;
  model?: string;
  streaming?: boolean;
  status?: 'pending' | 'confirmed' | 'error';
  toolInteractions?: ToolInteraction[];
  attachments?: Array<{
    id: string;
    name: string;
    type: string;
    content: string;
    mimeType?: string;
  }>;
}

interface MessageBubbleProps {
  message: ChatMessage;
  isLast: boolean;
  isStreaming: boolean;
  onContextMenu?: (e: MouseEvent<HTMLElement>, message: ChatMessage) => void;
  onRetry?: (message: ChatMessage) => void;
}

export const MessageBubble = memo<MessageBubbleProps>(({ message, isLast, isStreaming, onContextMenu, onRetry }) => {
  const { t } = useTranslation();
  const theme = useViewTheme();
  const currentSessionId = useCurrentSession()?.id;

  const deferredContent = useDeferredValue(message.content);
  const cleanedContent = useMemo(() => stripParallelHeader(deferredContent), [deferredContent]);
  const segments = useMemo(() => splitToolOutput(cleanedContent), [cleanedContent]);

  const textContent = useMemo(
    () =>
      segments
        .filter((s) => s.type === 'text')
        .map((s) => s.content)
        .join('\n'),
    [segments],
  );
  const toolSegments = useMemo(() => segments.filter((s): s is ToolSegment => s.type === 'tool'), [segments]);

  const status = useMemo<'idle' | 'typing' | 'thinking' | 'error'>(() => {
    if (message.error) return 'error';
    if (isStreaming && isLast) return message.content ? 'typing' : 'thinking';
    return 'idle';
  }, [message.error, isStreaming, isLast, message.content]);

  const assistantBubbleClasses = theme.isLight
    ? 'bg-white/50 border border-white/30 text-black shadow-sm'
    : 'bg-black/40 border border-[var(--glass-border)] text-white shadow-lg backdrop-blur-sm';

  const userBubbleClasses = theme.isLight
    ? 'bg-emerald-500/15 border border-emerald-500/20 text-black'
    : 'bg-[var(--matrix-accent)]/15 border border-[var(--matrix-accent)]/20 text-white';

  const isPending = message.status === 'pending';
  const isError = message.status === 'error';

  return (
    <ErrorBoundary name="MessageBubble">
      <article onContextMenu={(e) => onContextMenu?.(e, message)}>
        <div
          className={cn(
            isPending && 'opacity-70 animate-[optimistic-pulse_2s_ease-in-out_infinite]',
            isError && 'border-l-2 border-red-500 pl-1',
          )}
        >
          <BaseMessageBubble
            message={{
              id: message.id || '',
              role: message.role as 'user' | 'assistant' | 'system',
              content: textContent,
              isStreaming: isStreaming && isLast,
              timestamp: message.timestamp,
            }}
            theme={{
              isLight: theme.isLight,
              bubbleAssistant: assistantBubbleClasses,
              bubbleUser: userBubbleClasses,
              accentText: theme.accentText,
              accentBg: theme.accentBg,
              textMuted: theme.textMuted,
            }}
            avatar={message.role === 'assistant' ? <AgentAvatar state={status} /> : undefined}
            copyText={t('chat.copyMessage', 'Copy message')}
            copiedText={t('common.copied', 'Copied')}
            modelBadge={message.model}
            toolInteractions={
              toolSegments.length > 0 ? (
                <ToolResultRenderer segments={toolSegments} isLight={theme.isLight} />
              ) : undefined
            }
          />
        </div>
        {/* Retry button for error status */}
        {isError && message.role === 'user' && onRetry && (
          <div className="flex justify-end mt-1 mr-2">
            <button
              type="button"
              onClick={() => onRetry(message)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors"
            >
              <RefreshCw size={12} />
              {t('chat.retry', 'Retry')}
            </button>
          </div>
        )}
        {!isStreaming && message.role === 'assistant' && currentSessionId && message.id && (
          <div className="flex justify-start ml-14 mb-4">
            <MessageRating sessionId={currentSessionId} messageId={message.id} />
          </div>
        )}
      </article>
    </ErrorBoundary>
  );
});

MessageBubble.displayName = 'MessageBubble';
