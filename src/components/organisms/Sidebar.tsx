/**
 * Sidebar — ClaudeHydra collapsible navigation sidebar.
 * Ported from ClaudeHydra v3 `web/src/components/Sidebar.tsx`.
 *
 * Layout: EPS AI Solutions logo + nav items + session manager + theme toggle + version.
 * States: expanded (w-60) / collapsed (w-16) with smooth animation.
 * Mobile: overlay drawer on small screens.
 *
 * Neutral white accent (#ffffff) for active states, hovers, borders, glows.
 */

import {
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  Menu,
  MessageSquare,
  MessagesSquare,
  Moon,
  Plus,
  Settings,
  Sun,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type KeyboardEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/shared/utils/cn';
import { type ChatSession, useViewStore, type ViewId } from '@/stores/viewStore';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAV_ITEMS: readonly { id: ViewId; label: string; icon: typeof Zap }[] = [
  { id: 'home', label: 'Home', icon: Zap },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

const MOBILE_BREAKPOINT = 768;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// useIsMobile hook (inline — matches legacy useIsMobile)
// ---------------------------------------------------------------------------

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

// ---------------------------------------------------------------------------
// SessionItem sub-component
// ---------------------------------------------------------------------------

interface SessionItemProps {
  session: ChatSession;
  isActive: boolean;
  collapsed: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (newTitle: string) => void;
}

function SessionItem({ session, isActive, collapsed, onSelect, onDelete, onRename }: SessionItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (!confirmDelete) return;
    const timer = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmDelete]);

  const handleSave = () => {
    if (editTitle.trim() && editTitle !== session.title) {
      onRename(editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(session.title);
    setIsEditing(false);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  };

  const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  // Collapsed: just an icon button
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onSelect}
        data-testid="sidebar-session-item"
        className={cn(
          'w-full p-2 rounded flex items-center justify-center transition-colors',
          isActive
            ? 'bg-[rgba(255,255,255,0.15)] text-[var(--matrix-accent)]'
            : 'hover:bg-[rgba(255,255,255,0.08)] text-[var(--matrix-text-secondary)]',
        )}
        title={session.title}
      >
        <MessageSquare size={16} />
      </button>
    );
  }

  // Editing mode
  if (isEditing) {
    return (
      <div className="flex items-center gap-1 p-1">
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={handleEditKeyDown}
          className="flex-1 glass-input text-xs py-1 px-2"
          ref={(el) => el?.focus()}
        />
        <button
          type="button"
          onClick={handleSave}
          className="p-1 hover:bg-[rgba(255,255,255,0.15)] rounded text-[var(--matrix-accent)]"
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="p-1 hover:bg-[rgba(255,68,68,0.2)] rounded text-red-400"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  // Default: session row
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="sidebar-session-item"
      className={cn(
        'group relative flex items-center gap-2 p-2 rounded cursor-pointer transition-colors w-full text-left',
        isActive
          ? 'bg-[rgba(255,255,255,0.15)] text-[var(--matrix-accent)]'
          : 'hover:bg-[rgba(255,255,255,0.08)] text-[var(--matrix-text-secondary)]',
      )}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <MessageSquare size={14} className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{session.title}</p>
        <p className="text-xs text-[var(--matrix-text-secondary)] truncate">
          {session.messageCount} message{session.messageCount !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="p-1 hover:bg-[rgba(255,255,255,0.15)] rounded"
          title="Rename"
        >
          <Edit2 size={12} />
        </button>
        <button
          type="button"
          onClick={handleDeleteClick}
          className={cn(
            'p-1 rounded transition-colors',
            confirmDelete ? 'bg-[rgba(255,68,68,0.3)] text-red-300' : 'hover:bg-[rgba(255,68,68,0.2)] text-red-400',
          )}
          title={confirmDelete ? 'Click again to delete' : 'Delete'}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Tooltip with preview */}
      {showTooltip && session.preview && (
        <div
          className={cn(
            'absolute left-full top-0 ml-2 z-50 w-56 p-2.5 rounded-lg',
            'bg-[var(--matrix-bg-primary)]/95 border border-[rgba(255,255,255,0.2)]',
            'shadow-lg shadow-black/40 backdrop-blur-sm pointer-events-none',
            'animate-fade-in',
          )}
        >
          <p className="text-[11px] text-[var(--matrix-text-primary)] font-medium truncate mb-1">{session.title}</p>
          <p className="text-[10px] text-[var(--matrix-text-secondary)] line-clamp-3 leading-relaxed">
            {session.preview}
          </p>
          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-[var(--matrix-border)]">
            <span className="text-[9px] text-[var(--matrix-text-secondary)]">
              {session.messageCount} message{session.messageCount !== 1 ? 's' : ''}
            </span>
            <span className="text-[9px] text-[var(--matrix-accent)]">{timeAgo(session.updatedAt)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar Content (shared between desktop & mobile)
// ---------------------------------------------------------------------------

interface SidebarContentProps {
  collapsed: boolean;
  onClose?: () => void;
  isMobile?: boolean;
}

function SidebarContent({ collapsed, onClose, isMobile = false }: SidebarContentProps) {
  const {
    currentView,
    setView,
    activeSessionId,
    chatSessions,
    setActiveSessionId,
    createSession,
    deleteSession,
    renameSession,
    openTab,
  } = useViewStore();

  const { mode, setMode, isDark } = useTheme();

  const [showSessions, setShowSessions] = useState(true);

  // Sort sessions by updatedAt descending
  const sortedSessions = useMemo(() => [...chatSessions].sort((a, b) => b.updatedAt - a.updatedAt), [chatSessions]);

  const navigateTo = useCallback(
    (view: ViewId) => {
      setView(view);
      if (isMobile && onClose) onClose();
    },
    [setView, isMobile, onClose],
  );

  const handleCreateSession = () => {
    createSession();
  };

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    openTab(sessionId);
    setView('chat');
    if (isMobile && onClose) onClose();
  };

  const handleDeleteSession = (sessionId: string) => {
    deleteSession(sessionId);
  };

  const handleRenameSession = (sessionId: string, newTitle: string) => {
    renameSession(sessionId, newTitle);
  };

  // Theme mode cycling: dark -> light -> system -> dark
  const cycleThemeMode = () => {
    if (mode === 'dark') setMode('light');
    else if (mode === 'light') setMode('system');
    else setMode('dark');
  };

  const themeIcon = isDark ? Sun : Moon;
  const ThemeIcon = themeIcon;
  const themeLabel = mode === 'dark' ? 'Light' : mode === 'light' ? 'System' : 'Dark';

  return (
    <>
      {/* ---- Logo ---- */}
      <div className="p-4 flex items-center justify-center border-b border-[var(--matrix-border)]">
        <button
          type="button"
          data-testid="sidebar-logo"
          onClick={() => navigateTo('home')}
          className="hover:opacity-80 transition-opacity"
        >
          <img
            src={isDark ? '/logodark.webp' : '/logolight.webp'}
            alt="EPS AI Solutions"
            className={collapsed ? 'w-16 h-16 object-contain' : 'h-36 object-contain'}
          />
        </button>
      </div>

      {/* ---- Navigation ---- */}
      <nav className="py-3 px-2 space-y-1 border-b border-[var(--matrix-border)]">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <motion.button
              key={item.id}
              type="button"
              data-testid={`nav-${item.id}`}
              onClick={() => navigateTo(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                isActive
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-[var(--matrix-text-secondary)] hover:text-[var(--matrix-text-primary)] hover:bg-[rgba(255,255,255,0.08)]',
              )}
              whileHover={{ x: collapsed ? 0 : 2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'drop-shadow-[0_0_6px_var(--matrix-accent)]')} />
              {!collapsed && (
                <span className={cn('text-base whitespace-nowrap', isActive && 'text-glow-subtle')}>{item.label}</span>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* ---- Session Manager ---- */}
      <div className="flex-1 flex flex-col min-h-0 p-2 border-b border-[var(--matrix-border)]">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            data-testid="sidebar-chats-toggle"
            onClick={() => setShowSessions(!showSessions)}
            className="flex items-center gap-2 text-sm text-[var(--matrix-text-primary)] hover:text-[var(--matrix-accent)] transition-colors"
          >
            <MessagesSquare size={14} />
            {!collapsed && <span>Chats</span>}
            {!collapsed &&
              (showSessions ? (
                <ChevronLeft size={12} className="rotate-90" />
              ) : (
                <ChevronRight size={12} className="rotate-90" />
              ))}
          </button>
          <button
            type="button"
            data-testid="sidebar-new-chat-btn"
            onClick={handleCreateSession}
            className="p-1.5 hover:bg-[rgba(255,255,255,0.15)] rounded text-[var(--matrix-accent)] transition-colors"
            title="New chat"
          >
            <Plus size={14} />
          </button>
        </div>

        <AnimatePresence>
          {showSessions && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              data-testid="sidebar-session-list"
              className="flex-1 space-y-1 overflow-y-auto min-h-0"
            >
              {sortedSessions.length === 0 ? (
                <p className="text-[10px] text-[var(--matrix-text-secondary)] text-center py-2">
                  {collapsed ? '' : 'No chats yet'}
                </p>
              ) : (
                sortedSessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    isActive={session.id === activeSessionId}
                    collapsed={collapsed}
                    onSelect={() => handleSelectSession(session.id)}
                    onDelete={() => handleDeleteSession(session.id)}
                    onRename={(newTitle) => handleRenameSession(session.id, newTitle)}
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---- Bottom: Theme toggle + Settings ---- */}
      <div className="p-2 border-t border-[var(--matrix-border)]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="sidebar-theme-toggle"
            onClick={cycleThemeMode}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 p-2 rounded',
              'hover:bg-[rgba(255,255,255,0.08)] text-[var(--matrix-text-secondary)]',
              'hover:text-[var(--matrix-accent)] transition-colors',
            )}
            title={`Switch to ${themeLabel} mode`}
          >
            <ThemeIcon size={16} />
            {!collapsed && <span className="text-sm">{themeLabel}</span>}
          </button>
          <button
            type="button"
            data-testid="sidebar-settings-btn"
            onClick={() => navigateTo('settings')}
            className={cn(
              'flex items-center justify-center p-2 rounded',
              'hover:bg-[rgba(255,255,255,0.08)] text-[var(--matrix-text-secondary)]',
              'hover:text-[var(--matrix-accent)] transition-colors',
            )}
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>

        {/* Version */}
        {!collapsed && (
          <p data-testid="sidebar-version" className="text-[10px] text-[var(--matrix-text-secondary)] text-center mt-2 font-mono opacity-50">
            v4.0.0
          </p>
        )}
      </div>

      {/* ---- Mobile close button ---- */}
      {isMobile && (
        <div className="p-2 border-t border-[var(--matrix-border)]">
          <button
            type="button"
            data-testid="mobile-close-btn"
            onClick={onClose}
            className="nav-item w-full justify-center text-[var(--matrix-text-secondary)] hover:text-[var(--matrix-accent)]"
          >
            <X size={18} />
            <span className="text-sm">Close</span>
          </button>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Sidebar component
// ---------------------------------------------------------------------------

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, mobileDrawerOpen, setMobileDrawerOpen, currentView } = useViewStore();

  const isMobile = useIsMobile();

  // Auto-close mobile drawer on view change (currentView is intentional trigger)
  // biome-ignore lint/correctness/useExhaustiveDependencies: currentView triggers close on navigation
  useEffect(() => {
    if (isMobile) setMobileDrawerOpen(false);
  }, [currentView, isMobile, setMobileDrawerOpen]);

  // Mobile: hamburger + overlay drawer
  if (isMobile) {
    return (
      <>
        {/* Hamburger trigger */}
        <button
          type="button"
          data-testid="mobile-hamburger"
          onClick={() => setMobileDrawerOpen(true)}
          className={cn(
            'fixed top-3 left-3 z-50 p-2 rounded-lg',
            'glass-panel hover:bg-[rgba(255,255,255,0.08)] transition-colors',
          )}
          title="Menu"
        >
          <Menu size={20} className="text-[var(--matrix-accent)]" />
        </button>

        {/* Backdrop */}
        <AnimatePresence>
          {mobileDrawerOpen && (
            <motion.div
              key="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              data-testid="mobile-backdrop"
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setMobileDrawerOpen(false)}
              role="presentation"
            />
          )}
        </AnimatePresence>

        {/* Drawer */}
        <motion.aside
          initial={{ x: '-100%' }}
          animate={{ x: mobileDrawerOpen ? 0 : '-100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          data-testid="mobile-drawer"
          className="fixed top-0 left-0 h-full w-72 z-50 glass-panel-dark flex flex-col"
        >
          <SidebarContent collapsed={false} onClose={() => setMobileDrawerOpen(false)} isMobile />
        </motion.aside>
      </>
    );
  }

  // Desktop: inline sidebar
  return (
    <motion.aside
      data-testid="sidebar"
      initial={false}
      animate={{ width: sidebarCollapsed ? 64 : 240 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(
        'glass-panel-dark flex flex-col',
        'h-full overflow-hidden relative',
      )}
    >
      <SidebarContent collapsed={sidebarCollapsed} />

      {/* Collapse toggle (desktop only) */}
      <button
        type="button"
        data-testid="sidebar-collapse-toggle"
        onClick={toggleSidebar}
        className={cn(
          'absolute top-1/2 -translate-y-1/2 -right-3 z-20',
          'w-6 h-6 rounded-full flex items-center justify-center',
          'bg-[var(--matrix-bg-secondary)] border border-[var(--matrix-border)]',
          'text-[var(--matrix-text-secondary)] hover:text-[var(--matrix-accent)]',
          'hover:border-[var(--matrix-accent)] transition-colors',
          'shadow-sm',
        )}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </motion.aside>
  );
}
