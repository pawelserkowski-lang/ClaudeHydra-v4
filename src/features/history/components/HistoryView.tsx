/**
 * HistoryView — Approval Log & Session History
 * ==============================================
 * Displays session history with search/filter, sort by date,
 * delete with confirmation, and empty state.
 *
 * Ported from ClaudeHydra v3 `web/src/components/HistoryView.tsx`
 * and expanded with search, sort, confirmation dialogs, and motion.
 */

import { ArrowDownUp, Calendar, Check, Clock, Loader2, Search, Trash2, X, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useMemo, useState } from 'react';

import { Badge, Button, Card, Input } from '@/components/atoms';
import type { StatusState } from '@/components/molecules';
import { cn } from '@/shared/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HistoryStatus = 'approved' | 'denied' | 'auto-approved' | 'pending';
type SortOrder = 'newest' | 'oldest';

interface HistoryEntry {
  id: string;
  title: string;
  date: string;
  status: HistoryStatus;
  description: string;
  agentName: string;
  duration: string;
}

// ---------------------------------------------------------------------------
// Sample Data (placeholder -- will connect to backend)
// ---------------------------------------------------------------------------

const SAMPLE_HISTORY: readonly HistoryEntry[] = [
  {
    id: 'h1',
    title: 'Code Review - Authentication Module',
    date: '2026-02-12T10:30:00',
    status: 'approved',
    description: 'Opus Sentinel reviewed security patches for the auth middleware.',
    agentName: 'Opus Sentinel',
    duration: '2m 14s',
  },
  {
    id: 'h2',
    title: 'Refactor - Database Schema Migration',
    date: '2026-02-12T09:15:00',
    status: 'auto-approved',
    description: 'Opus Architect automated schema migration for v4 upgrade.',
    agentName: 'Opus Architect',
    duration: '5m 42s',
  },
  {
    id: 'h3',
    title: 'Test Suite - E2E Payment Flow',
    date: '2026-02-11T16:45:00',
    status: 'approved',
    description: 'Haiku Tester ran full E2E test suite on payment integration.',
    agentName: 'Haiku Tester',
    duration: '8m 03s',
  },
  {
    id: 'h4',
    title: 'Deploy - Staging Environment',
    date: '2026-02-11T14:20:00',
    status: 'denied',
    description: 'Haiku DevOps attempted staging deployment but health checks failed.',
    agentName: 'Haiku DevOps',
    duration: '1m 55s',
  },
  {
    id: 'h5',
    title: 'Documentation - API Reference Update',
    date: '2026-02-11T11:00:00',
    status: 'auto-approved',
    description: 'Sonnet Docs generated updated API reference from OpenAPI spec.',
    agentName: 'Sonnet Docs',
    duration: '3m 28s',
  },
  {
    id: 'h6',
    title: 'Performance Audit - Frontend Bundle',
    date: '2026-02-10T15:30:00',
    status: 'approved',
    description: 'Haiku Optimizer profiled bundle size and eliminated unused dependencies.',
    agentName: 'Haiku Optimizer',
    duration: '4m 17s',
  },
  {
    id: 'h7',
    title: 'Integration - OpenRouter API Bridge',
    date: '2026-02-10T10:00:00',
    status: 'pending',
    description: 'Haiku Integrator setting up OpenRouter fallback provider connection.',
    agentName: 'Haiku Integrator',
    duration: '--',
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  HistoryStatus,
  { label: string; indicatorStatus: StatusState; badgeVariant: 'success' | 'warning' | 'error' | 'accent' | 'default' }
> = {
  approved: { label: 'Approved', indicatorStatus: 'online', badgeVariant: 'success' },
  'auto-approved': { label: 'Auto-Approved', indicatorStatus: 'online', badgeVariant: 'accent' },
  denied: { label: 'Denied', indicatorStatus: 'error', badgeVariant: 'error' },
  pending: { label: 'Pending', indicatorStatus: 'pending', badgeVariant: 'warning' },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Animation Variants
// ---------------------------------------------------------------------------

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 25 },
  },
  exit: {
    opacity: 0,
    x: 20,
    height: 0,
    marginBottom: 0,
    padding: 0,
    transition: { duration: 0.2 },
  },
};

// ---------------------------------------------------------------------------
// HistoryItem Sub-component
// ---------------------------------------------------------------------------

interface HistoryItemProps {
  entry: HistoryEntry;
  onDelete: (id: string) => void;
}

function HistoryItem({ entry, onDelete }: HistoryItemProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const config = STATUS_CONFIG[entry.status];

  const handleDeleteClick = useCallback(() => {
    if (confirmDelete) {
      onDelete(entry.id);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      // Auto-reset after 3 seconds
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  }, [confirmDelete, entry.id, onDelete]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDelete(false);
  }, []);

  const statusIcon = useMemo(() => {
    switch (entry.status) {
      case 'approved':
        return <Check size={14} className="text-[var(--matrix-success)]" />;
      case 'auto-approved':
        return <Zap size={14} className="text-[var(--matrix-accent)]" />;
      case 'denied':
        return <X size={14} className="text-[var(--matrix-error)]" />;
      case 'pending':
        return <Loader2 size={14} className="text-[var(--matrix-warning)] animate-spin" />;
    }
  }, [entry.status]);

  return (
    <motion.div variants={itemVariants} layout layoutId={entry.id}>
      <Card
        variant="default"
        padding="none"
        className={cn(
          'border-l-2 transition-colors',
          entry.status === 'approved' && 'border-l-[var(--matrix-success)]',
          entry.status === 'auto-approved' && 'border-l-[var(--matrix-accent)]',
          entry.status === 'denied' && 'border-l-[var(--matrix-error)]',
          entry.status === 'pending' && 'border-l-[var(--matrix-warning)]',
        )}
      >
        <div className="p-4">
          {/* Top Row: Status Icon + Title + Time */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0">{statusIcon}</div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-medium text-[var(--matrix-text-primary)] truncate">{entry.title}</h3>
                <Badge variant={config.badgeVariant} size="sm">
                  {config.label}
                </Badge>
              </div>

              <p className="text-xs text-[var(--matrix-text-secondary)] mt-1 line-clamp-1">{entry.description}</p>

              {/* Meta Row */}
              <div className="flex items-center gap-4 mt-2 text-[11px] text-[var(--matrix-text-secondary)]">
                <span className="flex items-center gap-1">
                  <Calendar size={10} />
                  {formatDate(entry.date)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {formatTime(entry.date)}
                </span>
                <span className="flex items-center gap-1">
                  <Zap size={10} />
                  {entry.agentName}
                </span>
                <span className="text-[var(--matrix-accent)]/60">{entry.duration}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {confirmDelete ? (
                <>
                  <Button variant="danger" size="sm" onClick={handleDeleteClick} leftIcon={<Trash2 size={12} />}>
                    Confirm
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleCancelDelete}>
                    <X size={14} />
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" onClick={handleDeleteClick} className="opacity-40 hover:opacity-100">
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// HistoryView Component
// ---------------------------------------------------------------------------

export function HistoryView() {
  const [entries, setEntries] = useState<HistoryEntry[]>([...SAMPLE_HISTORY]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [statusFilter, setStatusFilter] = useState<HistoryStatus | 'all'>('all');

  // Filtered + sorted entries
  const displayEntries = useMemo(() => {
    let result = [...entries];

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter((e) => e.status === statusFilter);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.agentName.toLowerCase().includes(q),
      );
    }

    // Sort by date
    result.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [entries, searchQuery, sortOrder, statusFilter]);

  const handleDelete = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleClearAll = useCallback(() => {
    setEntries([]);
  }, []);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'));
  }, []);

  const statusFilters: Array<{ value: HistoryStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'approved', label: 'Approved' },
    { value: 'auto-approved', label: 'Auto' },
    { value: 'denied', label: 'Denied' },
    { value: 'pending', label: 'Pending' },
  ];

  return (
    <div data-testid="history-view" className="h-full flex flex-col overflow-auto p-4 sm:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--matrix-accent)]/10 border border-[var(--matrix-accent)]/20 flex items-center justify-center">
              <Clock size={20} className="text-[var(--matrix-accent)]" />
            </div>
            <div>
              <h2 data-testid="history-header" className="text-lg font-semibold text-[var(--matrix-accent)] text-glow-subtle">Approval History</h2>
              <p data-testid="history-entry-count" className="text-xs text-[var(--matrix-text-secondary)]">{entries.length} total entries</p>
            </div>
          </div>

          <Button
            data-testid="history-clear-all-btn"
            variant="danger"
            size="sm"
            onClick={handleClearAll}
            disabled={entries.length === 0}
            leftIcon={<Trash2 size={14} />}
          >
            Clear All
          </Button>
        </div>

        {/* Search + Sort Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1">
            <Input
              data-testid="history-search-input"
              icon={<Search size={14} />}
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              inputSize="sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button data-testid="history-sort-btn" variant="secondary" size="sm" onClick={toggleSortOrder} leftIcon={<ArrowDownUp size={14} />}>
              {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
            </Button>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {statusFilters.map((filter) => (
            <Button
              key={filter.value}
              data-testid={`history-filter-${filter.value}`}
              variant={statusFilter === filter.value ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* History List */}
      {displayEntries.length > 0 ? (
        <motion.div data-testid="history-list" variants={listVariants} initial="hidden" animate="visible" className="space-y-3">
          <AnimatePresence mode="popLayout">
            {displayEntries.map((entry) => (
              <HistoryItem key={entry.id} entry={entry} onDelete={handleDelete} />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        /* Empty State */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex-1 flex items-center justify-center"
        >
          <Card variant="glass" padding="lg" className="text-center max-w-sm">
            <Clock data-testid="history-empty-state" size={48} className="mx-auto text-[var(--matrix-text-secondary)] opacity-20 mb-4" />
            <p className="text-sm text-[var(--matrix-text-primary)] font-medium mb-2">No history entries</p>
            <p className="text-xs text-[var(--matrix-text-secondary)]">
              {entries.length === 0
                ? 'Actions will appear here after they are approved or denied.'
                : 'No entries match your current search and filter criteria.'}
            </p>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

export default HistoryView;
