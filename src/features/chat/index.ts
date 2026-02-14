// src/features/chat/index.ts
// Barrel file — re-exports all chat feature components and types.

export type { Attachment, ChatInputHandle, ChatInputProps } from './components/ChatInput';

export { ChatInput } from './components/ChatInput';
export type {
  ChatMessage,
  MessageAttachment,
  MessageBubbleProps,
  MessageRole,
} from './components/MessageBubble';

export { MessageBubble } from './components/MessageBubble';
export { ClaudeChatView } from './components/ClaudeChatView';
