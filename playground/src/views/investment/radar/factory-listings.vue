<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type {
  PublicOpportunityCrawlerProgress,
  PublicOpportunityItem,
  PublicOpportunityUrlImportResponse,
} from '#/api/investment';

import { computed, h, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  message,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  createManualPublicOpportunity,
  getEffectivePublicOpportunityList,
  getEffectivePublicOpportunityOptions,
  getEffectivePublicOpportunityProgress,
  getEffectivePublicOpportunityStats,
  getPublicOpportunityDetail,
  importPublicOpportunityUrls,
  runPublicOpportunityCrawlerTask,
} from '#/api/investment';

import {
  mergeSearchOptions,
  searchableDropdownProps,
  useSearchHistory,
} from '../search-history';
import OpportunityDetailDrawer from './opportunity-detail-drawer.vue';

defineOptions({ name: 'InvestmentRadarFactoryListings' });

defineProps<{
  embedded?: boolean;
}>();

const router = useRouter();
const loading = ref(false);
const detailLoading = ref(false);
const detailOpen = ref(false);
const loadError = ref('');
const importModalOpen = ref(false);
const importSaving = ref(false);
const importResult = ref<null | PublicOpportunityUrlImportResponse>(null);
const manualModalOpen = ref(false);
const manualSaving = ref(false);
const items = ref<PublicOpportunityItem[]>([]);
const currentItem = ref<null | PublicOpportunityItem>(null);
const crawlerProgress = ref<null | PublicOpportunityCrawlerProgress>(null);
let loadFactoryListingsVersion = 0;
let refreshFactoryListingStatsVersion = 0;
const factoryListingListScope = 'raw' as const;
const pagination = ref({
  current: 1,
  pageSize: 100,
  pageSizeOptions: ['20', '50', '100', '200'],
  showQuickJumper: true,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total.toLocaleString('zh-CN')} 条`,
  total: 0,
});
const searchForm = ref({
  city: '',
  keyword: '',
  publishedAgeLabel: '',
  sourceSite: '',
});
const citySearchHistory = useSearchHistory('radar.factory-listings.city');
const keywordSearchHistory = useSearchHistory('radar.factory-listings.keyword');
const publishedAgeSearchHistory = useSearchHistory(
  'radar.factory-listings.publishedAgeLabel',
);
const sourceSiteSearchHistory = useSearchHistory(
  'radar.factory-listings.sourceSite',
);
const publishedAgeLabelServerOptions = ref<Array<{ value: string }>>([]);
const sourceSiteServerOptions = ref<Array<{ value: string }>>([]);
const cityOptions = citySearchHistory.options();
const keywordOptions = keywordSearchHistory.options();
const publishedAgeLabelOptions = computed(() =>
  mergeSearchOptions(
    publishedAgeSearchHistory.history.value,
    publishedAgeLabelServerOptions.value.map((item) => item.value),
  ),
);
const sourceSiteOptions = computed(() =>
  mergeSearchOptions(
    sourceSiteSearchHistory.history.value,
    sourceSiteServerOptions.value.map((item) => item.value),
  ),
);
const supplyImportSourceOptions = [
  { label: 'cfzsw68 厂房网', value: 'PUBLIC_FACTORY_LISTING_CFZSW68' },
  { label: '99厂房网房源（广东）', value: 'PUBLIC_FACTORY_LISTING_99CFW_GD' },
  { label: '房天下房源（广东）', value: 'PUBLIC_FACTORY_LISTING_FANG_GD' },
  { label: '头等仓房源（广东）', value: 'PUBLIC_FACTORY_LISTING_TOODC_GD' },
  { label: '99厂房网房源（东莞）', value: 'PUBLIC_FACTORY_LISTING_99CFW_DG' },
  { label: '房天下房源（东莞）', value: 'PUBLIC_FACTORY_LISTING_FANG_DG' },
  { label: '头等仓房源（东莞）', value: 'PUBLIC_FACTORY_LISTING_TOODC_DG' },
];
const importForm = ref({
  runAfterImport: false,
  sourceCode: 'PUBLIC_FACTORY_LISTING_CFZSW68',
  urlText: '',
});
const manualForm = ref({
  areaText: '',
  city: '',
  contactName: '',
  description: '',
  district: '',
  priceText: '',
  sourceSite: 'manual',
  sourceUrl: '',
  title: '',
});

const summary = computed(() => ({
  currentPageCount: items.value.length,
  processSourceCount: crawlerProgress.value?.sourceCount || 0,
  recentTaskSourceCount:
    crawlerProgress.value?.sources.filter((source) => source.latestTask)
      .length || 0,
  total: pagination.value.total,
}));

const latestCrawlerTask = computed(() => {
  const candidates = [];
  for (const source of crawlerProgress.value?.sources || []) {
    if (source.latestTask) {
      candidates.push({
        sourceCode: source.sourceCode,
        sourceName: source.sourceName,
        task: source.latestTask,
      });
    }
  }
  return (
    candidates.sort(
      (left, right) =>
        getSortableTime(right.task.finishedAt || right.task.startedAt) -
        getSortableTime(left.task.finishedAt || left.task.startedAt),
    )[0] || null
  );
});

const latestCrawlerTaskAlertType = computed(() => {
  const status = latestCrawlerTask.value?.task.status;
  if (status === 'FAILED') {
    return 'error';
  }
  if (status === 'RUNNING') {
    return 'info';
  }
  return 'success';
});

const latestCrawlerTaskMessage = computed(() => {
  const latest = latestCrawlerTask.value;
  if (!latest) {
    const latestItem = items.value[0];
    if (latestItem?.lastSyncedAt) {
      return `最近入库记录：${latestItem.title || '公开房源'}，采集时间 ${formatSyncedTime(latestItem.lastSyncedAt)}；页面会每 60 秒自动刷新。`;
    }
    return '自动采集已开启，正在等待最近任务返回；页面会每 60 秒自动刷新。';
  }
  const task = latest.task;
  return [
    `最近采集：${latest.sourceName || latest.sourceCode}`,
    `状态 ${formatCrawlerTaskStatus(task.status)}`,
    `抓取 ${Number(task.fetchedCount || 0).toLocaleString('zh-CN')} 条`,
    `新增 ${Number(task.createdLeadCount || 0).toLocaleString('zh-CN')} 条`,
    `更新 ${Number(task.updatedLeadCount || 0).toLocaleString('zh-CN')} 条`,
    `过滤 ${Number(task.skippedCount || 0).toLocaleString('zh-CN')} 条`,
    `时间 ${formatSyncedTime(task.finishedAt || task.startedAt)}`,
  ].join('，');
});

const tableLocale = {
  emptyText: '暂无房源采集结果',
};

const shanghaiDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
});

const shanghaiTimeFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
  minute: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
});

function toAutoCompleteOptions(values?: string[]) {
  return [
    ...new Set((values || []).map((value) => value.trim()).filter(Boolean)),
  ].map((value) => ({ value }));
}

function rememberFactoryListingSearch() {
  citySearchHistory.add(searchForm.value.city);
  keywordSearchHistory.add(searchForm.value.keyword);
  publishedAgeSearchHistory.add(searchForm.value.publishedAgeLabel);
  sourceSiteSearchHistory.add(searchForm.value.sourceSite);
}

const columns: TableColumnsType<PublicOpportunityItem> = [
  {
    align: 'center',
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      h('div', { class: 'factory-title-cell' }, [
        h('div', { class: 'factory-title' }, record.title || '-'),
        h('div', { class: 'factory-source-url' }, record.sourceUrl || '-'),
      ]),
    dataIndex: 'title',
    ellipsis: true,
    key: 'title',
    title: '标题',
    width: 360,
  },
  {
    align: 'center',
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      [record.city, record.district].filter(Boolean).join(' / ') || '-',
    dataIndex: 'city',
    ellipsis: true,
    key: 'city',
    title: '城市 / 区域',
    width: 150,
  },
  {
    align: 'center',
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      formatArea(record),
    dataIndex: 'areaText',
    ellipsis: true,
    key: 'areaText',
    title: '面积',
    width: 130,
  },
  {
    align: 'center',
    customRender: ({ text }) => text || '-',
    dataIndex: 'priceText',
    ellipsis: true,
    key: 'priceText',
    title: '价格',
    width: 130,
  },
  {
    align: 'center',
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      renderSourceSite(record),
    dataIndex: 'sourceSite',
    ellipsis: true,
    key: 'sourceSite',
    title: '来源站点',
    width: 130,
  },
  {
    align: 'center',
    customRender: ({ text }) => formatPublishedDate(text),
    dataIndex: 'publishedAt',
    key: 'publishedAt',
    sorter: comparePublishedAtAsc,
    sortOrder: 'descend',
    title: '发布时间',
    width: 120,
  },
  {
    align: 'center',
    customRender: ({ text }) => text || '-',
    dataIndex: 'publishedAgeLabel',
    ellipsis: true,
    key: 'publishedAgeLabel',
    title: '时效',
    width: 110,
  },
  {
    align: 'center',
    customRender: ({ text }) => formatSyncedTime(text),
    dataIndex: 'lastSyncedAt',
    key: 'lastSyncedAt',
    title: '采集时间',
    width: 150,
  },
  {
    align: 'center',
    customRender: ({ text }) => text ?? '-',
    dataIndex: 'score',
    key: 'score',
    title: '分数',
    width: 90,
  },
  {
    align: 'center',
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      renderOpportunityStatus(record.opportunityStatus),
    dataIndex: 'opportunityStatus',
    key: 'opportunityStatus',
    title: '状态',
    width: 110,
  },
  {
    align: 'center',
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      h(Space, {}, () => [
        h(
          Button,
          {
            onClick: () => void openDetail(record),
            size: 'small',
            type: 'link',
          },
          () => '查看详情',
        ),
        h(
          Button,
          {
            onClick: () => openSource(record),
            size: 'small',
            type: 'link',
          },
          () => '原网页',
        ),
      ]),
    key: 'operation',
    title: '操作',
    width: 160,
  },
];

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

function getSortableTime(value?: null | string) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function comparePublishedAtAsc(
  left: PublicOpportunityItem,
  right: PublicOpportunityItem,
) {
  const syncedDiff =
    getSortableTime(left.lastSyncedAt) - getSortableTime(right.lastSyncedAt);
  if (syncedDiff !== 0) {
    return syncedDiff;
  }

  const publishedDiff =
    getSortableTime(left.publishedAt) - getSortableTime(right.publishedAt);
  if (publishedDiff !== 0) {
    return publishedDiff;
  }

  return Number(left.opportunityId || 0) - Number(right.opportunityId || 0);
}

function formatCrawlerTaskStatus(status?: null | string) {
  if (status === 'SUCCESS') {
    return '成功';
  }
  if (status === 'RUNNING') {
    return '运行中';
  }
  if (status === 'FAILED') {
    return '失败';
  }
  if (status === 'PENDING') {
    return '等待中';
  }
  return status || '未知';
}

function sortPublicOpportunityItemsBySyncedAtDesc(
  rows: PublicOpportunityItem[],
) {
  return [...rows].sort((left, right) => comparePublishedAtAsc(right, left));
}

function formatSyncedTime(value?: null | string) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const parts: Record<string, string> = {};
  for (const part of shanghaiTimeFormatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      parts[part.type] = part.value;
    }
  }

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function renderSourceSite(record: PublicOpportunityItem) {
  const label = record.sourceSite || record.sourceUrl || '-';
  if (!record.sourceUrl) {
    return label;
  }

  return h(
    'a',
    {
      class: 'source-site-link',
      href: record.sourceUrl,
      onClick: (event: MouseEvent) => event.stopPropagation(),
      rel: 'noopener noreferrer',
      style: {
        color: '#1677ff',
        cursor: 'pointer',
      },
      target: '_blank',
      title: record.sourceUrl,
    },
    label,
  );
}

function getOpportunityStatusMeta(status?: null | string) {
  if (status === 'EFFECTIVE') {
    return { color: 'green', label: '有效' };
  }
  if (status === 'VERIFIED') {
    return { color: 'cyan', label: '已核验' };
  }
  if (status === 'NEEDS_REVIEW') {
    return { color: 'orange', label: '待复核' };
  }
  if (status === 'EXPIRED') {
    return { color: 'red', label: '已失效' };
  }
  if (status === 'OUT_OF_SCOPE') {
    return { color: 'default', label: '越界' };
  }
  if (status === 'UNKNOWN_TIME') {
    return { color: 'orange', label: '时间待核' };
  }
  if (status === 'SOURCE_LOST') {
    return { color: 'red', label: '来源缺失' };
  }
  if (status === 'INVALID') {
    return { color: 'red', label: '无效' };
  }
  if (status === 'PARSED') {
    return { color: 'blue', label: '已解析' };
  }
  if (status === 'RAW') {
    return { color: 'default', label: '原始' };
  }
  return { color: 'blue', label: status || '待审核' };
}

function renderOpportunityStatus(status?: null | string) {
  const meta = getOpportunityStatusMeta(status);
  return h(Tag, { color: meta.color }, () => meta.label);
}

function buildQuery() {
  return {
    city: searchForm.value.city || undefined,
    currentPage: pagination.value.current,
    includeMeta: false,
    includeTotal: false,
    keyword: searchForm.value.keyword || undefined,
    opportunityType: 'SUPPLY',
    pageSize: pagination.value.pageSize,
    publishedAgeLabel: searchForm.value.publishedAgeLabel || undefined,
    scope: factoryListingListScope,
    sourceSite: searchForm.value.sourceSite || undefined,
  };
}

function buildStatsQuery() {
  return {
    city: searchForm.value.city || undefined,
    keyword: searchForm.value.keyword || undefined,
    opportunityType: 'SUPPLY',
    publishedAgeLabel: searchForm.value.publishedAgeLabel || undefined,
    scope: factoryListingListScope,
    sourceSite: searchForm.value.sourceSite || undefined,
  };
}

function updateFactoryListingFilters(filters?: {
  publishedAgeLabels?: string[];
  sourceSites?: string[];
}) {
  publishedAgeLabelServerOptions.value = toAutoCompleteOptions(
    filters?.publishedAgeLabels,
  );
  sourceSiteServerOptions.value = toAutoCompleteOptions(filters?.sourceSites);
}

async function refreshFactoryListingProgress(version: number) {
  const progress = await Promise.allSettled([
    getEffectivePublicOpportunityProgress({ opportunityType: 'SUPPLY' }),
  ]);

  if (version !== loadFactoryListingsVersion) {
    return;
  }

  const [progressResult] = progress;
  if (progressResult?.status === 'fulfilled') {
    crawlerProgress.value = progressResult.value;
  }

  if (progressResult?.status === 'rejected') {
    console.warn('load factory listing progress failed', progressResult.reason);
  }
}

async function refreshFactoryListingStats() {
  const version = ++refreshFactoryListingStatsVersion;
  try {
    const [stats, options] = await Promise.all([
      getEffectivePublicOpportunityStats(buildStatsQuery()),
      getEffectivePublicOpportunityOptions(buildStatsQuery()),
    ]);
    if (version !== refreshFactoryListingStatsVersion) {
      return;
    }
    pagination.value.total = Number(stats.total || 0);
    updateFactoryListingFilters(options.filters);
  } catch (error) {
    console.warn('load factory listing stats failed', error);
  }
}

async function loadFactoryListings() {
  const version = ++loadFactoryListingsVersion;
  loading.value = true;
  loadError.value = '';
  try {
    const query = buildQuery();
    const result = await getEffectivePublicOpportunityList(query);
    if (version !== loadFactoryListingsVersion) {
      return;
    }
    items.value = Array.isArray(result.items)
      ? sortPublicOpportunityItemsBySyncedAtDesc(result.items)
      : [];
    const itemCount = items.value.length;
    const total = result.total ?? result.page?.total;
    if (typeof total === 'number') {
      pagination.value.total = total;
    } else if (pagination.value.current === 1 && itemCount < query.pageSize) {
      pagination.value.total = itemCount;
    }
    loading.value = false;
    void refreshFactoryListingStats();
    void refreshFactoryListingProgress(version);
  } catch (error) {
    if (version !== loadFactoryListingsVersion) {
      return;
    }
    console.error('加载公开房源采集失败:', error);
    items.value = [];
    crawlerProgress.value = null;
    pagination.value.total = 0;
    loadError.value = '房源数据加载失败，请检查公开机会相关接口是否可用。';
  } finally {
    if (version === loadFactoryListingsVersion) {
      loading.value = false;
    }
  }
}

function handleSearch() {
  rememberFactoryListingSearch();
  pagination.value.current = 1;
  void loadFactoryListings();
}

function handleReset() {
  searchForm.value = {
    city: '',
    keyword: '',
    publishedAgeLabel: '',
    sourceSite: '',
  };
  handleSearch();
}

function handleTableChange(page: { current?: number; pageSize?: number }) {
  pagination.value.current = page.current || 1;
  pagination.value.pageSize = page.pageSize || 100;
  void loadFactoryListings();
}

async function openDetail(record: PublicOpportunityItem) {
  detailOpen.value = true;
  detailLoading.value = true;
  currentItem.value = record;
  try {
    currentItem.value = await getPublicOpportunityDetail(record.opportunityId);
  } catch (error) {
    console.error('加载公开房源详情失败:', error);
  } finally {
    detailLoading.value = false;
  }
}

function handleDetailOpenChange(value: boolean) {
  detailOpen.value = value;
}

function resetManualForm() {
  manualForm.value = {
    areaText: '',
    city: searchForm.value.city || '',
    contactName: '',
    description: '',
    district: '',
    priceText: '',
    sourceSite: 'manual',
    sourceUrl: '',
    title: '',
  };
}

function openManualModal() {
  resetManualForm();
  manualModalOpen.value = true;
}

function resetImportForm() {
  importForm.value = {
    runAfterImport: false,
    sourceCode: 'PUBLIC_FACTORY_LISTING_CFZSW68',
    urlText: '',
  };
  importResult.value = null;
}

function openImportModal() {
  resetImportForm();
  importModalOpen.value = true;
}

function getImportResultMessage(
  result: null | PublicOpportunityUrlImportResponse,
) {
  if (!result) {
    return '';
  }
  return [
    `已入队 ${result.seed.createdCount.toLocaleString('zh-CN')} 条`,
    `已存在 ${result.seed.updatedCount.toLocaleString('zh-CN')} 条`,
    `拒绝 ${result.rejectedCount.toLocaleString('zh-CN')} 条`,
    result.duplicateInputCount > 0
      ? `重复 ${result.duplicateInputCount.toLocaleString('zh-CN')} 条`
      : '',
  ]
    .filter(Boolean)
    .join('，');
}

function getCrawlerRunResultMessage(result: {
  createdLeadCount: number;
  fetchedCount: number;
  skippedCount: number;
  taskId: number;
  updatedLeadCount: number;
}) {
  return [
    `任务 ${result.taskId}`,
    `抓取 ${result.fetchedCount.toLocaleString('zh-CN')} 条`,
    `新增 ${result.createdLeadCount.toLocaleString('zh-CN')} 条`,
    `更新 ${result.updatedLeadCount.toLocaleString('zh-CN')} 条`,
    result.skippedCount > 0
      ? `过滤 ${result.skippedCount.toLocaleString('zh-CN')} 条`
      : '',
  ]
    .filter(Boolean)
    .join('，');
}

async function submitImportUrls() {
  const urlText = importForm.value.urlText.trim();
  if (!urlText) {
    message.warning('请粘贴公开房源详情页 URL');
    return;
  }

  importSaving.value = true;
  try {
    const result = await importPublicOpportunityUrls({
      requeueExisting: true,
      sourceCode: importForm.value.sourceCode,
      urlText,
    });
    importResult.value = result;
    const resultMessage = getImportResultMessage(result);
    if (result.acceptedCount > 0) {
      if (importForm.value.runAfterImport) {
        const task = await runPublicOpportunityCrawlerTask({
          batchSize: Math.min(result.acceptedCount, 10),
          discoverList: false,
          ignoreInterval: true,
          reprocessSuccess: false,
          sourceCode: importForm.value.sourceCode,
          staleReprocessMinutes: 5,
        });
        message.success(
          `${resultMessage}；已立即采集：${getCrawlerRunResultMessage(task)}`,
        );
        handleSearch();
      } else {
        message.success(`${resultMessage}，请在公开采集看板执行跑批`);
      }
      importModalOpen.value = false;
    } else {
      message.warning(resultMessage || '没有可入队的 URL');
    }
  } catch (error) {
    console.error('import public factory listing urls failed:', error);
    message.error('批量导入房源 URL 失败');
  } finally {
    importSaving.value = false;
  }
}

async function submitManualOpportunity() {
  const title = manualForm.value.title.trim();
  if (!title) {
    message.warning('请输入房源标题');
    return;
  }

  manualSaving.value = true;
  try {
    await createManualPublicOpportunity({
      ...manualForm.value,
      opportunityType: 'SUPPLY',
      title,
    });
    message.success('手动房源已写入公开机会池');
    manualModalOpen.value = false;
    handleSearch();
  } catch (error) {
    console.error('manual factory listing failed:', error);
    message.error('手动录入房源失败');
  } finally {
    manualSaving.value = false;
  }
}

function openSource(record: PublicOpportunityItem) {
  window.open(record.sourceUrl, '_blank', 'noopener,noreferrer');
}

function goToRadarList() {
  router.push('/investment/radar');
}

void loadFactoryListings();
const autoRefreshTimer = setInterval(() => {
  void loadFactoryListings();
}, 60_000);
const statsRefreshTimer = setInterval(() => {
  void refreshFactoryListingStats();
}, 10_000);

onBeforeUnmount(() => {
  clearInterval(autoRefreshTimer);
  clearInterval(statsRefreshTimer);
});
</script>

<template>
  <div :class="{ 'is-embedded': embedded }" class="factory-listings-route">
    <Page
      :auto-content-height="!embedded"
      class="radar-collection-page"
      content-class="radar-collection-content"
    >
      <div class="radar-collection-layout">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-lg font-semibold">公开房源采集</div>
            <div class="text-text-secondary text-sm">
              查看公开渠道采集到的可招商房源信息。
            </div>
          </div>
          <Space>
            <Button @click="goToRadarList">返回雷达列表</Button>
            <Button @click="openImportModal">批量导入URL</Button>
            <Button @click="openManualModal">手动录入房源</Button>
            <Button type="primary" @click="loadFactoryListings">
              刷新数据
            </Button>
          </Space>
        </div>

        <Alert v-if="loadError" :message="loadError" show-icon type="warning" />
        <Alert
          :message="latestCrawlerTaskMessage"
          show-icon
          :type="latestCrawlerTaskAlertType"
        />

        <Row class="radar-stat-card-grid" :gutter="[12, 12]">
          <Col :lg="6" :md="12" :sm="12" :xs="24">
            <Card class="radar-stat-card">
              <Statistic
                title="当前页采集数"
                :value="summary.currentPageCount"
              />
            </Card>
          </Col>
          <Col :lg="6" :md="12" :sm="12" :xs="24">
            <Card class="radar-stat-card">
              <Statistic title="合格采集数" :value="summary.total" />
            </Card>
          </Col>
          <Col :lg="6" :md="12" :sm="12" :xs="24">
            <Card class="radar-stat-card">
              <Statistic
                title="过程来源数"
                :value="summary.processSourceCount"
              />
            </Card>
          </Col>
          <Col :lg="6" :md="12" :sm="12" :xs="24">
            <Card class="radar-stat-card">
              <Statistic
                title="最近任务来源"
                :value="summary.recentTaskSourceCount"
              />
            </Card>
          </Col>
        </Row>

        <Card title="查询条件">
          <Form class="radar-search-form" layout="inline">
            <Form.Item label="城市">
              <AutoComplete
                v-model:value="searchForm.city"
                v-bind="searchableDropdownProps"
                allow-clear
                class="radar-filter-control"
                :options="cityOptions"
                placeholder="惠州"
                @press-enter="handleSearch"
                @select="handleSearch"
              />
            </Form.Item>
            <Form.Item label="来源">
              <AutoComplete
                v-model:value="searchForm.sourceSite"
                v-bind="searchableDropdownProps"
                allow-clear
                class="radar-filter-control"
                :options="sourceSiteOptions"
                placeholder="99cfw"
                @press-enter="handleSearch"
                @select="handleSearch"
              />
            </Form.Item>
            <Form.Item label="时效">
              <AutoComplete
                v-model:value="searchForm.publishedAgeLabel"
                v-bind="searchableDropdownProps"
                allow-clear
                class="radar-filter-control"
                :options="publishedAgeLabelOptions"
                placeholder="7 天前"
                @press-enter="handleSearch"
                @select="handleSearch"
              />
            </Form.Item>
            <Form.Item label="关键词">
              <AutoComplete
                v-model:value="searchForm.keyword"
                v-bind="searchableDropdownProps"
                allow-clear
                class="radar-filter-keyword"
                :options="keywordOptions"
                placeholder="标题 / 联系人 / 来源 URL"
                @press-enter="handleSearch"
                @select="handleSearch"
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" @click="handleSearch">查询</Button>
                <Button @click="handleReset">重置</Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>

        <Card class="radar-collection-table-card" title="房源采集结果">
          <Table
            bordered
            :columns="columns"
            :data-source="items"
            :loading="loading"
            :locale="tableLocale"
            :pagination="pagination"
            :scroll="{ x: 1490 }"
            row-key="opportunityId"
            size="small"
            table-layout="fixed"
            @change="handleTableChange"
          />
        </Card>
      </div>
    </Page>

    <OpportunityDetailDrawer
      :item="currentItem"
      :loading="detailLoading"
      :open="detailOpen"
      title="公开房源详情"
      @open-source="openSource"
      @update:open="handleDetailOpenChange"
    />

    <Modal
      v-model:open="importModalOpen"
      title="批量导入公开房源 URL"
      width="760px"
      :confirm-loading="importSaving"
      ok-text="导入队列"
      @ok="submitImportUrls"
    >
      <Form layout="vertical">
        <Form.Item label="采集平台" required>
          <Select
            v-model:value="importForm.sourceCode"
            :options="supplyImportSourceOptions"
          />
        </Form.Item>
        <Form.Item label="详情页 URL" required>
          <Input.TextArea
            v-model:value="importForm.urlText"
            :auto-size="{ minRows: 8, maxRows: 14 }"
            placeholder="每行一个公开房源详情页 URL，也可以直接粘贴一段包含 URL 的文本"
          />
        </Form.Item>
        <Form.Item>
          <Checkbox v-model:checked="importForm.runAfterImport">
            导入后立即采集当前平台，单次最多处理 10 条
          </Checkbox>
        </Form.Item>
        <Alert
          v-if="importResult"
          :message="getImportResultMessage(importResult)"
          show-icon
          :type="importResult.acceptedCount > 0 ? 'success' : 'warning'"
        />
      </Form>
    </Modal>

    <Modal
      v-model:open="manualModalOpen"
      title="手动录入公开房源"
      width="720px"
      :confirm-loading="manualSaving"
      @ok="submitManualOpportunity"
    >
      <Form layout="vertical">
        <Form.Item label="房源标题" required>
          <Input
            v-model:value="manualForm.title"
            placeholder="例如：惠州仲恺 1200 平方标准厂房出租"
          />
        </Form.Item>
        <Form.Item label="来源站点">
          <Input v-model:value="manualForm.sourceSite" placeholder="manual" />
        </Form.Item>
        <Form.Item label="来源链接">
          <Input
            v-model:value="manualForm.sourceUrl"
            placeholder="可填原网页地址；不填则自动生成应急来源"
          />
        </Form.Item>
        <Row :gutter="12">
          <Col :span="12">
            <Form.Item label="城市">
              <Input v-model:value="manualForm.city" placeholder="惠州" />
            </Form.Item>
          </Col>
          <Col :span="12">
            <Form.Item label="区域">
              <Input v-model:value="manualForm.district" placeholder="仲恺" />
            </Form.Item>
          </Col>
        </Row>
        <Row :gutter="12">
          <Col :span="12">
            <Form.Item label="面积">
              <Input v-model:value="manualForm.areaText" placeholder="1200㎡" />
            </Form.Item>
          </Col>
          <Col :span="12">
            <Form.Item label="价格">
              <Input
                v-model:value="manualForm.priceText"
                placeholder="18 元/㎡/月"
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="联系人 / 电话">
          <Input
            v-model:value="manualForm.contactName"
            placeholder="张经理 13800000000"
          />
        </Form.Item>
        <Form.Item label="补充描述">
          <Input.TextArea
            v-model:value="manualForm.description"
            :auto-size="{ minRows: 3, maxRows: 6 }"
            placeholder="可写层高、配电、消防、交通等补充信息"
          />
        </Form.Item>
      </Form>
    </Modal>
  </div>
</template>

<style lang="less" scoped>
.factory-listings-route,
.radar-collection-page,
:deep(.radar-collection-content) {
  min-height: 100%;
}

.factory-listings-route.is-embedded,
.factory-listings-route.is-embedded :deep(.radar-collection-page),
.factory-listings-route.is-embedded :deep(.radar-collection-content) {
  min-height: 100%;
}

.factory-listings-route.is-embedded :deep(.radar-collection-content) {
  box-sizing: border-box;
  padding: 0;
}

.radar-collection-layout {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: 16px;
}

.radar-collection-table-card {
  overflow: hidden;
}

.factory-title-cell,
.factory-title {
  min-width: 0;
  text-align: center;
}

.radar-stat-card-grid {
  margin: 0 !important;
}

.radar-stat-card {
  height: 100%;
}

.radar-stat-card :deep(.ant-card-body) {
  padding: 16px 18px;
}

.radar-stat-card :deep(.ant-statistic-title) {
  margin-bottom: 4px;
  color: var(--ant-color-text-secondary);
  font-size: 13px;
  line-height: 20px;
}

.radar-stat-card :deep(.ant-statistic-content) {
  color: var(--ant-color-text);
  font-size: 24px;
  line-height: 32px;
}

.factory-title {
  overflow: hidden;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.factory-source-url {
  overflow: hidden;
  color: var(--ant-color-text-description);
  margin: 0 auto;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.radar-search-form {
  --radar-filter-height: 32px;
  --radar-filter-width: 180px;

  align-items: center;
  row-gap: 8px;
  width: 100%;
}

.radar-search-form :deep(.ant-form-item) {
  align-items: center;
  margin-bottom: 0;
}

.radar-search-form :deep(.ant-form-item-control-input) {
  min-height: var(--radar-filter-height);
}

.radar-filter-control {
  width: var(--radar-filter-width);
  max-width: var(--radar-filter-width);
  min-width: var(--radar-filter-width);
}

.radar-filter-keyword {
  width: var(--radar-filter-width);
  max-width: var(--radar-filter-width);
  min-width: var(--radar-filter-width);
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
  height: var(--radar-filter-height);
}

.radar-search-form :deep(.ant-input),
.radar-search-form :deep(.ant-input-affix-wrapper),
.radar-search-form :deep(.ant-select-single .ant-select-selector),
.radar-search-form :deep(.ant-btn) {
  line-height: calc(var(--radar-filter-height) - 2px);
}

.radar-search-form :deep(.ant-input-affix-wrapper) {
  align-items: center;
  box-sizing: border-box;
  display: flex;
  padding-block: 0;
}

.radar-search-form :deep(.ant-input-affix-wrapper > input.ant-input) {
  height: calc(var(--radar-filter-height) - 2px);
  line-height: calc(var(--radar-filter-height) - 2px);
}

.radar-search-form :deep(.ant-select-single .ant-select-selector) {
  align-items: center;
  display: flex;
}

.radar-search-form :deep(.ant-select-single .ant-select-selection-item),
.radar-search-form :deep(.ant-select-single .ant-select-selection-placeholder) {
  line-height: calc(var(--radar-filter-height) - 2px);
  width: 100%;
}

.radar-search-form
  :deep(.ant-select-single .ant-select-selection-search-input) {
  text-align: left;
}

.radar-search-form :deep(.ant-form-item-label > label) {
  color: var(--ant-color-text);
  font-size: 14px;
  min-height: var(--radar-filter-height);
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

.source-site-link {
  color: var(--ant-color-primary);
}

.source-site-link:hover {
  text-decoration: underline;
}
</style>
