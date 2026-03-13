/**
 * Centralized data-testid selectors for E2E tests.
 * Single source of truth — update here when component testids change.
 */

export const SEL = {
  // AppShell
  appShell: '[data-testid="app-shell"]',

  // Sidebar
  sidebar: '[data-testid="sidebar"]',
  sidebarLogo: '[data-testid="sidebar-logo"]',
  sidebarCollapseToggle: '[data-testid="sidebar-collapse-toggle"]',
  sidebarThemeToggle: '[data-testid="sidebar-theme-toggle"]',
  sidebarSettingsBtn: '[data-testid="sidebar-settings-btn"]',
  sidebarNewChatBtn: '[data-testid="sidebar-new-chat-btn"]',
  sidebarChatsToggle: '[data-testid="sidebar-chats-toggle"]',
  sidebarSessionList: '[data-testid="sidebar-session-list"]',
  sidebarSessionItem: '[data-testid="sidebar-session-item"]',
  sidebarVersion: '[data-testid="sidebar-version"]',

  // Mobile
  mobileHamburger: '[data-testid="mobile-hamburger"]',
  mobileBackdrop: '[data-testid="mobile-backdrop"]',
  mobileDrawer: '[data-testid="mobile-drawer"]',
  mobileCloseBtn: '[data-testid="mobile-close-btn"]',

  // Navigation
  nav: (viewId: string) => `[data-testid="nav-${viewId}"]`,

  // Home
  homeView: '[data-testid="home-view"]',
  homeGlassCard: '[data-testid="home-glass-card"]',
  homeTitle: '[data-testid="home-title"]',
  homeSubtitle: '[data-testid="home-subtitle"]',
  homeVersionBadge: '[data-testid="home-version-badge"]',
  homeFeatureBadges: '[data-testid="home-feature-badges"]',
  homeFeatureCards: '[data-testid="home-feature-cards"]',
  homeCtaStartChat: '[data-testid="home-cta-start-chat"]',
  homeCtaSettings: '[data-testid="home-cta-settings"]',

  // Chat
  chatView: '[data-testid="chat-view"]',
  chatHeader: '[data-testid="chat-header"]',
  chatStatusText: '[data-testid="chat-status-text"]',
  chatEmptyState: '[data-testid="chat-empty-state"]',
  chatMessageArea: '[data-testid="chat-message-area"]',
  chatStreamingBar: '[data-testid="chat-streaming-bar"]',
  chatClearBtn: '[data-testid="chat-clear-btn"]',
  chatInputArea: '[data-testid="chat-input-area"]',
  chatTextarea: '[data-testid="chat-textarea"]',
  chatSendBtn: '[data-testid="chat-send-btn"]',
  chatMessageBubble: '[data-testid="chat-message-bubble"]',

  // History
  historyView: '[data-testid="history-view"]',
  historyHeader: '[data-testid="history-header"]',
  historyEntryCount: '[data-testid="history-entry-count"]',
  historyClearAllBtn: '[data-testid="history-clear-all-btn"]',
  historySearchInput: '[data-testid="history-search-input"]',
  historySortBtn: '[data-testid="history-sort-btn"]',
  historyFilter: (status: string) => `[data-testid="history-filter-${status}"]`,
  historyList: '[data-testid="history-list"]',
  historyEmptyState: '[data-testid="history-empty-state"]',

  // Settings
  settingsView: '[data-testid="settings-view"]',
  settingsHeader: '[data-testid="settings-header"]',
  settingsThemeSelector: '[data-testid="settings-theme-selector"]',
  settingsTheme: (mode: string) => `[data-testid="settings-theme-${mode}"]`,
  settingsModelSelector: '[data-testid="settings-model-selector"]',
  settingsAutoStartToggle: '[data-testid="settings-auto-start-toggle"]',
  settingsProvider: (id: string) => `[data-testid="settings-provider-${id}"]`,
  settingsAbout: '[data-testid="settings-about"]',

  // Agents
  agentsView: '[data-testid="agents-view"]',
  agentsHeader: '[data-testid="agents-header"]',
  agentsOnlineCount: '[data-testid="agents-online-count"]',
  agentsFilterBar: '[data-testid="agents-filter-bar"]',
  agentsGrid: '[data-testid="agents-grid"]',
  agentsFilter: (tier: string) => `[data-testid="agents-filter-${tier}"]`,
  agentCard: (id: string) => `[data-testid="agent-card-${id}"]`,

  // Status Footer
  statusFooter: '[data-testid="status-footer"]',
} as const;
