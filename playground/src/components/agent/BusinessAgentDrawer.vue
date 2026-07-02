<script lang="ts" setup>
import type { AgentChatResponse } from '#/api/agent';

import { computed, ref, watch } from 'vue';

import { JsonViewer, VbenIcon } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Drawer,
  Input,
  message,
  Space,
  Tag,
} from 'ant-design-vue';

import { sendAgentChatApi } from '#/api/agent';

import AgentApprovalCard from './AgentApprovalCard.vue';
import AgentTaskSteps from './AgentTaskSteps.vue';

const props = withDefaults(
  defineProps<{
    agentId?: string;
    context?: Record<string, unknown>;
    defaultPrompt?: string;
    description?: string;
    model?: string;
    open?: boolean;
    quickPrompts?: string[];
    title?: string;
    width?: number | string;
  }>(),
  {
    agentId: 'operations',
    context: () => ({}),
    defaultPrompt: '',
    description: '',
    model: 'qwen3.5-plus',
    open: false,
    quickPrompts: () => [],
    title: 'Agent 助手',
    width: 640,
  },
);

const emit = defineEmits<{
  success: [result: AgentChatResponse];
  'update:open': [open: boolean];
}>();

const prompt = ref(props.defaultPrompt);
const loading = ref(false);
const errorText = ref('');
const response = ref<AgentChatResponse>();

const hasResult = computed(
  () =>
    Boolean(response.value?.reply) ||
    Boolean(response.value?.task) ||
    Boolean(response.value?.result),
);

const resultValue = computed(() => response.value?.result || {});

function normalizeErrorMessage(error: any) {
  const text = String(error?.message || error?.error || '');
  if (text.includes('ALIYUN_BAILIAN_KEY')) {
    return 'AI 服务未配置，请先配置 ALIYUN_BAILIAN_KEY';
  }
  if (text.toLowerCase().includes('timeout')) {
    return 'AI 回复超过等待时间，请稍后重试，或切换 qwen-turbo 后再发送';
  }
  return text || 'Agent 执行失败，请稍后重试';
}

function closeDrawer() {
  emit('update:open', false);
}

function useQuickPrompt(value: string) {
  prompt.value = value;
}

async function runAgent() {
  const content = prompt.value.trim();
  if (!content || loading.value) {
    return;
  }

  loading.value = true;
  errorText.value = '';
  try {
    const result = await sendAgentChatApi({
      agentId: props.agentId,
      context: props.context,
      messages: [{ content, role: 'user' }],
      model: props.model,
    });
    response.value = result;
    emit('success', result);
  } catch (error) {
    errorText.value = normalizeErrorMessage(error);
    message.error(errorText.value);
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.defaultPrompt,
  (value) => {
    if (!prompt.value.trim()) {
      prompt.value = value;
    }
  },
);

watch(
  () => props.open,
  (open) => {
    if (open && props.defaultPrompt && !prompt.value.trim()) {
      prompt.value = props.defaultPrompt;
    }
  },
);
</script>

<template>
  <Drawer
    :open="open"
    :title="title"
    :width="width"
    destroy-on-close
    @close="closeDrawer"
  >
    <div class="business-agent-drawer">
      <Alert
        v-if="description"
        class="mb-3"
        :message="description"
        show-icon
        type="info"
      />

      <div v-if="quickPrompts.length > 0" class="mb-3">
        <div class="mb-2 text-sm font-medium">快捷提示</div>
        <Space wrap>
          <Button
            v-for="item in quickPrompts"
            :key="item"
            size="small"
            @click="useQuickPrompt(item)"
          >
            {{ item }}
          </Button>
        </Space>
      </div>

      <Card size="small" title="任务输入">
        <Input.TextArea
          v-model:value="prompt"
          :auto-size="{ minRows: 4, maxRows: 8 }"
          :disabled="loading"
          placeholder="输入要交给 Agent 处理的问题"
        />
        <div class="mt-3 flex items-center justify-between gap-3">
          <Tag color="processing">{{ agentId }}</Tag>
          <Button
            type="primary"
            :disabled="!prompt.trim()"
            :loading="loading"
            @click="runAgent"
          >
            <template #icon>
              <VbenIcon icon="lucide:send-horizontal" />
            </template>
            执行
          </Button>
        </div>
      </Card>

      <Alert
        v-if="errorText"
        class="mt-3"
        :message="errorText"
        show-icon
        type="error"
      />

      <div v-if="hasResult" class="mt-3 space-y-3">
        <Card v-if="response?.reply" size="small" title="Agent 回复">
          <div class="agent-reply">{{ response.reply }}</div>
        </Card>

        <AgentApprovalCard
          v-if="response?.status === 'waiting_approval'"
          reason="当前任务进入待审批状态，审批服务接入后可在这里继续处理。"
        />

        <Card v-if="response?.task" size="small" title="执行步骤">
          <AgentTaskSteps :steps="response.steps || []" :task="response.task" />
        </Card>

        <Card v-if="response?.result" size="small" title="执行结果">
          <JsonViewer :value="resultValue" boxed copyable :expand-depth="3" />
        </Card>
      </div>
    </div>
  </Drawer>
</template>

<style lang="less" scoped>
.business-agent-drawer {
  min-height: 100%;
}

.agent-reply {
  color: var(--ant-color-text);
  line-height: 24px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
