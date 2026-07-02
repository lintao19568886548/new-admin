<script lang="ts" setup>
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type { AgentTask, AgentTaskStatus } from '#/api/agent';

import { h, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import {
  Button,
  Card,
  message,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import { getAgentTaskListApi } from '#/api/agent';

defineOptions({ name: 'AgentTaskCenter' });

const router = useRouter();

const loading = ref(false);
const tasks = ref<AgentTask[]>([]);
const statusFilter = ref<AgentTaskStatus | undefined>();
const pagination = reactive<TablePaginationConfig>({
  current: 1,
  pageSize: 20,
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 条`,
  total: 0,
});

const tableLocale = {
  emptyText: '暂无 Agent 任务',
};

const statusOptions: Array<{ label: string; value: AgentTaskStatus }> = [
  { label: '等待', value: 'pending' },
  { label: '执行中', value: 'running' },
  { label: '完成', value: 'succeeded' },
  { label: '失败', value: 'failed' },
  { label: '待审批', value: 'waiting_approval' },
  { label: '已取消', value: 'cancelled' },
];

function getTaskStatusColor(status: AgentTaskStatus) {
  const statusMap: Record<AgentTaskStatus, string> = {
    cancelled: 'default',
    failed: 'red',
    pending: 'default',
    running: 'processing',
    succeeded: 'green',
    waiting_approval: 'orange',
  };
  return statusMap[status] || 'default';
}

function getTaskStatusText(status: AgentTaskStatus) {
  const statusMap: Record<AgentTaskStatus, string> = {
    cancelled: '已取消',
    failed: '失败',
    pending: '等待',
    running: '执行中',
    succeeded: '完成',
    waiting_approval: '待审批',
  };
  return statusMap[status] || status;
}

function formatOptionalTime(value?: null | string) {
  return value ? formatDateTime(value) : '-';
}

function formatShortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

function openDetail(taskId: string) {
  void router.push({
    name: 'AgentTaskDetail',
    query: { id: taskId },
  });
}

async function loadTasks() {
  loading.value = true;
  try {
    const result = await getAgentTaskListApi({
      currentPage: pagination.current || 1,
      pageSize: pagination.pageSize || 20,
      status: statusFilter.value,
    });
    tasks.value = result.items;
    pagination.total = result.total;
  } catch (error) {
    console.error('load agent tasks failed:', error);
    message.error('Agent 任务加载失败');
  } finally {
    loading.value = false;
  }
}

function handleStatusChange() {
  pagination.current = 1;
  void loadTasks();
}

function handleTableChange(page: TablePaginationConfig) {
  pagination.current = page.current || 1;
  pagination.pageSize = page.pageSize || 20;
  void loadTasks();
}

const columns: TableColumnsType<AgentTask> = [
  {
    customRender: ({ record }) =>
      h(
        Button,
        {
          onClick: () => openDetail(record.id),
          size: 'small',
          type: 'link',
        },
        () => formatShortId(record.id),
      ),
    dataIndex: 'id',
    key: 'id',
    title: '任务ID',
    width: 130,
  },
  {
    customRender: ({ record }) =>
      h(Tag, { color: getTaskStatusColor(record.status) }, () =>
        getTaskStatusText(record.status),
      ),
    dataIndex: 'status',
    key: 'status',
    title: '状态',
    width: 100,
  },
  {
    dataIndex: 'agentCode',
    key: 'agentCode',
    title: 'Agent',
    width: 140,
  },
  {
    customRender: ({ record }) => record.sourceModule || '-',
    dataIndex: 'sourceModule',
    key: 'sourceModule',
    title: '来源模块',
    width: 120,
  },
  {
    customRender: ({ record }) => record.sourcePage || '-',
    dataIndex: 'sourcePage',
    key: 'sourcePage',
    title: '来源页面',
    width: 140,
  },
  {
    customRender: ({ record }) => record.currentStepNo || '-',
    dataIndex: 'currentStepNo',
    key: 'currentStepNo',
    title: '当前步骤',
    width: 100,
  },
  {
    customRender: ({ record }) => record.errorMessage || '-',
    dataIndex: 'errorMessage',
    ellipsis: true,
    key: 'errorMessage',
    title: '错误信息',
    width: 220,
  },
  {
    customRender: ({ record }) => formatOptionalTime(record.createTime),
    dataIndex: 'createTime',
    key: 'createTime',
    title: '创建时间',
    width: 170,
  },
  {
    customRender: ({ record }) => formatOptionalTime(record.finishedAt),
    dataIndex: 'finishedAt',
    key: 'finishedAt',
    title: '结束时间',
    width: 170,
  },
  {
    customRender: ({ record }) =>
      h(
        Button,
        {
          onClick: () => openDetail(record.id),
          size: 'small',
          type: 'link',
        },
        () => '查看',
      ),
    fixed: 'right',
    key: 'operation',
    title: '操作',
    width: 90,
  },
];

onMounted(() => {
  void loadTasks();
});
</script>

<template>
  <Page auto-content-height title="Agent 任务中心">
    <div class="agent-task-center">
      <Card class="agent-task-toolbar" size="small">
        <Space wrap>
          <Select
            v-model:value="statusFilter"
            allow-clear
            class="w-[180px]"
            placeholder="全部状态"
            :options="statusOptions"
            @change="handleStatusChange"
          />
          <Button :loading="loading" @click="loadTasks">刷新</Button>
        </Space>
      </Card>

      <Card class="agent-task-table-card" size="small" title="任务列表">
        <Table
          bordered
          :columns="columns"
          :data-source="tasks"
          :loading="loading"
          :locale="tableLocale"
          :pagination="pagination"
          row-key="id"
          :scroll="{ x: 1360 }"
          size="small"
          @change="handleTableChange"
        />
      </Card>
    </div>
  </Page>
</template>

<style lang="less" scoped>
.agent-task-center {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: auto;
  padding: 16px;
}

.agent-task-toolbar {
  margin-bottom: 12px;
  flex: none;
}

.agent-task-table-card {
  flex: none;
}

:deep(.ant-table-thead > tr > th) {
  color: var(--ant-color-text);
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  vertical-align: middle;
}

:deep(.ant-table-tbody > tr > td) {
  color: var(--ant-color-text);
  font-size: 14px;
  line-height: 22px;
  text-align: center;
  vertical-align: middle;
}
</style>
