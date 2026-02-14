/**
 * MessageBubble — Chat message display with markdown rendering,
 * code highlighting, attachments, streaming indicator, and model badge.
 *
 * Ported from ClaudeHydra v3 `OllamaChatView.tsx` inline message rendering.
 * ClaudeHydra-v4: Extracted, typed, animated, uses CodeBlock molecule.
 */

import { Bot, Cpu, FileText, Image as ImageIcon, Loader2, User } from 'lucide-react';
import { motion } from 'motion/react';
import { type ReactNode, isValidElement, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from '@/components/molecules/CodeBlock';
import { cn } from '@/shared/utils/cn';

// ---------------------------------------------------------------------------
// Helper: extract plain text from React children (handles rehype-highlight spans)
// ---------------------------------------------------------------------------

function extractText(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (isValidElement(node)) {
    return extractText((node.props as { children?: ReactNode }).children);
  }
  return '';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MessageAttachment {
  id: string;
  name: string;
  type: 'file' | 'image';
  content: string;
  mimeType: string;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  attachments?: MessageAttachment[];
  timestamp: Date;
  model?: string;
  streaming?: boolean;
}

export interface MessageBubbleProps {
  message: ChatMessage;
  className?: string;
}

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

const bubbleVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 350, damping: 25 },
  },
};

// ---------------------------------------------------------------------------
// InlineCode helper
// ---------------------------------------------------------------------------

function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-[var(--matrix-bg-tertiary)] text-[var(--matrix-accent)] text-[0.85em] font-mono border border-[var(--glass-border)]">
      {children}
    </code>
  );
}

// ---------------------------------------------------------------------------
// Markdown components config
// ---------------------------------------------------------------------------

const markdownComponents = {
  code({
    className,
    children,
    node,
  }: {
    className?: string;
    children?: ReactNode;
    node?: { position?: { start: { line: number }; end: { line: number } } };
  }) {
    const match = /language-(\w+)/.exec(className ?? '');
    const isInline = !node?.position || (node.position.start.line === node.position.end.line && !match);
    const codeContent = extractText(children).replace(/\n$/, '');

    if (isInline) {
      return <InlineCode>{children}</InlineCode>;
    }

    return <CodeBlock code={codeContent} language={match?.[1]} className={className} />;
  },
  pre({ children }: { children?: ReactNode }) {
    return <>{children}</>;
  },
  p({ children }: { children?: ReactNode }) {
    return <p className="mb-2 last:mb-0">{children}</p>;
  },
  ul({ children }: { children?: ReactNode }) {
    return <ul className="list-disc list-inside mb-2">{children}</ul>;
  },
  ol({ children }: { children?: ReactNode }) {
    return <ol className="list-decimal list-inside mb-2">{children}</ol>;
  },
  a({ href, children }: { href?: string; children?: ReactNode }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--matrix-accent)] underline underline-offset-2 hover:text-[var(--matrix-accent-glow)] transition-colors"
      >
        {children}
      </a>
    );
  },
  blockquote({ children }: { children?: ReactNode }) {
    return (
      <blockquote className="border-l-2 border-[var(--matrix-accent)]/40 pl-3 my-2 text-[var(--matrix-text-secondary)] italic">
        {children}
      </blockquote>
    );
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageBubble({ message, className }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  const formattedTime = useMemo(
    () =>
      message.timestamp.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [message.timestamp],
  );

  const displayContent = message.content || (message.streaming ? '\u258C' : '');

  return (
    <motion.div
      data-testid="chat-message-bubble"
      variants={bubbleVariants}
      initial="hidden"
      animate="visible"
      layout
      className={cn('flex', isUser ? 'justify-end' : 'justify-start', className)}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-xl p-3 shadow-lg transition-colors',
          isUser
            ? 'bg-[var(--matrix-accent)]/10 border border-[var(--matrix-accent)]/25 backdrop-blur-sm'
            : 'bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-sm',
        )}
      >
        {/* Header: role icon + label + model badge + time + streaming */}
        <div className="flex items-center gap-2 mb-2">
          {isUser ? (
            <User size={14} className="text-[var(--matrix-accent)]" />
          ) : (
            <Bot size={14} className="text-[var(--matrix-text-secondary)]" />
          )}
          <span
            className={cn(
              'text-xs font-semibold',
              isUser ? 'text-[var(--matrix-accent)]' : 'text-[var(--matrix-text-secondary)]',
            )}
          >
            {isUser ? 'You' : 'Assistant'}
          </span>

          {/* Model badge (assistant only) */}
          {!isUser && message.model && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border text-[var(--matrix-accent)] bg-[var(--matrix-accent)]/15 border-[var(--matrix-accent)]/30">
              <Cpu size={9} />
              {message.model}
            </span>
          )}

          {/* Timestamp */}
          <span className="text-[10px] text-[var(--matrix-text-secondary)]">{formattedTime}</span>

          {/* Streaming indicator */}
          {message.streaming && <Loader2 size={12} className="animate-spin text-[var(--matrix-accent)]/60" />}
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-1 px-2 py-1 bg-[var(--matrix-bg-primary)]/50 rounded text-xs text-[var(--matrix-text-secondary)]"
              >
                {att.type === 'image' ? (
                  <ImageIcon size={12} className="text-purple-400" />
                ) : (
                  <FileText size={12} className="text-blue-400" />
                )}
                <span className="truncate max-w-[100px]">{att.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Content — Markdown rendered */}
        <div className="prose prose-invert prose-sm max-w-none text-[var(--matrix-text-primary)]">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={markdownComponents}>
            {displayContent}
          </ReactMarkdown>
        </div>
      </div>
    </motion.div>
  );
}
