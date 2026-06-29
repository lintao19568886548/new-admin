<script lang="ts" setup>
import type { ChatMessage, ChatSystemNotice, QuickQuestion } from './types';

import type { SmartServiceMessage } from '#/api/chat/smart-service';

import { computed, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { VbenIcon } from '@vben/common-ui';
import { ChevronLeft } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { message as antMessage, Button, Modal } from 'ant-design-vue';

import { requestSmartServiceStream } from '#/api/chat/smart-service';

import ChatInput from './modules/ChatInput.vue';
import MessageList from './modules/MessageList.vue';
import QuickQuestions from './modules/QuickQuestions.vue';

const STORAGE_KEY = 'profile:smart-service:messages';
const REQUEST_TIMEOUT_MS = 60_000;
const ASSISTANT_STOPPED_TEXT = '已停止生成。';

const WELCOME_MESSAGE: ChatMessage = {
  content:
    '你好呀，我是智能客服。很高兴见到你 🙂\n\n你可以问我账号、订单、会员、隐私政策等问题，我会一步一步帮你处理。',
  createdAt: Date.now(),
  id: 'welcome',
  role: 'assistant',
  status: 'sent',
};

const quickQuestions: QuickQuestion[] = [
  {
    icon: 'mdi:warehouse',
    key: 'factory',
    prompt: '我想查厂房，请告诉我可以按哪些条件筛选？',
    text: '查厂房',
  },
  {
    icon: 'mdi:lock-reset',
    key: 'changePassword',
    prompt: '如何修改密码？请分步骤告诉我。',
    text: '改密码',
  },
];

const router = useRouter();
const userStore = useUserStore();
const userInfo = computed(() => userStore.userInfo);
const messages = ref<ChatMessage[]>([]);
const notices = ref<ChatSystemNotice[]>([]);
const inputValue = ref('');
const loading = ref(false);
const chatBodyRef = ref<HTMLElement>();
const inputRef = ref<InstanceType<typeof ChatInput>>();
const lastUserText = ref('');
let abortController: AbortController | null = null;

const assistantStatusText = computed(() =>
  loading.value ? '正在输入...' : '在线 · 随时为你服务',
);

function createId(prefix = 'msg') {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createWelcomeMessage(): ChatMessage {
  return {
    ...WELCOME_MESSAGE,
    createdAt: Date.now(),
    id: createId('welcome'),
  };
}

function loadMessages() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    messages.value = [createWelcomeMessage()];
    return;
  }

  try {
    const parsed = JSON.parse(raw) as ChatMessage[];
    messages.value =
      Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : [createWelcomeMessage()];
  } catch {
    messages.value = [createWelcomeMessage()];
  }
}

function saveMessages() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.value));
}

function toApiMessages(): SmartServiceMessage[] {
  return messages.value
    .filter((item) => item.role === 'assistant' || item.role === 'user')
    .filter((item) => item.content.trim())
    .map((item) => ({
      content: item.content,
      role: item.role,
    }))
    .slice(-12);
}

function scrollToBottom() {
  void nextTick(() => {
    const el = chatBodyRef.value;
    if (!el) {
      return;
    }
    el.scrollTo({
      behavior: 'smooth',
      top: el.scrollHeight,
    });
  });
}

function addNotice(message: string, retryText?: string) {
  notices.value.push({
    id: createId('notice'),
    message,
    retryText,
    type: 'system',
  });
  scrollToBottom();
}

function clearNotices() {
  notices.value = [];
}

function parseSsePayload(line: string) {
  const normalized = line.trimStart();
  if (!normalized.startsWith('data:')) {
    return null;
  }
  return normalized.slice(5).trim();
}

function readDeltaText(payload: any) {
  if (payload?.error?.message) {
    throw new Error(String(payload.error.message));
  }
  const delta = payload?.choices?.[0]?.delta;
  const message = payload?.choices?.[0]?.message;
  return String(
    delta?.content ||
      delta?.reasoning_content ||
      message?.content ||
      payload?.output?.text ||
      '',
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function appendAssistantTextTyping(
  messageId: string,
  text: string,
  signal: AbortSignal,
) {
  for (const char of text) {
    if (signal.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    appendAssistantText(messageId, char);
    await sleep(18);
  }
}

function appendAssistantText(messageId: string, text: string) {
  const target = messages.value.find((item) => item.id === messageId);
  if (!target) {
    return;
  }
  target.content += text;
  saveMessages();
  scrollToBottom();
}

function resolveErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return '响应超时，请稍后重试';
  }
  const message = error instanceof Error ? error.message : '';
  if (/timeout|timed out|超时/i.test(message)) {
    return '响应超时，请稍后重试';
  }
  if (/Failed to fetch|NetworkError|network|fetch/i.test(message)) {
    return '网络异常，请检查后重试';
  }
  return message || '网络异常，请检查后重试';
}

async function consumeSseStream(
  response: Response,
  assistantId: string,
  signal: AbortSignal,
) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('智能客服未返回响应内容');
  }

  const decoder = new TextDecoder('utf8');
  let buffer = '';

  while (true) {
    if (signal.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    for (const line of lines) {
      const data = parseSsePayload(line);
      if (!data) {
        continue;
      }
      if (data === '[DONE]') {
        return;
      }
      const payload = JSON.parse(data);
      const delta = readDeltaText(payload);
      if (delta) {
        await appendAssistantTextTyping(assistantId, delta, signal);
      }
    }
  }
}

async function submitMessage(text: string, options: { appendUser: boolean }) {
  const content = text.trim();
  if (!content || loading.value) {
    return;
  }

  clearNotices();
  lastUserText.value = content;

  if (options.appendUser) {
    inputValue.value = '';
    const userMessage: ChatMessage = {
      avatar: userInfo.value?.avatar,
      content,
      createdAt: Date.now(),
      id: createId('user'),
      role: 'user',
      status: 'sent',
    };
    messages.value.push(userMessage);
  }

  const assistantMessage: ChatMessage = {
    content: '',
    createdAt: Date.now(),
    id: createId('assistant'),
    role: 'assistant',
    status: 'streaming',
  };

  messages.value.push(assistantMessage);
  saveMessages();
  scrollToBottom();

  loading.value = true;
  abortController = new AbortController();
  let didTimeout = false;
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    abortController?.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await requestSmartServiceStream({
      messages: toApiMessages(),
      signal: abortController.signal,
    });
    await consumeSseStream(
      response,
      assistantMessage.id,
      abortController.signal,
    );
    assistantMessage.status = 'sent';
    if (!assistantMessage.content.trim()) {
      assistantMessage.content = '暂时没有生成回复，请稍后重试。';
    }
    saveMessages();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (didTimeout) {
        assistantMessage.status = 'error';
        if (!assistantMessage.content.trim()) {
          messages.value = messages.value.filter(
            (item) => item.id !== assistantMessage.id,
          );
        }
        addNotice('响应超时，请稍后重试', '重试');
      } else {
        assistantMessage.status = 'sent';
        if (!assistantMessage.content.trim()) {
          assistantMessage.content = ASSISTANT_STOPPED_TEXT;
        }
      }
    } else {
      assistantMessage.status = 'error';
      if (!assistantMessage.content.trim()) {
        messages.value = messages.value.filter(
          (item) => item.id !== assistantMessage.id,
        );
      }
      addNotice(resolveErrorMessage(error), '重试');
    }
    saveMessages();
  } finally {
    window.clearTimeout(timeoutId);
    loading.value = false;
    abortController = null;
    inputRef.value?.focus();
    scrollToBottom();
  }
}

async function sendMessage(text: string) {
  await submitMessage(text, { appendUser: true });
}

function handleQuickQuestion(question: QuickQuestion) {
  inputValue.value = question.prompt || question.text;
  inputRef.value?.focus();
}

function retryLastMessage() {
  if (lastUserText.value) {
    void sendMessage(lastUserText.value);
  }
}

function stopGenerating() {
  abortController?.abort();
}

function clearConversation() {
  Modal.confirm({
    cancelText: '取消',
    centered: true,
    content: '清空后当前智能客服对话记录将无法恢复。',
    okText: '清空',
    onOk: () => {
      abortController?.abort();
      messages.value = [createWelcomeMessage()];
      clearNotices();
      saveMessages();
      scrollToBottom();
    },
    title: '清空对话',
  });
}

function handleVoiceInput() {
  antMessage.info('语音输入功能正在接入中');
}

onMounted(() => {
  loadMessages();
  scrollToBottom();
});
</script>

<template>
  <div class="smart-service-page">
    <div class="smart-service-ambient smart-service-ambient--one"></div>
    <div class="smart-service-ambient smart-service-ambient--two"></div>

    <header class="smart-service-header">
      <button type="button" @click="router.back()">
        <VbenIcon :icon="ChevronLeft" />
      </button>
      <div class="assistant-profile">
        <div class="assistant-avatar">
          <VbenIcon icon="mdi:robot-happy-outline" />
        </div>
        <div class="assistant-profile__text">
          <h1>智能客服</h1>
          <span>
            <i></i>
            {{ assistantStatusText }}
          </span>
        </div>
      </div>
      <Button size="small" type="link" @click="clearConversation">
        清空
      </Button>
    </header>

    <main ref="chatBodyRef" class="smart-service-body">
      <MessageList
        :loading="loading"
        :messages="messages"
        :notices="notices"
        :user-avatar="userInfo?.avatar"
        @retry="retryLastMessage"
      />
    </main>

    <footer class="smart-service-footer">
      <div class="smart-service-footer__inner">
        <QuickQuestions
          :disabled="loading"
          :questions="quickQuestions"
          @select="handleQuickQuestion"
        />
        <ChatInput
          ref="inputRef"
          v-model:value="inputValue"
          :loading="loading"
          @send="sendMessage"
          @stop="stopGenerating"
          @voice="handleVoiceInput"
        />
      </div>
    </footer>
  </div>
</template>

<style scoped>
.smart-service-page {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 12%, rgb(255 255 255 / 88%), transparent 22%),
    radial-gradient(circle at 86% 18%, rgb(162 236 255 / 58%), transparent 28%),
    linear-gradient(145deg, #f3e8ff 0%, #dfeeff 46%, #e9fbff 100%);
  isolation: isolate;
}

.smart-service-ambient {
  position: absolute;
  z-index: -1;
  pointer-events: none;
  filter: blur(10px);
  border-radius: 999px;
  opacity: 0.72;
}

.smart-service-ambient--one {
  top: 82px;
  right: -58px;
  width: 160px;
  height: 160px;
  background: radial-gradient(circle, rgb(99 102 241 / 35%), transparent 70%);
}

.smart-service-ambient--two {
  bottom: 128px;
  left: -70px;
  width: 190px;
  height: 190px;
  background: radial-gradient(circle, rgb(34 211 238 / 30%), transparent 68%);
}

.smart-service-header {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: 44px minmax(0, 1fr) 58px;
  align-items: center;
  min-height: 74px;
  padding: calc(env(safe-area-inset-top, 0px) + 8px) 12px 10px;
  background: rgb(255 255 255 / 42%);
  backdrop-filter: blur(18px);
  border-bottom: 1px solid rgb(255 255 255 / 50%);
  box-shadow: 0 16px 40px rgb(78 91 235 / 8%);
}

.smart-service-header button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  padding: 0;
  font-size: 22px;
  color: #334155;
  cursor: pointer;
  background: rgb(255 255 255 / 42%);
  border: 1px solid rgb(255 255 255 / 54%);
  border-radius: 50%;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 70%);
}

.assistant-profile {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.assistant-avatar {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  font-size: 25px;
  color: #fff;
  background:
    radial-gradient(circle at 32% 25%, rgb(255 255 255 / 78%), transparent 20%),
    linear-gradient(135deg, #7c65ff, #22d3ee);
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 16px;
  box-shadow: 0 16px 34px rgb(83 98 255 / 22%);
}

.assistant-avatar::after {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 12px;
  height: 12px;
  content: '';
  background: #3ee186;
  border: 2px solid rgb(255 255 255 / 88%);
  border-radius: 50%;
  box-shadow: 0 0 12px rgb(62 225 134 / 78%);
}

.assistant-profile__text {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.assistant-profile__text h1 {
  margin: 0;
  overflow: hidden;
  font-size: 18px;
  font-weight: 700;
  color: #1f2a44;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assistant-profile__text span {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  color: #61708f;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assistant-profile__text i {
  width: 6px;
  height: 6px;
  background: #31d982;
  border-radius: 50%;
  box-shadow: 0 0 10px rgb(49 217 130 / 80%);
}

.smart-service-header :deep(.ant-btn-link) {
  padding: 0 6px;
  font-weight: 600;
  color: #5261d8;
}

.smart-service-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.smart-service-footer {
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  padding: 8px 12px calc(24px + env(safe-area-inset-bottom, 0px));
  background: linear-gradient(180deg, transparent, rgb(240 247 255 / 74%) 20%);
}

.smart-service-footer__inner {
  display: grid;
  gap: 9px;
  max-width: 760px;
  margin: 0 auto;
}

@media (prefers-color-scheme: dark) {
  .smart-service-page {
    background:
      radial-gradient(
        circle at 82% 12%,
        rgb(56 189 248 / 18%),
        transparent 28%
      ),
      linear-gradient(145deg, #141322 0%, #101827 46%, #0f172a 100%);
  }

  .smart-service-header,
  .smart-service-footer {
    background: rgb(15 23 42 / 54%);
    border-color: rgb(255 255 255 / 10%);
  }

  .assistant-profile__text h1,
  .smart-service-header button {
    color: #e5e7eb;
  }

  .assistant-profile__text span {
    color: #b7c4da;
  }
}
</style>
