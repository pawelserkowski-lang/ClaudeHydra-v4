import { describe, it, expect } from 'vitest';
import {
  healthSchema,
  systemStatsSchema,
  agentSchema,
  agentsListSchema,
  claudeModelSchema,
  claudeModelsSchema,
  claudeChatResponseSchema,
  usageSchema,
  settingsSchema,
  messageSchema,
  sessionSummarySchema,
  sessionSchema,
} from '../schemas';

// ===========================================================================
// Health
// ===========================================================================
describe('healthSchema', () => {
  it('parses valid health response', () => {
    const data = {
      status: 'healthy',
      version: '4.0.1',
      uptime_seconds: 3600,
      providers: [
        { name: 'anthropic', available: true },
        { name: 'google', available: false },
      ],
    };
    expect(healthSchema.parse(data)).toEqual(data);
  });

  it('rejects missing fields', () => {
    const result = healthSchema.safeParse({ status: 'ok' });
    expect(result.success).toBe(false);
  });
});

// ===========================================================================
// System Stats
// ===========================================================================
describe('systemStatsSchema', () => {
  it('parses valid stats', () => {
    const data = {
      cpu_usage: 45.2,
      memory_used: 8192,
      memory_total: 16384,
      uptime_seconds: 7200,
      active_sessions: 3,
      total_messages: 150,
    };
    expect(systemStatsSchema.parse(data)).toEqual(data);
  });

  it('rejects non-number cpu_usage', () => {
    const result = systemStatsSchema.safeParse({
      cpu_usage: 'high',
      memory_used: 8192,
      memory_total: 16384,
      uptime_seconds: 7200,
      active_sessions: 3,
      total_messages: 150,
    });
    expect(result.success).toBe(false);
  });
});

// ===========================================================================
// Agent
// ===========================================================================
describe('agentSchema', () => {
  const validAgent = {
    id: 'agent-1',
    name: 'Researcher',
    role: 'research',
    specialization: 'web search',
    tier: 'premium',
    status: 'active',
    description: 'Researches topics on the web',
    model: 'claude-sonnet-4-5-20250929',
  };

  it('parses valid agent', () => {
    expect(agentSchema.parse(validAgent)).toEqual(validAgent);
  });

  it('parses agent without optional model', () => {
    const { model, ...noModel } = validAgent;
    expect(agentSchema.parse(noModel)).toEqual(noModel);
  });

  it('rejects agent missing required fields', () => {
    const { description, ...incomplete } = validAgent;
    const result = agentSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });
});

describe('agentsListSchema', () => {
  it('parses array of agents', () => {
    const agents = [
      { id: '1', name: 'A', role: 'r', specialization: 's', tier: 't', status: 'active', description: 'd' },
      { id: '2', name: 'B', role: 'r', specialization: 's', tier: 't', status: 'idle', description: 'd' },
    ];
    expect(agentsListSchema.parse(agents)).toHaveLength(2);
  });
});

// ===========================================================================
// Claude Model
// ===========================================================================
describe('claudeModelSchema', () => {
  const validModel = {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    tier: 'Coordinator',
    provider: 'anthropic',
    available: true,
  };

  it('parses valid Claude model', () => {
    expect(claudeModelSchema.parse(validModel)).toEqual(validModel);
  });

  it('rejects model with missing provider', () => {
    const { provider, ...incomplete } = validModel;
    const result = claudeModelSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });
});

describe('claudeModelsSchema', () => {
  it('parses array of Claude models', () => {
    const models = [
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', tier: 'Commander', provider: 'anthropic', available: true },
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', tier: 'Coordinator', provider: 'anthropic', available: true },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', tier: 'Executor', provider: 'anthropic', available: true },
    ];
    expect(claudeModelsSchema.parse(models)).toHaveLength(3);
  });
});

// ===========================================================================
// Claude Chat Response
// ===========================================================================
describe('claudeChatResponseSchema', () => {
  it('parses valid Claude response', () => {
    const data = {
      content: 'Hi there!',
      model: 'claude-sonnet-4-5-20250929',
      usage: { input_tokens: 10, output_tokens: 25 },
    };
    expect(claudeChatResponseSchema.parse(data)).toEqual(data);
  });

  it('rejects response with invalid usage shape', () => {
    const result = claudeChatResponseSchema.safeParse({
      content: 'Hi',
      model: 'claude-sonnet-4-5-20250929',
      usage: { input_tokens: 'ten' },
    });
    expect(result.success).toBe(false);
  });
});

// ===========================================================================
// Usage
// ===========================================================================
describe('usageSchema', () => {
  it('parses valid usage', () => {
    expect(usageSchema.parse({ input_tokens: 100, output_tokens: 200 }))
      .toEqual({ input_tokens: 100, output_tokens: 200 });
  });

  it('rejects missing output_tokens', () => {
    const result = usageSchema.safeParse({ input_tokens: 100 });
    expect(result.success).toBe(false);
  });
});

// ===========================================================================
// Settings
// ===========================================================================
describe('settingsSchema', () => {
  const validSettings = {
    default_model: 'claude-sonnet-4-5-20250929',
    temperature: 0.7,
    max_tokens: 4096,
    language: 'en',
    theme: 'matrix-green',
  };

  it('parses valid settings', () => {
    expect(settingsSchema.parse(validSettings)).toEqual(validSettings);
  });

  it('rejects settings with missing theme', () => {
    const { theme, ...incomplete } = validSettings;
    const result = settingsSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });
});

// ===========================================================================
// Message
// ===========================================================================
describe('messageSchema', () => {
  it('parses message with optional model field', () => {
    const data = { role: 'user', content: 'Hello', model: 'gpt-4' };
    expect(messageSchema.parse(data)).toEqual(data);
  });

  it('parses message without optional model', () => {
    const data = { role: 'assistant', content: 'Hi!' };
    expect(messageSchema.parse(data)).toEqual(data);
  });

  it('rejects message missing content', () => {
    const result = messageSchema.safeParse({ role: 'user' });
    expect(result.success).toBe(false);
  });
});

// ===========================================================================
// Session Summary
// ===========================================================================
describe('sessionSummarySchema', () => {
  const validSummary = {
    id: 'sess-1',
    title: 'Test Session',
    created_at: '2025-06-01T12:00:00Z',
    updated_at: '2025-06-01T13:00:00Z',
    message_count: 10,
  };

  it('parses summary with optional preview', () => {
    const withPreview = { ...validSummary, preview: 'Hello world...' };
    expect(sessionSummarySchema.parse(withPreview)).toEqual(withPreview);
  });

  it('parses summary without preview', () => {
    expect(sessionSummarySchema.parse(validSummary)).toEqual(validSummary);
  });

  it('rejects summary missing id', () => {
    const { id, ...incomplete } = validSummary;
    const result = sessionSummarySchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });
});

// ===========================================================================
// Session (full)
// ===========================================================================
describe('sessionSchema', () => {
  it('parses full session with messages', () => {
    const data = {
      id: 'sess-1',
      title: 'Chat',
      created_at: '2025-06-01T12:00:00Z',
      updated_at: '2025-06-01T13:00:00Z',
      message_count: 2,
      messages: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
      ],
    };
    expect(sessionSchema.parse(data)).toEqual(data);
  });

  it('rejects session without messages array', () => {
    const result = sessionSchema.safeParse({
      id: 'sess-1',
      title: 'Chat',
      created_at: '2025-06-01T12:00:00Z',
      updated_at: '2025-06-01T13:00:00Z',
      message_count: 0,
    });
    expect(result.success).toBe(false);
  });
});
