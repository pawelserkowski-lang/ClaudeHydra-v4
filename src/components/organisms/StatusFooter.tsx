/**
 * StatusFooter — Compact footer with version, status, and live date/time.
 * Matches Tissaia v4 Footer style.
 */

import { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface StatusFooterProps {
  status?: string;
  language?: string;
}

export function StatusFooter({ status = 'healthy', language = 'en' }: StatusFooterProps) {
  const { isDark } = useTheme();

  const [dateTime, setDateTime] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const locale = language === 'pl' ? 'pl-PL' : 'en-US';
  const formattedDate = dateTime.toLocaleDateString(locale);
  const formattedTime = dateTime.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const separatorClass = isDark ? 'text-white/20' : 'text-slate-300';

  return (
    <footer
      className={`px-6 py-2 border-t ${
        isDark
          ? 'border-white/10 bg-black/20 text-slate-400'
          : 'border-slate-200/30 bg-white/20 text-slate-600'
      } text-xs flex items-center justify-between`}
    >
      <div className="flex items-center gap-4">
        <span className={isDark ? 'text-white' : 'text-emerald-600'}>ClaudeHydra v4.0.0</span>
        <span className={separatorClass}>|</span>
        <span>
          {status === 'healthy' ? (
            <span className={isDark ? 'text-white' : 'text-emerald-600'}>&#x25CF; Online</span>
          ) : (
            <span className="text-yellow-500">&#x25CF; Degraded</span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span>AI Swarm Control Center</span>
        <span className={separatorClass}>|</span>
        <span>{formattedDate}</span>
        <span className={separatorClass}>|</span>
        <span className="tabular-nums">{formattedTime}</span>
      </div>
    </footer>
  );
}

export default StatusFooter;
