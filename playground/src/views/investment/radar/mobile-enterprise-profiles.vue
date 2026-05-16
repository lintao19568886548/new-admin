<script lang="ts" setup>
import type {
  EnterpriseProfile,
  EnterpriseTag,
  SignalEvent,
  SignalEventType,
} from '#/api/investment';

import { onMounted, reactive, ref } from 'vue';

import { ReloadOutlined } from '@ant-design/icons-vue';
import {
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  message,
  Pagination,
  Progress,
  Spin,
  Tag,
} from 'ant-design-vue';

import {
  getEnterpriseProfileDetail,
  getEnterpriseProfileList,
  getEnterpriseProfileSignals,
  getEnterpriseProfileTags,
  rebuildEnterpriseProfileDemo,
} from '#/api/investment';

import { formatDateOnly } from './mobile-utils';

defineOptions({ name: 'InvestmentRadarMobileEnterpriseProfiles' });

const loading = ref(false);
const detailLoading = ref(false);
const rebuilding = ref(false);
const detailOpen = ref(false);
const items = ref<EnterpriseProfile[]>([]);
const currentProfile = ref<EnterpriseProfile | null>(null);
const tagItems = ref<EnterpriseTag[]>([]);
const signalItems = ref<SignalEvent[]>([]);
const rebuildSummary = ref<null | {
  createdProfileCount: number;
  createdTagCount: number;
  signalEventCount: number;
  sourceCompanyCount: number;
  updatedProfileCount: number;
  updatedTagCount: number;
}>(null);

const searchForm = reactive({
  industryName: '',
  keyword: '',
  regionCity: '',
});

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const eventTypeMeta: Record<
  SignalEventType | string,
  { color: string; label: string }
> = {
  EIA_EXPAND: { color: 'red', label: '环评扩产' },
  FACTORY_RENT_DEMAND: { color: 'blue', label: '租厂需求' },
  NEWS_EXPAND: { color: 'purple', label: '新闻扩张' },
  PUBLIC_FACTORY_DEMAND: { color: 'cyan', label: '公开厂房需求' },
  RECRUITMENT_EXPAND: { color: 'gold', label: '招聘扩张' },
  RELOCATION: { color: 'orange', label: '搬迁' },
  UNKNOWN: { color: 'default', label: '未知' },
};

function formatRegion(record: EnterpriseProfile) {
  return (
    [record.regionProvince, record.regionCity, record.regionDistrict]
      .filter(Boolean)
      .join(' / ') || '-'
  );
}

function renderEventType(eventType?: null | string) {
  if (!eventType) {
    return { color: 'default', label: '-' };
  }
  const meta = eventTypeMeta[eventType] || {
    color: 'default',
    label: eventType,
  };
  return meta;
}

function buildQuery() {
  return {
    currentPage: pagination.current,
    industryName: searchForm.industryName || undefined,
    keyword: searchForm.keyword || undefined,
    pageSize: pagination.pageSize,
    regionCity: searchForm.regionCity || undefined,
  };
}

async function loadProfiles() {
  loading.value = true;
  try {
    const result = await getEnterpriseProfileList(buildQuery());
    items.value = result.items;
    pagination.total = result.total;
  } catch (error) {
    console.error('加载企业画像失败:', error);
    items.value = [];
    pagination.total = 0;
  } finally {
    loading.value = false;
  }
}

function searchProfiles() {
  pagination.current = 1;
  void loadProfiles();
}

function resetSearch() {
  searchForm.industryName = '';
  searchForm.keyword = '';
  searchForm.regionCity = '';
  searchProfiles();
}

function onPageChange(page: number, pageSize: number) {
  pagination.current = page;
  pagination.pageSize = pageSize;
  void loadProfiles();
}

async function rebuildDemoProfiles() {
  if (rebuilding.value) {
    return;
  }
  rebuilding.value = true;
  try {
    const result = await rebuildEnterpriseProfileDemo();
    rebuildSummary.value = result;
    message.success(
      `重建完成：画像新增 ${result.createdProfileCount}，更新 ${result.updatedProfileCount}`,
    );
    pagination.current = 1;
    await loadProfiles();
  } catch (error) {
    console.error('重建企业画像失败:', error);
    message.error('重建 demo 企业画像失败');
  } finally {
    rebuilding.value = false;
  }
}

async function openDetail(record: EnterpriseProfile) {
  detailOpen.value = true;
  detailLoading.value = true;
  currentProfile.value = record;
  tagItems.value = [];
  signalItems.value = [];
  try {
    const [detail, tags, signals] = await Promise.all([
      getEnterpriseProfileDetail(record.profileId),
      getEnterpriseProfileTags(record.profileId),
      getEnterpriseProfileSignals(record.profileId),
    ]);
    currentProfile.value = detail;
    tagItems.value = tags.items;
    signalItems.value = signals.items;
  } catch (error) {
    console.error('加载企业画像详情失败:', error);
    message.error('企业画像详情加载失败');
  } finally {
    detailLoading.value = false;
  }
}

onMounted(() => {
  void loadProfiles();
});
</script>

<template>
  <div class="radar-mobile-page">
    <div class="radar-mobile-header">
      <Button type="primary" :loading="loading" @click="loadProfiles">
        <ReloadOutlined class="mr-1 h-4 w-4" />
        刷新
      </Button>
    </div>

    <div class="radar-mobile-filter">
      <Form layout="vertical">
        <Form.Item>
          <Input
            v-model:value="searchForm.keyword"
            allow-clear
            placeholder="企业 / 行业 / 地区"
            @press-enter="searchProfiles"
          />
        </Form.Item>
        <div class="filter-row">
          <Form.Item class="filter-item">
            <Input
              v-model:value="searchForm.industryName"
              allow-clear
              placeholder="行业"
              @press-enter="searchProfiles"
            />
          </Form.Item>
          <Form.Item class="filter-item">
            <Input
              v-model:value="searchForm.regionCity"
              allow-clear
              placeholder="城市"
              @press-enter="searchProfiles"
            />
          </Form.Item>
        </div>
        <div class="filter-actions">
          <Button type="primary" @click="searchProfiles">查询</Button>
          <Button @click="resetSearch">重置</Button>
          <Button :loading="rebuilding" @click="rebuildDemoProfiles">
            重建 demo
          </Button>
        </div>
      </Form>
    </div>

    <div v-if="rebuildSummary" class="rebuild-summary">
      最近重建：信号 {{ rebuildSummary.signalEventCount }}，企业
      {{ rebuildSummary.sourceCompanyCount }}，画像新增
      {{ rebuildSummary.createdProfileCount }}，画像更新
      {{ rebuildSummary.updatedProfileCount }}
    </div>

    <Spin :spinning="loading">
      <div v-if="items.length > 0" class="radar-mobile-list">
        <Card
          v-for="item in items"
          :key="item.profileId"
          class="radar-mobile-card"
          :body-style="{ padding: '0' }"
        >
          <div class="radar-card-head">
            <div class="radar-card-title">{{ item.companyName }}</div>
            <Progress
              :percent="item.profileCompleteness"
              :status="item.profileCompleteness >= 70 ? 'success' : 'normal'"
              size="small"
              type="circle"
            />
          </div>
          <div class="radar-card-tags">
            <span>{{ item.industryName || '-' }}</span>
            <span>{{ formatRegion(item) }}</span>
          </div>
          <div class="radar-card-meta">
            <div class="meta-row">
              <span class="meta-label">信号数</span>
              <span class="meta-value">{{ item.signalCount }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">最新意图</span>
              <Tag :color="renderEventType(item.latestIntentType).color">
                {{ renderEventType(item.latestIntentType).label }}
              </Tag>
            </div>
            <div class="meta-row">
              <span class="meta-label">最新信号</span>
              <span class="meta-value">{{
                formatDateOnly(item.lastSignalTime)
              }}</span>
            </div>
          </div>
          <div
            v-if="item.industryTags?.length"
            class="radar-card-industry-tags"
          >
            <Tag
              v-for="tag in item.industryTags.slice(0, 4)"
              :key="tag"
              color="blue"
            >
              {{ tag }}
            </Tag>
            <span
              v-if="item.industryTags.length > 4"
              class="text-text-secondary"
            >
              +{{ item.industryTags.length - 4 }}
            </span>
          </div>
          <div class="radar-card-actions">
            <Button
              size="small"
              class="radar-action-btn"
              @click="openDetail(item)"
            >
              查看详情
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
      <Empty v-else class="radar-mobile-empty" description="暂无企业画像" />
    </Spin>

    <Drawer
      v-model:open="detailOpen"
      destroy-on-close
      title="企业画像详情"
      placement="right"
      width="100%"
    >
      <div v-if="detailLoading" class="drawer-loading">加载中...</div>
      <template v-else-if="currentProfile">
        <div class="detail-section">
          <div class="detail-company-name">
            {{ currentProfile.companyName }}
          </div>
          <div class="detail-meta">
            <span>{{ currentProfile.industryName || '-' }}</span>
            <span>{{ formatRegion(currentProfile) }}</span>
          </div>
          <Progress
            :percent="currentProfile.profileCompleteness"
            class="detail-progress"
          />
        </div>

        <div class="detail-section">
          <div class="detail-section-title">基本信息</div>
          <div class="detail-row">
            <span class="detail-label">信号数量</span>
            <span class="detail-value">{{ currentProfile.signalCount }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">最新意图</span>
            <Tag
              :color="renderEventType(currentProfile.latestIntentType).color"
            >
              {{ renderEventType(currentProfile.latestIntentType).label }}
            </Tag>
          </div>
          <div class="detail-row">
            <span class="detail-label">统一社会信用代码</span>
            <span class="detail-value">{{
              currentProfile.unifiedSocialCreditCode || '-'
            }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">注册资本</span>
            <span class="detail-value">{{
              currentProfile.registeredCapital ?? '-'
            }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">地址</span>
            <span class="detail-value">{{
              currentProfile.address || '-'
            }}</span>
          </div>
        </div>

        <div v-if="tagItems.length > 0" class="detail-section">
          <div class="detail-section-title">企业标签</div>
          <div class="tag-list">
            <div v-for="tag in tagItems" :key="tag.tagId" class="tag-item">
              <Tag :color="tag.tagType === 'INDUSTRY' ? 'blue' : 'green'">
                {{ tag.tagType }}
              </Tag>
              <span class="tag-name">{{ tag.tagName }}</span>
              <span class="tag-confidence">{{ tag.confidenceScore }}</span>
            </div>
          </div>
        </div>

        <div v-if="signalItems.length > 0" class="detail-section">
          <div class="detail-section-title">关联信号</div>
          <div class="signal-list">
            <div
              v-for="signal in signalItems"
              :key="signal.eventId"
              class="signal-item"
            >
              <div class="signal-header">
                <Tag :color="renderEventType(signal.eventType).color">
                  {{ renderEventType(signal.eventType).label }}
                </Tag>
                <span class="signal-time">{{
                  formatDateOnly(signal.eventTime)
                }}</span>
              </div>
              <div class="signal-title">{{ signal.eventTitle }}</div>
              <div class="signal-source">{{ signal.sourceName }}</div>
            </div>
          </div>
        </div>
      </template>
    </Drawer>
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

.radar-mobile-filter {
  margin-bottom: 8px;
  padding: 12px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
}

.dark .radar-mobile-filter {
  background: #2d2d2d;
}

.filter-row {
  display: flex;
  gap: 8px;
}

.filter-item {
  flex: 1;
}

.filter-actions {
  display: flex;
  gap: 8px;
}

.filter-actions Button {
  flex: 1;
}

.filter-actions > :last-child:nth-child(odd) {
  flex-basis: 100%;
}

.rebuild-summary {
  padding: 8px 12px;
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  background: #fff;
  border-radius: 8px;
}

.dark .rebuild-summary {
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

.dark .radar-mobile-card {
  background: #2d2d2d;
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
  font-size: 16px;
  font-weight: 700;
  line-height: 23px;
  color: var(--ant-color-text);
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

.radar-card-meta {
  margin-top: 10px;
}

.meta-row {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}

.meta-row:last-child {
  margin-bottom: 0;
}

.meta-label {
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  min-width: 60px;
  flex-shrink: 0;
}

.meta-value {
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
}

.radar-card-industry-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.radar-card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--ant-color-border);
}

.radar-action-btn {
  flex: 1;
  justify-content: center;
}

.radar-mobile-pagination {
  margin-top: 10px;
  text-align: center;
}

.radar-mobile-empty {
  padding: 32px 0;
}

.drawer-loading {
  padding: 16px;
  text-align: center;
}

.detail-section {
  padding: 12px 0;
  border-bottom: 1px solid var(--ant-color-border);
}

.detail-section:last-child {
  border-bottom: none;
}

.detail-company-name {
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
  color: var(--ant-color-text);
}

.detail-meta {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.detail-progress {
  margin-top: 12px;
}

.detail-section-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: var(--ant-color-text);
  margin-bottom: 10px;
}

.detail-row {
  display: flex;
  gap: 8px;
  padding: 6px 0;
}

.detail-label {
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  min-width: 80px;
  flex-shrink: 0;
}

.detail-value {
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
  flex: 1;
}

.tag-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tag-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.tag-name {
  flex: 1;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
}

.tag-confidence {
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.signal-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.signal-item {
  padding: 10px;
  background: var(--ant-color-fill);
  border-radius: 8px;
}

.signal-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}

.signal-time {
  font-size: 11px;
  line-height: 16px;
  color: var(--ant-color-text-secondary);
  margin-left: auto;
}

.signal-title {
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
}

.signal-source {
  font-size: 11px;
  line-height: 16px;
  color: var(--ant-color-text-secondary);
  margin-top: 2px;
}
</style>
