/**
 * Zod v4 schemas for all ClaudeHydra v4 backend API endpoints.
 * Each schema mirrors the Rust/Axum response shape exactly.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export const providerInfoSchema = z.object({
  name: z.string(),
  available: z.boolean(),
});

export type ProviderInfo = z.infer<typeof providerInfoSchema>;

export const healthSchema = z.object({
  status: z.string(),
  version: z.string(),
  uptime_seconds: z.number(),
  providers: z.array(providerInfoSchema),
});

export type Health = z.infer<typeof healthSchema>;

// ---------------------------------------------------------------------------
// System Stats
// ---------------------------------------------------------------------------

export const systemStatsSchema = z.object({
  cpu_usage: z.number(),
  memory_used: z.number(),
  memory_total: z.number(),
  uptime_seconds: z.number(),
  active_sessions: z.number(),
  total_messages: z.number(),
});

export type SystemStats = z.infer<typeof systemStatsSchema>;

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export const agentSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  specialization: z.string(),
  tier: z.string(),
  status: z.string(),
  description: z.string(),
  model: z.string().optional(),
});

export type Agent = z.infer<typeof agentSchema>;

export const agentsListSchema = z.array(agentSchema);

export type AgentsList = z.infer<typeof agentsListSchema>;

// ---------------------------------------------------------------------------
// Claude Models
// ---------------------------------------------------------------------------

export const claudeModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  tier: z.string(),
  provider: z.string(),
  available: z.boolean(),
});

export type ClaudeModel = z.infer<typeof claudeModelSchema>;

export const claudeModelsSchema = z.array(claudeModelSchema);

export type ClaudeModels = z.infer<typeof claudeModelsSchema>;

// ---------------------------------------------------------------------------
// Claude Chat
// ---------------------------------------------------------------------------

export const usageSchema = z.object({
  input_tokens: z.number(),
  output_tokens: z.number(),
});

export type Usage = z.infer<typeof usageSchema>;

export const claudeChatRequestSchema = z.object({
  model: z.string(),
  messages: z.array(
    z.object({
      role: z.string(),
      content: z.string(),
    }),
  ),
  max_tokens: z.number().optional(),
  temperature: z.number().optional(),
  system: z.string().optional(),
  stream: z.boolean().optional(),
});

export type ClaudeChatRequest = z.infer<typeof claudeChatRequestSchema>;

export const claudeChatResponseSchema = z.object({
  content: z.string(),
  model: z.string(),
  usage: usageSchema,
});

export type ClaudeChatResponse = z.infer<typeof claudeChatResponseSchema>;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const settingsSchema = z.object({
  default_model: z.string(),
  temperature: z.number(),
  max_tokens: z.number(),
  language: z.string(),
  theme: z.string(),
});

export type Settings = z.infer<typeof settingsSchema>;

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export const messageSchema = z.object({
  role: z.string(),
  content: z.string(),
  model: z.string().optional(),
});

export type Message = z.infer<typeof messageSchema>;

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const sessionSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  message_count: z.number(),
  preview: z.string().optional(),
});

export type SessionSummary = z.infer<typeof sessionSummarySchema>;

export const sessionsListSchema = z.array(sessionSummarySchema);

export type SessionsList = z.infer<typeof sessionsListSchema>;

export const sessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  message_count: z.number(),
  messages: z.array(messageSchema),
});

export type Session = z.infer<typeof sessionSchema>;
