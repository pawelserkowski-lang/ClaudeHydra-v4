// src/i18n/index.ts
/**
 * ClaudeHydra — i18next Configuration
 * =====================================
 * Delegates to @jaskier/i18n initI18n with CH-specific overrides.
 * CH-specific keys: home branding, sidebar partner, footer tagline.
 */

import { initI18n } from '@jaskier/i18n';

initI18n({
  overrides: {
    en: {
      home: {
        logoAlt: 'ClaudeHydra Logo',
        title: 'ClaudeHydra',
        appName: 'ClaudeHydra',
        badges: {
          agents: '12 Agents',
          claudeApi: 'Claude API',
          mcpIntegration: 'MCP Integration',
          streamingChat: 'Streaming Chat',
        },
      },
      sidebar: {
        partnerApp: 'GeminiHydra',
      },
      footer: {
        tagline: 'AI Swarm',
        statusTagline: 'AI Swarm Control Center',
      },
      chat: {
        title: 'Claude Chat',
        partnerSession: 'GeminiHydra Session ({{count}} messages)',
        readOnlyView: 'Read-only view from GeminiHydra',
      },
    },
    pl: {
      home: {
        logoAlt: 'Logo ClaudeHydra',
        title: 'ClaudeHydra',
        appName: 'ClaudeHydra',
        badges: {
          agents: '12 Agentów',
          claudeApi: 'Claude API',
          mcpIntegration: 'Integracja MCP',
          streamingChat: 'Czat Strumieniowy',
        },
      },
      sidebar: {
        partnerApp: 'GeminiHydra',
      },
      footer: {
        tagline: 'Rój AI',
        statusTagline: 'Centrum Sterowania Rojem AI',
      },
      chat: {
        title: 'Czat Claude',
        partnerSession: 'Sesja GeminiHydra ({{count}} wiadomości)',
        readOnlyView: 'Widok tylko do odczytu z GeminiHydra',
      },
    },
  },
});

export { default } from '@jaskier/i18n';
