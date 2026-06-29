<script lang="ts" setup>
import type { ChatMessage } from '../types';

import { computed } from 'vue';

import { VbenIcon } from '@vben/common-ui';

import { message as antMessage } from 'ant-design-vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

const props = defineProps<{
  chatMessage: ChatMessage;
  userAvatar?: string;
}>();

const isUser = computed(() => props.chatMessage.role === 'user');

const renderedContent = computed(() => {
  const rawHtml = marked.parse(props.chatMessage.content || '', {
    breaks: true,
    gfm: true,
  }) as string;
  const html = rawHtml.replaceAll(
    /<pre><code([^>]*)>/g,
    (_match, attrs: string) =>
      `<div class="code-block"><button class="copy-code-button" type="button">复制</button><pre><code${attrs}>`,
  );
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['class', 'type'],
  });
});

async function copyText(text: string) {
  if (!text) {
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  antMessage.success('已复制代码');
}

function handleBubbleClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>('.copy-code-button');
  if (!button) {
    return;
  }

  const block = button.nextElementSibling;
  const code = block?.querySelector('code')?.textContent || '';
  void copyText(code);
}
</script>

<template>
  <div class="message-item" :class="{ 'message-item--user': isUser }">
    <div class="message-item__avatar">
      <img v-if="isUser && userAvatar" :src="userAvatar" alt="用户头像" />
      <VbenIcon
        v-else
        :icon="isUser ? 'mdi:account-circle-outline' : 'mdi:robot-outline'"
      />
    </div>
    <div class="message-item__content">
      <div class="message-item__bubble" @click="handleBubbleClick">
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="markdown-body" v-html="renderedContent"></div>
      </div>
      <div v-if="chatMessage.status === 'error'" class="message-item__status">
        发送失败
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-item {
  display: flex;
  gap: 11px;
  align-items: flex-start;
  width: 100%;
}

.message-item--user {
  flex-direction: row-reverse;
}

.message-item__avatar {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  overflow: hidden;
  font-size: 21px;
  color: #f8fbff;
  background:
    radial-gradient(circle at 35% 25%, rgb(255 255 255 / 70%), transparent 22%),
    linear-gradient(135deg, #7467f0, #32c5ff);
  border: 1px solid rgb(255 255 255 / 58%);
  border-radius: 50%;
  box-shadow: 0 12px 28px rgb(78 91 235 / 20%);
}

.message-item--user .message-item__avatar {
  color: #506070;
  background:
    radial-gradient(circle at 32% 28%, rgb(255 255 255 / 70%), transparent 22%),
    linear-gradient(135deg, #fff, #dfe8ff);
  border-color: rgb(255 255 255 / 70%);
}

.message-item__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.message-item__content {
  display: grid;
  gap: 6px;
  max-width: min(78%, 620px);
}

.message-item__bubble {
  padding: 12px 14px;
  overflow: hidden;
  color: #1d2638;
  background: rgb(255 255 255 / 62%);
  backdrop-filter: blur(18px);
  border: 1px solid rgb(255 255 255 / 58%);
  border-radius: 20px 20px 20px 8px;
  box-shadow: 0 16px 38px rgb(66 79 132 / 12%);
}

.message-item--user .message-item__bubble {
  color: #fff;
  background: linear-gradient(135deg, #6e63ff, #2aa8ff);
  border-color: rgb(255 255 255 / 28%);
  border-radius: 20px 20px 8px;
  box-shadow: 0 16px 38px rgb(65 102 245 / 20%);
}

.message-item__status {
  font-size: 12px;
  color: #ef4444;
}

:deep(.markdown-body) {
  font-size: 14px;
  line-height: 1.85;
  word-break: break-word;
}

:deep(.markdown-body > :first-child) {
  margin-top: 0;
}

:deep(.markdown-body > :last-child) {
  margin-bottom: 0;
}

:deep(.markdown-body p),
:deep(.markdown-body ul),
:deep(.markdown-body ol),
:deep(.markdown-body pre) {
  margin: 0 0 8px;
}

:deep(.markdown-body ul),
:deep(.markdown-body ol) {
  padding-left: 18px;
}

:deep(.markdown-body code) {
  padding: 2px 5px;
  font-size: 12px;
  color: #0f172a;
  background: rgb(79 70 229 / 10%);
  border-radius: 7px;
}

:deep(.code-block) {
  position: relative;
  margin: 8px 0;
}

:deep(.code-block pre) {
  padding: 34px 12px 12px;
  overflow-x: auto;
  background: #0f172a;
  border-radius: 8px;
}

:deep(.code-block code) {
  padding: 0;
  color: #e2e8f0;
  background: transparent;
}

:deep(.copy-code-button) {
  position: absolute;
  top: 6px;
  right: 6px;
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
  color: #dbeafe;
  cursor: pointer;
  background: rgb(255 255 255 / 12%);
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 6px;
}

.message-item--user :deep(.markdown-body code) {
  color: #fff;
  background: rgb(255 255 255 / 16%);
}

@media (prefers-color-scheme: dark) {
  .message-item__avatar {
    color: #93c5fd;
    background: #1e3a8a;
  }

  .message-item__bubble {
    color: #e5e7eb;
    background: #1f2937;
    border-color: rgb(255 255 255 / 8%);
  }

  :deep(.markdown-body code) {
    color: #e5e7eb;
    background: rgb(255 255 255 / 10%);
  }
}

@media (max-width: 520px) {
  .message-item__content {
    max-width: calc(100% - 48px);
  }
}
</style>
