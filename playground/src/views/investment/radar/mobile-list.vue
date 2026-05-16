<script lang="ts" setup>
import type { RadarLead } from './data';

import type {
  PublicOpportunityItem,
  RadarLeadImportFailItem,
} from '#/api/investment';

import { onMounted, reactive, ref } from 'vue';
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

function goToDashboard() {
  router.push('/investment/radar/mobile-dashboard');
}

function goToTasks() {
  router.push('/investment/radar/mobile-tasks');
}

function goToLeadDetail(leadId: number) {
  router.push(`/investment/radar/mobile/${leadId}`);
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
    opportunityLoading.value = false;
  }
}

function searchLeads() {
  leadPagination.current = 1;
  void loadLeads();
}

function resetLeads() {
  leadSearch.keyword = '';
  leadSearch.priorityLevel = undefined;
  leadSearch.stage = undefined;
  searchLeads();
}

function searchOpportunities() {
  opportunityPagination.current = 1;
  void loadOpportunities();
}

function resetOpportunities() {
  opportunitySearch.city = '';
  opportunitySearch.keyword = '';
  opportunitySearch.opportunityType = '';
  opportunitySearch.sourceSite = '';
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
  if (String(key) === 'opportunities' && opportunities.value.length === 0) {
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
      <Button type="primary" :loading="collectRunning" @click="startCollect">
        采集
      </Button>
    </div>

    <div v-if="collectText" class="radar-mobile-notice">
      {{ collectText }}
    </div>

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
    </div>

    <Alert v-if="loadError" :message="loadError" show-icon type="warning" />

    <Tabs
      v-model:active-key="activeTab"
      class="radar-mobile-tabs"
      @change="onTabChange"
    >
      <Tabs.TabPane key="leads" tab="线索">
        <div class="radar-mobile-filter">
          <Form layout="vertical">
            <Form.Item label="关键字">
              <Input
                v-model:value="leadSearch.keyword"
                allow-clear
                placeholder="企业 / 电话 / 园区"
                @press-enter="searchLeads"
              />
            </Form.Item>
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
                查询
              </Button>
              <Button @click="resetLeads">重置</Button>
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
              @click="goToLeadDetail(item.leadId)"
            >
              <div class="radar-card-head">
                <div class="radar-card-title">{{ item.enterpriseName }}</div>
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
              v-if="leadPagination.total > leadPagination.pageSize"
              class="radar-mobile-pagination"
              size="small"
              :current="leadPagination.current"
              :page-size="leadPagination.pageSize"
              :total="leadPagination.total"
              @change="onLeadPageChange"
            />
          </div>
          <Empty v-else class="radar-mobile-empty" description="暂无雷达线索" />
        </Spin>
      </Tabs.TabPane>

      <Tabs.TabPane key="opportunities" tab="公开机会">
        <div class="radar-mobile-filter">
          <Form layout="vertical">
            <Form.Item label="关键字">
              <Input
                v-model:value="opportunitySearch.keyword"
                allow-clear
                placeholder="标题 / 联系人 / 来源"
                @press-enter="searchOpportunities"
              />
            </Form.Item>
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
                查询
              </Button>
              <Button @click="resetOpportunities">重置</Button>
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
              @click="openOpportunityDetail(item)"
            >
              <div class="radar-card-head">
                <div class="radar-card-title">
                  {{ item.title || `机会 #${item.opportunityId}` }}
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
              v-if="
                opportunityPagination.total > opportunityPagination.pageSize
              "
              class="radar-mobile-pagination"
              size="small"
              :current="opportunityPagination.current"
              :page-size="opportunityPagination.pageSize"
              :total="opportunityPagination.total"
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
  padding: 10px 8px calc(88px + env(safe-area-inset-bottom));
  background: #f0f2f5;
}

.dark .radar-mobile-page {
  background: #1a1a1a;
}

.radar-mobile-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px;
  margin-bottom: 8px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
}

.dark .radar-mobile-header {
  background: #2d2d2d;
}

.radar-mobile-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 26px;
  color: var(--ant-color-text);
}

.radar-mobile-header p {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.radar-mobile-notice {
  padding: 9px 12px;
  margin-bottom: 8px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-primary);
  background: var(--ant-color-primary-bg);
  border-radius: 6px;
}

.radar-mobile-actions,
.radar-mobile-filter-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.radar-mobile-actions {
  margin-bottom: 8px;
}

.radar-mobile-upload {
  display: block;
}

.radar-mobile-upload :deep(.ant-upload),
.radar-mobile-upload :deep(.ant-btn) {
  width: 100%;
}

.radar-mobile-tabs :deep(.ant-tabs-nav) {
  padding: 0 4px;
  margin-bottom: 8px;
}

.radar-mobile-filter {
  padding: 12px 8px;
  margin-bottom: 8px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
}

.dark .radar-mobile-filter,
.dark .radar-mobile-card {
  background: #2d2d2d;
}

.radar-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.radar-mobile-card {
  overflow: hidden;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.radar-mobile-card :deep(.ant-card-body) {
  padding: 13px !important;
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
  font-size: 16px;
  font-weight: 700;
  line-height: 23px;
  color: var(--ant-color-text);
  word-break: break-word;
}

.radar-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin-top: 8px;
  font-size: 12px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.radar-score-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 12px;
}

.radar-score-grid > div {
  padding: 7px 2px;
  text-align: center;
  background: var(--ant-color-fill-quaternary);
  border-radius: 6px;
}

.radar-score-grid span {
  display: block;
  font-size: 11px;
  line-height: 16px;
  color: var(--ant-color-text-secondary);
}

.radar-score-grid strong {
  display: block;
  font-size: 17px;
  line-height: 22px;
  color: var(--ant-color-text);
}

.radar-card-meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 4px;
  margin-top: 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.radar-mobile-card p {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
  word-break: break-word;
}

.radar-card-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.radar-action-btn {
  min-width: 0;
}

.radar-mobile-pagination {
  margin-top: 10px;
  text-align: center;
}

.radar-mobile-empty {
  padding: 32px 0;
}

.import-help {
  margin-top: 8px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.import-result-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 58vh;
  overflow-y: auto;
}

.import-result-card {
  padding: 10px;
  background: var(--ant-color-fill-quaternary);
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 8px;
}

.import-result-head {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
  font-size: 13px;
  color: var(--ant-color-text);
}

.import-result-card p {
  margin: 6px 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-error);
}

.import-result-card pre {
  max-height: 120px;
  padding: 8px;
  margin: 0;
  overflow: auto;
  font-size: 11px;
  line-height: 16px;
  color: var(--ant-color-text-secondary);
  white-space: pre-wrap;
  background: var(--ant-color-bg-container);
  border-radius: 6px;
}
</style>
