/**
 * ClaudeChatView — Full chat interface for Claude API with NDJSON streaming.
 *
 * Replaces OllamaChatView. Uses static Claude model list,
 * streams via /api/claude/chat/stream (NDJSON protocol),
 * and sends a hidden system message to each agent.
 */

import { Bot, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { type ModelOption, ModelSelector } from '@/components/molecules/ModelSelector';
import { cn } from '@/shared/utils/cn';
import { type Attachment, ChatInput } from './ChatInput';
import { type ChatMessage, MessageBubble } from './MessageBubble';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClaudeModel {
  id: string;
  name: string;
  tier: string;
  provider: string;
  available: boolean;
}

interface StreamChunk {
  id: string;
  token: string;
  done: boolean;
  model?: string;
  total_tokens?: number;
}

// ---------------------------------------------------------------------------
// Static Claude models
// ---------------------------------------------------------------------------

const CLAUDE_MODELS: ClaudeModel[] = [
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', tier: 'Commander', provider: 'anthropic', available: true },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', tier: 'Coordinator', provider: 'anthropic', available: true },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', tier: 'Executor', provider: 'anthropic', available: true },
];

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

// ---------------------------------------------------------------------------
// System prompt (sent as hidden context, not shown in chat)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = [
  'You are a Witcher-themed AI agent in the ClaudeHydra v4 Swarm Control Center.',
  'The swarm consists of 12 agents organized in 3 tiers:',
  '- Commander (Geralt, Yennefer, Vesemir) → Claude Opus 4.6',
  '- Coordinator (Triss, Jaskier, Ciri, Dijkstra) → Claude Sonnet 4.5',
  '- Executor (Lambert, Eskel, Regis, Zoltan, Philippa) → Claude Haiku 4.5',
  '',
  'You assist the user with software engineering tasks.',
  'Respond concisely and helpfully. Use markdown formatting when appropriate.',
].join('\n');

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function claudeHealthCheck(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return false;
    const data = await res.json();
    const anthropic = data.providers?.find((p: { name: string; available: boolean }) => p.name === 'anthropic');
    return anthropic?.available ?? false;
  } catch {
    return false;
  }
}

/**
 * NDJSON streaming chat — reads newline-delimited JSON from backend.
 * Backend translates Anthropic SSE into NDJSON:
 * {"token":"text","done":false}
 * {"token":"","done":true,"model":"...","total_tokens":42}
 */
async function* claudeStreamChat(
  model: string,
  messages: Array<{ role: string; content: string }>,
): AsyncGenerator<StreamChunk> {
  const res = await fetch('/api/claude/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 4096,
      stream: true,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(`Chat request failed: ${res.status} ${errorText}`);
  }

  if (!res.body) {
    throw new Error('Response body is null — streaming not supported');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const chunk: { token?: string; done?: boolean; model?: string; total_tokens?: number } =
          JSON.parse(line);
        yield {
          id: crypto.randomUUID(),
          token: chunk.token ?? '',
          done: chunk.done ?? false,
          model: chunk.model,
          total_tokens: chunk.total_tokens,
        };
      } catch {
        // Ignore NDJSON parse errors on partial lines
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Model option adapter
// ---------------------------------------------------------------------------

function toModelOption(m: ClaudeModel): ModelOption {
  return {
    id: m.id,
    name: m.name,
    provider: m.provider,
    available: m.available,
    description: m.tier,
  };
}

// ---------------------------------------------------------------------------
// Empty state sub-component
// ---------------------------------------------------------------------------

function EmptyChatState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      data-testid="chat-empty-state"
      className="h-full flex items-center justify-center text-[var(--matrix-text-secondary)]"
    >
      <div className="text-center">
        <Bot size={64} className="mx-auto mb-4 opacity-30 text-[var(--matrix-accent)]" />
        <p className="text-lg mb-2 text-[var(--matrix-text-primary)]">Start a conversation</p>
        <p className="text-sm">Select a model and type a message</p>
        <p className="text-xs mt-4 opacity-70">Drag and drop files to add context</p>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// ClaudeChatView component
// ---------------------------------------------------------------------------

export function ClaudeChatView() {
  // Model state
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const [claudeConnected, setClaudeConnected] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const responseBufferRef = useRef<string>('');

  // ----- Check Claude API connectivity on mount ----------------------------

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const connected = await claudeHealthCheck();
        setClaudeConnected(connected);
      } catch {
        setClaudeConnected(false);
      }
    };
    void checkHealth();
  }, []);

  // ----- Auto-scroll -------------------------------------------------------
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll must fire on every message update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ----- Paste handler (global) --------------------------------------------

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          e.preventDefault();
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // ----- Model selection adapter -------------------------------------------

  const modelOptions = CLAUDE_MODELS.map(toModelOption);

  const handleModelSelect = useCallback((model: ModelOption) => {
    setSelectedModel(model.id);
  }, []);

  // ----- Clear chat --------------------------------------------------------

  const clearChat = useCallback(() => {
    setMessages([]);
    setIsLoading(false);
  }, []);

  // ----- Send message with streaming ---------------------------------------

  const handleSend = useCallback(
    async (text: string, attachments: Attachment[]) => {
      if (!selectedModel || isLoading) return;

      // Build content with file attachments
      let content = text;
      for (const att of attachments) {
        if (att.type === 'file') {
          content += `\n\n--- File: ${att.name} ---\n${att.content}`;
        }
      }

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        attachments: attachments.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          content: a.content,
          mimeType: a.mimeType,
        })),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      // Create placeholder assistant message
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        model: selectedModel,
        streaming: true,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        // Build history for context — include system prompt as first message
        const chatHistory: Array<{ role: string; content: string }> = [
          { role: 'user', content: SYSTEM_PROMPT },
          { role: 'assistant', content: 'Understood. I am ready to assist as a Witcher agent in the ClaudeHydra swarm.' },
        ];
        for (const m of messages) {
          chatHistory.push({ role: m.role, content: m.content });
        }
        chatHistory.push({ role: 'user', content });

        responseBufferRef.current = '';

        for await (const chunk of claudeStreamChat(selectedModel, chatHistory)) {
          responseBufferRef.current += chunk.token;

          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg?.streaming) {
              return [
                ...prev.slice(0, -1),
                {
                  ...lastMsg,
                  content: lastMsg.content + chunk.token,
                  streaming: !chunk.done,
                },
              ];
            }
            return prev;
          });

          if (chunk.done) {
            setIsLoading(false);
            responseBufferRef.current = '';
          }
        }
      } catch (err) {
        console.error('Chat error:', err);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.streaming) {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                content: `Error: ${err instanceof Error ? err.message : String(err)}`,
                streaming: false,
              },
            ];
          }
          return prev;
        });
        setIsLoading(false);
      }
    },
    [selectedModel, isLoading, messages],
  );

  // ----- Render -------------------------------------------------------------

  return (
    <div data-testid="chat-view" className="h-full flex flex-col p-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        data-testid="chat-header"
        className="flex items-center justify-between mb-4"
      >
        <div className="flex items-center gap-3">
          <Bot className="text-[var(--matrix-accent)]" size={24} />
          <div>
            <h2 className="text-lg font-semibold text-[var(--matrix-accent)] font-mono">Claude Chat</h2>
            <p data-testid="chat-status-text" className="text-xs text-[var(--matrix-text-secondary)]">
              {claudeConnected
                ? `${CLAUDE_MODELS.length} models available`
                : 'Offline — configure API key in Settings'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Model selector */}
          <ModelSelector
            models={modelOptions}
            selectedId={selectedModel || null}
            onSelect={handleModelSelect}
            disabled={!claudeConnected}
            placeholder="Select model"
            className="w-56"
          />

          {/* Clear chat */}
          <Button
            data-testid="chat-clear-btn"
            variant="ghost"
            size="sm"
            onClick={clearChat}
            title="Clear chat"
            aria-label="Clear chat"
            leftIcon={<Trash2 size={14} />}
          >
            Clear
          </Button>
        </div>
      </motion.div>

      {/* Chat message area */}
      <div
        ref={chatContainerRef}
        data-testid="chat-message-area"
        className={cn('flex-1 p-4 overflow-y-auto relative transition-all rounded-lg', 'scrollbar-thin')}
      >
        {messages.length === 0 ? (
          <EmptyChatState />
        ) : (
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Streaming indicator bar */}
      {isLoading && (
        <motion.div
          data-testid="chat-streaming-bar"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          className="h-0.5 bg-gradient-to-r from-transparent via-[var(--matrix-accent)] to-transparent origin-left mt-1 rounded-full"
        />
      )}

      {/* Chat input */}
      <div className="mt-3">
        <ChatInput
          onSend={handleSend}
          disabled={!claudeConnected || !selectedModel}
          isLoading={isLoading}
          placeholder={claudeConnected ? 'Type a message... (Shift+Enter = new line)' : 'Configure API key in Settings'}
        />
      </div>
    </div>
  );
}

export default ClaudeChatView;
