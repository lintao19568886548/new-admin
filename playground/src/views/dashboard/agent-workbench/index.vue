<script lang="ts" setup>
import type { AgentChatMessage, AgentChatRole } from '#/api/agent';

import { computed, nextTick, onMounted, ref, watch } from 'vue';

import { VbenIcon } from '@vben/common-ui';

import { Button, Input, message, Select, Tag, Tooltip } from 'ant-design-vue';

import { sendAgentChatApi } from '#/api/agent';

interface AgentPreset {
  accentClass: string;
  description: string;
  icon: string;
  id: string;
  name: string;
  scope: string[];
}

interface ChatMessage extends AgentChatMessage {
  agentId?: string;
  createdAt: string;
  id: string;
  status?: 'failed' | 'sent';
  synthetic?: boolean;
}

interface PersistedAgentState {
  messages?: ChatMessage[];
  selectedAgentId?: string;
  selectedModel?: string;
}

const STORAGE_KEY = 'kanwei-agent-workbench-chat-v1';
const WELCOME_MESSAGE_ID = 'agent-welcome-message';

const agentPresets: AgentPreset[] = [
  {
    accentClass: 'text-cyan-600 bg-cyan-50 border-cyan-200',
    description: '园区经营、待办拆解、跨模块排查',
    icon: 'lucide:layout-dashboard',
    id: 'operations',
    name: '运营总控',
    scope: ['总台', '租赁', '账单', '门禁'],
  },
  {
    accentClass: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    description: '线索跟进、销售话术、客户归属',
    icon: 'lucide:users-round',
    id: 'crm',
    name: '获客销售',
    scope: ['获客推广', '招商', '客户跟进'],
  },
  {
    accentClass: 'text-amber-600 bg-amber-50 border-amber-200',
    description: '收费核对、催收节奏、财务异常',
    icon: 'lucide:receipt-text',
    id: 'bill',
    name: '账单财务',
    scope: ['账单', '收支', '催收'],
  },
  {
    accentClass: 'text-slate-600 bg-slate-50 border-slate-200',
    description: '巡检异常、维修闭环、现场处置',
    icon: 'lucide:wrench',
    id: 'maintenance',
    name: '巡检维护',
    scope: ['消防', '电梯', '厂房维护'],
  },
];

const modelOptions = [
  { label: 'qwen3.5-plus', value: 'qwen3.5-plus' },
  { label: 'qwen-plus', value: 'qwen-plus' },
  { label: 'qwen-turbo', value: 'qwen-turbo' },
  { label: 'qwen-long', value: 'qwen-long' },
];

const quickPrompts = [
  '帮我梳理今天园区运营最应该先看的事项',
  '生成一段客户跟进话术，语气自然一点',
  '账单催收怎么分层处理，给我一个执行清单',
  '巡检发现异常后，怎么安排闭环处理',
];

const selectedAgentId = ref('operations');
const selectedModel = ref('qwen3.5-plus');
const inputValue = ref('');
const loading = ref(false);
const errorText = ref('');
const messages = ref<ChatMessage[]>([]);
const messagePanelRef = ref<HTMLElement>();

const activeAgent = computed(
  () =>
    agentPresets.find((agent) => agent.id === selectedAgentId.value) ||
    agentPresets[0]!,
);

const userMessageCount = computed(
  () => messages.value.filter((item) => item.role === 'user').length,
);

const assistantMessageCount = computed(
  () =>
    messages.value.filter(
      (item) => item.role === 'assistant' && !item.synthetic,
    ).length,
);

const contextItems = computed(() => [
  { label: 'Agent', value: activeAgent.value.name },
  { label: '模型', value: selectedModel.value },
  { label: '用户消息', value: `${userMessageCount.value} 条` },
  { label: '回复记录', value: `${assistantMessageCount.value} 条` },
]);

const toolCards = computed(() => {
  const base = [
    {
      icon: 'lucide:clipboard-check',
      name: '任务拆解',
      text: '把目标拆成责任人、时间点和校验项。',
    },
    {
      icon: 'lucide:file-search',
      name: '问题排查',
      text: '按模块定位配置、权限、数据和流程问题。',
    },
    {
      icon: 'lucide:message-square-text',
      name: '话术生成',
      text: '生成面向客户、销售、财务的可用文案。',
    },
  ];

  if (selectedAgentId.value === 'crm') {
    return [
      {
        icon: 'lucide:phone-call',
        name: '跟进节奏',
        text: '围绕客户来源、销售归属和下一次触达安排。',
      },
      ...base.slice(1),
    ];
  }

  if (selectedAgentId.value === 'bill') {
    return [
      {
        icon: 'lucide:badge-dollar-sign',
        name: '催收策略',
        text: '按账龄、金额和客户状态分层处理。',
      },
      ...base.slice(0, 2),
    ];
  }

  return base;
});

function createMessage(
  role: AgentChatRole,
  content: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    agentId: selectedAgentId.value,
    content,
    createdAt: new Date().toISOString(),
    id:
      extra.id ||
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    status: 'sent',
    ...extra,
  };
}

function createWelcomeMessage() {
  return createMessage(
    'assistant',
    '我是 Agent 工作台。你可以直接把园区运营、获客、账单、维修巡检这些问题发给我，我会按当前上下文继续处理。',
    {
      id: WELCOME_MESSAGE_ID,
      synthetic: true,
    },
  );
}

function normalizePersistedMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): ChatMessage | null => {
      const role = (item as ChatMessage)?.role;
      const content = String((item as ChatMessage)?.content || '').trim();
      if (
        !content ||
        (role !== 'assistant' && role !== 'system' && role !== 'user')
      ) {
        return null;
      }
      return {
        agentId: String(
          (item as ChatMessage)?.agentId || selectedAgentId.value,
        ),
        content,
        createdAt:
          String((item as ChatMessage)?.createdAt || '') ||
          new Date().toISOString(),
        id:
          String((item as ChatMessage)?.id || '') ||
          `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role,
        status: (item as ChatMessage)?.status === 'failed' ? 'failed' : 'sent',
        synthetic: Boolean((item as ChatMessage)?.synthetic),
      } satisfies ChatMessage;
    })
    .filter((item): item is ChatMessage => item !== null)
    .slice(-80);
}

function loadPersistedState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    messages.value = [createWelcomeMessage()];
    return;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedAgentState;
    const agentExists = agentPresets.some(
      (item) => item.id === parsed.selectedAgentId,
    );
    selectedAgentId.value = agentExists
      ? String(parsed.selectedAgentId)
      : 'operations';

    const modelExists = modelOptions.some(
      (item) => item.value === parsed.selectedModel,
    );
    selectedModel.value = modelExists
      ? String(parsed.selectedModel)
      : 'qwen3.5-plus';

    const persistedMessages = normalizePersistedMessages(parsed.messages);
    messages.value =
      persistedMessages.length > 0
        ? persistedMessages
        : [createWelcomeMessage()];
  } catch (error) {
    console.error('Agent workspace state parse failed:', error);
    messages.value = [createWelcomeMessage()];
  }
}

function persistState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      messages: messages.value.slice(-80),
      selectedAgentId: selectedAgentId.value,
      selectedModel: selectedModel.value,
    }),
  );
}

function buildHistoryPayload(): AgentChatMessage[] {
  return messages.value
    .filter((item) => !item.synthetic && item.status !== 'failed')
    .map((item) => ({
      content: item.content,
      role: item.role,
    }))
    .slice(-16);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

function normalizeErrorMessage(error: any) {
  const text = String(error?.message || error?.error || '');
  if (text.includes('ALIYUN_BAILIAN_KEY')) {
    return 'AI服务未配置，请先配置 ALIYUN_BAILIAN_KEY';
  }
  if (text.toLowerCase().includes('timeout')) {
    return 'AI回复超过等待时间，请稍后重试，或切换 qwen-turbo 后再发送';
  }
  return text || 'Agent回复失败，请稍后重试';
}

async function scrollToBottom() {
  await nextTick();
  const panel = messagePanelRef.value;
  if (!panel) return;
  panel.scrollTop = panel.scrollHeight;
}

async function sendMessage(content = inputValue.value) {
  const text = content.trim();
  if (!text || loading.value) {
    return;
  }

  const userMessage = createMessage('user', text);
  messages.value.push(userMessage);
  inputValue.value = '';
  errorText.value = '';
  loading.value = true;
  await scrollToBottom();

  try {
    const result = await sendAgentChatApi({
      agentId: selectedAgentId.value,
      context: {
        agentName: activeAgent.value.name,
        scope: activeAgent.value.scope,
      },
      messages: buildHistoryPayload(),
      model: selectedModel.value,
    });

    messages.value.push(
      createMessage('assistant', result.reply || '没有生成有效回复。', {
        agentId: result.agentId,
      }),
    );
  } catch (error) {
    userMessage.status = 'failed';
    errorText.value = normalizeErrorMessage(error);
    message.error(errorText.value);
  } finally {
    loading.value = false;
    await scrollToBottom();
  }
}

function handleEnter(event: KeyboardEvent) {
  if (event.shiftKey) {
    return;
  }
  event.preventDefault();
  void sendMessage();
}

function startNewConversation() {
  messages.value = [createWelcomeMessage()];
  errorText.value = '';
  inputValue.value = '';
  persistState();
  void scrollToBottom();
}

function handleAgentChange(agentId: string) {
  selectedAgentId.value = agentId;
}

function usePrompt(prompt: string) {
  void sendMessage(prompt);
}

watch(
  [messages, selectedAgentId, selectedModel],
  () => {
    persistState();
  },
  { deep: true },
);

onMounted(() => {
  loadPersistedState();
  void scrollToBottom();
});
</script>

<template>
  <div
    class="min-h-full bg-slate-100 p-3 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
  >
    <div
      class="grid min-h-[680px] gap-3 lg:h-[calc(100vh-104px)] lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]"
    >
      <aside
        class="flex min-h-[220px] flex-col rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="border-b border-slate-200 p-4 dark:border-slate-800">
          <div class="flex items-center gap-2">
            <span
              class="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-600"
            >
              <VbenIcon icon="lucide:bot" class="text-xl" />
            </span>
            <div>
              <div class="text-base font-semibold">Agent工作台</div>
              <div class="text-xs text-slate-500">瞰维智管</div>
            </div>
          </div>
        </div>

        <div class="flex-1 space-y-2 overflow-y-auto p-3">
          <button
            v-for="agent in agentPresets"
            :key="agent.id"
            type="button"
            class="w-full rounded-lg border p-3 text-left transition hover:border-cyan-300 hover:bg-cyan-50/70 dark:hover:bg-slate-800"
            :class="
              selectedAgentId === agent.id
                ? agent.accentClass
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
            "
            @click="handleAgentChange(agent.id)"
          >
            <div class="flex items-center gap-2">
              <VbenIcon :icon="agent.icon" class="text-lg" />
              <span class="text-sm font-semibold">{{ agent.name }}</span>
            </div>
            <div
              class="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400"
            >
              {{ agent.description }}
            </div>
            <div class="mt-2 flex flex-wrap gap-1">
              <Tag v-for="scope in agent.scope" :key="scope" :bordered="false">
                {{ scope }}
              </Tag>
            </div>
          </button>
        </div>

        <div class="border-t border-slate-200 p-3 dark:border-slate-800">
          <Button block @click="startNewConversation">
            <template #icon>
              <VbenIcon icon="lucide:plus" />
            </template>
            新会话
          </Button>
        </div>
      </aside>

      <main
        class="flex min-h-[620px] flex-col rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      >
        <header
          class="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <VbenIcon
                :icon="activeAgent.icon"
                class="text-xl text-cyan-600"
              />
              <h1 class="m-0 truncate text-lg font-semibold">
                {{ activeAgent.name }}
              </h1>
            </div>
            <div class="mt-1 truncate text-sm text-slate-500">
              {{ activeAgent.description }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Select
              v-model:value="selectedModel"
              :options="modelOptions"
              class="w-[150px]"
              size="small"
            />
            <Tooltip title="清空当前会话">
              <Button size="small" @click="startNewConversation">
                <template #icon>
                  <VbenIcon icon="lucide:trash-2" />
                </template>
              </Button>
            </Tooltip>
          </div>
        </header>

        <section
          ref="messagePanelRef"
          class="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950/60"
        >
          <div
            v-for="item in messages"
            :key="item.id"
            class="flex"
            :class="item.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[86%] rounded-lg border px-3 py-2 shadow-sm sm:max-w-[78%]"
              :class="
                item.role === 'user'
                  ? 'border-cyan-600 bg-cyan-600 text-white'
                  : 'border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'
              "
            >
              <div class="mb-1 flex items-center gap-2 text-xs opacity-80">
                <VbenIcon
                  :icon="
                    item.role === 'user' ? 'lucide:user' : activeAgent.icon
                  "
                />
                <span>{{
                  item.role === 'user' ? '我' : activeAgent.name
                }}</span>
                <span>{{ formatTime(item.createdAt) }}</span>
                <Tag v-if="item.status === 'failed'" color="red">发送失败</Tag>
              </div>
              <div class="message-content text-sm leading-6">
                {{ item.content }}
              </div>
            </div>
          </div>

          <div v-if="loading" class="flex justify-start">
            <div
              class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <span class="inline-flex items-center gap-2">
                <VbenIcon icon="lucide:loader-circle" class="animate-spin" />
                正在处理
              </span>
            </div>
          </div>
        </section>

        <footer class="border-t border-slate-200 p-3 dark:border-slate-800">
          <div class="mb-3 flex gap-2 overflow-x-auto pb-1">
            <button
              v-for="prompt in quickPrompts"
              :key="prompt"
              type="button"
              class="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              :disabled="loading"
              @click="usePrompt(prompt)"
            >
              {{ prompt }}
            </button>
          </div>

          <div
            v-if="errorText"
            class="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {{ errorText }}
          </div>

          <div
            class="mb-2 text-xs leading-5 text-slate-500 dark:text-slate-400"
          >
            当前 Agent
            工作台先支持文字提问；图片、文件路径和截图解析需要后续接入上传和多模态接口。
          </div>

          <div class="flex items-end gap-2">
            <Input.TextArea
              v-model:value="inputValue"
              :auto-size="{ minRows: 1, maxRows: 4 }"
              :disabled="loading"
              placeholder="输入要处理的园区问题"
              @keydown.enter="handleEnter"
            />
            <Tooltip title="发送">
              <Button
                type="primary"
                :disabled="!inputValue.trim()"
                :loading="loading"
                @click="sendMessage()"
              >
                <template #icon>
                  <VbenIcon icon="lucide:send-horizontal" />
                </template>
              </Button>
            </Tooltip>
          </div>
        </footer>
      </main>

      <aside class="hidden min-h-[620px] flex-col gap-3 xl:flex">
        <section
          class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div class="mb-3 flex items-center gap-2 text-sm font-semibold">
            <VbenIcon icon="lucide:database" class="text-cyan-600" />
            当前上下文
          </div>
          <div class="space-y-2">
            <div
              v-for="item in contextItems"
              :key="item.label"
              class="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800"
            >
              <span class="text-slate-500">{{ item.label }}</span>
              <span class="font-medium">{{ item.value }}</span>
            </div>
          </div>
        </section>

        <section
          class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div class="mb-3 flex items-center gap-2 text-sm font-semibold">
            <VbenIcon icon="lucide:workflow" class="text-emerald-600" />
            常用能力
          </div>
          <div class="space-y-2">
            <div
              v-for="tool in toolCards"
              :key="tool.name"
              class="rounded-md border border-slate-200 p-3 dark:border-slate-800"
            >
              <div class="flex items-center gap-2 text-sm font-medium">
                <VbenIcon :icon="tool.icon" class="text-slate-600" />
                {{ tool.name }}
              </div>
              <div class="mt-1 text-xs leading-5 text-slate-500">
                {{ tool.text }}
              </div>
            </div>
          </div>
        </section>

        <section
          class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div class="mb-3 flex items-center gap-2 text-sm font-semibold">
            <VbenIcon icon="lucide:shield-check" class="text-amber-600" />
            运行状态
          </div>
          <div class="space-y-2 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-slate-500">密钥来源</span>
              <Tag color="green">后端系统密钥</Tag>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">上下文</span>
              <Tag color="blue">本地持久化</Tag>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">接口</span>
              <Tag color="processing">/agent/chat</Tag>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.message-content {
  word-break: break-word;
  white-space: pre-wrap;
}
</style>
