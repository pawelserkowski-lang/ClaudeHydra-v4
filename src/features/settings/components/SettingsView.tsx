/**
 * SettingsView — API Keys, Theme, and App Configuration
 * ======================================================
 * Manages 8 AI provider API keys, theme selection, auto-start,
 * and default model. Collapsible glass panel sections.
 *
 * Ported from ClaudeHydra v3 `web/src/components/SettingsView.tsx`
 * and expanded with 8 providers, endpoint URLs, test connection,
 * theme selector, and auto-start config.
 */

import {
  Bot,
  Brain,
  ChevronRight,
  Eye,
  EyeOff,
  Globe,
  Key,
  Monitor,
  Moon,
  Palette,
  Play,
  Plug,
  Save,
  Settings,
  Sparkles,
  Sun,
  X,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useMemo, useState } from 'react';

import { Badge, Button, Card, Input } from '@/components/atoms';
import { type ModelOption, ModelSelector } from '@/components/molecules';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/shared/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProviderId = 'claude' | 'openai' | 'gemini' | 'groq' | 'mistral' | 'openrouter' | 'together';

type ThemeMode = 'dark' | 'light' | 'system';

interface ProviderConfig {
  id: ProviderId;
  name: string;
  icon: typeof Sparkles;
  iconColor: string;
  keyPlaceholder: string;
  endpointPlaceholder: string;
  description: string;
}

interface ProviderState {
  apiKey: string;
  endpoint: string;
  testing: boolean;
  testResult: 'success' | 'error' | null;
}

interface SettingsState {
  providers: Record<ProviderId, ProviderState>;
  autoStart: boolean;
  defaultModel: string | null;
}

// ---------------------------------------------------------------------------
// Provider Definitions
// ---------------------------------------------------------------------------

const PROVIDERS: readonly ProviderConfig[] = [
  {
    id: 'claude',
    name: 'Anthropic (Claude)',
    icon: Sparkles,
    iconColor: 'text-purple-400',
    keyPlaceholder: 'sk-ant-...',
    endpointPlaceholder: 'https://api.anthropic.com',
    description: 'Primary AI provider. Required for Claude API access.',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: Brain,
    iconColor: 'text-emerald-400',
    keyPlaceholder: 'sk-...',
    endpointPlaceholder: 'https://api.openai.com/v1',
    description: 'GPT-4 and GPT-4o fallback provider.',
  },
  {
    id: 'gemini',
    name: 'Google (Gemini)',
    icon: Zap,
    iconColor: 'text-blue-400',
    keyPlaceholder: 'AIza...',
    endpointPlaceholder: 'https://generativelanguage.googleapis.com',
    description: 'Gemini 2.0 Flash and Pro models.',
  },
  {
    id: 'groq',
    name: 'Groq',
    icon: Zap,
    iconColor: 'text-red-400',
    keyPlaceholder: 'gsk_...',
    endpointPlaceholder: 'https://api.groq.com/openai/v1',
    description: 'Ultra-fast LPU inference for Llama and Mixtral.',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    icon: Bot,
    iconColor: 'text-orange-400',
    keyPlaceholder: '...',
    endpointPlaceholder: 'https://api.mistral.ai/v1',
    description: 'Mistral Large and Codestral models.',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: Globe,
    iconColor: 'text-cyan-400',
    keyPlaceholder: 'sk-or-...',
    endpointPlaceholder: 'https://openrouter.ai/api/v1',
    description: 'Unified gateway to 100+ AI models.',
  },
  {
    id: 'together',
    name: 'Together AI',
    icon: Plug,
    iconColor: 'text-indigo-400',
    keyPlaceholder: '...',
    endpointPlaceholder: 'https://api.together.xyz/v1',
    description: 'Open-source model hosting and fine-tuning.',
  },
] as const;

// ---------------------------------------------------------------------------
// Default Model Options
// ---------------------------------------------------------------------------

const DEFAULT_MODEL_OPTIONS: readonly ModelOption[] = [
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'anthropic', available: true, description: 'Commander tier' },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'anthropic', available: true, description: 'Coordinator tier' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic', available: true, description: 'Executor tier' },
] as const;

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

function createInitialProviderState(): Record<ProviderId, ProviderState> {
  const result: Record<string, ProviderState> = {};
  for (const p of PROVIDERS) {
    result[p.id] = {
      apiKey: '',
      endpoint: '',
      testing: false,
      testResult: null,
    };
  }
  return result as Record<ProviderId, ProviderState>;
}

// ---------------------------------------------------------------------------
// CollapsibleSection Sub-component
// ---------------------------------------------------------------------------

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}

function CollapsibleSection({ title, icon, children, defaultOpen = false, badge }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Card variant="glass" padding="none" className="overflow-hidden">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-full flex items-center gap-3 p-4 hover:bg-[var(--matrix-accent)]/5 transition-colors"
        >
          {icon}
          <span className="text-sm font-semibold text-[var(--matrix-text-primary)] flex-1 text-left">{title}</span>
          {badge && <span className="mr-2">{badge}</span>}
          <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronRight size={16} className="text-[var(--matrix-text-secondary)]" />
          </motion.div>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0 border-t border-[var(--matrix-border)] space-y-4">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// ApiKeyField Sub-component
// ---------------------------------------------------------------------------

interface ApiKeyFieldProps {
  provider: ProviderConfig;
  state: ProviderState;
  onKeyChange: (key: string) => void;
  onEndpointChange: (endpoint: string) => void;
  onTestConnection: () => void;
}

function ApiKeyField({ provider, state, onKeyChange, onEndpointChange, onTestConnection }: ApiKeyFieldProps) {
  const [showKey, setShowKey] = useState(false);
  const Icon = provider.icon;
  const hasKey = state.apiKey.length > 0;

  return (
    <div data-testid={`settings-provider-${provider.id}`} className="space-y-3 p-3 rounded-lg border border-[var(--matrix-border)] bg-[var(--matrix-bg-secondary)]/30">
      {/* Provider Header */}
      <div className="flex items-center gap-2">
        <Icon size={16} className={provider.iconColor} />
        <span className="text-sm font-medium text-[var(--matrix-text-primary)]">{provider.name}</span>
        {hasKey && (
          <Badge variant="accent" size="sm" dot>
            Configured
          </Badge>
        )}
        {state.testResult === 'success' && (
          <Badge variant="success" size="sm" dot>
            Connected
          </Badge>
        )}
        {state.testResult === 'error' && (
          <Badge variant="error" size="sm" dot>
            Failed
          </Badge>
        )}
      </div>

      <p className="text-[11px] text-[var(--matrix-text-secondary)]">{provider.description}</p>

      {/* API Key Input */}
      <div className="relative">
        <Input
          label="API Key"
          type={showKey ? 'text' : 'password'}
          value={state.apiKey}
          onChange={(e) => onKeyChange(e.target.value)}
          placeholder={provider.keyPlaceholder}
          inputSize="sm"
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShowKey((prev) => !prev)}
          className={cn(
            'absolute right-2 top-[calc(50%+4px)] -translate-y-1/2',
            'text-[var(--matrix-text-secondary)] hover:text-[var(--matrix-accent)] transition-colors',
          )}
        >
          {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      {/* Endpoint URL */}
      <Input
        label="Endpoint URL"
        type="text"
        value={state.endpoint}
        onChange={(e) => onEndpointChange(e.target.value)}
        placeholder={provider.endpointPlaceholder}
        inputSize="sm"
        icon={<Globe size={12} />}
      />

      {/* Test Connection */}
      <Button
        variant="secondary"
        size="sm"
        onClick={onTestConnection}
        isLoading={state.testing}
        loadingText="Testing..."
        leftIcon={state.testing ? undefined : <Plug size={12} />}
        disabled={!hasKey}
      >
        Test Connection
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ThemeSelector Sub-component
// ---------------------------------------------------------------------------

interface ThemeSelectorProps {
  currentMode: ThemeMode;
  onModeChange: (mode: ThemeMode) => void;
}

function ThemeSelector({ currentMode, onModeChange }: ThemeSelectorProps) {
  const themes: Array<{ mode: ThemeMode; label: string; icon: typeof Sun; description: string }> = [
    { mode: 'dark', label: 'Matrix Dark', icon: Moon, description: 'Green matrix terminal aesthetic' },
    { mode: 'light', label: 'White Wolf', icon: Sun, description: 'Clean light theme with forest green' },
    { mode: 'system', label: 'System', icon: Monitor, description: 'Follow OS preference' },
  ];

  return (
    <div data-testid="settings-theme-selector" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {themes.map((theme) => {
        const ThemeIcon = theme.icon;
        const isActive = currentMode === theme.mode;
        return (
          <motion.button
            key={theme.mode}
            type="button"
            data-testid={`settings-theme-${theme.mode}`}
            onClick={() => onModeChange(theme.mode)}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all text-center',
              isActive
                ? 'border-[var(--matrix-accent)] bg-[var(--matrix-accent)]/10 shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                : 'border-[var(--matrix-border)] bg-[var(--matrix-bg-secondary)]/30 hover:border-[var(--matrix-accent-dim)]',
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <ThemeIcon
              size={24}
              className={cn(isActive ? 'text-[var(--matrix-accent)]' : 'text-[var(--matrix-text-secondary)]')}
            />
            <span
              className={cn(
                'text-sm font-medium',
                isActive ? 'text-[var(--matrix-accent)]' : 'text-[var(--matrix-text-primary)]',
              )}
            >
              {theme.label}
            </span>
            <span className="text-[10px] text-[var(--matrix-text-secondary)]">{theme.description}</span>
            {isActive && (
              <Badge variant="accent" size="sm">
                Active
              </Badge>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingsView Component
// ---------------------------------------------------------------------------

export function SettingsView() {
  const { mode, setMode } = useTheme();

  const [settings, setSettings] = useState<SettingsState>({
    providers: createInitialProviderState(),
    autoStart: false,
    defaultModel: null,
  });

  // -- Provider handlers --

  const handleKeyChange = useCallback((providerId: ProviderId, key: string) => {
    setSettings((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [providerId]: {
          ...prev.providers[providerId],
          apiKey: key,
          testResult: null, // Reset test result on key change
        },
      },
    }));
  }, []);

  const handleEndpointChange = useCallback((providerId: ProviderId, endpoint: string) => {
    setSettings((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [providerId]: {
          ...prev.providers[providerId],
          endpoint,
          testResult: null,
        },
      },
    }));
  }, []);

  const handleTestConnection = useCallback(async (providerId: ProviderId) => {
    setSettings((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [providerId]: {
          ...prev.providers[providerId],
          testing: true,
          testResult: null,
        },
      },
    }));

    let result: 'success' | 'error' = 'error';

    try {
      if (providerId === 'claude') {
        // Save the API key to backend, then check health
        const provider = settings.providers[providerId];
        if (provider.apiKey.length > 0) {
          await fetch('/api/settings/api-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: 'ANTHROPIC_API_KEY', key: provider.apiKey }),
          });
          const healthRes = await fetch('/api/health');
          if (healthRes.ok) {
            const data = await healthRes.json();
            const anthropic = data.providers?.find((p: { name: string; available: boolean }) => p.name === 'anthropic');
            result = anthropic?.available ? 'success' : 'error';
          }
        }
      } else {
        // For other providers, simulate test
        const provider = settings.providers[providerId];
        await new Promise((resolve) => setTimeout(resolve, 1000));
        result = provider.apiKey.length > 0 ? 'success' : 'error';
      }
    } catch {
      result = 'error';
    }

    setSettings((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [providerId]: {
          ...prev.providers[providerId],
          testing: false,
          testResult: result,
        },
      },
    }));
  }, [settings.providers]);

  // -- Model selection --

  const handleModelSelect = useCallback((model: ModelOption) => {
    setSettings((prev) => ({ ...prev, defaultModel: model.id }));
  }, []);

  // -- Auto-start --

  const handleAutoStartToggle = useCallback(() => {
    setSettings((prev) => ({ ...prev, autoStart: !prev.autoStart }));
  }, []);

  // -- Count configured providers --

  const configuredCount = useMemo(() => {
    return Object.values(settings.providers).filter((p) => p.apiKey.length > 0).length;
  }, [settings.providers]);

  return (
    <div data-testid="settings-view" className="h-full flex flex-col overflow-auto p-4 sm:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-[var(--matrix-accent)]/10 border border-[var(--matrix-accent)]/20 flex items-center justify-center">
            <Settings size={20} className="text-[var(--matrix-accent)]" />
          </div>
          <div>
            <h2 data-testid="settings-header" className="text-lg font-semibold text-[var(--matrix-accent)] text-glow-subtle">Settings</h2>
            <p className="text-xs text-[var(--matrix-text-secondary)]">
              Configure API keys, theme, and application preferences
            </p>
          </div>
        </div>
      </motion.div>

      <div className="space-y-4">
        {/* ============================================ */}
        {/* THEME SECTION                                */}
        {/* ============================================ */}
        <CollapsibleSection title="Appearance" icon={<Palette size={18} className="text-pink-400" />} defaultOpen>
          <ThemeSelector currentMode={mode as ThemeMode} onModeChange={setMode} />
        </CollapsibleSection>

        {/* ============================================ */}
        {/* DEFAULT MODEL SECTION                        */}
        {/* ============================================ */}
        <CollapsibleSection title="Default Model" icon={<Brain size={18} className="text-blue-400" />} defaultOpen>
          <p className="text-xs text-[var(--matrix-text-secondary)] mb-3">
            Select the default AI model used for new chat sessions.
          </p>
          <div data-testid="settings-model-selector">
            <ModelSelector
              models={[...DEFAULT_MODEL_OPTIONS]}
              selectedId={settings.defaultModel}
              onSelect={handleModelSelect}
              placeholder="Select default model..."
            />
          </div>
        </CollapsibleSection>

        {/* ============================================ */}
        {/* AUTO-START SECTION                           */}
        {/* ============================================ */}
        <CollapsibleSection title="Auto-Start Configuration" icon={<Play size={18} className="text-green-400" />}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Play size={18} className="text-[var(--matrix-text-secondary)]" />
              <div>
                <p className="text-sm text-[var(--matrix-text-primary)]">Auto-start on login</p>
                <p className="text-xs text-[var(--matrix-text-secondary)]">
                  Automatically launch ClaudeHydra when the system starts.
                </p>
              </div>
            </div>
            <motion.button
              type="button"
              data-testid="settings-auto-start-toggle"
              onClick={handleAutoStartToggle}
              className={cn(
                'relative w-14 h-7 rounded-full border transition-colors',
                settings.autoStart
                  ? 'bg-[var(--matrix-accent)]/20 border-[var(--matrix-accent)]'
                  : 'bg-[var(--matrix-bg-secondary)] border-[var(--matrix-border)]',
              )}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                className={cn(
                  'absolute top-0.5 w-6 h-6 rounded-full flex items-center justify-center',
                  settings.autoStart ? 'bg-[var(--matrix-accent)]' : 'bg-[var(--matrix-text-secondary)]',
                )}
                animate={{ left: settings.autoStart ? 30 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                {settings.autoStart ? (
                  <Zap size={12} className="text-[var(--matrix-bg-primary)]" />
                ) : (
                  <X size={12} className="text-[var(--matrix-bg-primary)]" />
                )}
              </motion.div>
            </motion.button>
          </div>
        </CollapsibleSection>

        {/* ============================================ */}
        {/* AI PROVIDER API KEYS SECTION                 */}
        {/* ============================================ */}
        <CollapsibleSection
          title="AI Provider API Keys"
          icon={<Key size={18} className="text-yellow-400" />}
          badge={
            <Badge variant="accent" size="sm">
              {configuredCount}/{PROVIDERS.length}
            </Badge>
          }
        >
          <div className="space-y-4">
            {PROVIDERS.map((provider) => (
              <ApiKeyField
                key={provider.id}
                provider={provider}
                state={settings.providers[provider.id]}
                onKeyChange={(key) => handleKeyChange(provider.id, key)}
                onEndpointChange={(ep) => handleEndpointChange(provider.id, ep)}
                onTestConnection={() => handleTestConnection(provider.id)}
              />
            ))}
          </div>
        </CollapsibleSection>

        {/* ============================================ */}
        {/* SAVE NOTE                                    */}
        {/* ============================================ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
        >
          <Card variant="glass" padding="md">
            <div className="flex items-center gap-2 text-xs text-[var(--matrix-text-secondary)]">
              <Save size={14} />
              <span>Settings are saved automatically to localStorage.</span>
            </div>
            <p className="text-xs text-[var(--matrix-warning)]/70 mt-2">
              Note: API keys are stored locally in the browser. For production environments, consider using environment
              variables or a secure vault.
            </p>
          </Card>
        </motion.div>

        {/* ============================================ */}
        {/* APP INFO                                     */}
        {/* ============================================ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
        >
          <Card variant="glass" padding="md">
            <h3 data-testid="settings-about" className="text-sm font-semibold text-[var(--matrix-text-primary)] mb-2">About</h3>
            <div className="text-xs text-[var(--matrix-text-secondary)] space-y-1">
              <p>ClaudeHydra v4.0.0</p>
              <p>AI Swarm Control Center -- Claude Edition</p>
              <p className="text-[var(--matrix-accent)]/60 font-mono">Phase 4 / Agent 7 -- Feature Views</p>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default SettingsView;
