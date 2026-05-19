<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type { RadarLead } from './data';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { PublicOpportunityItem, RadarCollectTask } from '#/api/investment';

import { computed, h, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { ReloadOutlined } from '@ant-design/icons-vue';
import { useMediaQuery } from '@vueuse/core';
import {
  Alert,
  Upload as AUpload,
  Button,
  Card,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Pagination,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getEffectivePublicOpportunityList,
  getPublicOpportunityDetail,
  getRadarCollectTask,
  getRadarLeadList,
  importRadarLeads,
  importRadarLeadsFile,
  runRadarCollect,
} from '#/api/investment';

import CrawlerSources from './crawler-sources.vue';
import CrawlerTasks from './crawler-tasks.vue';
import {
  RADAR_STAGE_LABEL_MAP,
  RADAR_STAGE_OPTIONS,
  useColumns,
  useGridFormSchema,
} from './data';
import EnterpriseProfiles from './enterprise-profiles.vue';
import ExternalLeads from './external-leads.vue';
import FactoryListings from './factory-listings.vue';
import OpportunityDetailDrawer from './opportunity-detail-drawer.vue';
import PublicDemands from './public-demands.vue';
import ScoreRules from './score-rules.vue';
import SignalEvents from './signal-events.vue';

defineOptions({ name: 'InvestmentRadarList' });

const CrawlerSourcesComponent = CrawlerSources;
const CrawlerTasksComponent = CrawlerTasks;
const EnterpriseProfilesComponent = EnterpriseProfiles;
const ExternalLeadsComponent = ExternalLeads;
const FactoryListingsComponent = FactoryListings;
const PublicDemandsComponent = PublicDemands;
const ScoreRulesComponent = ScoreRules;
const SignalEventsComponent = SignalEvents;
const router = useRouter();
const isMobile = useMediaQuery('(max-width: 767px)');
const activeTab = ref<
  | 'crawlerSources'
  | 'crawlerTasks'
  | 'enterpriseProfiles'
  | 'externalLeads'
  | 'factoryListings'
  | 'leads'
  | 'publicDemands'
  | 'publicOpportunities'
  | 'scoreRules'
  | 'signalEvents'
>('leads');
const importModalOpen = ref(false);
const importModalMode = ref<'json' | 'result'>('json');
const importJsonText = ref('');
const collectTask = ref<null | RadarCollectTask>(null);
const collectPolling = ref(false);
const publicOpportunityLoading = ref(false);
const publicOpportunityDetailLoading = ref(false);
const publicOpportunityDetailOpen = ref(false);
const publicOpportunityLoadError = ref('');
const publicOpportunityItems = ref<PublicOpportunityItem[]>([]);
const currentPublicOpportunity = ref<null | PublicOpportunityItem>(null);
let collectTaskTimer: number | undefined;
const importFailItems = ref<
  Array<{
    enterpriseName?: null | string;
    error: string;
    index?: number;
    rawData?: Record<string, unknown>;
    rowNumber?: number;
  }>
>([]);
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
const importFailColumns = [
  {
    customRender: ({ record }: { record: any }) =>
      record.rowNumber ?? (Number(record.index) || 0) + 1,
    dataIndex: 'rowNumber',
    key: 'rowNumber',
    title: '行号',
    width: 90,
  },
  {
    customRender: ({ record }: { record: any }) =>
      record.enterpriseName || record.rawData?.enterpriseName || '-',
    dataIndex: 'enterpriseName',
    key: 'enterpriseName',
    title: '企业名称',
    width: 180,
  },
  {
    dataIndex: 'error',
    key: 'error',
    title: '失败原因',
  },
  {
    customRender: ({ record }: { record: any }) =>
      JSON.stringify(record.rawData || {}),
    dataIndex: 'rawData',
    key: 'rawData',
    title: '原始行数据',
  },
];
const collectStatusText: Record<RadarCollectTask['status'], string> = {
  FAILED: '失败',
  PENDING: '处理中',
  RUNNING: '处理中',
  SUCCESS: '成功',
};
const opportunityTypeOptions = [
  { label: '全部', value: '' },
  { label: '需求机会', value: 'DEMAND' },
  { label: '房源机会', value: 'SUPPLY' },
];
const opportunityTypeMeta: Record<
  PublicOpportunityItem['opportunityType'],
  { color: string; label: string }
> = {
  DEMAND: { color: 'blue', label: '需求' },
  SUPPLY: { color: 'green', label: '房源' },
};
const publicOpportunitySearch = ref({
  city: '',
  keyword: '',
  opportunityType: '',
  sourceSite: '',
});
const publicOpportunityPagination = ref({
  current: 1,
  pageSize: 20,
  total: 0,
});
const mobileLeadLoading = ref(false);
const mobileLeadItems = ref<RadarLead[]>([]);
const mobileLeadSearch = ref({
  keyword: '',
  priorityLevel: undefined as string | undefined,
  stage: undefined as string | undefined,
});
const mobileLeadPagination = ref({
  current: 1,
  pageSize: 10,
  total: 0,
});
const publicOpportunityTableLocale = {
  emptyText: '暂无公开机会数据',
};
const priorityOptions = [
  { label: 'A 级', value: 'A' },
  { label: 'B 级', value: 'B' },
  { label: 'C 级', value: 'C' },
];

const collectStatusClass = computed(() => {
  if (collectTask.value?.status === 'SUCCESS') {
    return 'text-green-600';
  }
  if (collectTask.value?.status === 'FAILED') {
    return 'text-red-600';
  }
  return 'text-primary';
});

function isCollectTaskFinished(status?: RadarCollectTask['status']) {
  return status === 'FAILED' || status === 'SUCCESS';
}

function formatDuration(durationMs?: null | number) {
  if (durationMs === null || durationMs === undefined) {
    return '-';
  }
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  return `${(durationMs / 1000).toFixed(1)}s`;
}

const shanghaiDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
});

function formatPublishedDate(value?: null | string) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const parts: Record<string, string> = {};
  for (const part of shanghaiDateFormatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      parts[part.type] = part.value;
    }
  }

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatArea(record: PublicOpportunityItem) {
  if (
    record.areaText &&
    record.areaSqm !== null &&
    record.areaSqm !== undefined
  ) {
    return `${record.areaText} / ${Number(record.areaSqm).toLocaleString()} ㎡`;
  }
  if (record.areaText) {
    return record.areaText;
  }
  if (record.areaSqm !== null && record.areaSqm !== undefined) {
    return `${Number(record.areaSqm).toLocaleString()} ㎡`;
  }
  return '-';
}

function formatLeadArea(value?: null | number) {
  if (value === null || value === undefined) {
    return '-';
  }
  return `${Number(value).toLocaleString('zh-CN')}㎡`;
}

function formatRegion(record: PublicOpportunityItem) {
  return [record.city, record.district].filter(Boolean).join(' / ') || '-';
}

function formatContact(record: PublicOpportunityItem) {
  return (
    [record.contactName, record.phoneNumber].filter(Boolean).join(' ') || '-'
  );
}

function getOpportunityTypeMeta(
  type: PublicOpportunityItem['opportunityType'],
) {
  return opportunityTypeMeta[type] || { color: 'default', label: type };
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

function getStageColor(stage?: null | string) {
  if (stage === 'PENDING_CONTACT') {
    return 'gold';
  }
  if (stage === 'REPLIED' || stage === 'VISIT' || stage === 'DEAL') {
    return 'green';
  }
  if (stage === 'INVALID') {
    return 'red';
  }
  return 'blue';
}

function openOpportunitySourceUrl(record: PublicOpportunityItem) {
  window.open(record.sourceUrl, '_blank', 'noopener,noreferrer');
}

function clearCollectTaskTimer() {
  if (collectTaskTimer) {
    window.clearTimeout(collectTaskTimer);
    collectTaskTimer = undefined;
  }
}

async function refreshCollectTask(taskId: string) {
  const task = await getRadarCollectTask(taskId);
  collectTask.value = task;
  return task;
}

function scheduleCollectTaskPolling(taskId: string) {
  clearCollectTaskTimer();
  collectTaskTimer = window.setTimeout(async () => {
    try {
      const task = await refreshCollectTask(taskId);
      if (isCollectTaskFinished(task.status)) {
        collectPolling.value = false;
        message.success({
          content:
            task.status === 'SUCCESS'
              ? `同步完成，新增 ${task.created} 条，更新 ${task.updated} 条，跳过 ${task.skipped} 条`
              : `同步失败：${task.errorReason || '未知错误'}`,
          key: 'radar_sync',
        });
        if (task.status === 'SUCCESS') {
          gridApi.query();
          if (isMobile.value) {
            void loadMobileLeads();
          }
        }
        return;
      }
      scheduleCollectTaskPolling(taskId);
    } catch (error) {
      collectPolling.value = false;
      console.error('查询智能招商采集任务失败:', error);
      message.error({
        content: '查询智能招商采集任务失败',
        key: 'radar_sync',
      });
    }
  }, 1500);
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

function goToDashboard() {
  router.push('/investment/radar-dashboard');
}

function goToTasks() {
  router.push('/investment/radar-tasks');
}

function handleImportModalOk() {
  if (importModalMode.value === 'result') {
    importModalOpen.value = false;
    return;
  }

  void submitImportJson();
}

async function submitImportJson() {
  const raw = importJsonText.value.trim();
  if (!raw) {
    message.warning('请输入 JSON 数组');
    return;
  }

  let items: any[] = [];

  try {
    const parsed = JSON.parse(raw);
    items = Array.isArray(parsed) ? parsed : parsed.items;
  } catch {
    message.error('JSON 格式不正确');
    return;
  }

  if (!Array.isArray(items)) {
    message.error('导入内容必须是数组或 { items: [] }');
    return;
  }

  message.loading({
    content: '正在导入潜客...',
    duration: 0,
    key: 'radar_import',
  });

  try {
    const result = await importRadarLeads({ items });
    importFailItems.value = result.failItems || [];
    message.success({
      content: `导入完成，成功 ${result.success} 条，失败 ${importFailItems.value.length} 条`,
      key: 'radar_import',
    });
    if (importFailItems.value.length > 0) {
      importModalMode.value = 'result';
      importModalOpen.value = true;
    } else {
      importModalOpen.value = false;
      importJsonText.value = '';
    }
    gridApi.query();
  } catch (error) {
    console.error('导入智能招商潜客失败:', error);
    message.error({
      content: '导入智能招商潜客失败',
      key: 'radar_import',
    });
  }
}

async function handleImportFileBeforeUpload(file: File) {
  message.loading({
    content: `正在导入文件 ${file.name}...`,
    duration: 0,
    key: 'radar_import_file',
  });

  try {
    const formData = new FormData();
    formData.append('file', file);
    const result = await importRadarLeadsFile(formData);
    importFailItems.value = result.failItems || [];
    message.success({
      content: `文件导入完成，成功 ${result.success} 条，失败 ${importFailItems.value.length} 条`,
      key: 'radar_import_file',
    });
    if (importFailItems.value.length > 0) {
      importModalMode.value = 'result';
      importModalOpen.value = true;
    }
    gridApi.query();
  } catch (error) {
    console.error('上传导入潜客文件失败:', error);
    message.error({
      content: '上传导入潜客文件失败',
      key: 'radar_import_file',
    });
  }

  return false;
}

async function syncRadarLeads() {
  if (collectPolling.value) {
    return;
  }

  clearCollectTaskTimer();
  collectTask.value = null;
  collectPolling.value = true;
  message.loading({
    content: '正在创建采集任务...',
    duration: 0,
    key: 'radar_sync',
  });

  try {
    const result = await runRadarCollect();
    collectTask.value = result.task;
    message.success({
      content: '采集任务已创建',
      key: 'radar_sync',
    });
    scheduleCollectTaskPolling(result.taskId);
  } catch (error) {
    collectPolling.value = false;
    console.error('同步智能招商潜客失败:', error);
    message.error({
      content: '同步智能招商潜客失败',
      key: 'radar_sync',
    });
  }
}

function buildPublicOpportunityQuery() {
  return {
    city: publicOpportunitySearch.value.city || undefined,
    currentPage: publicOpportunityPagination.value.current,
    keyword: publicOpportunitySearch.value.keyword || undefined,
    opportunityType: publicOpportunitySearch.value.opportunityType || undefined,
    pageSize: publicOpportunityPagination.value.pageSize,
    sourceSite: publicOpportunitySearch.value.sourceSite || undefined,
  };
}

async function loadPublicOpportunities() {
  publicOpportunityLoading.value = true;
  publicOpportunityLoadError.value = '';
  try {
    const result = await getEffectivePublicOpportunityList(
      buildPublicOpportunityQuery(),
    );
    const effectiveItems = result.items.filter(
      (item) => item.opportunityStatus === 'EFFECTIVE',
    );
    publicOpportunityItems.value = effectiveItems;
    publicOpportunityPagination.value.total = result.total;
  } catch (error) {
    console.error('获取公开有效机会失败:', error);
    publicOpportunityItems.value = [];
    publicOpportunityPagination.value.total = 0;
    publicOpportunityLoadError.value =
      '公开机会数据加载失败，请检查相关接口是否已接入。';
  } finally {
    publicOpportunityLoading.value = false;
  }
}

async function loadMobileLeads() {
  mobileLeadLoading.value = true;
  try {
    const result = await getRadarLeadList({
      currentPage: mobileLeadPagination.value.current,
      keyword: mobileLeadSearch.value.keyword || undefined,
      pageSize: mobileLeadPagination.value.pageSize,
      priorityLevel: mobileLeadSearch.value.priorityLevel,
      stage: mobileLeadSearch.value.stage,
    });
    mobileLeadItems.value = Array.isArray(result.items) ? result.items : [];
    mobileLeadPagination.value.total =
      typeof result.total === 'number'
        ? result.total
        : (result.page?.total ?? mobileLeadItems.value.length);
  } catch (error) {
    console.error('加载移动端雷达线索失败:', error);
    mobileLeadItems.value = [];
    mobileLeadPagination.value.total = 0;
    message.error('加载雷达线索失败');
  } finally {
    mobileLeadLoading.value = false;
  }
}

function searchMobileLeads() {
  mobileLeadPagination.value.current = 1;
  void loadMobileLeads();
}

function resetMobileLeadSearch() {
  mobileLeadSearch.value = {
    keyword: '',
    priorityLevel: undefined,
    stage: undefined,
  };
  searchMobileLeads();
}

function handleMobileLeadPageChange(page: number, nextPageSize: number) {
  mobileLeadPagination.value.current = page;
  mobileLeadPagination.value.pageSize = nextPageSize;
  void loadMobileLeads();
}

function handlePublicOpportunityPageChange(page: number, nextPageSize: number) {
  publicOpportunityPagination.value.current = page;
  publicOpportunityPagination.value.pageSize = nextPageSize;
  void loadPublicOpportunities();
}

function searchPublicOpportunities() {
  publicOpportunityPagination.value.current = 1;
  void loadPublicOpportunities();
}

function resetPublicOpportunitySearch() {
  publicOpportunitySearch.value = {
    city: '',
    keyword: '',
    opportunityType: '',
    sourceSite: '',
  };
  searchPublicOpportunities();
}

function handlePublicOpportunityTableChange(page: any) {
  publicOpportunityPagination.value.current = page.current || 1;
  publicOpportunityPagination.value.pageSize = page.pageSize || 20;
  void loadPublicOpportunities();
}

async function openPublicOpportunityDetail(record: PublicOpportunityItem) {
  publicOpportunityDetailOpen.value = true;
  publicOpportunityDetailLoading.value = true;
  currentPublicOpportunity.value = record;
  try {
    currentPublicOpportunity.value = await getPublicOpportunityDetail(
      record.opportunityId,
    );
  } catch (error) {
    console.error('获取公开机会详情失败:', error);
    message.error('获取公开机会详情失败');
  } finally {
    publicOpportunityDetailLoading.value = false;
  }
}

function handlePublicOpportunityDetailOpen(value: boolean) {
  publicOpportunityDetailOpen.value = value;
}

function handleTabChange(key: number | string) {
  activeTab.value = key as typeof activeTab.value;
  if (
    activeTab.value === 'publicOpportunities' &&
    publicOpportunityItems.value.length === 0
  ) {
    void loadPublicOpportunities();
  }
}

function handleMobileTabChange(key: number | string) {
  const nextTab =
    key === 'publicOpportunities' ? 'publicOpportunities' : 'leads';
  activeTab.value = nextTab;
  if (nextTab === 'leads' && mobileLeadItems.value.length === 0) {
    void loadMobileLeads();
  }
  if (
    nextTab === 'publicOpportunities' &&
    publicOpportunityItems.value.length === 0
  ) {
    void loadPublicOpportunities();
  }
}

onBeforeUnmount(() => {
  clearCollectTaskTimer();
});

onMounted(() => {
  if (isMobile.value) {
    void loadMobileLeads();
  }
});

watch(isMobile, (value) => {
  if (value) {
    if (!['leads', 'publicOpportunities'].includes(activeTab.value)) {
      activeTab.value = 'leads';
    }
    if (mobileLeadItems.value.length === 0) {
      void loadMobileLeads();
    }
  }
});

watch(activeTab, (value) => {
  if (
    isMobile.value &&
    value === 'leads' &&
    mobileLeadItems.value.length === 0
  ) {
    void loadMobileLeads();
  }
});

function onActionClick({ code, row }: OnActionClickParams<any>) {
  if (code === '查看') {
    router.push(`/investment/radar/${row.leadId}`);
  }
}

function goToLeadDetail(leadId: number | string) {
  router.push(`/investment/radar/${leadId}`);
}

const publicOpportunityColumns: TableColumnsType<PublicOpportunityItem> = [
  {
    customRender: ({ record }: { record: PublicOpportunityItem }) => {
      const meta = getOpportunityTypeMeta(record.opportunityType);
      return h(Tag, { color: meta.color }, () => meta.label);
    },
    dataIndex: 'opportunityType',
    key: 'opportunityType',
    title: '类型',
    width: 90,
  },
  {
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      h('div', { class: 'public-opportunity-title-cell' }, [
        h('div', { class: 'public-opportunity-title' }, record.title || '-'),
        h('div', { class: 'public-opportunity-source' }, record.sourceUrl),
      ]),
    dataIndex: 'title',
    key: 'title',
    title: '标题',
    width: 320,
  },
  {
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      formatRegion(record),
    dataIndex: 'city',
    key: 'city',
    title: '城市 / 区域',
    width: 140,
  },
  {
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      formatArea(record),
    dataIndex: 'areaText',
    key: 'areaText',
    title: '面积',
    width: 120,
  },
  {
    customRender: ({ text }: { text?: null | string }) => text || '-',
    dataIndex: 'priceText',
    key: 'priceText',
    title: '价格 / 预算',
    width: 130,
  },
  {
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      formatContact(record),
    dataIndex: 'phoneNumber',
    key: 'phoneNumber',
    title: '联系人 / 电话',
    width: 160,
  },
  {
    customRender: ({ text }: { text?: null | string }) =>
      formatPublishedDate(text),
    dataIndex: 'publishedAt',
    key: 'publishedAt',
    title: '发布时间',
    width: 120,
  },
  {
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      record.publishedAgeLabel || '-',
    dataIndex: 'publishedAgeLabel',
    key: 'publishedAgeLabel',
    title: '时效',
    width: 130,
  },
  {
    customRender: ({ text }: { text?: null | number }) =>
      text === null || text === undefined ? '-' : text,
    dataIndex: 'score',
    key: 'score',
    title: '分数',
    width: 90,
  },
  {
    customRender: ({ text }: { text?: null | string }) => text || '-',
    dataIndex: 'sourceSite',
    key: 'sourceSite',
    title: '来源',
    width: 110,
  },
  {
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      h(Space, {}, () => [
        h(
          Button,
          {
            onClick: () => void openPublicOpportunityDetail(record),
            size: 'small',
            type: 'link',
          },
          () => '查看详情',
        ),
        h(
          Button,
          {
            onClick: () => openOpportunitySourceUrl(record),
            size: 'small',
            type: 'link',
          },
          () => '原网页',
        ),
      ]),
    fixed: 'right',
    key: 'operation',
    title: '操作',
    width: 160,
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    schema: useGridFormSchema(),
  },
  gridOptions: {
    align: 'center',
    border: true,
    columns: useColumns(onActionClick),
    headerAlign: 'center',
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async (page) => {
          const formData = (await gridApi.formApi?.getValues?.()) || {};
          return await getRadarLeadList({
            ...formData,
            currentPage: page.page?.currentPage || 1,
            pageSize: page.page?.pageSize || 20,
          });
        },
      },
    },
    rowConfig: {
      keyField: 'leadId',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions,
});
</script>

<template>
  <Page auto-content-height content-class="radar-page-content">
    <div v-if="isMobile" class="radar-mobile-page">
      <div class="radar-mobile-header">
        <div>
          <div class="radar-mobile-title">智能招商雷达</div>
          <div class="radar-mobile-subtitle">查看潜客、公开机会和触达进展</div>
        </div>
        <Button
          type="primary"
          :loading="mobileLeadLoading"
          @click="loadMobileLeads"
        >
          刷新
        </Button>
      </div>

      <div class="radar-mobile-actions">
        <Button block @click="goToDashboard">看板</Button>
        <Button block @click="goToTasks">触达任务</Button>
        <Button
          block
          :disabled="collectPolling"
          :loading="collectPolling"
          type="primary"
          @click="syncRadarLeads"
        >
          同步潜客
        </Button>
      </div>

      <div v-if="collectTask" class="radar-mobile-sync-card">
        <div class="radar-mobile-sync-row">
          <span>采集状态</span>
          <span :class="collectStatusClass">
            {{ collectStatusText[collectTask.status] }}
          </span>
        </div>
        <div class="radar-mobile-sync-grid">
          <span>新增 {{ collectTask.created }}</span>
          <span>更新 {{ collectTask.updated }}</span>
          <span>跳过 {{ collectTask.skipped }}</span>
          <span>耗时 {{ formatDuration(collectTask.durationMs) }}</span>
        </div>
        <div v-if="collectTask.errorReason" class="radar-mobile-error">
          {{ collectTask.errorReason }}
        </div>
      </div>

      <Tabs
        class="radar-mobile-tabs"
        :active-key="activeTab"
        @change="handleMobileTabChange"
      >
        <Tabs.TabPane key="leads" tab="潜客">
          <div class="radar-mobile-filter">
            <Input
              v-model:value="mobileLeadSearch.keyword"
              allow-clear
              placeholder="企业 / 电话 / 园区"
              @press-enter="searchMobileLeads"
            />
            <div class="radar-mobile-filter-grid">
              <Select
                v-model:value="mobileLeadSearch.priorityLevel"
                allow-clear
                placeholder="优先级"
                :options="priorityOptions"
              />
              <Select
                v-model:value="mobileLeadSearch.stage"
                allow-clear
                placeholder="阶段"
                :options="RADAR_STAGE_OPTIONS"
              />
            </div>
            <div class="radar-mobile-filter-actions">
              <Button block type="primary" @click="searchMobileLeads">
                查询
              </Button>
              <Button block @click="resetMobileLeadSearch">重置</Button>
            </div>
          </div>

          <Spin :spinning="mobileLeadLoading">
            <div v-if="mobileLeadItems.length > 0" class="radar-mobile-list">
              <button
                v-for="item in mobileLeadItems"
                :key="item.leadId"
                class="radar-mobile-card"
                type="button"
                @click="goToLeadDetail(item.leadId)"
              >
                <div class="radar-mobile-card-head">
                  <div class="radar-mobile-card-title">
                    {{ item.enterpriseName || '雷达线索' }}
                  </div>
                  <Tag :color="getPriorityColor(item.priorityLevel)">
                    {{ item.priorityLevel || '-' }} 级
                  </Tag>
                </div>
                <div class="radar-mobile-card-tags">
                  <Tag :color="getStageColor(item.stage)">
                    {{ getStageLabel(item.stage) }}
                  </Tag>
                  <span>{{ item.parkName || '未分配园区' }}</span>
                  <span>{{ item.ownerName || '未分配负责人' }}</span>
                </div>
                <div class="radar-mobile-score-grid">
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
                <div class="radar-mobile-card-meta">
                  <span>意向面积：{{ formatLeadArea(item.intentArea) }}</span>
                  <span>最近信号：{{ item.latestSignalType || '-' }}</span>
                  <span>电话：{{ item.phoneNumber || '-' }}</span>
                </div>
              </button>
              <Pagination
                v-if="mobileLeadPagination.total > 0"
                class="radar-mobile-pagination"
                :current="mobileLeadPagination.current"
                :page-size="mobileLeadPagination.pageSize"
                :total="mobileLeadPagination.total"
                simple
                @change="handleMobileLeadPageChange"
              />
            </div>
            <Empty
              v-else
              class="radar-mobile-empty"
              description="暂无雷达潜客"
            />
          </Spin>
        </Tabs.TabPane>

        <Tabs.TabPane key="publicOpportunities" tab="公开机会">
          <Alert
            v-if="publicOpportunityLoadError"
            :message="publicOpportunityLoadError"
            class="mb-3"
            show-icon
            type="warning"
          />

          <div class="radar-mobile-filter">
            <Input
              v-model:value="publicOpportunitySearch.keyword"
              allow-clear
              placeholder="标题 / 联系人 / 来源"
              @press-enter="searchPublicOpportunities"
            />
            <div class="radar-mobile-filter-grid">
              <Select
                v-model:value="publicOpportunitySearch.opportunityType"
                :options="opportunityTypeOptions"
              />
              <Input
                v-model:value="publicOpportunitySearch.city"
                allow-clear
                placeholder="城市"
                @press-enter="searchPublicOpportunities"
              />
            </div>
            <Input
              v-model:value="publicOpportunitySearch.sourceSite"
              allow-clear
              placeholder="来源站点"
              @press-enter="searchPublicOpportunities"
            />
            <div class="radar-mobile-filter-actions">
              <Button block type="primary" @click="searchPublicOpportunities">
                查询
              </Button>
              <Button block @click="resetPublicOpportunitySearch">重置</Button>
            </div>
          </div>

          <Spin :spinning="publicOpportunityLoading">
            <div
              v-if="publicOpportunityItems.length > 0"
              class="radar-mobile-list"
            >
              <button
                v-for="item in publicOpportunityItems"
                :key="item.opportunityId"
                class="radar-mobile-card"
                type="button"
                @click="openPublicOpportunityDetail(item)"
              >
                <div class="radar-mobile-card-head">
                  <div class="radar-mobile-card-title">
                    {{ item.title || '公开机会' }}
                  </div>
                  <Tag
                    :color="getOpportunityTypeMeta(item.opportunityType).color"
                  >
                    {{ getOpportunityTypeMeta(item.opportunityType).label }}
                  </Tag>
                </div>
                <div class="radar-mobile-card-meta">
                  <span>区域：{{ formatRegion(item) }}</span>
                  <span>面积：{{ formatArea(item) }}</span>
                  <span>价格：{{ item.priceText || '-' }}</span>
                  <span>联系人：{{ formatContact(item) }}</span>
                  <span>来源：{{ item.sourceSite || '-' }}</span>
                  <span>时效：{{ item.publishedAgeLabel || '-' }}</span>
                </div>
                <div class="radar-mobile-card-foot">
                  <span>分数 {{ item.score ?? '-' }}</span>
                  <Button
                    size="small"
                    type="link"
                    @click.stop="openOpportunitySourceUrl(item)"
                  >
                    原网页
                  </Button>
                </div>
              </button>
              <Pagination
                v-if="publicOpportunityPagination.total > 0"
                class="radar-mobile-pagination"
                :current="publicOpportunityPagination.current"
                :page-size="publicOpportunityPagination.pageSize"
                :total="publicOpportunityPagination.total"
                simple
                @change="handlePublicOpportunityPageChange"
              />
            </div>
            <Empty
              v-else
              class="radar-mobile-empty"
              description="暂无公开机会"
            />
          </Spin>
        </Tabs.TabPane>
      </Tabs>
    </div>

    <Tabs
      v-else
      class="radar-tabs"
      :active-key="activeTab"
      @change="handleTabChange"
    >
      <Tabs.TabPane key="leads" tab="原有雷达线索">
        <div class="radar-leads-pane">
          <Grid class="radar-leads-grid" table-title="智能招商潜客列表">
            <template #toolbar-tools>
              <Space>
                <Button @click="goToDashboard">查看看板</Button>
                <Button @click="goToTasks">触达任务</Button>
                <Button @click="downloadImportTemplate">下载模板</Button>
                <Button
                  @click="
                    importModalMode = 'json';
                    importModalOpen = true;
                    importFailItems = [];
                  "
                >
                  手工导入
                </Button>
                <AUpload
                  :before-upload="handleImportFileBeforeUpload"
                  :show-upload-list="false"
                  accept=".csv,.xlsx"
                >
                  <Button>上传 CSV/XLSX</Button>
                </AUpload>
                <Button
                  type="primary"
                  :disabled="collectPolling"
                  :loading="collectPolling"
                  @click="syncRadarLeads"
                >
                  <ReloadOutlined />
                  同步潜客
                </Button>
              </Space>
            </template>
          </Grid>

          <div
            v-if="collectTask"
            class="bg-card border-border mb-4 rounded-md border px-4 py-3 text-sm"
          >
            <Space wrap>
              <span>
                任务状态：
                <span :class="collectStatusClass">
                  {{ collectStatusText[collectTask.status] }}
                </span>
              </span>
              <span>新增 {{ collectTask.created }} 条</span>
              <span>更新 {{ collectTask.updated }} 条</span>
              <span>跳过 {{ collectTask.skipped }} 条</span>
              <span>耗时 {{ formatDuration(collectTask.durationMs) }}</span>
              <span v-if="collectTask.errorReason" class="text-red-600">
                错误原因：{{ collectTask.errorReason }}
              </span>
            </Space>
          </div>
        </div>
      </Tabs.TabPane>

      <Tabs.TabPane key="externalLeads" tab="外部公开线索">
        <component :is="ExternalLeadsComponent" />
      </Tabs.TabPane>

      <Tabs.TabPane key="signalEvents" tab="企业信号">
        <component :is="SignalEventsComponent" />
      </Tabs.TabPane>

      <Tabs.TabPane key="enterpriseProfiles" tab="企业画像">
        <component :is="EnterpriseProfilesComponent" />
      </Tabs.TabPane>

      <Tabs.TabPane key="scoreRules" tab="评分规则">
        <component :is="ScoreRulesComponent" />
      </Tabs.TabPane>

      <Tabs.TabPane key="crawlerSources" tab="数据源">
        <component :is="CrawlerSourcesComponent" />
      </Tabs.TabPane>

      <Tabs.TabPane key="crawlerTasks" tab="采集任务">
        <component :is="CrawlerTasksComponent" />
      </Tabs.TabPane>

      <Tabs.TabPane key="publicDemands" tab="公开需求采集">
        <component :is="PublicDemandsComponent" embedded />
      </Tabs.TabPane>

      <Tabs.TabPane key="factoryListings" tab="公开房源采集">
        <component :is="FactoryListingsComponent" embedded />
      </Tabs.TabPane>

      <Tabs.TabPane key="publicOpportunities" tab="公开有效机会">
        <div class="radar-public-pane">
          <Alert
            v-if="publicOpportunityLoadError"
            :message="publicOpportunityLoadError"
            show-icon
            type="warning"
          />

          <Card class="public-opportunity-panel" title="查询条件">
            <Form class="radar-search-form" layout="inline">
              <Form.Item label="机会类型">
                <Select
                  v-model:value="publicOpportunitySearch.opportunityType"
                  class="radar-filter-control"
                  :options="opportunityTypeOptions"
                />
              </Form.Item>
              <Form.Item label="城市">
                <Input
                  v-model:value="publicOpportunitySearch.city"
                  allow-clear
                  class="radar-filter-control"
                  placeholder="惠州"
                  @press-enter="searchPublicOpportunities"
                />
              </Form.Item>
              <Form.Item label="来源">
                <Input
                  v-model:value="publicOpportunitySearch.sourceSite"
                  allow-clear
                  class="radar-filter-control"
                  placeholder="99cfw"
                  @press-enter="searchPublicOpportunities"
                />
              </Form.Item>
              <Form.Item label="关键词">
                <Input
                  v-model:value="publicOpportunitySearch.keyword"
                  allow-clear
                  class="radar-filter-keyword"
                  placeholder="标题 / 联系人 / 来源 URL"
                  @press-enter="searchPublicOpportunities"
                />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" @click="searchPublicOpportunities">
                    查询
                  </Button>
                  <Button @click="resetPublicOpportunitySearch">重置</Button>
                  <Button
                    :loading="publicOpportunityLoading"
                    @click="loadPublicOpportunities"
                  >
                    刷新数据
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>

          <Card class="public-opportunity-table-card" title="最新公开机会列表">
            <Table
              bordered
              :columns="publicOpportunityColumns"
              :data-source="publicOpportunityItems"
              :loading="publicOpportunityLoading"
              :locale="publicOpportunityTableLocale"
              :pagination="publicOpportunityPagination"
              :scroll="{ x: 1400 }"
              row-key="opportunityId"
              size="small"
              @change="handlePublicOpportunityTableChange"
            />
          </Card>
        </div>
      </Tabs.TabPane>
    </Tabs>

    <Modal
      v-model:open="importModalOpen"
      :ok-text="importModalMode === 'result' ? '关闭' : '确定'"
      :title="importModalMode === 'result' ? '导入失败项' : '手工导入潜客'"
      width="720px"
      @ok="handleImportModalOk"
    >
      <Input.TextArea
        v-if="importModalMode === 'json'"
        v-model:value="importJsonText"
        :auto-size="{ minRows: 12, maxRows: 20 }"
        :placeholder="importPlaceholder"
      />
      <div v-if="importModalMode === 'json'" class="text-text-secondary mt-2">
        文件上传支持 CSV 和 XLSX，XLSX 默认读取第一张工作表。
      </div>
      <Table
        v-if="importFailItems.length > 0"
        bordered
        class="mt-4"
        :columns="importFailColumns"
        :data-source="importFailItems"
        :pagination="false"
        row-key="rowNumber"
        size="small"
      />
      <template #footer>
        <Space>
          <Button v-if="importFailItems.length > 0" @click="downloadFailItems">
            导出失败项
          </Button>
          <Button @click="importModalOpen = false">关闭</Button>
          <Button
            v-if="importModalMode !== 'result'"
            type="primary"
            @click="handleImportModalOk"
          >
            确定
          </Button>
        </Space>
      </template>
    </Modal>

    <OpportunityDetailDrawer
      :item="currentPublicOpportunity"
      :loading="publicOpportunityDetailLoading"
      :open="publicOpportunityDetailOpen"
      title="公开有效机会详情"
      @open-source="openOpportunitySourceUrl"
      @update:open="handlePublicOpportunityDetailOpen"
    />
  </Page>
</template>

<style lang="less" scoped>
:deep(.radar-page-content) {
  min-height: 0;
  overflow: hidden !important;
}

.radar-tabs {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

:deep(.radar-tabs > .ant-tabs-nav) {
  flex: none;
  margin-bottom: 12px;
}

:deep(.radar-tabs .ant-tabs-content-holder) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

:deep(.radar-tabs .ant-tabs-content) {
  height: 100%;
  min-height: 0;
}

:deep(.radar-tabs .ant-tabs-tabpane) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.radar-leads-pane,
.radar-public-pane {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
}

.radar-leads-pane {
  overflow: hidden;
}

.radar-public-pane {
  overflow: auto;
}

.radar-tabs :deep(.external-leads-pane),
.radar-tabs :deep(.signal-events-pane),
.radar-tabs :deep(.enterprise-profiles-pane),
.radar-tabs :deep(.score-rules-pane),
.radar-tabs :deep(.crawler-sources-pane),
.radar-tabs :deep(.crawler-tasks-pane),
.radar-tabs :deep(.public-demands-route.is-embedded),
.radar-tabs :deep(.factory-listings-route.is-embedded) {
  height: 100%;
  min-height: 0;
  overflow: auto !important;
}

.radar-leads-grid {
  flex: 1 1 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.public-opportunity-panel {
  flex: none;
}

.public-opportunity-table-card :deep(.ant-pagination) {
  margin: 12px 0 0;
}

.public-opportunity-title {
  font-weight: 500;
  text-align: center;
}

.public-opportunity-source {
  max-width: 280px;
  margin: 0 auto;
  overflow: hidden;
  color: var(--ant-color-text-description);
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.radar-search-form {
  align-items: center;
  row-gap: 8px;
}

.radar-search-form :deep(.ant-form-item) {
  align-items: center;
  margin-bottom: 0;
}

.radar-search-form :deep(.ant-form-item-control-input) {
  min-height: 32px;
}

.radar-filter-control {
  width: 180px;
  min-width: 180px;
}

.radar-filter-keyword {
  width: 320px;
  max-width: 100%;
  min-width: 320px;
}

.radar-search-form :deep(.ant-input),
.radar-search-form :deep(.ant-input-affix-wrapper),
.radar-search-form :deep(.ant-select-selection-item),
.radar-search-form :deep(.ant-select-selection-placeholder) {
  font-size: 14px;
}

.radar-search-form :deep(.ant-input),
.radar-search-form :deep(.ant-input-affix-wrapper),
.radar-search-form :deep(.ant-select-single),
.radar-search-form :deep(.ant-select-single .ant-select-selector),
.radar-search-form :deep(.ant-select-single .ant-select-selection-search-input),
.radar-search-form :deep(.ant-btn) {
  height: 32px;
}

.radar-search-form :deep(.ant-input),
.radar-search-form :deep(.ant-input-affix-wrapper),
.radar-search-form :deep(.ant-select-single .ant-select-selector),
.radar-search-form :deep(.ant-btn) {
  line-height: 30px;
}

.radar-search-form :deep(.ant-input-affix-wrapper) {
  align-items: center;
  box-sizing: border-box;
  display: flex;
  padding-block: 0;
}

.radar-search-form :deep(.ant-input-affix-wrapper > input.ant-input) {
  height: 30px;
  line-height: 30px;
}

.radar-search-form :deep(.ant-select-single .ant-select-selector) {
  align-items: center;
  display: flex;
}

.radar-search-form :deep(.ant-select-single .ant-select-selection-item),
.radar-search-form :deep(.ant-select-single .ant-select-selection-placeholder) {
  line-height: 30px;
}

.radar-search-form :deep(.ant-form-item-label > label) {
  color: var(--ant-color-text);
  font-size: 14px;
  min-height: 32px;
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

.radar-mobile-page {
  min-height: 100%;
  padding: 12px 12px calc(var(--app-safe-area-bottom) + 24px);
  overflow-y: auto;
  background: #f6f7f9;
}

.dark .radar-mobile-page {
  background: #111315;
}

.radar-mobile-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.radar-mobile-title {
  color: var(--ant-color-text);
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;
}

.radar-mobile-subtitle {
  margin-top: 2px;
  color: var(--ant-color-text-secondary);
  font-size: 13px;
  line-height: 20px;
}

.radar-mobile-actions,
.radar-mobile-filter-actions,
.radar-mobile-filter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.radar-mobile-actions {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 12px;
}

.radar-mobile-sync-card,
.radar-mobile-filter,
.radar-mobile-card {
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 8px;
  background: var(--ant-color-bg-container);
  box-shadow: 0 4px 14px rgb(15 23 42 / 6%);
}

.radar-mobile-sync-card {
  margin-bottom: 12px;
  padding: 12px;
  font-size: 13px;
}

.radar-mobile-sync-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  color: var(--ant-color-text);
  font-weight: 600;
}

.radar-mobile-sync-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  color: var(--ant-color-text-secondary);
}

.radar-mobile-error {
  margin-top: 8px;
  color: var(--ant-color-error);
  line-height: 20px;
}

.radar-mobile-tabs {
  min-height: 0;
}

.radar-mobile-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 10px;
}

.radar-mobile-filter {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
  padding: 12px;
}

.radar-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.radar-mobile-card {
  width: 100%;
  padding: 13px;
  color: inherit;
  text-align: left;
}

.radar-mobile-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.radar-mobile-card-title {
  min-width: 0;
  color: var(--ant-color-text);
  font-size: 16px;
  font-weight: 700;
  line-height: 22px;
  word-break: break-word;
}

.radar-mobile-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin-top: 8px;
  color: var(--ant-color-text-secondary);
  font-size: 12px;
}

.radar-mobile-score-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.radar-mobile-score-grid > div {
  border-radius: 6px;
  padding: 8px 4px;
  background: var(--ant-color-fill-quaternary);
  text-align: center;
}

.radar-mobile-score-grid span {
  display: block;
  color: var(--ant-color-text-secondary);
  font-size: 11px;
  line-height: 16px;
}

.radar-mobile-score-grid strong {
  display: block;
  color: var(--ant-color-text);
  font-size: 17px;
  line-height: 22px;
}

.radar-mobile-card-meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 5px;
  margin-top: 12px;
  color: var(--ant-color-text-secondary);
  font-size: 13px;
  line-height: 20px;
}

.radar-mobile-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
  color: var(--ant-color-text-secondary);
  font-size: 13px;
}

.radar-mobile-pagination {
  margin-top: 12px;
  text-align: center;
}

.radar-mobile-empty {
  padding: 32px 0;
}

@media (max-width: 767px) {
  :deep(.radar-page-content) {
    overflow-y: auto !important;
  }
}
</style>
