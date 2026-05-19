<script lang="ts" setup>
import type { PublicOpportunityItem } from '#/api/investment';

import { computed, onMounted, reactive, ref } from 'vue';

import { ChevronDown, ExternalLink, Search } from '@vben/icons';

import { FileTextOutlined } from '@ant-design/icons-vue';
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Pagination,
  Spin,
  Statistic,
  Tag,
} from 'ant-design-vue';

import {
  createManualPublicOpportunity,
  getEffectivePublicOpportunityList,
  getPublicOpportunityDetail,
} from '#/api/investment';

import { formatArea, formatDateOnly, formatTime } from './mobile-utils';
import OpportunityDetailDrawer from './opportunity-detail-drawer.vue';

defineOptions({ name: 'InvestmentRadarMobilePublicDemands' });

const loading = ref(false);
const detailLoading = ref(false);
const detailOpen = ref(false);
const loadError = ref('');
const manualOpen = ref(false);
const manualSaving = ref(false);
const items = ref<PublicOpportunityItem[]>([]);
const currentItem = ref<null | PublicOpportunityItem>(null);
const filterExpanded = ref(false);

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const searchForm = reactive({
  city: '',
  keyword: '',
  publishedAgeLabel: '',
  sourceSite: '',
});

const publishedAgeLabelOptions = ref<Array<{ value: string }>>([]);
const sourceSiteOptions = ref<Array<{ value: string }>>([]);

const manualForm = reactive({
  areaText: '',
  city: '',
  contactName: '',
  description: '',
  district: '',
  industryText: '',
  phoneNumber: '',
  priceText: '',
  sourceSite: 'manual',
  sourceUrl: '',
  title: '',
});

const summary = computed(() => ({
  currentPageCount: items.value.length,
  total: pagination.total,
}));

function handleSearch() {
  pagination.current = 1;
  filterExpanded.value = false;
  void loadPublicDemands();
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
  void loadPublicDemands();
}

function toggleFilter() {
  filterExpanded.value = !filterExpanded.value;
}

function toAutoCompleteOptions(values?: string[]) {
  return [
    ...new Set((values || []).map((value) => value.trim()).filter(Boolean)),
  ].map((value) => ({ value }));
}

async function loadPublicDemands() {
  loading.value = true;
  loadError.value = '';
  try {
    const result = await getEffectivePublicOpportunityList({
      city: searchForm.city || undefined,
      currentPage: pagination.current,
      keyword: searchForm.keyword || undefined,
      opportunityType: 'DEMAND',
      pageSize: pagination.pageSize,
      publishedAgeLabel: searchForm.publishedAgeLabel || undefined,
      sourceSite: searchForm.sourceSite || undefined,
    });
    items.value = Array.isArray(result.items)
      ? result.items.filter((item) => item.opportunityType === 'DEMAND')
      : [];
    const itemCount = items.value.length;
    pagination.total =
      typeof result.total === 'number'
        ? result.total
        : result.page?.total || itemCount;
    publishedAgeLabelOptions.value = toAutoCompleteOptions(
      result.filters?.publishedAgeLabels,
    );
    sourceSiteOptions.value = toAutoCompleteOptions(
      result.filters?.sourceSites,
    );
  } catch (error) {
    console.error('加载公开需求采集失败:', error);
    items.value = [];
    pagination.total = 0;
    loadError.value = '需求数据加载失败，请检查公开机会相关接口是否可用。';
  } finally {
    loading.value = false;
  }
}

async function openDetail(record: PublicOpportunityItem) {
  detailOpen.value = true;
  detailLoading.value = true;
  currentItem.value = record;
  try {
    currentItem.value = await getPublicOpportunityDetail(record.opportunityId);
  } catch (error) {
    console.error('加载公开需求详情失败:', error);
  } finally {
    detailLoading.value = false;
  }
}

function handleDetailOpenChange(value: boolean) {
  detailOpen.value = value;
}

function openSource(record: PublicOpportunityItem) {
  window.open(record.sourceUrl, '_blank', 'noopener,noreferrer');
}

function getDemandTitle(record: PublicOpportunityItem) {
  return record.title || '公开需求';
}

function getPublishedAgeText(record: PublicOpportunityItem) {
  return record.publishedAgeLabel || '-';
}

function getRegionText(record: PublicOpportunityItem) {
  return [record.city, record.district].filter(Boolean).join(' / ') || '-';
}

function getSourceSiteText(record: PublicOpportunityItem) {
  return record.sourceSite || '-';
}

function getAreaText(record: PublicOpportunityItem) {
  return String(formatArea(record));
}

function getPriceText(record: PublicOpportunityItem) {
  return record.priceText || '-';
}

function getContactNameText(record: PublicOpportunityItem) {
  return record.contactName || '-';
}

function getPhoneText(record: PublicOpportunityItem) {
  return record.phoneNumber || '-';
}

function getPublishedDateText(record: PublicOpportunityItem) {
  return String(formatDateOnly(record.publishedAt));
}

function getSyncedTimeText(record: PublicOpportunityItem) {
  return String(formatTime(record.lastSyncedAt));
}

function getScoreText(record: PublicOpportunityItem) {
  return String(record.score ?? '-');
}

function getDescriptionText(record: PublicOpportunityItem) {
  return record.description || '';
}

function resetManualForm() {
  manualForm.areaText = '';
  manualForm.city = searchForm.city || '';
  manualForm.contactName = '';
  manualForm.description = '';
  manualForm.district = '';
  manualForm.industryText = '';
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

async function submitManualDemand() {
  const title = manualForm.title.trim();
  if (!title) {
    message.warning('请输入需求标题');
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
      industryText: manualForm.industryText,
      opportunityType: 'DEMAND',
      phoneNumber: manualForm.phoneNumber,
      priceText: manualForm.priceText,
      sourceSite: manualForm.sourceSite,
      sourceUrl: manualForm.sourceUrl,
      title,
    });
    message.success('公开需求已录入');
    manualOpen.value = false;
    handleSearch();
  } catch (error) {
    console.error('manual mobile public demand failed:', error);
    message.error('录入公开需求失败');
  } finally {
    manualSaving.value = false;
  }
}

onMounted(() => {
  void loadPublicDemands();
});
</script>

<template>
  <div class="radar-mobile-route">
    <div class="radar-mobile-page">
      <div class="radar-mobile-header">
        <div>
          <h2>公开需求采集</h2>
          <p>查看公开渠道采集到的企业选址与求租需求。</p>
        </div>
        <div class="radar-mobile-header-actions">
          <Button @click="openManualModal">录入</Button>
          <Button type="primary" :loading="loading" @click="loadPublicDemands">
            刷新
          </Button>
        </div>
      </div>

      <Alert v-if="loadError" :message="loadError" show-icon type="warning" />

      <div class="radar-mobile-stats">
        <Card class="radar-mobile-stat-card">
          <Statistic title="当前页需求数" :value="summary.currentPageCount" />
        </Card>
        <Card class="radar-mobile-stat-card">
          <Statistic title="总需求数" :value="summary.total" />
        </Card>
      </div>

      <div class="radar-mobile-filter">
        <div class="mobile-search-bar">
          <Input
            v-model:value="searchForm.keyword"
            allow-clear
            class="mobile-search-input"
            placeholder="标题 / 联系人 / 来源"
            @press-enter="handleSearch"
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
              <Input
                v-model:value="searchForm.city"
                allow-clear
                placeholder="惠州"
                @press-enter="handleSearch"
              />
            </Form.Item>
            <Form.Item label="来源站点">
              <Input
                v-model:value="searchForm.sourceSite"
                allow-clear
                placeholder="99cfw"
                @press-enter="handleSearch"
              />
            </Form.Item>
            <Form.Item label="时效">
              <Input
                v-model:value="searchForm.publishedAgeLabel"
                allow-clear
                placeholder="7 天前"
                @press-enter="handleSearch"
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
              <div class="radar-card-title" :title="getDemandTitle(item)">
                {{ getDemandTitle(item) }}
              </div>
              <Tag class="radar-card-type" color="blue">需求</Tag>
            </div>
            <div class="radar-card-tags">
              <span class="radar-card-chip" :title="getRegionText(item)">
                {{ getRegionText(item) }}
              </span>
              <span class="radar-card-chip" :title="getSourceSiteText(item)">
                {{ getSourceSiteText(item) }}
              </span>
              <span class="radar-card-chip" :title="getPublishedAgeText(item)">
                {{ getPublishedAgeText(item) }}
              </span>
            </div>
            <div class="radar-card-meta">
              <span class="radar-meta-item" :title="getAreaText(item)">
                <span>面积</span>
                <strong>{{ getAreaText(item) }}</strong>
              </span>
              <span class="radar-meta-item" :title="getPriceText(item)">
                <span>预算</span>
                <strong>{{ getPriceText(item) }}</strong>
              </span>
              <span class="radar-meta-item" :title="getContactNameText(item)">
                <span>联系人</span>
                <strong>{{ getContactNameText(item) }}</strong>
              </span>
              <span class="radar-meta-item" :title="getPhoneText(item)">
                <span>电话</span>
                <strong>{{ getPhoneText(item) }}</strong>
              </span>
              <span class="radar-meta-item" :title="getPublishedDateText(item)">
                <span>发布</span>
                <strong>{{ getPublishedDateText(item) }}</strong>
              </span>
              <span class="radar-meta-item" :title="getSyncedTimeText(item)">
                <span>采集</span>
                <strong>{{ getSyncedTimeText(item) }}</strong>
              </span>
              <span class="radar-meta-item" :title="getScoreText(item)">
                <span>分数</span>
                <strong>{{ getScoreText(item) }}</strong>
              </span>
            </div>
            <div
              v-if="item.description"
              class="radar-card-desc"
              :title="getDescriptionText(item)"
            >
              {{ getDescriptionText(item) }}
            </div>
            <div class="radar-card-actions">
              <Button
                size="small"
                class="radar-action-btn"
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
        <Empty v-else class="radar-mobile-empty" description="暂无公开需求" />
      </Spin>
    </div>

    <OpportunityDetailDrawer
      :item="currentItem"
      :loading="detailLoading"
      :open="detailOpen"
      title="公开需求详情"
      @open-source="openSource"
      @update:open="handleDetailOpenChange"
    />

    <Modal
      v-model:open="manualOpen"
      title="手动录入公开需求"
      :confirm-loading="manualSaving"
      ok-text="保存"
      cancel-text="取消"
      @ok="submitManualDemand"
    >
      <Form layout="vertical">
        <Form.Item label="需求标题" required>
          <Input
            v-model:value="manualForm.title"
            placeholder="例如：某制造企业求租 1500 平方厂房"
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
          <Form.Item label="面积需求">
            <Input v-model:value="manualForm.areaText" placeholder="1500㎡" />
          </Form.Item>
          <Form.Item label="预算">
            <Input
              v-model:value="manualForm.priceText"
              placeholder="20 元/㎡/月"
            />
          </Form.Item>
        </div>
        <div class="radar-manual-grid">
          <Form.Item label="联系人">
            <Input v-model:value="manualForm.contactName" placeholder="王总" />
          </Form.Item>
          <Form.Item label="电话">
            <Input
              v-model:value="manualForm.phoneNumber"
              placeholder="手机号"
            />
          </Form.Item>
        </div>
        <Form.Item label="行业">
          <Input
            v-model:value="manualForm.industryText"
            placeholder="智能制造"
          />
        </Form.Item>
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
            placeholder="可写搬迁、扩产、仓储、产线等需求信号"
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

.radar-mobile-header-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
}

.radar-mobile-page :deep(.ant-alert) {
  margin-bottom: 8px;
}

.radar-mobile-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.radar-mobile-stat-card {
  overflow: hidden;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
}

.dark .radar-mobile-stat-card {
  background: #2d2d2d;
}

.radar-mobile-stat-card :deep(.ant-card-body) {
  padding: 12px !important;
}

.radar-mobile-stat-card :deep(.ant-statistic-title) {
  margin-bottom: 4px;
  overflow: hidden;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.radar-mobile-stat-card :deep(.ant-statistic-content) {
  overflow: hidden;
  font-size: 22px;
  line-height: 28px;
  color: var(--ant-color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
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
  word-break: break-word;
  -webkit-box-orient: vertical;
}

.radar-card-type {
  flex: 0 0 auto;
  margin-inline-end: 0;
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

.radar-card-chip {
  min-width: 0;
  max-width: 100%;
  padding: 2px 7px;
  overflow: hidden;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--ant-color-fill-tertiary);
  border-radius: 4px;
}

.radar-card-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 10px;
  margin-top: 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.radar-meta-item {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 4px;
  align-items: baseline;
  min-width: 0;
}

.radar-meta-item span {
  color: var(--ant-color-text-tertiary);
}

.radar-meta-item strong {
  min-width: 0;
  overflow: hidden;
  font-weight: 400;
  color: var(--ant-color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
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
  word-break: break-word;
  border-top: 1px solid var(--ant-color-border);
  -webkit-box-orient: vertical;
}

.radar-card-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
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
  height: auto;
  min-height: 32px;
  white-space: normal;
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
