import { useCallback } from 'react';

interface UseChatFileHandlerProps {
  onPasteImage?: (base64: string) => void;
  onPasteFile?: (content: string, filename: string) => void;
}

export function useChatFileHandler(_props: UseChatFileHandlerProps) {
  const handlePaste = useCallback((_e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Basic paste is handled globally, but we can prevent default or handle specific cases here if needed.
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleFileSelect = useCallback((_e: React.ChangeEvent<HTMLInputElement>) => {
    // Basic file select handler
  }, []);

  return {
    handlePaste,
    handleDrop,
    handleFileSelect,
  };
}
