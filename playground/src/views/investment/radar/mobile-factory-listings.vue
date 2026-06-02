<script lang="ts" setup>
import type {
  PublicOpportunityCrawlerProgress,
  PublicOpportunityItem,
} from '#/api/investment';

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import { ChevronDown, ExternalLink, Search } from '@vben/icons';

import { FileTextOutlined } from '@ant-design/icons-vue';
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Pagination,
  Spin,
  Tag,
} from 'ant-design-vue';

import {
  createManualPublicOpportunity,
  getEffectivePublicOpportunityList,
  getEffectivePublicOpportunityOptions,
  getEffectivePublicOpportunityProgress,
  getEffectivePublicOpportunityStats,
  getPublicOpportunityDetail,
} from '#/api/investment';

import {
  mergeSearchOptions,
  searchableDropdownProps,
  useSearchHistory,
} from '../search-history';
import {
  formatArea,
  formatDateOnly,
  formatNumber,
  formatTime,
} from './mobile-utils';
import OpportunityDetailDrawer from './opportunity-detail-drawer.vue';

defineOptions({ name: 'InvestmentRadarMobileFactoryListings' });

const loading = ref(false);
const detailLoading = ref(false);
const detailOpen = ref(false);
const loadError = ref('');
const manualOpen = ref(false);
const manualSaving = ref(false);
const items = ref<PublicOpportunityItem[]>([]);
const currentItem = ref<null | PublicOpportunityItem>(null);
const filterExpanded = ref(false);
const crawlerProgress = ref<null | PublicOpportunityCrawlerProgress>(null);
let loadFactoryListingsVersion = 0;
let refreshFactoryListingStatsVersion = 0;
const factoryListingListScope = 'raw' as const;
let autoRefreshTimer: ReturnType<typeof setInterval> | undefined;
let statsRefreshTimer: ReturnType<typeof setInterval> | undefined;

const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
});

const searchForm = reactive({
  city: '',
  keyword: '',
  publishedAgeLabel: '',
  sourceSite: '',
});

const citySearchHistory = useSearchHistory(
  'radar.mobile-factory-listings.city',
);
const keywordSearchHistory = useSearchHistory(
  'radar.mobile-factory-listings.keyword',
);
const publishedAgeSearchHistory = useSearchHistory(
  'radar.mobile-factory-listings.publishedAgeLabel',
);
const sourceSiteSearchHistory = useSearchHistory(
  'radar.mobile-factory-listings.sourceSite',
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

const manualForm = reactive({
  areaText: '',
  city: '',
  contactName: '',
  description: '',
  district: '',
  phoneNumber: '',
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
  total: pagination.total,
}));

const pageSummaryText = computed(
  () => `第 ${pagination.current} 页 / 每页 ${pagination.pageSize} 条`,
);

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
      return `最近入库记录：${latestItem.title || '公开房源'}，采集时间 ${formatTime(latestItem.lastSyncedAt)}；页面会每 60 秒自动刷新。`;
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
    `时间 ${formatTime(task.finishedAt || task.startedAt)}`,
  ].join('，');
});

function handleSearch() {
  rememberFactoryListingSearch();
  pagination.current = 1;
  filterExpanded.value = false;
  void loadFactoryListings();
}

function handleReset() {
  searchForm.city = '';
  searchForm.keyword = '';
  searchForm.publishedAgeLabel = '';
  searchForm.sourceSite = '';
  filterExpanded.value = false;
  handleSearch();
}

function onPageChange(page: number, pageSize: number) {
  pagination.current = page;
  pagination.pageSize = pageSize;
  void loadFactoryListings();
}

function toggleFilter() {
  filterExpanded.value = !filterExpanded.value;
}

function toAutoCompleteOptions(values?: string[]) {
  return [
    ...new Set((values || []).map((value) => value.trim()).filter(Boolean)),
  ].map((value) => ({ value }));
}

function rememberFactoryListingSearch() {
  citySearchHistory.add(searchForm.city);
  keywordSearchHistory.add(searchForm.keyword);
  publishedAgeSearchHistory.add(searchForm.publishedAgeLabel);
  sourceSiteSearchHistory.add(searchForm.sourceSite);
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

function getSortableTime(value?: null | string) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function sortPublicOpportunityItemsByPublishedAtDesc(
  rows: PublicOpportunityItem[],
) {
  return [...rows].sort((left, right) => {
    const syncedDiff =
      getSortableTime(right.lastSyncedAt) - getSortableTime(left.lastSyncedAt);
    if (syncedDiff !== 0) {
      return syncedDiff;
    }

    const publishedDiff =
      getSortableTime(right.publishedAt) - getSortableTime(left.publishedAt);
    if (publishedDiff !== 0) {
      return publishedDiff;
    }

    return Number(right.opportunityId || 0) - Number(left.opportunityId || 0);
  });
}

function buildQuery() {
  return {
    city: searchForm.city || undefined,
    currentPage: pagination.current,
    includeMeta: false,
    includeTotal: false,
    keyword: searchForm.keyword || undefined,
    opportunityType: 'SUPPLY',
    pageSize: pagination.pageSize,
    publishedAgeLabel: searchForm.publishedAgeLabel || undefined,
    scope: factoryListingListScope,
    sourceSite: searchForm.sourceSite || undefined,
  };
}

function buildStatsQuery() {
  return {
    city: searchForm.city || undefined,
    keyword: searchForm.keyword || undefined,
    opportunityType: 'SUPPLY',
    publishedAgeLabel: searchForm.publishedAgeLabel || undefined,
    scope: factoryListingListScope,
    sourceSite: searchForm.sourceSite || undefined,
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
    console.warn(
      'load mobile factory listing progress failed',
      progressResult.reason,
    );
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
    pagination.total = Number(stats.total || 0);
    updateFactoryListingFilters(options.filters);
  } catch (error) {
    console.warn('load mobile factory listing stats failed', error);
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
      ? sortPublicOpportunityItemsByPublishedAtDesc(result.items)
      : [];
    const itemCount = items.value.length;
    const total = result.total ?? result.page?.total;
    if (typeof total === 'number') {
      pagination.total = total;
    } else if (pagination.current === 1 && itemCount < query.pageSize) {
      pagination.total = itemCount;
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
    pagination.total = 0;
    loadError.value = '房源数据加载失败，请检查公开机会相关接口是否可用。';
  } finally {
    if (version === loadFactoryListingsVersion) {
      loading.value = false;
    }
  }
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

function openSource(record: PublicOpportunityItem) {
  if (!record.sourceUrl) {
    return;
  }
  window.open(record.sourceUrl, '_blank', 'noopener,noreferrer');
}

function formatLocation(record: PublicOpportunityItem) {
  return [record.city, record.district].filter(Boolean).join(' / ') || '-';
}

function formatSource(record: PublicOpportunityItem) {
  return record.sourceSite || record.sourceUrl || '-';
}

function formatContact(record: PublicOpportunityItem) {
  const contact = [record.contactName, record.phoneNumber]
    .filter(Boolean)
    .join(' / ');
  return contact || '-';
}

function formatScore(record: PublicOpportunityItem) {
  return record.score === null || record.score === undefined
    ? '-'
    : formatNumber(record.score);
}

function formatSyncedTime(record: PublicOpportunityItem) {
  return String(formatTime(record.lastSyncedAt));
}

function resetManualForm() {
  manualForm.areaText = '';
  manualForm.city = searchForm.city || '';
  manualForm.contactName = '';
  manualForm.description = '';
  manualForm.district = '';
  manualForm.phoneNumber = '';
  manualForm.priceText = '';
  manualForm.sourceSite = 'manual';
  manualForm.sourceUrl = '';
  manualForm.title = '';
}

function openManualModal() {
  resetManualForm();
  manualOpen.value = true;
}

async function submitManualFactoryListing() {
  const title = manualForm.title.trim();
  if (!title) {
    message.warning('请输入房源标题');
    return;
  }

  manualSaving.value = true;
  try {
    await createManualPublicOpportunity({
      areaText: manualForm.areaText,
      city: manualForm.city,
      contactName: manualForm.contactName,
      description: manualForm.description,
      district: manualForm.district,
      opportunityType: 'SUPPLY',
      phoneNumber: manualForm.phoneNumber,
      priceText: manualForm.priceText,
      sourceSite: manualForm.sourceSite,
      sourceUrl: manualForm.sourceUrl,
      title,
    });
    message.success('公开房源已录入');
    manualOpen.value = false;
    handleSearch();
  } catch (error) {
    console.error('manual mobile factory listing failed:', error);
    message.error('录入公开房源失败');
  } finally {
    manualSaving.value = false;
  }
}

onMounted(() => {
  void loadFactoryListings();
  autoRefreshTimer = setInterval(() => {
    void loadFactoryListings();
  }, 60_000);
  statsRefreshTimer = setInterval(() => {
    void refreshFactoryListingStats();
  }, 10_000);
});

onBeforeUnmount(() => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
  }
  if (statsRefreshTimer) {
    clearInterval(statsRefreshTimer);
  }
});
</script>

<template>
  <div class="radar-mobile-route">
    <div class="radar-mobile-page">
      <div class="radar-mobile-header">
        <div>
          <h2>公开房源采集</h2>
          <p>查看公开渠道采集到的可招商房源信息。</p>
        </div>
        <div class="radar-mobile-header-actions">
          <Button @click="openManualModal">录入</Button>
          <Button
            type="primary"
            :loading="loading"
            @click="loadFactoryListings"
          >
            刷新
          </Button>
        </div>
      </div>

      <Alert v-if="loadError" :message="loadError" show-icon type="warning" />
      <Alert
        :message="latestCrawlerTaskMessage"
        show-icon
        :type="latestCrawlerTaskAlertType"
      />

      <div class="radar-mobile-stats">
        <div class="radar-mobile-stat-card">
          <div class="radar-stat-label">当前页房源数</div>
          <div class="radar-stat-value">
            {{ formatNumber(summary.currentPageCount) }}
          </div>
          <div class="radar-stat-note">{{ pageSummaryText }}</div>
        </div>
        <div class="radar-mobile-stat-card">
          <div class="radar-stat-label">合格采集数</div>
          <div class="radar-stat-value">
            {{ formatNumber(summary.total) }}
          </div>
          <div class="radar-stat-note">当前筛选条件下的房源</div>
        </div>
        <div class="radar-mobile-stat-card">
          <div class="radar-stat-label">过程来源数</div>
          <div class="radar-stat-value">
            {{ formatNumber(summary.processSourceCount) }}
          </div>
          <div class="radar-stat-note">不计入有效数</div>
        </div>
        <div class="radar-mobile-stat-card">
          <div class="radar-stat-label">最近任务来源</div>
          <div class="radar-stat-value">
            {{ formatNumber(summary.recentTaskSourceCount) }}
          </div>
          <div class="radar-stat-note">采集过程参考</div>
        </div>
      </div>

      <div class="radar-mobile-filter">
        <div class="mobile-search-bar">
          <AutoComplete
            v-model:value="searchForm.keyword"
            v-bind="searchableDropdownProps"
            allow-clear
            class="mobile-search-input"
            :options="keywordOptions"
            placeholder="标题 / 联系人 / 来源"
            @press-enter="handleSearch"
            @select="handleSearch"
          />
          <Button type="primary" @click="handleSearch">查询</Button>
          <Button @click="toggleFilter">
            筛选
            <ChevronDown
              :class="{ 'rotate-180': filterExpanded }"
              class="transition-transform"
            />
          </Button>
        </div>
        <div v-show="filterExpanded" class="radar-filter-content">
          <Form layout="vertical">
            <Form.Item label="城市">
              <AutoComplete
                v-model:value="searchForm.city"
                v-bind="searchableDropdownProps"
                allow-clear
                :options="cityOptions"
                placeholder="惠州"
                @press-enter="handleSearch"
                @select="handleSearch"
              />
            </Form.Item>
            <Form.Item label="来源站点">
              <AutoComplete
                v-model:value="searchForm.sourceSite"
                v-bind="searchableDropdownProps"
                allow-clear
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
                :options="publishedAgeLabelOptions"
                placeholder="7 天前"
                @press-enter="handleSearch"
                @select="handleSearch"
              />
            </Form.Item>
            <div class="radar-mobile-filter-actions">
              <Button type="primary" @click="handleSearch">
                <Search class="mr-1 h-4 w-4" />
                应用筛选
              </Button>
              <Button @click="handleReset">重置</Button>
            </div>
          </Form>
        </div>
      </div>

      <Spin :spinning="loading">
        <div v-if="items.length > 0" class="radar-mobile-list">
          <Card
            v-for="item in items"
            :key="item.opportunityId"
            class="radar-mobile-card"
            :body-style="{ padding: '0' }"
          >
            <div class="radar-card-head">
              <div class="radar-card-title" :title="item.title || '公开房源'">
                {{ item.title || '公开房源' }}
              </div>
              <Tag color="green">房源</Tag>
            </div>
            <div class="radar-card-source-row">
              <span class="radar-card-location" :title="formatLocation(item)">
                {{ formatLocation(item) }}
              </span>
              <span class="radar-card-source" :title="formatSource(item)">
                {{ formatSource(item) }}
              </span>
            </div>
            <div class="radar-card-tags">
              <span>{{ item.publishedAgeLabel || '时效未知' }}</span>
              <span>发布 {{ formatDateOnly(item.publishedAt) }}</span>
              <span>采集 {{ formatSyncedTime(item) }}</span>
              <span>评分 {{ formatScore(item) }}</span>
            </div>
            <div class="radar-card-meta">
              <div class="radar-card-metric">
                <span class="radar-card-metric-label">面积</span>
                <span class="radar-card-metric-value">
                  {{ formatArea(item) }}
                </span>
              </div>
              <div class="radar-card-metric">
                <span class="radar-card-metric-label">价格</span>
                <span class="radar-card-metric-value">
                  {{ item.priceText || '-' }}
                </span>
              </div>
              <div class="radar-card-metric radar-card-metric-wide">
                <span class="radar-card-metric-label">联系人</span>
                <span class="radar-card-metric-value">
                  {{ formatContact(item) }}
                </span>
              </div>
            </div>
            <div v-if="item.description" class="radar-card-desc">
              {{ item.description }}
            </div>
            <div class="radar-card-actions">
              <Button
                size="small"
                class="radar-action-btn"
                type="primary"
                @click.stop="openDetail(item)"
              >
                <FileTextOutlined class="mr-1 h-4 w-4" />
                详情
              </Button>
              <Button
                v-if="item.sourceUrl"
                size="small"
                class="radar-action-btn"
                @click.stop="openSource(item)"
              >
                <ExternalLink class="mr-1 h-4 w-4" />
                原网页
              </Button>
            </div>
          </Card>
          <Pagination
            v-if="pagination.total > pagination.pageSize"
            class="radar-mobile-pagination"
            size="small"
            :current="pagination.current"
            :page-size="pagination.pageSize"
            :total="pagination.total"
            @change="onPageChange"
          />
        </div>
        <Empty v-else class="radar-mobile-empty" description="暂无公开房源" />
      </Spin>
    </div>

    <OpportunityDetailDrawer
      :item="currentItem"
      :loading="detailLoading"
      :open="detailOpen"
      title="公开房源详情"
      @open-source="openSource"
      @update:open="handleDetailOpenChange"
    />

    <Modal
      v-model:open="manualOpen"
      title="手动录入公开房源"
      :confirm-loading="manualSaving"
      ok-text="保存"
      cancel-text="取消"
      @ok="submitManualFactoryListing"
    >
      <Form layout="vertical">
        <Form.Item label="房源标题" required>
          <Input
            v-model:value="manualForm.title"
            placeholder="例如：惠州仲恺 1200 平方标准厂房出租"
          />
        </Form.Item>
        <div class="radar-manual-grid">
          <Form.Item label="城市">
            <Input v-model:value="manualForm.city" placeholder="惠州" />
          </Form.Item>
          <Form.Item label="区域">
            <Input v-model:value="manualForm.district" placeholder="仲恺" />
          </Form.Item>
        </div>
        <div class="radar-manual-grid">
          <Form.Item label="面积">
            <Input v-model:value="manualForm.areaText" placeholder="1200㎡" />
          </Form.Item>
          <Form.Item label="价格">
            <Input
              v-model:value="manualForm.priceText"
              placeholder="18 元/㎡/月"
            />
          </Form.Item>
        </div>
        <div class="radar-manual-grid">
          <Form.Item label="联系人">
            <Input
              v-model:value="manualForm.contactName"
              placeholder="张经理"
            />
          </Form.Item>
          <Form.Item label="电话">
            <Input
              v-model:value="manualForm.phoneNumber"
              placeholder="手机号"
            />
          </Form.Item>
        </div>
        <Form.Item label="来源站点">
          <Input v-model:value="manualForm.sourceSite" placeholder="manual" />
        </Form.Item>
        <Form.Item label="来源链接">
          <Input v-model:value="manualForm.sourceUrl" placeholder="可选" />
        </Form.Item>
        <Form.Item label="补充描述">
          <Input.TextArea
            v-model:value="manualForm.description"
            :auto-size="{ minRows: 3, maxRows: 5 }"
            placeholder="可写层高、配电、消防、交通等补充信息"
          />
        </Form.Item>
      </Form>
    </Modal>
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

.radar-mobile-header > div:first-child {
  min-width: 0;
}

.radar-mobile-header-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  max-width: 148px;
}

.radar-mobile-header-actions :deep(.ant-btn) {
  min-width: 64px;
  padding-inline: 10px;
}

.radar-mobile-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.radar-mobile-stat-card {
  min-width: 0;
  padding: 12px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
}

.dark .radar-mobile-stat-card {
  background: #2d2d2d;
}

.radar-stat-label,
.radar-stat-note {
  overflow: hidden;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.radar-stat-value {
  margin-top: 2px;
  font-size: 24px;
  font-weight: 700;
  line-height: 32px;
  color: var(--ant-color-text);
}

.radar-stat-note {
  margin-top: 2px;
}

.radar-mobile-filter {
  margin-bottom: 8px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
}

.dark .radar-mobile-filter,
.dark .radar-mobile-card {
  background: #2d2d2d;
}

.mobile-search-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 64px 72px;
  gap: 8px;
  align-items: center;
  padding: 10px;
}

.mobile-search-input {
  min-width: 0;
}

.radar-filter-content {
  padding: 0 10px 10px;
  border-top: 1px solid var(--ant-color-border-secondary);
}

.radar-mobile-filter-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 8px;
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
  display: -webkit-box;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 16px;
  font-weight: 700;
  line-height: 23px;
  color: var(--ant-color-text);
  -webkit-line-clamp: 2;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
}

.radar-card-head :deep(.ant-tag) {
  flex: 0 0 auto;
  margin-inline-end: 0;
}

.radar-card-source-row {
  display: grid;
  grid-template-columns: minmax(0, auto) minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  margin-top: 8px;
  font-size: 12px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.radar-card-location,
.radar-card-source {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.radar-card-location {
  max-width: 112px;
  font-weight: 600;
  color: var(--ant-color-text);
}

.radar-card-source {
  overflow-wrap: anywhere;
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

.radar-card-tags span {
  min-width: 0;
  max-width: calc(50% - 4px);
  padding: 1px 7px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--ant-color-fill-tertiary);
  border-radius: 999px;
}

.radar-card-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 8px;
  margin-top: 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.radar-card-metric {
  min-width: 0;
  padding: 8px;
  background: var(--ant-color-fill-quaternary);
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 6px;
}

.radar-card-metric-wide {
  grid-column: 1 / -1;
}

.radar-card-metric-label {
  display: block;
  margin-bottom: 3px;
  font-size: 12px;
  line-height: 16px;
  color: var(--ant-color-text-tertiary);
}

.radar-card-metric-value {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  line-height: 18px;
  color: var(--ant-color-text);
  -webkit-line-clamp: 2;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
}

.radar-card-desc {
  display: -webkit-box;
  padding-top: 10px;
  margin-top: 10px;
  overflow: hidden;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
  -webkit-line-clamp: 3;
  overflow-wrap: anywhere;
  border-top: 1px solid var(--ant-color-border);
  -webkit-box-orient: vertical;
}

.radar-card-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding-top: 10px;
  margin-top: 12px;
  border-top: 1px solid var(--ant-color-border);
}

.radar-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.radar-action-btn :deep(span:not(.anticon)) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.radar-mobile-pagination {
  margin-top: 10px;
  text-align: center;
}

.radar-mobile-empty {
  padding: 32px 0;
}

.rotate-180 {
  transform: rotate(180deg);
}

.transition-transform {
  transition: transform 0.2s ease;
}

.radar-manual-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 480px) {
  .radar-manual-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
