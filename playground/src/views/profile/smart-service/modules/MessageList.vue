<script lang="ts" setup>
import type { ChatMessage, ChatSystemNotice } from '../types';

import MessageItem from './MessageItem.vue';

defineProps<{
  loading: boolean;
  messages: ChatMessage[];
  notices: ChatSystemNotice[];
  userAvatar?: string;
}>();

const emit = defineEmits<{
  (event: 'retry'): void;
}>();

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <div class="message-list">
    <div v-if="messages.length === 0" class="message-list__empty">
      <div class="message-list__skeleton"></div>
      <div class="message-list__skeleton message-list__skeleton--short"></div>
    </div>

    <template v-else>
      <div class="message-list__time">
        <span>{{ formatTime(messages[0]?.createdAt || Date.now()) }}</span>
      </div>

      <MessageItem
        v-for="item in messages"
        :key="item.id"
        :chat-message="item"
        :user-avatar="userAvatar"
      />
    </template>

    <div
      v-for="notice in notices"
      :key="notice.id"
      class="message-list__notice"
    >
      <span>{{ notice.message }}</span>
      <button v-if="notice.retryText" type="button" @click="emit('retry')">
        {{ notice.retryText }}
      </button>
    </div>

    <div v-if="loading" class="typing-indicator">
      <span>正在输入</span>
      <i></i>
      <i></i>
      <i></i>
    </div>
  </div>
</template>

<style scoped>
.message-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
  padding: 18px 14px 28px;
}

.message-list__time {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #94a3b8;
}

.message-list__time::before,
.message-list__time::after {
  width: 52px;
  height: 1px;
  content: '';
  background: #e5e7eb;
}

.message-list__notice {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  align-self: center;
  justify-content: center;
  max-width: 90%;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: #59677f;
  text-align: center;
  background: rgb(255 255 255 / 52%);
  backdrop-filter: blur(14px);
  border: 1px solid rgb(255 255 255 / 48%);
  border-radius: 999px;
}

.message-list__notice button {
  padding: 0;
  color: #2563eb;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.message-list__empty {
  display: grid;
  gap: 10px;
  max-width: 260px;
  padding: 8px 0;
}

.message-list__skeleton {
  width: 240px;
  height: 44px;
  background: linear-gradient(90deg, #f1f5f9, #e2e8f0, #f1f5f9);
  background-size: 200% 100%;
  border-radius: 12px;
  animation: skeleton-loading 1.2s ease-in-out infinite;
}

.message-list__skeleton--short {
  width: 180px;
}

.typing-indicator {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  align-self: flex-start;
  padding: 8px 12px;
  font-size: 13px;
  color: #59677f;
  background: rgb(255 255 255 / 62%);
  backdrop-filter: blur(16px);
  border: 1px solid rgb(255 255 255 / 52%);
  border-radius: 18px;
  box-shadow: 0 16px 38px rgb(66 79 132 / 10%);
}

.typing-indicator i {
  width: 5px;
  height: 5px;
  background: #94a3b8;
  border-radius: 50%;
  animation: typing-dot 1s ease-in-out infinite;
}

.typing-indicator i:nth-child(3) {
  animation-delay: 0.15s;
}

.typing-indicator i:nth-child(4) {
  animation-delay: 0.3s;
}

@keyframes typing-dot {
  0%,
  80%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }

  40% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

@keyframes skeleton-loading {
  0% {
    background-position: 100% 0;
  }

  100% {
    background-position: -100% 0;
  }
}

@media (prefers-color-scheme: dark) {
  .message-list {
    background: #0f172a;
  }

  .message-list__time::before,
  .message-list__time::after {
    background: #334155;
  }

  .message-list__notice {
    color: #cbd5e1;
    background: rgb(148 163 184 / 16%);
  }

  .typing-indicator {
    color: #cbd5e1;
    background: #1f2937;
    border-color: rgb(255 255 255 / 8%);
  }

  .message-list__skeleton {
    background: linear-gradient(90deg, #1f2937, #334155, #1f2937);
    background-size: 200% 100%;
  }
}
</style>
