<script setup lang="ts">
import type {
  AgentTask,
  AgentTaskStep,
  AgentTaskStepStatus,
} from '#/api/agent';

import { computed } from 'vue';

import { VbenIcon } from '@vben/common-ui';

import { Tag } from 'ant-design-vue';

const props = withDefaults(
  defineProps<{
    compact?: boolean;
    steps?: AgentTaskStep[];
    task?: AgentTask;
  }>(),
  {
    compact: false,
    steps: () => [],
    task: undefined,
  },
);

const taskStatusText = computed(() => getTaskStatusText(props.task?.status));

function getStepStatusColor(status: AgentTaskStepStatus) {
  const statusMap: Record<AgentTaskStepStatus, string> = {
    failed: 'red',
    pending: 'default',
    running: 'processing',
    skipped: 'default',
    succeeded: 'green',
    waiting_approval: 'orange',
  };
  return statusMap[status] || 'default';
}

function getStepStatusText(status: AgentTaskStepStatus) {
  const statusMap: Record<AgentTaskStepStatus, string> = {
    failed: '失败',
    pending: '等待',
    running: '执行中',
    skipped: '跳过',
    succeeded: '完成',
    waiting_approval: '待审批',
  };
  return statusMap[status] || status;
}

function getTaskStatusColor(status?: string) {
  if (status === 'succeeded') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'waiting_approval') return 'orange';
  if (status === 'running') return 'processing';
  return 'default';
}

function getTaskStatusText(status?: string) {
  const statusMap: Record<string, string> = {
    cancelled: '已取消',
    failed: '失败',
    pending: '等待',
    running: '执行中',
    succeeded: '完成',
    waiting_approval: '待审批',
  };
  return status ? statusMap[status] || status : '未知';
}
</script>

<template>
  <div
    class="rounded-md border border-slate-200 bg-slate-50 p-3 text-left text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    :class="compact ? 'text-xs' : 'text-sm'"
  >
    <div
      v-if="task"
      class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      :class="compact ? 'text-xs' : 'text-sm'"
    >
      <div class="flex min-w-0 items-center gap-2">
        <VbenIcon icon="lucide:workflow" />
        <span class="truncate font-medium">任务 {{ task.id }}</span>
      </div>
      <Tag :color="getTaskStatusColor(task.status)">
        {{ taskStatusText }}
      </Tag>
    </div>

    <div v-if="steps.length > 0" class="space-y-2" :class="task ? 'mt-3' : ''">
      <div
        v-for="step in steps"
        :key="step.id"
        class="rounded border border-slate-200 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-900"
        :class="compact ? 'text-xs' : 'text-sm'"
      >
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-medium">
            {{ step.stepNo }}. {{ step.stepName }}
          </span>
          <Tag :color="getStepStatusColor(step.status)">
            {{ getStepStatusText(step.status) }}
          </Tag>
          <Tag v-if="step.skillName" :bordered="false">
            {{ step.skillName }}
          </Tag>
          <Tag v-if="step.requiresApproval" color="orange">需审批</Tag>
          <span
            v-if="step.durationMs"
            class="text-slate-500 dark:text-slate-400"
          >
            {{ step.durationMs }}ms
          </span>
        </div>
        <div
          v-if="step.errorMessage"
          class="mt-1 text-red-600 dark:text-red-300"
        >
          {{ step.errorMessage }}
        </div>
      </div>
    </div>

    <div v-else class="text-slate-500 dark:text-slate-400">暂无步骤记录</div>
  </div>
</template>
