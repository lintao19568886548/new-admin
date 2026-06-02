<script lang="ts" setup>
import { computed } from 'vue';

import {
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Skeleton,
  Statistic,
  Tag,
} from 'ant-design-vue';

type PublicCrawlCityDistributionItem = {
  cityCode?: null | string;
  cityName: string;
  demandCount: number;
  effectiveCount: number;
  listingCount: number;
  pendingVerifyCount: number;
  percent?: null | number;
};

type PublicCrawlPlatformDistributionItem = {
  demandCount: number;
  fetchedCount?: number;
  hiddenCount: number;
  latestTaskStatus?: null | string;
  listingCount: number;
  percent?: null | number;
  platformCode: string;
  platformName: string;
  sourceCode?: null | string;
  totalCount: number;
  updatedCount?: number;
  upsertedCount?: number;
  zeroFetched?: boolean;
};

type PublicCrawlStatsSummary = {
  demandEffectiveRate?: null | number;
  failedPlatformCount: number;
  fetchSuccessRate?: null | number;
  guangdongDemandEffectiveCount: number;
  guangdongListingEffectiveCount: number;
  lastCrawledAt?: null | string;
  listingEffectiveRate?: null | number;
  nonGuangdongHiddenCount: number;
  nonGuangdongHiddenRate?: null | number;
  pendingVerifyCount: number;
  pendingVerifyOverdueCount?: null | number;
  platformCount: number;
  platformFetchedCount: number;
  platformSuccessCount: number;
  todayFetchedChange?: null | number;
  todayFetchedCount: number;
  zeroFetchedPlatformCount: number;
};

const props = withDefaults(
  defineProps<{
    cityDistribution?: PublicCrawlCityDistributionItem[];
    loading?: boolean;
    mockFallback?: boolean;
    platformDistribution?: PublicCrawlPlatformDistributionItem[];
    summary?: null | PublicCrawlStatsSummary;
  }>(),
  {
    cityDistribution: () => [],
    loading: false,
    mockFallback: true,
    platformDistribution: () => [],
    summary: null,
  },
);

const resolvedSummary = computed(() => {
  if (props.summary) {
    return props.summary;
  }
  return null;
});

const resolvedPlatformDistribution = computed(() => {
  return props.platformDistribution;
});

const resolvedCityDistribution = computed(() => {
  return props.cityDistribution;
});

const platformTotal = computed(() =>
  resolvedPlatformDistribution.value.reduce(
    (total, item) => total + toSafeNumber(item.totalCount),
    0,
  ),
);

const cityTotal = computed(() =>
  resolvedCityDistribution.value.reduce(
    (total, item) => total + toSafeNumber(item.effectiveCount),
    0,
  ),
);

const metricItems = computed(() => {
  const summary = resolvedSummary.value;
  if (!summary) {
    return [];
  }

  return [
    {
      color: 'blue',
      key: 'guangdongListingEffectiveCount',
      label: '老板口径房源 EFFECTIVE',
      meta: `广东房源有效率 ${formatPercent(summary.listingEffectiveRate)}`,
      value: summary.guangdongListingEffectiveCount,
    },
    {
      color: 'green',
      key: 'guangdongDemandEffectiveCount',
      label: '老板口径需求 EFFECTIVE',
      meta: `广东需求有效率 ${formatPercent(summary.demandEffectiveRate)}`,
      value: summary.guangdongDemandEffectiveCount,
    },
    {
      color: 'cyan',
      key: 'todayFetchedCount',
      label: '今日 EFFECTIVE 新增',
      meta: `有效池新增 ${formatSignedNumber(summary.todayFetchedChange)}`,
      value: summary.todayFetchedCount,
    },
    {
      color: 'purple',
      key: 'platformCount',
      label: '采集任务平台',
      meta: `过程任务 ${formatNumber(summary.platformSuccessCount)} 个成功 / ${formatNumber(summary.failedPlatformCount)} 个失败`,
      value: summary.platformCount,
    },
    {
      color: summary.zeroFetchedPlatformCount > 0 ? 'red' : 'green',
      key: 'zeroFetchedPlatformCount',
      label: '零抓取平台',
      meta: `过程抓取详情 ${formatNumber(summary.platformFetchedCount)} 条`,
      value: summary.zeroFetchedPlatformCount,
    },
    {
      color: 'orange',
      key: 'pendingVerifyCount',
      label: '待纠偏数据',
      meta: `超时 ${formatNumber(summary.pendingVerifyOverdueCount)} 条`,
      value: summary.pendingVerifyCount,
    },
    {
      color: 'red',
      key: 'nonGuangdongHiddenCount',
      label: '非广东隐藏数',
      meta: `隐藏占比 ${formatPercent(summary.nonGuangdongHiddenRate)}`,
      value: summary.nonGuangdongHiddenCount,
    },
  ];
});

function formatNumber(value?: null | number) {
  const numericValue = toSafeNumber(value);
  return numericValue.toLocaleString('zh-CN');
}

function formatPercent(value?: null | number) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  const normalized = Number(value) <= 1 ? Number(value) * 100 : Number(value);
  return `${normalized.toFixed(1)}%`;
}

function formatSignedNumber(value?: null | number) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  const numericValue = Number(value);
  const prefix = numericValue > 0 ? '+' : '';
  return `${prefix}${numericValue.toLocaleString('zh-CN')}`;
}

function getDistributionPercent(
  percent: null | number | undefined,
  value: number,
  total: number,
) {
  if (percent !== null && percent !== undefined && !Number.isNaN(percent)) {
    const normalized = percent <= 1 ? percent * 100 : percent;
    return Math.max(0, Math.min(100, normalized));
  }

  if (total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (value / total) * 100));
}

function toSafeNumber(value?: null | number) {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function getTaskStatusColor(status?: null | string, zeroFetched?: boolean) {
  if (zeroFetched) {
    return 'red';
  }
  if (status === 'SUCCESS') {
    return 'green';
  }
  if (status === 'FAILED') {
    return 'red';
  }
  if (status === 'RUNNING' || status === 'PENDING') {
    return 'processing';
  }
  return 'default';
}

function getTaskStatusText(status?: null | string, zeroFetched?: boolean) {
  if (zeroFetched) {
    return '成功但零抓取';
  }
  const statusTextMap: Record<string, string> = {
    CANCELED: '已取消',
    FAILED: '失败',
    PENDING: '等待中',
    RUNNING: '运行中',
    SUCCESS: '成功',
  };
  return status ? statusTextMap[status] || status : '未运行';
}
</script>

<template>
  <Skeleton :loading="loading" active>
    <div class="public-crawl-stats-panel">
      <Empty
        v-if="!resolvedSummary"
        class="public-crawl-empty"
        description="暂无真实统计数据"
      />

      <Row v-else class="crawl-metric-grid" :gutter="[12, 12]">
        <Col
          v-for="item in metricItems"
          :key="item.key"
          :lg="8"
          :md="12"
          :sm="12"
          :xs="24"
        >
          <Card class="crawl-metric-card">
            <Statistic
              :title="item.label"
              :value="item.value"
              :value-style="{ color: 'var(--ant-color-text)' }"
            />
            <div class="crawl-metric-meta">
              <Tag :color="item.color">{{ item.meta }}</Tag>
            </div>
          </Card>
        </Col>
      </Row>

      <Row :gutter="[12, 12]">
        <Col :lg="12" :md="24" :sm="24" :xs="24">
          <Card
            class="distribution-card"
            title="平台分布（过程指标 / EFFECTIVE）"
          >
            <div
              v-if="resolvedPlatformDistribution.length > 0"
              class="distribution-list"
            >
              <div
                v-for="item in resolvedPlatformDistribution"
                :key="item.platformCode"
                class="distribution-item"
              >
                <div class="distribution-head">
                  <div>
                    <strong>{{ item.platformName }}</strong>
                    <span>
                      房源EFFECTIVE {{ formatNumber(item.listingCount) }} /
                      需求EFFECTIVE {{ formatNumber(item.demandCount) }} /
                      过程抓取 {{ formatNumber(item.fetchedCount) }} / 过程入库
                      {{ formatNumber(item.upsertedCount) }}
                    </span>
                  </div>
                  <div class="distribution-status">
                    <Tag
                      :color="
                        getTaskStatusColor(
                          item.latestTaskStatus,
                          item.zeroFetched,
                        )
                      "
                    >
                      {{
                        getTaskStatusText(
                          item.latestTaskStatus,
                          item.zeroFetched,
                        )
                      }}
                    </Tag>
                    <em>{{ formatNumber(item.totalCount) }}</em>
                  </div>
                </div>
                <Progress
                  :percent="
                    getDistributionPercent(
                      item.percent,
                      item.totalCount,
                      platformTotal,
                    )
                  "
                  :show-info="false"
                  size="small"
                />
              </div>
            </div>
            <Empty v-else description="暂无平台分布" />
          </Card>
        </Col>

        <Col :lg="12" :md="24" :sm="24" :xs="24">
          <Card
            class="distribution-card"
            title="城市分布（老板口径 EFFECTIVE）"
          >
            <div
              v-if="resolvedCityDistribution.length > 0"
              class="distribution-list"
            >
              <div
                v-for="item in resolvedCityDistribution"
                :key="item.cityCode || item.cityName"
                class="distribution-item"
              >
                <div class="distribution-head">
                  <div>
                    <strong>{{ item.cityName }}</strong>
                    <span>
                      房源EFFECTIVE {{ formatNumber(item.listingCount) }} /
                      需求EFFECTIVE {{ formatNumber(item.demandCount) }} /
                      待核验
                      {{ formatNumber(item.pendingVerifyCount) }}
                    </span>
                  </div>
                  <em>{{ formatNumber(item.effectiveCount) }}</em>
                </div>
                <Progress
                  :percent="
                    getDistributionPercent(
                      item.percent,
                      item.effectiveCount,
                      cityTotal,
                    )
                  "
                  :show-info="false"
                  size="small"
                  status="active"
                />
              </div>
            </div>
            <Empty v-else description="暂无城市分布" />
          </Card>
        </Col>
      </Row>
    </div>
  </Skeleton>
</template>

<style scoped>
.public-crawl-stats-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.public-crawl-empty {
  padding: 28px 0;
  background: var(--ant-color-bg-container);
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 8px;
}

.crawl-metric-grid {
  margin: 0 !important;
}

.crawl-metric-card {
  height: 100%;
}

.crawl-metric-card :deep(.ant-card-body) {
  padding: 16px 18px;
}

.crawl-metric-card :deep(.ant-statistic-title) {
  margin-bottom: 4px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.crawl-metric-card :deep(.ant-statistic-content) {
  font-size: 26px;
  line-height: 34px;
}

.crawl-metric-meta {
  display: flex;
  margin-top: 10px;
}

.distribution-card {
  height: 100%;
}

.distribution-card :deep(.ant-card-body) {
  min-height: 296px;
}

.distribution-list {
  display: grid;
  gap: 14px;
}

.distribution-item {
  min-width: 0;
}

.distribution-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 6px;
}

.distribution-head > div {
  min-width: 0;
}

.distribution-head strong,
.distribution-head span {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.distribution-head strong {
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: var(--ant-color-text);
}

.distribution-head span {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.distribution-head em {
  flex: none;
  font-size: 16px;
  font-style: normal;
  font-weight: 700;
  line-height: 22px;
  color: var(--ant-color-text);
}

.distribution-status {
  display: flex;
  flex: none;
  gap: 6px;
  align-items: center;
}

@media (max-width: 767px) {
  .crawl-metric-card :deep(.ant-card-body) {
    padding: 14px;
  }

  .crawl-metric-card :deep(.ant-statistic-content) {
    font-size: 24px;
    line-height: 32px;
  }

  .distribution-card :deep(.ant-card-body) {
    min-height: auto;
    padding: 14px;
  }

  .distribution-head {
    gap: 8px;
  }

  .distribution-head span {
    white-space: normal;
  }
}
</style>
