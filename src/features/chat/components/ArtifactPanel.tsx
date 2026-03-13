import { useViewTheme } from '@jaskier/chat-module';
import { BaseArtifactView, cn } from '@jaskier/ui';
import { AnimatePresence, motion } from 'motion/react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useViewStore } from '@/stores/viewStore';

export const ArtifactPanel = memo(function ArtifactPanel() {
  const theme = useViewTheme();
  const activeArtifact = useViewStore((s) => s.activeArtifact);
  const setActiveArtifact = useViewStore((s) => s.setActiveArtifact);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsFullscreen(false);
    setActiveArtifact(null);
  }, [setActiveArtifact]);

  // Escape key closes fullscreen (or closes panel if not fullscreen)
  useEffect(() => {
    if (!activeArtifact) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen, activeArtifact, handleClose]);

  // Reset fullscreen when artifact changes
  const prevArtifactIdRef = useRef(activeArtifact?.id);
  if (prevArtifactIdRef.current !== activeArtifact?.id) {
    prevArtifactIdRef.current = activeArtifact?.id;
    if (isFullscreen) setIsFullscreen(false);
  }

  return (
    <>
      {/* Inline side-panel — animated enter/exit when artifact changes */}
      <AnimatePresence mode="wait">
        {activeArtifact && !isFullscreen && (
          <motion.div
            key="artifact-inline"
            initial={{ opacity: 0, x: 50, width: 0 }}
            animate={{ opacity: 1, x: 0, width: '50%' }}
            exit={{ opacity: 0, x: 50, width: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={cn(
              'h-full flex flex-col border-l border-[var(--matrix-accent)]/20 bg-black/40 backdrop-blur-md z-20 shrink-0 relative overflow-hidden',
              theme.glassPanel,
              'rounded-r-xl rounded-l-none border-y-0 border-r-0',
            )}
          >
            <BaseArtifactView
              content={activeArtifact.code}
              language={activeArtifact.language}
              title={activeArtifact.title}
              onClose={handleClose}
              isFullscreen={false}
              onToggleFullscreen={toggleFullscreen}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen overlay — fixed position, dark backdrop */}
      <AnimatePresence>
        {activeArtifact && isFullscreen && (
          <motion.div
            key="artifact-fullscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            {/* Backdrop — click to exit fullscreen */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={toggleFullscreen}
            />

            {/* Content panel */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={cn(
                'relative w-[92vw] h-[92vh] flex flex-col overflow-hidden rounded-xl border border-[var(--matrix-accent)]/30 shadow-2xl',
                theme.glassPanel,
              )}
            >
              <BaseArtifactView
                content={activeArtifact.code}
                language={activeArtifact.language}
                title={activeArtifact.title}
                onClose={handleClose}
                isFullscreen={true}
                onToggleFullscreen={toggleFullscreen}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
