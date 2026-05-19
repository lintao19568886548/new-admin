<script lang="ts" setup>
import type { RadarLead } from './data';

import type {
  PublicOpportunityItem,
  RadarLeadImportFailItem,
} from '#/api/investment';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Search } from '@vben/icons';

import {
  Alert,
  Upload as AUpload,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Pagination,
  Row,
  Select,
  Spin,
  Tabs,
  Tag,
} from 'ant-design-vue';

import {
  getEffectivePublicOpportunityList,
  getPublicOpportunityDetail,
  getRadarCollectTask,
  getRadarLeadList,
  importRadarLeads,
  importRadarLeadsFile,
  runRadarCollect,
} from '#/api/investment';

import { RADAR_STAGE_OPTIONS } from './data';
import {
  formatArea,
  formatDateOnly,
  formatTime,
  getOpportunityTypeMeta,
  getPriorityColor,
  getStageLabel,
  priorityOptions,
} from './mobile-utils';
import OpportunityDetailDrawer from './opportunity-detail-drawer.vue';

defineOptions({ name: 'InvestmentRadarMobileList' });

const router = useRouter();
const activeTab = ref<'leads' | 'opportunities'>('leads');
const leadLoading = ref(false);
const opportunityLoading = ref(false);
const loadError = ref('');
const leads = ref<RadarLead[]>([]);
const opportunities = ref<PublicOpportunityItem[]>([]);
const opportunityLoaded = ref(false);
const opportunityDetailLoading = ref(false);
const opportunityDetailOpen = ref(false);
const currentOpportunity = ref<null | PublicOpportunityItem>(null);
const collectRunning = ref(false);
const collectText = ref('');
const importModalOpen = ref(false);
const importModalMode = ref<'json' | 'result'>('json');
const importJsonText = ref('');
const importing = ref(false);
const importFailItems = ref<RadarLeadImportFailItem[]>([]);
const leadFilterOpen = ref(false);
const opportunityFilterOpen = ref(false);
let collectTimer: number | undefined;

const leadSearch = reactive({
  keyword: '',
  priorityLevel: undefined as string | undefined,
  stage: undefined as string | undefined,
});

const opportunitySearch = reactive({
  city: '',
  keyword: '',
  opportunityType: '',
  sourceSite: '',
});

const leadPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const opportunityPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const opportunityTypeOptions = [
  { label: '全部机会', value: '' },
  { label: '需求', value: 'DEMAND' },
  { label: '房源', value: 'SUPPLY' },
];
const importPlaceholder =
  '请输入 JSON 数组，例如：[{"enterpriseName":"某企业","phoneNumber":"13800138000","parkId":1}]';
const csvTemplateHeaders = [
  'enterpriseName',
  'phoneNumber',
  'contactName',
  'parkId',
  'intentArea',
  'address',
  'sourceKey',
];

const leadTotalText = computed(() => formatCount(leadPagination.total));
const opportunityTotalText = computed(() =>
  opportunityLoaded.value ? formatCount(opportunityPagination.total) : '未加载',
);
const leadPageText = computed(() =>
  formatPageSummary(
    leadPagination.current,
    leadPagination.pageSize,
    leadPagination.total,
    leads.value.length,
  ),
);
const opportunityPageText = computed(() =>
  opportunityLoaded.value
    ? formatPageSummary(
        opportunityPagination.current,
        opportunityPagination.pageSize,
        opportunityPagination.total,
        opportunities.value.length,
      )
    : '切换后加载',
);
function goToDashboard() {
  router.push('/investment/radar/mobile-dashboard');
}

function goToTasks() {
  router.push('/investment/radar/mobile-tasks');
}

function goToLeadDetail(leadId: number) {
  router.push(`/investment/radar/mobile/${leadId}`);
}

function showLeads() {
  activeTab.value = 'leads';
}

function showOpportunities() {
  activeTab.value = 'opportunities';
  if (!opportunityLoaded.value || opportunities.value.length === 0) {
    void loadOpportunities();
  }
}

function resolveLeadTotal(result: {
  items?: unknown[];
  page?: { total?: number };
  total?: number;
}) {
  return Number(
    result.total ?? result.page?.total ?? result.items?.length ?? 0,
  );
}

function formatCount(value: number) {
  return Number(value || 0).toLocaleString('zh-CN');
}

function formatPageSummary(
  current: number,
  pageSize: number,
  total: number,
  currentCount: number,
) {
  if (total <= 0 && currentCount <= 0) {
    return '暂无数据';
  }

  const start = (current - 1) * pageSize + 1;
  const end =
    total > 0 ? Math.min(current * pageSize, total) : start + currentCount - 1;
  return `第 ${formatCount(start)}-${formatCount(end)} 条`;
}

function escapeCsvCell(value: unknown) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csvText = rows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\n');
  const blob = new Blob([`\uFEFF${csvText}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadImportTemplate() {
  downloadCsv('智能招商雷达导入模板.csv', [
    csvTemplateHeaders,
    [
      '示例企业',
      '13800138000',
      '张经理',
      '14',
      '800',
      '示例地址',
      'manual-demo-001',
    ],
  ]);
}

function downloadFailItems() {
  if (importFailItems.value.length === 0) {
    message.warning('暂无失败项可导出');
    return;
  }

  downloadCsv('智能招商雷达导入失败项.csv', [
    ['rowNumber', 'enterpriseName', 'error', 'rawData'],
    ...importFailItems.value.map((item) => [
      item.rowNumber ?? (Number(item.index) || 0) + 1,
      item.enterpriseName || item.rawData?.enterpriseName || '',
      item.error,
      JSON.stringify(item.rawData || {}),
    ]),
  ]);
}

function openImportModal() {
  importModalMode.value = 'json';
  importFailItems.value = [];
  importModalOpen.value = true;
}

function handleImportModalOk() {
  if (importModalMode.value === 'result') {
    importModalOpen.value = false;
    return;
  }
  void submitImportJson();
}

function handleImportSuccess(success: number) {
  message.success(
    `导入完成，成功 ${success} 条，失败 ${importFailItems.value.length} 条`,
  );
  activeTab.value = 'leads';
  leadPagination.current = 1;
  void loadLeads();

  if (importFailItems.value.length > 0) {
    importModalMode.value = 'result';
    importModalOpen.value = true;
    return;
  }

  importModalOpen.value = false;
  importJsonText.value = '';
}

async function submitImportJson() {
  const raw = importJsonText.value.trim();
  if (!raw) {
    message.warning('请输入 JSON 数组');
    return;
  }

  let items: unknown;
  try {
    const parsed = JSON.parse(raw) as unknown[] | { items?: unknown };
    items = Array.isArray(parsed) ? parsed : parsed.items;
  } catch {
    message.error('JSON 格式不正确');
    return;
  }

  if (!Array.isArray(items)) {
    message.error('导入内容必须是数组或 { items: [] }');
    return;
  }

  importing.value = true;
  try {
    const result = await importRadarLeads({
      items: items as Record<string, unknown>[],
    });
    importFailItems.value = result.failItems || [];
    handleImportSuccess(result.success);
  } catch (error) {
    console.error('移动端导入智能招商潜客失败:', error);
    message.error('导入智能招商潜客失败');
  } finally {
    importing.value = false;
  }
}

async function handleImportFileBeforeUpload(file: File) {
  importing.value = true;
  try {
    const formData = new FormData();
    formData.append('file', file);
    const result = await importRadarLeadsFile(formData);
    importFailItems.value = result.failItems || [];
    handleImportSuccess(result.success);
  } catch (error) {
    console.error('移动端上传导入潜客文件失败:', error);
    message.error('上传导入潜客文件失败');
  } finally {
    importing.value = false;
  }

  return false;
}

async function loadLeads() {
  leadLoading.value = true;
  loadError.value = '';
  try {
    const result = await getRadarLeadList({
      currentPage: leadPagination.current,
      keyword: leadSearch.keyword || undefined,
      pageSize: leadPagination.pageSize,
      priorityLevel: leadSearch.priorityLevel,
      stage: leadSearch.stage,
    });
    leads.value = Array.isArray(result.items) ? result.items : [];
    leadPagination.total = resolveLeadTotal(result);
  } catch (error) {
    console.error('加载移动端雷达线索失败:', error);
    leads.value = [];
    leadPagination.total = 0;
    loadError.value = '雷达线索加载失败，请稍后重试。';
  } finally {
    leadLoading.value = false;
  }
}

async function loadOpportunities() {
  opportunityLoading.value = true;
  loadError.value = '';
  try {
    const result = await getEffectivePublicOpportunityList({
      city: opportunitySearch.city || undefined,
      currentPage: opportunityPagination.current,
      keyword: opportunitySearch.keyword || undefined,
      opportunityType: opportunitySearch.opportunityType || undefined,
      pageSize: opportunityPagination.pageSize,
      sourceSite: opportunitySearch.sourceSite || undefined,
    });
    opportunities.value = Array.isArray(result.items) ? result.items : [];
    opportunityPagination.total = resolveLeadTotal(result);
  } catch (error) {
    console.error('加载移动端公开机会失败:', error);
    opportunities.value = [];
    opportunityPagination.total = 0;
    loadError.value = '公开机会加载失败，请稍后重试。';
  } finally {
    opportunityLoaded.value = true;
    opportunityLoading.value = false;
  }
}

function searchLeads() {
  leadPagination.current = 1;
  leadFilterOpen.value = false;
  void loadLeads();
}

function resetLeads() {
  leadSearch.keyword = '';
  leadSearch.priorityLevel = undefined;
  leadSearch.stage = undefined;
  leadFilterOpen.value = false;
  searchLeads();
}

function searchOpportunities() {
  opportunityPagination.current = 1;
  opportunityFilterOpen.value = false;
  void loadOpportunities();
}

function resetOpportunities() {
  opportunitySearch.city = '';
  opportunitySearch.keyword = '';
  opportunitySearch.opportunityType = '';
  opportunitySearch.sourceSite = '';
  opportunityFilterOpen.value = false;
  searchOpportunities();
}

function onLeadPageChange(page: number, pageSize: number) {
  leadPagination.current = page;
  leadPagination.pageSize = pageSize;
  void loadLeads();
}

function onOpportunityPageChange(page: number, pageSize: number) {
  opportunityPagination.current = page;
  opportunityPagination.pageSize = pageSize;
  void loadOpportunities();
}

async function openOpportunityDetail(record: PublicOpportunityItem) {
  opportunityDetailOpen.value = true;
  opportunityDetailLoading.value = true;
  currentOpportunity.value = record;
  try {
    currentOpportunity.value = await getPublicOpportunityDetail(
      record.opportunityId,
    );
  } catch (error) {
    console.error('load mobile public opportunity detail failed:', error);
    message.error('加载公开机会详情失败');
  } finally {
    opportunityDetailLoading.value = false;
  }
}

function handleOpportunityDetailOpenChange(value: boolean) {
  opportunityDetailOpen.value = value;
}

function openOpportunitySourceUrl(record: PublicOpportunityItem) {
  if (!record.sourceUrl) {
    message.warning('暂无原网页地址');
    return;
  }
  window.open(record.sourceUrl, '_blank', 'noopener,noreferrer');
}

async function pollCollectTask(taskId: string) {
  window.clearTimeout(collectTimer);
  try {
    const task = await getRadarCollectTask(taskId);
    collectText.value = `采集${task.status === 'SUCCESS' ? '完成' : '进行中'}：新增 ${task.created}，更新 ${task.updated}，跳过 ${task.skipped}`;
    if (task.status === 'SUCCESS') {
      collectRunning.value = false;
      void loadLeads();
      void loadOpportunities();
      return;
    }
    if (task.status === 'FAILED') {
      collectRunning.value = false;
      collectText.value = task.errorReason || '采集失败，请稍后重试。';
      return;
    }
    collectTimer = window.setTimeout(() => void pollCollectTask(taskId), 2000);
  } catch (error) {
    console.error('轮询采集任务失败:', error);
    collectRunning.value = false;
    collectText.value = '采集任务状态获取失败。';
  }
}

async function startCollect() {
  if (collectRunning.value) {
    return;
  }
  collectRunning.value = true;
  collectText.value = '正在启动公开数据采集...';
  try {
    const result = await runRadarCollect();
    window.sessionStorage.setItem('latest_radar_task_id', result.taskId);
    void pollCollectTask(result.taskId);
  } catch (error) {
    console.error('启动移动端雷达采集失败:', error);
    collectRunning.value = false;
    collectText.value = '';
    message.error('启动采集失败，请稍后重试');
  }
}

function onTabChange(key: number | string) {
  if (
    String(key) === 'opportunities' &&
    (!opportunityLoaded.value || opportunities.value.length === 0)
  ) {
    void loadOpportunities();
  }
}

onMounted(() => {
  void loadLeads();
});
</script>

<template>
  <div class="radar-mobile-page">
    <div class="radar-mobile-header">
      <div>
        <h2>智能招商雷达</h2>
        <p>移动端快速查看高优先级线索、公开机会和触达进度。</p>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="radar-mobile-stats">
      <button
        class="radar-mobile-stat"
        :class="{ 'is-active': activeTab === 'leads' }"
        type="button"
        @click="showLeads"
      >
        <span>雷达线索</span>
        <strong>{{ leadTotalText }}</strong>
        <em>{{ leadPageText }}</em>
      </button>
      <button
        class="radar-mobile-stat"
        :class="{ 'is-active': activeTab === 'opportunities' }"
        type="button"
        @click="showOpportunities"
      >
        <span>公开机会</span>
        <strong>{{ opportunityTotalText }}</strong>
        <em>{{ opportunityPageText }}</em>
      </button>
    </div>

    <!-- 操作按钮区 -->
    <div class="radar-mobile-actions">
      <Button block @click="goToDashboard">看板</Button>
      <Button block @click="goToTasks">触达任务</Button>
      <Button block @click="downloadImportTemplate">下载模板</Button>
      <Button block @click="openImportModal">手工导入</Button>
      <AUpload
        class="radar-mobile-upload"
        accept=".csv,.json,.xlsx,.xls"
        :before-upload="handleImportFileBeforeUpload"
        :max-count="1"
        :show-upload-list="false"
      >
        <Button block :loading="importing">文件导入</Button>
      </AUpload>
      <Button
        block
        type="primary"
        :loading="collectRunning"
        @click="startCollect"
      >
        {{ collectRunning ? '采集中...' : '采集同步' }}
      </Button>
    </div>

    <!-- 采集状态提示 -->
    <Alert
      v-if="collectText"
      :message="collectText"
      show-icon
      type="info"
      class="radar-mobile-notice"
    />

    <Alert v-if="loadError" :message="loadError" show-icon type="warning" />

    <Tabs
      v-model:active-key="activeTab"
      class="radar-mobile-tabs"
      @change="onTabChange"
    >
      <Tabs.TabPane key="leads" tab="线索">
        <div class="radar-mobile-filter">
          <Form layout="vertical">
            <div class="mobile-search-bar">
              <Input
                v-model:value="leadSearch.keyword"
                allow-clear
                class="mobile-search-input"
                placeholder="企业 / 电话 / 园区"
                @press-enter="searchLeads"
              />
              <Button type="primary" @click="searchLeads"> 查询 </Button>
              <Button @click="leadFilterOpen = !leadFilterOpen">筛选</Button>
            </div>
            <div v-show="leadFilterOpen" class="mobile-filter-panel">
              <Row :gutter="8">
                <Col :span="12">
                  <Form.Item label="优先级">
                    <Select
                      v-model:value="leadSearch.priorityLevel"
                      allow-clear
                      placeholder="全部"
                      :options="priorityOptions"
                    />
                  </Form.Item>
                </Col>
                <Col :span="12">
                  <Form.Item label="阶段">
                    <Select
                      v-model:value="leadSearch.stage"
                      allow-clear
                      placeholder="全部"
                      :options="RADAR_STAGE_OPTIONS"
                    />
                  </Form.Item>
                </Col>
              </Row>
              <div class="radar-mobile-filter-actions">
                <Button type="primary" @click="searchLeads">
                  <Search class="mr-1 h-4 w-4" />
                  应用筛选
                </Button>
                <Button @click="resetLeads">重置</Button>
              </div>
            </div>
          </Form>
        </div>

        <Spin :spinning="leadLoading">
          <div v-if="leads.length > 0" class="radar-mobile-list">
            <Card
              v-for="item in leads"
              :key="item.leadId"
              class="radar-mobile-card"
              :body-style="{ padding: '0' }"
              role="button"
              tabindex="0"
              @click="goToLeadDetail(item.leadId)"
              @keydown.enter="goToLeadDetail(item.leadId)"
              @keydown.space.prevent="goToLeadDetail(item.leadId)"
            >
              <div class="radar-card-head">
                <div class="radar-card-title">
                  {{ item.enterpriseName || '雷达线索' }}
                </div>
                <Tag :color="getPriorityColor(item.priorityLevel)">
                  {{ item.priorityLevel || '-' }} 级
                </Tag>
              </div>
              <div class="radar-card-tags">
                <Tag color="blue">{{ getStageLabel(item.stage) }}</Tag>
                <span>{{ item.parkName || '未分配园区' }}</span>
                <span>{{ item.ownerName || '未分配负责人' }}</span>
              </div>
              <div class="radar-score-grid">
                <div>
                  <span>总分</span>
                  <strong>{{ item.totalScore }}</strong>
                </div>
                <div>
                  <span>意图</span>
                  <strong>{{ item.intentScore }}</strong>
                </div>
                <div>
                  <span>匹配</span>
                  <strong>{{ item.matchScore }}</strong>
                </div>
                <div>
                  <span>触达</span>
                  <strong>{{ item.reachableScore }}</strong>
                </div>
              </div>
              <div class="radar-card-meta">
                <span>电话：{{ item.phoneNumber || '-' }}</span>
                <span>
                  面积：{{ item.intentArea ? `${item.intentArea} ㎡` : '-' }}
                </span>
                <span>信号：{{ item.latestSignalType || '-' }}</span>
                <span>信号时间：{{ formatTime(item.latestSignalTime) }}</span>
              </div>
            </Card>
            <Pagination
              v-if="leadPagination.total > 0"
              class="radar-mobile-pagination"
              size="small"
              :current="leadPagination.current"
              :page-size="leadPagination.pageSize"
              :total="leadPagination.total"
              simple
              @change="onLeadPageChange"
            />
          </div>
          <Empty v-else class="radar-mobile-empty" description="暂无雷达线索" />
        </Spin>
      </Tabs.TabPane>

      <Tabs.TabPane key="opportunities" tab="公开机会">
        <div class="radar-mobile-filter">
          <Form layout="vertical">
            <div class="mobile-search-bar">
              <Input
                v-model:value="opportunitySearch.keyword"
                allow-clear
                class="mobile-search-input"
                placeholder="标题 / 联系人 / 来源"
                @press-enter="searchOpportunities"
              />
              <Button type="primary" @click="searchOpportunities">
                查询
              </Button>
              <Button @click="opportunityFilterOpen = !opportunityFilterOpen">
                筛选
              </Button>
            </div>
            <div v-show="opportunityFilterOpen" class="mobile-filter-panel">
              <Row :gutter="8">
                <Col :span="12">
                  <Form.Item label="类型">
                    <Select
                      v-model:value="opportunitySearch.opportunityType"
                      :options="opportunityTypeOptions"
                    />
                  </Form.Item>
                </Col>
                <Col :span="12">
                  <Form.Item label="城市">
                    <Input
                      v-model:value="opportunitySearch.city"
                      allow-clear
                      placeholder="城市"
                      @press-enter="searchOpportunities"
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="来源站点">
                <Input
                  v-model:value="opportunitySearch.sourceSite"
                  allow-clear
                  placeholder="来源站点"
                  @press-enter="searchOpportunities"
                />
              </Form.Item>
              <div class="radar-mobile-filter-actions">
                <Button type="primary" @click="searchOpportunities">
                  <Search class="mr-1 h-4 w-4" />
                  应用筛选
                </Button>
                <Button @click="resetOpportunities">重置</Button>
              </div>
            </div>
          </Form>
        </div>

        <Spin :spinning="opportunityLoading">
          <div v-if="opportunities.length > 0" class="radar-mobile-list">
            <Card
              v-for="item in opportunities"
              :key="item.opportunityId"
              class="radar-mobile-card"
              :body-style="{ padding: '0' }"
              role="button"
              tabindex="0"
              @click="openOpportunityDetail(item)"
              @keydown.enter="openOpportunityDetail(item)"
              @keydown.space.prevent="openOpportunityDetail(item)"
            >
              <div class="radar-card-head">
                <div class="radar-card-title">
                  {{ item.title || '公开机会' }}
                </div>
                <Tag
                  :color="getOpportunityTypeMeta(item.opportunityType).color"
                >
                  {{ getOpportunityTypeMeta(item.opportunityType).label }}
                </Tag>
              </div>
              <div class="radar-card-tags">
                <span>{{
                  [item.city, item.district].filter(Boolean).join(' / ') || '-'
                }}</span>
                <span>{{ item.sourceSite || '-' }}</span>
                <span>{{ item.publishedAgeLabel || '-' }}</span>
              </div>
              <div class="radar-card-meta">
                <span>面积：{{ formatArea(item) }}</span>
                <span>价格：{{ item.priceText || '-' }}</span>
                <span>联系人：{{ item.contactName || '-' }}</span>
                <span>电话：{{ item.phoneNumber || '-' }}</span>
                <span>发布日期：{{ formatDateOnly(item.publishedAt) }}</span>
              </div>
              <p v-if="item.description">{{ item.description }}</p>
              <div class="radar-card-actions">
                <Button
                  size="small"
                  class="radar-action-btn"
                  @click.stop="openOpportunityDetail(item)"
                >
                  详情
                </Button>
                <Button
                  v-if="item.sourceUrl"
                  size="small"
                  class="radar-action-btn"
                  @click.stop="openOpportunitySourceUrl(item)"
                >
                  原网页
                </Button>
              </div>
            </Card>
            <Pagination
              v-if="opportunityPagination.total > 0"
              class="radar-mobile-pagination"
              size="small"
              :current="opportunityPagination.current"
              :page-size="opportunityPagination.pageSize"
              :total="opportunityPagination.total"
              simple
              @change="onOpportunityPageChange"
            />
          </div>
          <Empty v-else class="radar-mobile-empty" description="暂无公开机会" />
        </Spin>
      </Tabs.TabPane>
    </Tabs>

    <Modal
      v-model:open="importModalOpen"
      :confirm-loading="importing"
      :ok-text="importModalMode === 'result' ? '关闭' : '确定'"
      :title="importModalMode === 'result' ? '导入失败项' : '手工导入潜客'"
      width="92vw"
      @ok="handleImportModalOk"
    >
      <template v-if="importModalMode === 'json'">
        <Input.TextArea
          v-model:value="importJsonText"
          :auto-size="{ minRows: 8, maxRows: 14 }"
          :placeholder="importPlaceholder"
        />
        <div class="import-help">
          支持 JSON 数组或 { items: [] }，字段与下载模板一致。
        </div>
      </template>

      <div v-else class="import-result-list">
        <div
          v-for="item in importFailItems"
          :key="`${item.rowNumber ?? item.index}-${item.error}`"
          class="import-result-card"
        >
          <div class="import-result-head">
            <span>
              第 {{ item.rowNumber ?? (Number(item.index) || 0) + 1 }} 行
            </span>
            <strong>{{
              item.enterpriseName || item.rawData?.enterpriseName || '-'
            }}</strong>
          </div>
          <p>{{ item.error }}</p>
          <pre>{{ JSON.stringify(item.rawData || {}, null, 2) }}</pre>
        </div>
      </div>

      <template #footer>
        <Button v-if="importFailItems.length > 0" @click="downloadFailItems">
          下载失败项
        </Button>
        <Button @click="importModalOpen = false">关闭</Button>
        <Button
          v-if="importModalMode !== 'result'"
          type="primary"
          :loading="importing"
          @click="handleImportModalOk"
        >
          确定
        </Button>
      </template>
    </Modal>

    <OpportunityDetailDrawer
      :item="currentOpportunity"
      :loading="opportunityDetailLoading"
      :open="opportunityDetailOpen"
      title="公开机会详情"
      @open-source="openOpportunitySourceUrl"
      @update:open="handleOpportunityDetailOpenChange"
    />
  </div>
</template>

<style scoped>
.radar-mobile-page {
  box-sizing: border-box;
  min-height: 100%;
  padding: 12px 10px calc(96px + env(safe-area-inset-bottom));
  background: #f0f2f5;
}

.dark .radar-mobile-page {
  background: #1a1a1a;
}

.radar-mobile-header {
  padding: 16px;
  margin-bottom: 12px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 6%);
}

.radar-mobile-header > div {
  min-width: 0;
}

.radar-mobile-header :deep(.ant-btn) {
  flex: 0 0 auto;
}

.dark .radar-mobile-header {
  background: #2d2d2d;
}

.radar-mobile-header h2 {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;
  color: var(--ant-color-text);
}

.dark .radar-mobile-header h2 {
  color: #fff;
}

.radar-mobile-header p {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.dark .radar-mobile-header p {
  color: rgb(255 255 255 / 60%);
}

.radar-mobile-notice {
  margin-bottom: 12px;
  border-radius: 8px;
}

.dark .radar-mobile-notice {
  background: rgb(24 144 255 / 10%);
  border-color: rgb(24 144 255 / 30%);
}

.radar-mobile-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.radar-mobile-actions :deep(.ant-btn),
.radar-mobile-filter-actions :deep(.ant-btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: auto;
  min-height: 40px;
  padding: 8px 12px;
  font-size: 14px;
  line-height: 20px;
  white-space: normal;
  border-radius: 8px;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.radar-mobile-actions :deep(.ant-btn):hover,
.radar-mobile-filter-actions :deep(.ant-btn):hover {
  transform: translateY(-1px);
}

.radar-mobile-actions :deep(.ant-btn):active,
.radar-mobile-filter-actions :deep(.ant-btn):active {
  transform: scale(0.98);
}

.dark .radar-mobile-actions :deep(.ant-btn),
.dark .radar-mobile-filter-actions :deep(.ant-btn) {
  color: #fff;
  background: rgb(255 255 255 / 10%);
  border-color: rgb(255 255 255 / 20%);
}

.radar-mobile-filter-actions :deep(svg) {
  flex: 0 0 auto;
}

.radar-mobile-filter-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.radar-mobile-upload {
  display: block;
}

.radar-mobile-upload :deep(.ant-upload),
.radar-mobile-upload :deep(.ant-btn) {
  width: 100%;
}

.radar-mobile-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.radar-mobile-stat {
  min-width: 0;
  padding: 14px 12px;
  text-align: left;
  background: #fff;
  border: 2px solid transparent;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 6%);
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

button.radar-mobile-stat:hover:not(.is-active) {
  box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
  transform: translateY(-2px);
}

button.radar-mobile-stat:active {
  transform: scale(0.98);
}

button.radar-mobile-stat {
  font: inherit;
  cursor: pointer;
}

.radar-mobile-stat.is-active {
  background: linear-gradient(
    135deg,
    var(--ant-color-primary-bg) 0%,
    var(--ant-color-primary-hover) 100%
  );
  border-color: var(--ant-color-primary);
  box-shadow: 0 4px 12px rgb(0 0 0 / 12%);
  transform: translateY(-2px);
}

.radar-mobile-stat span,
.radar-mobile-stat em,
.radar-mobile-stat strong {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.radar-mobile-stat span {
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.dark .radar-mobile-stat span {
  color: rgb(255 255 255 / 60%);
}

.radar-mobile-stat strong {
  margin-top: 4px;
  font-size: 24px;
  font-weight: 700;
  line-height: 28px;
  color: var(--ant-color-text);
}

.dark .radar-mobile-stat strong {
  color: #fff;
}

.radar-mobile-stat em {
  margin-top: 4px;
  font-size: 12px;
  font-style: normal;
  line-height: 16px;
  color: var(--ant-color-text-tertiary);
}

.dark .radar-mobile-stat em {
  color: rgb(255 255 255 / 50%);
}

.radar-mobile-tabs :deep(.ant-tabs-nav) {
  padding: 0 4px;
  margin-bottom: 12px;
}

.radar-mobile-filter {
  padding: 14px 12px;
  margin-bottom: 12px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 6%);
}

.mobile-search-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 64px 64px;
  gap: 8px;
  align-items: center;
}

.mobile-search-input {
  min-width: 0;
}

.mobile-filter-panel {
  padding-top: 10px;
  margin-top: 10px;
  border-top: 1px solid var(--ant-color-border-secondary);
}

.radar-mobile-filter :deep(.ant-form-item) {
  margin-bottom: 12px;
}

.radar-mobile-filter :deep(.ant-input),
.radar-mobile-filter :deep(.ant-select-selector) {
  border-radius: 8px;
}

.dark .radar-mobile-filter,
.dark .radar-mobile-stat,
.dark .radar-mobile-card {
  background: #2d2d2d;
}

.radar-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.radar-mobile-card {
  overflow: hidden;
  cursor: pointer;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgb(0 0 0 / 8%);
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.radar-mobile-card:hover {
  box-shadow: 0 4px 16px rgb(0 0 0 / 12%);
  transform: translateY(-2px);
}

.radar-mobile-card:active {
  transform: scale(0.98);
}

.radar-mobile-card:focus-visible {
  outline: 2px solid var(--ant-color-primary);
  outline-offset: 2px;
}

.radar-mobile-card :deep(.ant-card-body) {
  padding: 16px !important;
}

.radar-card-head {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
}

.radar-card-title {
  flex: 1;
  min-width: 0;
  font-size: 17px;
  font-weight: 700;
  line-height: 24px;
  color: var(--ant-color-text);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.dark .radar-card-title {
  color: #fff;
}

.radar-card-head :deep(.ant-tag) {
  flex: 0 0 auto;
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.radar-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.dark .radar-card-tags {
  color: rgb(255 255 255 / 60%);
}

.radar-card-tags > span,
.radar-card-tags :deep(.ant-tag) {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.radar-score-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.radar-score-grid > div {
  padding: 10px 4px;
  text-align: center;
  background: var(--ant-color-fill-quaternary);
  border-radius: 8px;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.radar-score-grid > div:hover {
  background: var(--ant-color-fill-tertiary);
}

.radar-score-grid > div:active {
  transform: scale(0.95);
}

.dark .radar-score-grid > div {
  background: rgb(255 255 255 / 10%);
}

.radar-score-grid span {
  display: block;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  color: var(--ant-color-text-secondary);
}

.dark .radar-score-grid span {
  color: rgb(255 255 255 / 60%);
}

.radar-score-grid strong {
  display: block;
  margin-top: 4px;
  font-size: 18px;
  font-weight: 700;
  line-height: 24px;
  color: var(--ant-color-text);
}

.dark .radar-score-grid strong {
  color: #fff;
}

.radar-card-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 12px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.dark .radar-card-meta {
  color: rgb(255 255 255 / 60%);
}

.radar-card-meta span {
  min-width: 0;
  padding: 4px 8px;
  overflow-wrap: anywhere;
  background: var(--ant-color-fill-quaternary);
  border-radius: 6px;
}

.dark .radar-card-meta span {
  background: rgb(255 255 255 / 10%);
}

.radar-mobile-card p {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 22px;
  color: var(--ant-color-text-secondary);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.dark .radar-mobile-card p {
  color: rgb(255 255 255 / 60%);
}

.radar-card-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.radar-action-btn {
  min-width: 0;
  height: 36px;
  font-size: 14px;
  border-radius: 8px;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.radar-action-btn:active {
  transform: scale(0.95);
}

.dark .radar-action-btn {
  color: #fff;
  background: rgb(255 255 255 / 10%);
  border-color: rgb(255 255 255 / 20%);
}

.radar-mobile-pagination {
  margin-top: 14px;
  text-align: center;
}

.dark .radar-mobile-pagination :deep(.ant-pagination-item),
.dark .radar-mobile-pagination :deep(.ant-pagination-prev),
.dark .radar-mobile-pagination :deep(.ant-pagination-next) {
  background: rgb(255 255 255 / 10%);
  border-color: rgb(255 255 255 / 20%);
}

.dark .radar-mobile-pagination :deep(.ant-pagination-item a),
.dark .radar-mobile-pagination :deep(.ant-pagination-prev a),
.dark .radar-mobile-pagination :deep(.ant-pagination-next a) {
  color: #fff;
}

.radar-mobile-empty {
  padding: 40px 0;
}

.dark .radar-mobile-empty :deep(.ant-empty-description) {
  color: rgb(255 255 255 / 60%);
}

.import-help {
  margin-top: 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.dark .import-help {
  color: rgb(255 255 255 / 60%);
}

.import-result-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 58vh;
  overflow-y: auto;
}

.import-result-card {
  padding: 12px;
  background: var(--ant-color-fill-quaternary);
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 10px;
}

.dark .import-result-card {
  background: rgb(255 255 255 / 5%);
  border-color: rgb(255 255 255 / 10%);
}

.import-result-head {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 500;
  color: var(--ant-color-text);
}

.import-result-card p {
  margin: 8px 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-error);
}

.dark .import-result-card p {
  color: #ff4d4f;
}

.import-result-card pre {
  max-height: 140px;
  padding: 10px;
  margin: 0;
  overflow: auto;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  white-space: pre-wrap;
  background: var(--ant-color-bg-container);
  border-radius: 8px;
}

.dark .import-result-card pre {
  color: rgb(255 255 255 / 70%);
  background: rgb(0 0 0 / 30%);
}
</style>
