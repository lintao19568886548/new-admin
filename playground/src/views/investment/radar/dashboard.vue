<script lang="ts" setup>
import type { RadarLead } from './data';

import type { PublicOpportunityItem, RadarCollectTask } from '#/api/investment';

import { computed, h, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { useMediaQuery } from '@vueuse/core';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
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
const route = useRoute();
const isMobile = useMediaQuery('(max-width: 767px)');
const loading = ref(true);
const loadError = ref('');
const leads = ref<RadarLead[]>([]);
const opportunities = ref<PublicOpportunityItem[]>([]);
const latestTask = ref<null | RadarCollectTask>(null);
const leadTableScroll = computed(() =>
  isMobile.value ? { x: 640 } : undefined,
);

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
    customRender: ({ text }: { text?: string }) => getStageLabel(text),
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
      const label = getOpportunityTypeLabel(text);
      if (label !== '-') {
        return label;
      }
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
  let color = getPriorityColor(priorityLevel);
  if (priorityLevel === 'A') {
    color = 'red';
  } else if (priorityLevel === 'B') {
    color = 'orange';
  }
  return h(Tag, { color }, () => `${priorityLevel} 级`);
}

function getPriorityColor(priorityLevel?: null | string) {
  if (priorityLevel === 'A') {
    return 'red';
  }
  if (priorityLevel === 'B') {
    return 'orange';
  }
  return 'blue';
}

function getStageLabel(stage?: null | string) {
  if (!stage) {
    return '-';
  }
  return RADAR_STAGE_LABEL_MAP[stage] || stage;
}

function getOpportunityTypeLabel(type?: null | string) {
  if (type === 'DEMAND') {
    return '需求';
  }
  if (type === 'SUPPLY') {
    return '房源';
  }
  return '-';
}

function getOpportunityLocation(record: PublicOpportunityItem) {
  return [record.city, record.district].filter(Boolean).join(' / ') || '-';
}

function getOpportunityArea(record: PublicOpportunityItem) {
  return record.areaText || (record.areaSqm ? `${record.areaSqm}㎡` : '-');
}

function goToLeadDetail(leadId: number) {
  const detailBasePath = route.path.includes('/mobile-dashboard')
    ? '/investment/radar/mobile'
    : '/investment/radar';
  router.push(`${detailBasePath}/${leadId}`);
}

function getLeadRow(record: RadarLead) {
  return {
    onClick: () => goToLeadDetail(record.leadId),
  };
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
  router.push(
    route.path.includes('/mobile-dashboard')
      ? '/investment/radar/mobile'
      : '/investment/radar',
  );
}

function goToTasks() {
  router.push(
    route.path.includes('/mobile-dashboard')
      ? '/investment/radar/mobile-tasks'
      : '/investment/radar-tasks',
  );
}

onMounted(() => {
  void loadDashboard();
});
</script>

<template>
  <Page :auto-content-height="!isMobile">
    <div v-if="isMobile" class="radar-dashboard-mobile">
      <div class="radar-mobile-header">
        <div>
          <h2>招商看板</h2>
          <p>汇总潜客、触达进展与公开机会。</p>
        </div>
        <Button type="primary" :loading="loading" @click="loadDashboard">
          刷新
        </Button>
      </div>

      <div class="radar-mobile-actions">
        <Button block @click="goToRadarList">雷达列表</Button>
        <Button block @click="goToTasks">触达任务</Button>
      </div>

      <Alert v-if="loadError" :message="loadError" show-icon type="warning" />

      <template v-if="loading">
        <div class="radar-mobile-skeleton">
          <Skeleton active :paragraph="{ rows: 8 }" />
        </div>
      </template>

      <template v-else>
        <section class="radar-mobile-summary">
          <div>
            <span>线索总数</span>
            <strong>{{ summary.totalLeads }}</strong>
          </div>
          <div>
            <span>活跃线索</span>
            <strong>{{ summary.activeLeads }}</strong>
          </div>
          <div>
            <span>A级潜客</span>
            <strong>{{ summary.highPriority }}</strong>
          </div>
          <div>
            <span>跟进阶段</span>
            <strong>{{ summary.replied }}</strong>
          </div>
        </section>

        <section class="radar-mobile-panel">
          <div class="radar-mobile-section-title">最近同步状态</div>
          <div class="radar-mobile-status">
            <div>
              <span>任务状态</span>
              <Tag :color="latestTask?.status === 'SUCCESS' ? 'green' : 'blue'">
                {{ latestTaskStatusText }}
              </Tag>
            </div>
            <div>
              <span>新增线索</span>
              <strong>{{ latestTask?.created ?? '-' }}</strong>
            </div>
            <div>
              <span>更新线索</span>
              <strong>{{ latestTask?.updated ?? '-' }}</strong>
            </div>
            <div>
              <span>跳过数量</span>
              <strong>{{ latestTask?.skipped ?? '-' }}</strong>
            </div>
          </div>
          <p v-if="latestTask?.errorReason" class="radar-mobile-error">
            {{ latestTask.errorReason }}
          </p>
        </section>

        <section class="radar-mobile-panel">
          <div class="radar-mobile-section-title">优先潜客</div>
          <div v-if="leads.length > 0" class="radar-mobile-list">
            <button
              v-for="lead in leads"
              :key="lead.leadId"
              class="radar-mobile-card"
              type="button"
              @click="goToLeadDetail(lead.leadId)"
            >
              <div class="radar-mobile-card-head">
                <div>
                  <div class="radar-mobile-card-title">
                    {{ lead.enterpriseName || '-' }}
                  </div>
                  <div class="radar-mobile-card-subtitle">
                    {{ lead.parkName || '-' }}
                  </div>
                </div>
                <Tag :color="getPriorityColor(lead.priorityLevel)">
                  {{ lead.priorityLevel || '-' }}级
                </Tag>
              </div>
              <div class="radar-mobile-card-meta">
                <span>阶段：{{ getStageLabel(lead.stage) }}</span>
                <span>总分：{{ lead.totalScore ?? '-' }}</span>
                <span>信号：{{ lead.latestSignalType || '-' }}</span>
              </div>
            </button>
          </div>
          <Empty v-else description="暂无优先潜客" />
        </section>

        <section class="radar-mobile-panel">
          <div class="radar-mobile-section-title">最新公开机会</div>
          <div v-if="opportunities.length > 0" class="radar-mobile-list">
            <article
              v-for="item in opportunities"
              :key="item.opportunityId"
              class="radar-mobile-card"
            >
              <div class="radar-mobile-card-head">
                <div>
                  <div class="radar-mobile-card-title">
                    {{ item.title || '-' }}
                  </div>
                  <div class="radar-mobile-card-subtitle">
                    {{ getOpportunityLocation(item) }}
                  </div>
                </div>
                <Tag color="blue">
                  {{ getOpportunityTypeLabel(item.opportunityType) }}
                </Tag>
              </div>
              <div class="radar-mobile-card-meta">
                <span>面积：{{ getOpportunityArea(item) }}</span>
                <span>分数：{{ item.score ?? '-' }}</span>
                <span>来源：{{ item.sourceSite || '-' }}</span>
              </div>
            </article>
          </div>
          <Empty v-else description="暂无公开机会" />
        </section>
      </template>
    </div>

    <div v-else class="radar-dashboard space-y-4">
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
                :custom-row="getLeadRow"
                :data-source="leads"
                :pagination="false"
                row-key="leadId"
                :scroll="leadTableScroll"
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

<style scoped>
.radar-dashboard-mobile {
  box-sizing: border-box;
  min-height: 100%;
  padding: 10px 8px calc(88px + env(safe-area-inset-bottom));
  background: #f0f2f5;
}

.dark .radar-dashboard-mobile {
  background: #1a1a1a;
}

.radar-mobile-header,
.radar-mobile-panel,
.radar-mobile-skeleton {
  background: var(--ant-color-bg-container);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.radar-mobile-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px;
  margin-bottom: 8px;
}

.radar-mobile-header h2 {
  margin: 0;
  color: var(--ant-color-text);
  font-size: 18px;
  font-weight: 700;
  line-height: 26px;
}

.radar-mobile-header p {
  margin: 2px 0 0;
  color: var(--ant-color-text-secondary);
  font-size: 13px;
  line-height: 20px;
}

.radar-mobile-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.radar-mobile-skeleton {
  padding: 12px;
}

.radar-mobile-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 8px 0;
}

.radar-mobile-summary > div {
  padding: 12px;
  background: var(--ant-color-bg-container);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.radar-mobile-summary span,
.radar-mobile-status span {
  display: block;
  color: var(--ant-color-text-secondary);
  font-size: 12px;
  line-height: 18px;
}

.radar-mobile-summary strong {
  display: block;
  margin-top: 4px;
  color: var(--ant-color-text);
  font-size: 22px;
  line-height: 28px;
}

.radar-mobile-panel {
  padding: 12px;
  margin-top: 8px;
}

.radar-mobile-section-title {
  margin-bottom: 10px;
  color: var(--ant-color-text);
  font-size: 15px;
  font-weight: 700;
  line-height: 22px;
}

.radar-mobile-status {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.radar-mobile-status strong {
  color: var(--ant-color-text);
  font-size: 15px;
  line-height: 22px;
}

.radar-mobile-error {
  margin: 10px 0 0;
  color: var(--ant-color-error);
  font-size: 13px;
  line-height: 20px;
  word-break: break-word;
}

.radar-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.radar-mobile-card {
  display: block;
  width: 100%;
  padding: 12px;
  color: inherit;
  text-align: left;
  background: var(--ant-color-fill-tertiary);
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 8px;
}

button.radar-mobile-card {
  cursor: pointer;
}

.radar-mobile-card-head {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
}

.radar-mobile-card-title {
  color: var(--ant-color-text);
  font-size: 15px;
  font-weight: 700;
  line-height: 22px;
  word-break: break-word;
}

.radar-mobile-card-subtitle {
  margin-top: 2px;
  color: var(--ant-color-text-secondary);
  font-size: 12px;
  line-height: 18px;
}

.radar-mobile-card-meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 4px;
  margin-top: 10px;
  color: var(--ant-color-text-secondary);
  font-size: 13px;
  line-height: 20px;
}
</style>
