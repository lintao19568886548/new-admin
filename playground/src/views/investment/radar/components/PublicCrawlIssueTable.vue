<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { computed, h } from 'vue';

import { formatDateTime } from '@vben/utils';

import { useMediaQuery } from '@vueuse/core';
import {
  Button,
  Card,
  Empty,
  Progress,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

type PublicCrawlIssueLevel = 'HIGH' | 'LOW' | 'MEDIUM';
type PublicCrawlIssueStatus = 'FIXED' | 'IGNORED' | 'PENDING' | 'VERIFYING';
type PublicCrawlOpportunityType = 'DEMAND' | 'SUPPLY' | 'UNKNOWN';
type PublicCrawlTagMeta = {
  color: string;
  label: string;
};

type PublicCrawlIssueItem = {
  city?: null | string;
  crawledAt?: null | string;
  district?: null | string;
  issueId: number | string;
  issueLevel: PublicCrawlIssueLevel | string;
  issueType: string;
  opportunityType: PublicCrawlOpportunityType | string;
  ownerName?: null | string;
  publishedAt?: null | string;
  reason: string;
  sourceSite: string;
  sourceUrl?: null | string;
  status: PublicCrawlIssueStatus | string;
  title: string;
};

type PublicCrawlIssueDistributionItem = {
  demandCount: number;
  hiddenCount: number;
  listingCount: number;
  percent?: null | number;
  platformCode: string;
  platformName: string;
  totalCount: number;
};

type PublicCrawlIssueReasonDistributionItem = {
  issueType: string;
  label: string;
  level: PublicCrawlIssueLevel | string;
  percent?: null | number;
  totalCount: number;
};

const props = withDefaults(
  defineProps<{
    issueDistribution?: PublicCrawlIssueDistributionItem[];
    issueReasonDistribution?: PublicCrawlIssueReasonDistributionItem[];
    items?: PublicCrawlIssueItem[];
    loading?: boolean;
    mockFallback?: boolean;
    total?: number;
  }>(),
  {
    issueDistribution: () => [],
    issueReasonDistribution: () => [],
    loading: false,
    mockFallback: true,
    total: 0,
    items: () => [],
  },
);

const isMobile = useMediaQuery('(max-width: 767px)');

const resolvedItems = computed(() => {
  return props.items;
});

const displayTotal = computed(() =>
  props.total > 0 ? props.total : resolvedItems.value.length,
);

const distributionTotal = computed(() =>
  props.issueDistribution.reduce(
    (total, item) => total + toSafeNumber(item.totalCount),
    0,
  ),
);

const reasonDistributionTotal = computed(() =>
  props.issueReasonDistribution.reduce(
    (total, item) => total + toSafeNumber(item.totalCount),
    0,
  ),
);

const tableLocale = {
  emptyText: '暂无待纠偏数据',
};

const issueTypeLabelMap: Record<string, string> = {
  DUPLICATED_SOURCE: '重复来源',
  LOW_CONFIDENCE_CITY: '城市置信低',
  MISSING_CONTACT: '缺少联系方式',
  MISSING_REQUIRED_FIELD: '字段缺失',
  NON_GUANGDONG: '非广东数据',
  REGION_OUT_OF_SCOPE: '区域疑似越界',
  发布时间异常: '发布时间异常',
  审计待核验: '审计待核验',
  房源缺少城市或区域: '房源缺少城市或区域',
  缺少发布时间: '缺少发布时间',
  缺少来源链接: '缺少来源链接',
  缺少详情证据: '缺少详情证据',
  非广东数据: '非广东数据',
};

const unknownOpportunityTypeMeta: PublicCrawlTagMeta = {
  color: 'default',
  label: '未知',
};

const lowIssueLevelMeta: PublicCrawlTagMeta = {
  color: 'default',
  label: '低',
};

const pendingStatusMeta: PublicCrawlTagMeta = {
  color: 'orange',
  label: '待核验',
};

const opportunityTypeMeta: Record<string, PublicCrawlTagMeta> = {
  DEMAND: { color: 'green', label: '需求' },
  SUPPLY: { color: 'blue', label: '房源' },
  UNKNOWN: unknownOpportunityTypeMeta,
};

const issueLevelMeta: Record<string, PublicCrawlTagMeta> = {
  HIGH: { color: 'red', label: '高' },
  LOW: lowIssueLevelMeta,
  MEDIUM: { color: 'orange', label: '中' },
};

const statusMeta: Record<string, PublicCrawlTagMeta> = {
  FIXED: { color: 'green', label: '已修复' },
  IGNORED: { color: 'default', label: '已忽略' },
  PENDING: pendingStatusMeta,
  VERIFYING: { color: 'processing', label: '核验中' },
};

const columns: TableColumnsType<PublicCrawlIssueItem> = [
  {
    customRender: ({ record }) =>
      h('div', { class: 'issue-title-cell' }, [
        h('div', { class: 'issue-title' }, record.title || '-'),
        h(
          'div',
          { class: 'issue-subtitle' },
          `${record.sourceSite || '-'} / ${record.ownerName || '-'}`,
        ),
      ]),
    key: 'title',
    title: '待核验数据',
    width: 300,
  },
  {
    customRender: ({ record }) => renderOpportunityType(record.opportunityType),
    dataIndex: 'opportunityType',
    key: 'opportunityType',
    title: '类型',
    width: 90,
  },
  {
    customRender: ({ record }) => getIssueTypeLabel(record.issueType),
    dataIndex: 'issueType',
    key: 'issueType',
    title: '质量问题类型',
    width: 130,
  },
  {
    customRender: ({ record }) =>
      [record.city, record.district].filter(Boolean).join(' / ') || '-',
    key: 'location',
    title: '城市 / 区域',
    width: 130,
  },
  {
    customRender: ({ record }) => renderIssueLevel(record.issueLevel),
    dataIndex: 'issueLevel',
    key: 'issueLevel',
    title: '级别',
    width: 90,
  },
  {
    customRender: ({ record }) => renderStatus(record.status),
    dataIndex: 'status',
    key: 'status',
    title: '核验状态',
    width: 110,
  },
  {
    customRender: ({ record }) =>
      h('div', { class: 'issue-reason-cell' }, record.reason || '-'),
    dataIndex: 'reason',
    key: 'reason',
    title: '命中原因',
    width: 280,
  },
  {
    customRender: ({ record }) => formatOptionalTime(record.crawledAt),
    dataIndex: 'crawledAt',
    key: 'crawledAt',
    title: '抓取时间',
    width: 160,
  },
  {
    customRender: ({ record }) =>
      h(
        Button,
        {
          disabled: !record.sourceUrl,
          onClick: () => openSource(record),
          size: 'small',
          type: 'link',
        },
        () => '原文',
      ),
    fixed: 'right',
    key: 'operation',
    title: '操作',
    width: 90,
  },
];

function formatOptionalTime(value?: null | string) {
  return value ? formatDateTime(value) : '-';
}

function formatNumber(value?: null | number) {
  return toSafeNumber(value).toLocaleString('zh-CN');
}

function getIssueTypeLabel(issueType?: null | string) {
  if (!issueType) {
    return '-';
  }
  return issueTypeLabelMap[issueType] || issueType;
}

function getOpportunityTypeMeta(opportunityType?: null | string) {
  return (
    opportunityTypeMeta[String(opportunityType || 'UNKNOWN')] ??
    unknownOpportunityTypeMeta
  );
}

function getIssueLevelMeta(issueLevel?: null | string) {
  return (
    issueLevelMeta[String(issueLevel || 'LOW')] ?? {
      color: 'default',
      label: issueLevel || '-',
    }
  );
}

function getStatusMeta(status?: null | string) {
  return (
    statusMeta[String(status || 'PENDING')] ?? {
      color: 'default',
      label: status || '-',
    }
  );
}

function renderOpportunityType(opportunityType?: null | string) {
  const meta = getOpportunityTypeMeta(opportunityType);
  return h(Tag, { color: meta.color }, () => meta.label);
}

function renderIssueLevel(issueLevel?: null | string) {
  const meta = getIssueLevelMeta(issueLevel);
  return h(Tag, { color: meta.color }, () => meta.label);
}

function renderStatus(status?: null | string) {
  const meta = getStatusMeta(status);
  return h(Tag, { color: meta.color }, () => meta.label);
}

function openSource(record: PublicCrawlIssueItem) {
  if (!record.sourceUrl) {
    return;
  }
  window.open(record.sourceUrl, '_blank', 'noopener,noreferrer');
}

function getDistributionPercent(item: PublicCrawlIssueDistributionItem) {
  if (
    item.percent !== null &&
    item.percent !== undefined &&
    !Number.isNaN(Number(item.percent))
  ) {
    return Math.max(0, Math.min(100, Number(item.percent)));
  }

  if (distributionTotal.value <= 0) {
    return 0;
  }
  return Number(((item.totalCount / distributionTotal.value) * 100).toFixed(1));
}

function getReasonDistributionPercent(
  item: PublicCrawlIssueReasonDistributionItem,
) {
  if (
    item.percent !== null &&
    item.percent !== undefined &&
    !Number.isNaN(Number(item.percent))
  ) {
    return Math.max(0, Math.min(100, Number(item.percent)));
  }

  if (reasonDistributionTotal.value <= 0) {
    return 0;
  }
  return Number(
    ((item.totalCount / reasonDistributionTotal.value) * 100).toFixed(1),
  );
}

function toSafeNumber(value?: null | number) {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}
</script>

<template>
  <Card class="public-crawl-issue-card" title="待纠偏/待核验数据列表">
    <template #extra>
      <span class="issue-total">共 {{ displayTotal }} 条</span>
    </template>

    <div v-if="issueDistribution.length > 0" class="issue-distribution">
      <div
        v-for="item in issueDistribution"
        :key="item.platformCode"
        class="issue-distribution-item"
      >
        <div class="issue-distribution-head">
          <strong>{{ item.platformName }}</strong>
          <span>{{ formatNumber(item.totalCount) }}</span>
        </div>
        <Progress
          :percent="getDistributionPercent(item)"
          :show-info="false"
          size="small"
          status="exception"
        />
      </div>
    </div>

    <div v-if="issueReasonDistribution.length > 0" class="issue-reason-ranking">
      <div class="issue-section-title">质量问题排行</div>
      <div class="issue-reason-grid">
        <div
          v-for="item in issueReasonDistribution"
          :key="item.issueType"
          class="issue-reason-item"
        >
          <div class="issue-reason-head">
            <div>
              <Tag :color="getIssueLevelMeta(item.level).color">
                {{ getIssueLevelMeta(item.level).label }}
              </Tag>
              <strong>{{ getIssueTypeLabel(item.label) }}</strong>
            </div>
            <span>{{ formatNumber(item.totalCount) }}</span>
          </div>
          <Progress
            :percent="getReasonDistributionPercent(item)"
            :show-info="false"
            size="small"
            status="exception"
          />
        </div>
      </div>
    </div>

    <Table
      v-if="!isMobile"
      bordered
      :columns="columns"
      :data-source="resolvedItems"
      :loading="loading"
      :locale="tableLocale"
      :pagination="{ pageSize: 8, showSizeChanger: false }"
      row-key="issueId"
      :scroll="{ x: 1380 }"
      size="small"
      table-layout="fixed"
    />

    <div v-else class="issue-mobile-list">
      <div v-if="loading" class="issue-mobile-loading">加载中...</div>
      <template v-else-if="resolvedItems.length > 0">
        <article
          v-for="item in resolvedItems"
          :key="item.issueId"
          class="issue-mobile-card"
        >
          <div class="issue-mobile-head">
            <div>
              <strong>{{ item.title || '-' }}</strong>
              <span>{{ item.sourceSite || '-' }}</span>
            </div>
            <Space :size="4">
              <Tag :color="getIssueLevelMeta(item.issueLevel).color">
                {{ getIssueLevelMeta(item.issueLevel).label }}
              </Tag>
              <Tag :color="getStatusMeta(item.status).color">
                {{ getStatusMeta(item.status).label }}
              </Tag>
            </Space>
          </div>
          <div class="issue-mobile-meta">
            <span>
              {{ getOpportunityTypeMeta(item.opportunityType).label }} /
              {{ getIssueTypeLabel(item.issueType) }}
            </span>
            <span>
              {{
                [item.city, item.district].filter(Boolean).join(' / ') || '-'
              }}
            </span>
            <span>{{ formatOptionalTime(item.crawledAt) }}</span>
          </div>
          <p>{{ item.reason || '-' }}</p>
          <Button
            v-if="item.sourceUrl"
            size="small"
            type="link"
            @click="openSource(item)"
          >
            原文
          </Button>
        </article>
      </template>
      <Empty v-else description="暂无待纠偏数据" />
    </div>
  </Card>
</template>

<style scoped>
.public-crawl-issue-card {
  overflow: hidden;
}

.issue-total {
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.issue-distribution {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.issue-reason-ranking {
  margin-bottom: 12px;
}

.issue-section-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  color: var(--ant-color-text);
}

.issue-reason-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.issue-distribution-item {
  min-width: 0;
  padding: 10px;
  background: var(--ant-color-fill-tertiary);
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 6px;
}

.issue-reason-item {
  min-width: 0;
  padding: 10px;
  background: var(--ant-color-bg-container);
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 6px;
}

.issue-distribution-head {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.issue-reason-head {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.issue-reason-head > div {
  display: flex;
  gap: 4px;
  align-items: center;
  min-width: 0;
}

.issue-reason-head strong {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.issue-reason-head span {
  flex: none;
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
  color: var(--ant-color-text);
}

.issue-distribution-head strong {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.issue-distribution-head span {
  flex: none;
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
  color: var(--ant-color-text);
}

.public-crawl-issue-card :deep(.ant-table-thead > tr > th) {
  padding: 9px 10px;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  color: var(--ant-color-text);
  text-align: center;
  vertical-align: middle;
}

.public-crawl-issue-card :deep(.ant-table-tbody > tr > td) {
  padding: 9px 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
  text-align: center;
  vertical-align: middle;
}

.issue-title-cell,
.issue-reason-cell {
  min-width: 0;
  text-align: left;
}

.issue-title,
.issue-subtitle,
.issue-reason-cell {
  overflow: hidden;
  text-overflow: ellipsis;
}

.issue-title {
  font-weight: 600;
  color: var(--ant-color-text);
  white-space: nowrap;
}

.issue-subtitle {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  white-space: nowrap;
}

.issue-reason-cell {
  display: -webkit-box;
  line-height: 20px;
  -webkit-line-clamp: 2;
  word-break: break-word;
  white-space: normal;
  -webkit-box-orient: vertical;
}

.issue-mobile-list {
  display: grid;
  gap: 10px;
}

.issue-mobile-loading {
  padding: 18px 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
  text-align: center;
}

.issue-mobile-card {
  min-width: 0;
  padding: 12px;
  background: var(--ant-color-fill-tertiary);
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 8px;
}

.issue-mobile-head {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
}

.issue-mobile-head > div {
  min-width: 0;
}

.issue-mobile-head strong,
.issue-mobile-head span {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.issue-mobile-head strong {
  font-size: 14px;
  line-height: 22px;
  color: var(--ant-color-text);
  word-break: break-word;
  white-space: normal;
}

.issue-mobile-head span,
.issue-mobile-meta {
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.issue-mobile-meta {
  display: grid;
  gap: 4px;
  margin-top: 10px;
}

.issue-mobile-card p {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
  word-break: break-word;
}

.issue-mobile-card :deep(.ant-btn) {
  height: 24px;
  padding: 0;
  margin-top: 8px;
}

@media (max-width: 767px) {
  .public-crawl-issue-card :deep(.ant-card-body) {
    padding: 12px;
  }

  .issue-distribution {
    grid-template-columns: 1fr;
  }

  .issue-reason-grid {
    grid-template-columns: 1fr;
  }
}
</style>
