<script lang="ts" setup>
import type { AgentTask, AgentTaskStatus, AgentTaskStep } from '#/api/agent';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { JsonViewer, Page } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  message,
  Spin,
  Tag,
} from 'ant-design-vue';

import { getAgentTaskDetailApi } from '#/api/agent';
import AgentTaskSteps from '#/components/agent/AgentTaskSteps.vue';

defineOptions({ name: 'AgentTaskDetail' });

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const task = ref<AgentTask>();
const steps = ref<AgentTaskStep[]>([]);

const taskId = computed(() => {
  const value = route.query.id;
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }
  return String(value || '').trim();
});

const inputValue = computed(() => task.value?.input || {});
const planValue = computed(() => task.value?.plan || {});
const resultValue = computed(() => task.value?.result || {});

function getTaskStatusColor(status?: AgentTaskStatus) {
  const statusMap: Record<AgentTaskStatus, string> = {
    cancelled: 'default',
    failed: 'red',
    pending: 'default',
    running: 'processing',
    succeeded: 'green',
    waiting_approval: 'orange',
  };
  return status ? statusMap[status] || 'default' : 'default';
}

function getTaskStatusText(status?: AgentTaskStatus) {
  const statusMap: Record<AgentTaskStatus, string> = {
    cancelled: '已取消',
    failed: '失败',
    pending: '等待',
    running: '执行中',
    succeeded: '完成',
    waiting_approval: '待审批',
  };
  return status ? statusMap[status] || status : '-';
}

function formatOptionalTime(value?: null | string) {
  return value ? formatDateTime(value) : '-';
}

async function loadTaskDetail() {
  if (!taskId.value) {
    task.value = undefined;
    steps.value = [];
    return;
  }

  loading.value = true;
  try {
    const result = await getAgentTaskDetailApi(taskId.value);
    task.value = result.task;
    steps.value = result.steps;
  } catch (error) {
    console.error('load agent task detail failed:', error);
    message.error('Agent 任务详情加载失败');
  } finally {
    loading.value = false;
  }
}

function goBack() {
  void router.push({ name: 'AgentTaskCenter' });
}

watch(
  taskId,
  () => {
    void loadTaskDetail();
  },
  { immediate: false },
);

onMounted(() => {
  void loadTaskDetail();
});
</script>

<template>
  <Page auto-content-height title="Agent 任务详情">
    <div class="agent-task-detail">
      <div class="mb-3 flex items-center justify-between gap-3">
        <Button @click="goBack">返回任务中心</Button>
        <Button :disabled="!taskId" :loading="loading" @click="loadTaskDetail">
          刷新
        </Button>
      </div>

      <Empty v-if="!taskId" description="缺少任务 ID，请从任务中心进入详情" />

      <Spin v-else :spinning="loading">
        <div v-if="task" class="space-y-4">
          <Card size="small" title="任务概览">
            <Descriptions bordered :column="2" size="small">
              <Descriptions.Item label="任务ID">
                {{ task.id }}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag :color="getTaskStatusColor(task.status)">
                  {{ getTaskStatusText(task.status) }}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Agent">
                {{ task.agentCode }}
              </Descriptions.Item>
              <Descriptions.Item label="用户ID">
                {{ task.userId }}
              </Descriptions.Item>
              <Descriptions.Item label="来源模块">
                {{ task.sourceModule || '-' }}
              </Descriptions.Item>
              <Descriptions.Item label="来源页面">
                {{ task.sourcePage || '-' }}
              </Descriptions.Item>
              <Descriptions.Item label="当前步骤">
                {{ task.currentStepNo || '-' }}
              </Descriptions.Item>
              <Descriptions.Item label="园区ID">
                {{ task.parkId || '-' }}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {{ formatOptionalTime(task.createTime) }}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {{ formatOptionalTime(task.startedAt) }}
              </Descriptions.Item>
              <Descriptions.Item label="结束时间">
                {{ formatOptionalTime(task.finishedAt) }}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {{ formatOptionalTime(task.updateTime) }}
              </Descriptions.Item>
            </Descriptions>

            <Alert
              v-if="task.errorMessage"
              class="mt-3"
              :message="task.errorMessage"
              show-icon
              type="error"
            />
          </Card>

          <Card size="small" title="执行步骤">
            <AgentTaskSteps :steps="steps" :task="task" />
          </Card>

          <Card size="small" title="任务输入">
            <JsonViewer :value="inputValue" boxed copyable :expand-depth="2" />
          </Card>

          <Card size="small" title="执行计划">
            <JsonViewer :value="planValue" boxed copyable :expand-depth="3" />
          </Card>

          <Card size="small" title="执行结果">
            <JsonViewer :value="resultValue" boxed copyable :expand-depth="3" />
          </Card>
        </div>

        <Empty v-else description="未找到任务详情" />
      </Spin>
    </div>
  </Page>
</template>

<style lang="less" scoped>
.agent-task-detail {
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 16px;
}
</style>
