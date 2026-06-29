export type ChatMessageRole = 'assistant' | 'system' | 'user';

export type ChatMessageStatus = 'error' | 'sending' | 'sent' | 'streaming';

export interface ChatMessage {
  avatar?: string;
  content: string;
  createdAt: number;
  id: string;
  role: ChatMessageRole;
  status?: ChatMessageStatus;
}

export interface ChatSystemNotice {
  id: string;
  message: string;
  retryText?: string;
  type: 'system';
}

export interface QuickQuestion {
  icon?: string;
  key: string;
  prompt?: string;
  text: string;
}
