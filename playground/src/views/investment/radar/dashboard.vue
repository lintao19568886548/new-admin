<script lang="ts" setup>
import type { RadarLead } from './data';

import type { PublicOpportunityItem, RadarCollectTask } from '#/api/investment';

import { computed, h, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  getEffectivePublicOpportunityList,
  getRadarCollectTask,
  getRadarLeadList,
} from '#/api/investment';

import { RADAR_STAGE_LABEL_MAP } from './data';

defineOptions({ name: 'InvestmentRadarDashboard' });

const router = useRouter();
const loading = ref(true);
const loadError = ref('');
const leads = ref<RadarLead[]>([]);
const opportunities = ref<PublicOpportunityItem[]>([]);
const latestTask = ref<null | RadarCollectTask>(null);

const summary = computed(() => {
  const leadItems = leads.value;
  return {
    activeLeads: leadItems.filter((item) => item.stage !== 'INVALID').length,
    highPriority: leadItems.filter((item) => item.priorityLevel === 'A').length,
    replied: leadItems.filter((item) =>
      ['CONTACTED', 'DEAL', 'REPLIED', 'VISIT'].includes(item.stage),
    ).length,
    totalLeads: leadItems.length,
  };
});

const latestTaskStatusText = computed(() => {
  const status = latestTask.value?.status;
  if (!status) {
    return '暂无';
  }
  return (
    {
      FAILED: '失败',
      PENDING: '处理中',
      RUNNING: '处理中',
      SUCCESS: '成功',
    }[status] || status
  );
});

const leadColumns = [
  {
    customRender: ({ text }: { text?: string }) =>
      text ? hPriorityTag(text) : '-',
    dataIndex: 'enterpriseName',
    key: 'enterpriseName',
    title: '企业名称',
  },
  {
    dataIndex: 'parkName',
    key: 'parkName',
    title: '园区',
  },
  {
    customRender: ({ text }: { text?: string }) =>
      text ? hPriorityTag(text) : '-',
    dataIndex: 'priorityLevel',
    key: 'priorityLevel',
    title: '优先级',
  },
  {
    customRender: ({ text }: { text?: string }) =>
      text ? RADAR_STAGE_LABEL_MAP[text] || text : '-',
    dataIndex: 'stage',
    key: 'stage',
    title: '阶段',
  },
  {
    dataIndex: 'totalScore',
    key: 'totalScore',
    title: '总分',
  },
];

const opportunityColumns = [
  {
    dataIndex: 'title',
    ellipsis: true,
    key: 'title',
    title: '标题',
  },
  {
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      [record.city, record.district].filter(Boolean).join(' / ') || '-',
    dataIndex: 'city',
    key: 'city',
    title: '城市',
  },
  {
    customRender: ({ text }: { text?: string }) => {
      if (text === 'DEMAND') {
        return '需求';
      }
      if (text === 'SUPPLY') {
        return '房源';
      }
      return '-';
    },
    dataIndex: 'opportunityType',
    key: 'opportunityType',
    title: '类型',
  },
  {
    customRender: ({ text }: { text?: null | number }) => text ?? '-',
    dataIndex: 'score',
    key: 'score',
    title: '分数',
  },
];

function hPriorityTag(priorityLevel: string) {
  let color = 'blue';
  if (priorityLevel === 'A') {
    color = 'red';
  } else if (priorityLevel === 'B') {
    color = 'orange';
  }
  return h(Tag, { color }, () => `${priorityLevel} 级`);
}

async function loadDashboard() {
  loading.value = true;
  loadError.value = '';
  try {
    const [leadResult, opportunityResult] = await Promise.all([
      getRadarLeadList({
        currentPage: 1,
        pageSize: 8,
      }),
      getEffectivePublicOpportunityList({
        currentPage: 1,
        pageSize: 6,
      }),
    ]);

    leads.value = Array.isArray(leadResult.items) ? leadResult.items : [];
    opportunities.value = Array.isArray(opportunityResult.items)
      ? opportunityResult.items
      : [];

    const possibleTaskId = window.sessionStorage.getItem(
      'latest_radar_task_id',
    );
    if (possibleTaskId) {
      try {
        latestTask.value = await getRadarCollectTask(possibleTaskId);
      } catch {
        latestTask.value = null;
      }
    }
  } catch (error) {
    console.error('加载招商看板失败:', error);
    loadError.value = '看板数据加载失败，请检查雷达相关接口是否已接入。';
  } finally {
    loading.value = false;
  }
}

function goToRadarList() {
  router.push('/investment/radar');
}

function goToTasks() {
  router.push('/investment/radar-tasks');
}

onMounted(() => {
  void loadDashboard();
});
</script>

<template>
  <Page auto-content-height>
    <div class="radar-dashboard space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-lg font-semibold">招商看板</div>
          <div class="text-text-secondary text-sm">
            汇总招商线索、触达进展与公开机会，辅助判断当前招商跟进重点。
          </div>
        </div>
        <Space>
          <Button @click="goToRadarList">返回雷达列表</Button>
          <Button @click="goToTasks">触达任务</Button>
          <Button type="primary" @click="loadDashboard">刷新数据</Button>
        </Space>
      </div>

      <Alert v-if="loadError" :message="loadError" show-icon type="warning" />

      <template v-if="loading">
        <Row :gutter="[16, 16]">
          <Col v-for="item in 4" :key="item" :lg="6" :md="12" :sm="12" :xs="24">
            <Card>
              <Skeleton active :paragraph="{ rows: 1 }" />
            </Card>
          </Col>
        </Row>
      </template>

      <template v-else>
        <Row :gutter="[16, 16]">
          <Col :lg="6" :md="12" :sm="12" :xs="24">
            <Card>
              <Statistic title="线索总数" :value="summary.totalLeads" />
            </Card>
          </Col>
          <Col :lg="6" :md="12" :sm="12" :xs="24">
            <Card>
              <Statistic title="活跃线索" :value="summary.activeLeads" />
            </Card>
          </Col>
          <Col :lg="6" :md="12" :sm="12" :xs="24">
            <Card>
              <Statistic title="A级优先潜客" :value="summary.highPriority" />
            </Card>
          </Col>
          <Col :lg="6" :md="12" :sm="12" :xs="24">
            <Card>
              <Statistic title="已进入跟进阶段" :value="summary.replied" />
            </Card>
          </Col>
        </Row>

        <Row :gutter="[16, 16]">
          <Col :lg="14" :md="24" :sm="24" :xs="24">
            <Card title="优先潜客列表">
              <Table
                :columns="leadColumns"
                :data-source="leads"
                :pagination="false"
                row-key="leadId"
                size="small"
              />
            </Card>
          </Col>

          <Col :lg="10" :md="24" :sm="24" :xs="24">
            <Card title="最近同步状态">
              <div class="space-y-3 text-sm">
                <div class="flex items-center justify-between">
                  <span class="text-text-secondary">任务状态</span>
                  <Tag
                    :color="latestTask?.status === 'SUCCESS' ? 'green' : 'blue'"
                  >
                    {{ latestTaskStatusText }}
                  </Tag>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-text-secondary">新增线索</span>
                  <span>{{ latestTask?.created ?? '-' }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-text-secondary">更新线索</span>
                  <span>{{ latestTask?.updated ?? '-' }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-text-secondary">跳过数量</span>
                  <span>{{ latestTask?.skipped ?? '-' }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-text-secondary">错误原因</span>
                  <span class="max-w-[220px] truncate">
                    {{ latestTask?.errorReason || '-' }}
                  </span>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        <Card title="最新公开机会列表">
          <Table
            :columns="opportunityColumns"
            :data-source="opportunities"
            :pagination="false"
            row-key="opportunityId"
            size="small"
          />
        </Card>
      </template>
    </div>
  </Page>
</template>
