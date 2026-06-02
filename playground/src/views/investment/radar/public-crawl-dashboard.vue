<script lang="ts" setup>
import type {
  PublicCrawlAuditPreview,
  PublicCrawlAuditPreviewItem,
  PublicCrawlAuditSummary,
  PublicCrawlBatchMode,
  PublicCrawlBatchPlatformResult,
  PublicCrawlBatchRunResult,
  PublicCrawlCityDistributionItem,
  PublicCrawlDashboardSummary,
  PublicCrawlPlatformDistributionItem,
} from '#/api/investment/public-crawl-audit';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  message,
  Popconfirm,
  Progress,
  Space,
  Tag,
} from 'ant-design-vue';

import {
  getPublicCrawlAuditPreview,
  getPublicCrawlAuditSummary,
  repairPublicCrawlHistory,
  runPublicCrawlBatch,
} from '#/api/investment/public-crawl-audit';

import PublicCrawlIssueTable from './components/PublicCrawlIssueTable.vue';
import PublicCrawlStatsPanel from './components/PublicCrawlStatsPanel.vue';

defineOptions({ name: 'InvestmentRadarPublicCrawlDashboard' });

type PublicCrawlIssueLevel = 'HIGH' | 'LOW' | 'MEDIUM';
type PublicCrawlIssueStatus = 'FIXED' | 'IGNORED' | 'PENDING' | 'VERIFYING';
type PublicCrawlOpportunityType = 'DEMAND' | 'SUPPLY' | 'UNKNOWN';

type PublicCrawlIssueReasonDistributionItem = {
  issueType: string;
  label: string;
  level: PublicCrawlIssueLevel | string;
  percent?: null | number;
  totalCount: number;
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

type PublicCrawlDashboardApiResult = {
  auditMode?: null | string;
  cityDistribution: PublicCrawlCityDistributionItem[];
  dryRun?: boolean;
  issueDistribution: PublicCrawlPlatformDistributionItem[];
  issueList: PublicCrawlIssueItem[];
  issueReasonDistribution: PublicCrawlIssueReasonDistributionItem[];
  issueTotal: number;
  platformDistribution: PublicCrawlPlatformDistributionItem[];
  refreshedAt?: null | string;
  statDate: string;
  summary: PublicCrawlDashboardSummary;
};

const loading = ref(false);
const previewLoading = ref(false);
const batchRunning = ref(false);
const repairing = ref(false);
const loadError = ref('');
const dashboard = ref<null | PublicCrawlDashboardApiResult>(null);
const lastBatchResult = ref<null | PublicCrawlBatchRunResult>(null);
let dashboardLoadVersion = 0;

const summary = computed(() => dashboard.value?.summary || null);
const platformDistribution = computed(
  () => dashboard.value?.platformDistribution || [],
);
const cityDistribution = computed(
  () => dashboard.value?.cityDistribution || [],
);
const issueItems = computed(() => dashboard.value?.issueList || []);
const issueReasonDistribution = computed(
  () => dashboard.value?.issueReasonDistribution || [],
);
const issueTotal = computed(() => {
  const total = dashboard.value?.issueTotal;
  return typeof total === 'number' && total > 0
    ? total
    : issueItems.value.length;
});
const statDateText = computed(() => dashboard.value?.statDate || '-');
const refreshedAtText = computed(() =>
  dashboard.value?.refreshedAt
    ? formatDashboardTime(dashboard.value.refreshedAt)
    : '-',
);
const auditModeText = computed(() => {
  const auditMode = dashboard.value?.auditMode;
  if (!auditMode) {
    return '审计接口';
  }
  return auditMode === 'DRY_RUN' ? 'Dry Run' : auditMode;
});
const auditModeColor = computed(() =>
  dashboard.value?.dryRun ? 'orange' : 'green',
);
const targetProgressItems = computed(() => {
  const currentSummary = summary.value;
  if (!currentSummary) {
    return [];
  }

  return [
    {
      count: currentSummary.guangdongListingEffectiveCount,
      key: 'supply',
      label: '公开房源 EFFECTIVE',
      percent: getTargetProgressPercent(
        currentSummary.guangdongListingEffectiveCount,
        TARGET_LISTING_COUNT,
      ),
      shortage: Math.max(
        0,
        TARGET_LISTING_COUNT - currentSummary.guangdongListingEffectiveCount,
      ),
      target: TARGET_LISTING_COUNT,
    },
    {
      count: currentSummary.guangdongDemandEffectiveCount,
      key: 'demand',
      label: '公开需求 EFFECTIVE',
      percent: getTargetProgressPercent(
        currentSummary.guangdongDemandEffectiveCount,
        TARGET_DEMAND_COUNT,
      ),
      shortage: Math.max(
        0,
        TARGET_DEMAND_COUNT - currentSummary.guangdongDemandEffectiveCount,
      ),
      target: TARGET_DEMAND_COUNT,
    },
  ];
});

const batchProblemItems = computed(() => {
  const result = lastBatchResult.value;
  if (!result) {
    return [];
  }
  return result.items.filter(
    (item) =>
      item.status === 'FAILED' ||
      item.zeroOutput ||
      item.effectiveCount === 0 ||
      item.skippedCount > item.effectiveCount * 2,
  );
});

const bossVerdict = computed(() => {
  const currentSummary = summary.value;
  if (!currentSummary) {
    return null;
  }
  const targetReached =
    currentSummary.guangdongListingEffectiveCount >= TARGET_LISTING_COUNT &&
    currentSummary.guangdongDemandEffectiveCount >= TARGET_DEMAND_COUNT;
  const platformHealthy =
    currentSummary.zeroFetchedPlatformCount === 0 &&
    currentSummary.failedPlatformCount === 0;
  const qualityHealthy = currentSummary.nonGuangdongHiddenCount === 0;

  if (targetReached && platformHealthy && qualityHealthy) {
    return {
      color: 'success' as const,
      text: '可验收',
    };
  }
  if (targetReached) {
    return {
      color: 'warning' as const,
      text: '数据量达标，仍需处理质量问题',
    };
  }
  return {
    color: 'warning' as const,
    text: '未达老板目标，继续补平台产出',
  };
});

const batchOutputNotice = computed(() => {
  const result = lastBatchResult.value;
  if (!result) {
    return null;
  }

  if (result.total.onlyZeroOutput || result.total.hasUsefulOutput === false) {
    return {
      description:
        '抓取、入库和任务成功是过程指标；老板口径只统计 investment_public_opportunity 中状态为 EFFECTIVE 的广东公开房源/需求。',
      message: '本轮未产生老板口径有效新增',
      type: 'warning' as const,
    };
  }

  if (result.total.hasEffectiveOutput === false) {
    return {
      description:
        '本轮可能有发现、抓取或入库动作，但未形成 investment_public_opportunity.EFFECTIVE，不能抵扣老板验收缺口。',
      message: '本轮过程有产出，但未转成老板口径 EFFECTIVE',
      type: 'warning' as const,
    };
  }

  if (toSafeNumber(result.total.zeroOutputPlatformCount) > 0) {
    return {
      description:
        '空跑平台不会增加老板口径有效数，优先排查源站列表发现、详情解析和区域过滤。',
      message: '存在空跑平台，需优先处理',
      type: 'warning' as const,
    };
  }

  return null;
});

const TARGET_DEMAND_COUNT = 3000;
const TARGET_LISTING_COUNT = 3000;

function createEmptyAuditPreview(
  summaryResult: PublicCrawlAuditSummary,
): PublicCrawlAuditPreview {
  return {
    auditMode: summaryResult.auditMode,
    dryRun: summaryResult.dryRun,
    generatedAt: summaryResult.generatedAt,
    limit: 0,
    totalPreviewCount: toSafeNumber(
      summaryResult.summary?.proposedDowngradeCount,
    ),
    items: [],
  };
}

async function loadAuditPreview(
  summaryResult: PublicCrawlAuditSummary,
  version: number,
) {
  previewLoading.value = true;
  try {
    const previewResult = await getPublicCrawlAuditPreview();
    if (version !== dashboardLoadVersion) {
      return;
    }
    dashboard.value = normalizeDashboard(
      mapAuditDashboard(summaryResult, previewResult),
    );
  } catch (error) {
    if (version !== dashboardLoadVersion) {
      return;
    }
    console.warn('load public crawl audit preview failed:', error);
  } finally {
    if (version === dashboardLoadVersion) {
      previewLoading.value = false;
    }
  }
}

async function loadDashboard(options: { refresh?: boolean } = {}) {
  const version = (dashboardLoadVersion += 1);
  loading.value = true;
  loadError.value = '';

  try {
    const summaryResult = await getPublicCrawlAuditSummary({
      refresh: options.refresh ? 1 : undefined,
    });
    const result = mapAuditDashboard(
      summaryResult,
      createEmptyAuditPreview(summaryResult),
    );
    if (version !== dashboardLoadVersion) {
      return;
    }
    dashboard.value = normalizeDashboard(result);
    void loadAuditPreview(summaryResult, version);
  } catch (error) {
    if (version !== dashboardLoadVersion) {
      return;
    }
    console.error('load public crawl dashboard failed:', error);
    dashboard.value = null;
    loadError.value = '公开机会历史数据审计接口加载失败。';
  } finally {
    if (version === dashboardLoadVersion) {
      loading.value = false;
    }
  }
}

async function previewRepairHistory() {
  repairing.value = true;
  try {
    const result = await repairPublicCrawlHistory({
      dryRun: true,
      limit: 20,
    });
    message.info(
      `预览命中 ${result.plannedDowngradeCount.toLocaleString('zh-CN')} 条需清洗数据`,
    );
  } catch (error) {
    console.error('preview public crawl repair failed:', error);
    message.warning('历史数据清洗预览失败');
  } finally {
    repairing.value = false;
  }
}

async function applyRepairHistory() {
  repairing.value = true;
  try {
    const result = await repairPublicCrawlHistory({
      dryRun: false,
      limit: 50,
    });
    message.success(
      `已清洗 ${result.repairedCount.toLocaleString('zh-CN')} 条历史数据`,
    );
    await loadDashboard({ refresh: true });
  } catch (error) {
    console.error('apply public crawl repair failed:', error);
    message.warning('历史数据清洗执行失败');
  } finally {
    repairing.value = false;
  }
}

function getBatchModeLabel(mode: PublicCrawlBatchMode) {
  const labelMap: Record<PublicCrawlBatchMode, string> = {
    ALL: '全部平台',
    DEMAND: '公开需求',
    SUPPLY: '公开房源',
  };
  return labelMap[mode];
}

function getBatchOpportunityTypeLabel(type: string) {
  return type === 'DEMAND' ? '需求' : '房源';
}

function getBatchStatusColor(status: string) {
  return status === 'SUCCESS' ? 'green' : 'red';
}

function getBatchOutputStatusColor(item: PublicCrawlBatchPlatformResult) {
  if (item.status === 'FAILED') {
    return 'red';
  }
  if (item.yieldedEffective) {
    return 'green';
  }
  if (item.zeroOutput) {
    return 'orange';
  }
  return 'blue';
}

function getBatchOutputStatusText(item: PublicCrawlBatchPlatformResult) {
  if (item.status === 'FAILED') {
    return '失败';
  }
  if (item.yieldedEffective) {
    return '本次入库有效';
  }
  if (item.zeroOutput) {
    return '空跑';
  }
  return '无新增 EFFECTIVE';
}

function formatFailureReasons(
  reasons: Array<{ count: number; reason: string }> = [],
) {
  if (reasons.length === 0) {
    return '无';
  }
  return reasons
    .slice(0, 2)
    .map((item) => `${item.reason}(${item.count})`)
    .join(' / ');
}

async function runBatch(mode: PublicCrawlBatchMode) {
  if (batchRunning.value) {
    return;
  }
  batchRunning.value = true;
  try {
    const result = await runPublicCrawlBatch({
      batchSize: 10,
      continueOnError: true,
      discoverList: true,
      freshnessDays: 180,
      ignoreInterval: true,
      maxConcurrency: 4,
      maxListPages: 60,
      mode,
      reprocessSuccess: false,
      staleReprocessMinutes: 5,
    });
    lastBatchResult.value = result;
    message.success(
      `${getBatchModeLabel(mode)}跑批结束：本次入库有效 ${result.total.effectiveCount.toLocaleString('zh-CN')} 条，老板口径累计 ${result.total.collectedEffectiveCount.toLocaleString('zh-CN')} 条`,
    );
    await loadDashboard({ refresh: true });
  } catch (error) {
    console.error('run public crawl batch failed:', error);
    message.warning(`${getBatchModeLabel(mode)}跑批失败`);
  } finally {
    batchRunning.value = false;
  }
}

function mapAuditDashboard(
  summaryResult: PublicCrawlAuditSummary,
  previewResult: PublicCrawlAuditPreview,
): PublicCrawlDashboardApiResult {
  const summaryCounts = normalizeAuditCounts(summaryResult.summary);
  const issueItems = normalizeAuditPreviewItems(previewResult.items);
  const issuePreviewTotal =
    previewResult.totalPreviewCount > 0
      ? previewResult.totalPreviewCount
      : issueItems.length;
  const generatedAt = summaryResult.generatedAt || previewResult.generatedAt;
  const dashboardResult = summaryResult.dashboard;
  const dashboardSummary = dashboardResult?.summary;

  return {
    auditMode: summaryResult.auditMode || previewResult.auditMode,
    cityDistribution: dashboardResult?.cityDistribution || [],
    dryRun: summaryResult.dryRun || previewResult.dryRun,
    issueDistribution: buildIssueDistribution(previewResult.items),
    issueList: issueItems,
    issueReasonDistribution: buildIssueReasonDistribution(issueItems),
    issueTotal: issuePreviewTotal,
    platformDistribution: dashboardResult?.platformDistribution || [],
    refreshedAt: generatedAt,
    statDate: getDateText(generatedAt),
    summary: {
      demandEffectiveRate:
        dashboardSummary?.demandEffectiveRate ||
        getTargetProgressPercent(0, TARGET_DEMAND_COUNT),
      failedPlatformCount: toSafeNumber(dashboardSummary?.failedPlatformCount),
      fetchSuccessRate: dashboardSummary?.fetchSuccessRate || 0,
      guangdongDemandEffectiveCount: toSafeNumber(
        dashboardSummary?.guangdongDemandEffectiveCount,
      ),
      guangdongListingEffectiveCount: toSafeNumber(
        dashboardSummary?.guangdongListingEffectiveCount,
      ),
      lastCrawledAt: dashboardSummary?.lastCrawledAt || generatedAt,
      nonGuangdongHiddenCount: summaryCounts.nonGuangdongCount,
      nonGuangdongHiddenRate: getPercent(
        summaryCounts.nonGuangdongCount,
        summaryCounts.totalCount,
      ),
      pendingVerifyCount: issuePreviewTotal,
      pendingVerifyOverdueCount: summaryCounts.suspiciousPublishedAtCount,
      platformCount: toSafeNumber(dashboardSummary?.platformCount),
      platformFetchedCount: toSafeNumber(
        dashboardSummary?.platformFetchedCount,
      ),
      platformSuccessCount: toSafeNumber(
        dashboardSummary?.platformSuccessCount,
      ),
      todayFetchedChange: null,
      todayFetchedCount: toSafeNumber(dashboardSummary?.todayFetchedCount),
      totalEffectiveCount: toSafeNumber(dashboardSummary?.totalEffectiveCount),
      zeroFetchedPlatformCount: toSafeNumber(
        dashboardSummary?.zeroFetchedPlatformCount,
      ),
      listingEffectiveRate:
        dashboardSummary?.listingEffectiveRate ||
        getTargetProgressPercent(0, TARGET_LISTING_COUNT),
    },
  };
}

function normalizeDashboard(
  result: PublicCrawlDashboardApiResult,
): PublicCrawlDashboardApiResult {
  return {
    ...result,
    cityDistribution: Array.isArray(result.cityDistribution)
      ? result.cityDistribution
      : [],
    issueDistribution: Array.isArray(result.issueDistribution)
      ? result.issueDistribution
      : [],
    issueList: Array.isArray(result.issueList) ? result.issueList : [],
    issueReasonDistribution: Array.isArray(result.issueReasonDistribution)
      ? result.issueReasonDistribution
      : [],
    issueTotal: Number(result.issueTotal || 0),
    platformDistribution: Array.isArray(result.platformDistribution)
      ? result.platformDistribution
      : [],
  };
}

function normalizeAuditCounts(
  counts?: null | Partial<PublicCrawlAuditSummary['summary']>,
): PublicCrawlAuditSummary['summary'] {
  return {
    guangdongValidCount: toSafeNumber(counts?.guangdongValidCount),
    missingHashOrDetailEvidenceCount: toSafeNumber(
      counts?.missingHashOrDetailEvidenceCount,
    ),
    missingPublishedAtCount: toSafeNumber(counts?.missingPublishedAtCount),
    missingSourceUrlCount: toSafeNumber(counts?.missingSourceUrlCount),
    missingSupplyLocationCount: toSafeNumber(
      counts?.missingSupplyLocationCount,
    ),
    nonGuangdongCount: toSafeNumber(counts?.nonGuangdongCount),
    suspiciousPublishedAtCount: toSafeNumber(
      counts?.suspiciousPublishedAtCount,
    ),
    totalCount: toSafeNumber(counts?.totalCount),
  };
}

function normalizeAuditPreviewItems(
  items: PublicCrawlAuditPreviewItem[],
): PublicCrawlIssueItem[] {
  return (Array.isArray(items) ? items : []).map((item) => ({
    city: item.city,
    crawledAt: item.lastSyncedAt || item.updateTime || item.createTime,
    district: item.district,
    issueId: item.opportunityId,
    issueLevel: getAuditIssueLevel(item),
    issueType: getAuditIssueType(item),
    opportunityType: normalizeOpportunityType(item.opportunityType),
    ownerName: item.sourceKey || '审计接口',
    publishedAt: item.publishedAt,
    reason: item.issueReasons.join(' / ') || '审计规则命中',
    sourceSite: item.sourceSite || item.sourceTable || '未知来源',
    sourceUrl: item.sourceUrl,
    status: 'PENDING',
    title: item.title || '未解析标题',
  }));
}

function buildIssueReasonDistribution(
  items: PublicCrawlIssueItem[],
): PublicCrawlIssueReasonDistributionItem[] {
  const groups = new Map<string, PublicCrawlIssueReasonDistributionItem>();

  for (const item of items) {
    const issueType = item.issueType || '审计待核验';
    const group = groups.get(issueType) || {
      issueType,
      label: issueType,
      level: item.issueLevel,
      totalCount: 0,
    };

    group.totalCount += 1;
    if (
      getIssueLevelWeight(item.issueLevel) > getIssueLevelWeight(group.level)
    ) {
      group.level = item.issueLevel;
    }
    groups.set(issueType, group);
  }

  return withDistributionPercent([...groups.values()]);
}

function getIssueLevelWeight(level?: null | string) {
  if (level === 'HIGH') {
    return 3;
  }
  if (level === 'MEDIUM') {
    return 2;
  }
  return 1;
}

function buildIssueDistribution(
  items: PublicCrawlAuditPreviewItem[],
): PublicCrawlPlatformDistributionItem[] {
  const groups = new Map<string, PublicCrawlPlatformDistributionItem>();

  for (const item of items) {
    const platformName = item.sourceSite || item.sourceTable || '未知来源';
    const group = groups.get(platformName) || {
      demandCount: 0,
      hiddenCount: 0,
      platformCode: platformName,
      platformName,
      sourceCode: null,
      totalCount: 0,
      listingCount: 0,
    };

    group.totalCount += 1;
    if (normalizeOpportunityType(item.opportunityType) === 'DEMAND') {
      group.demandCount += 1;
    } else if (normalizeOpportunityType(item.opportunityType) === 'SUPPLY') {
      group.listingCount += 1;
    }
    if (item.issueFlags.nonGuangdong) {
      group.hiddenCount += 1;
    }
    groups.set(platformName, group);
  }

  return withDistributionPercent([...groups.values()]);
}

function withDistributionPercent<
  T extends {
    effectiveCount?: number;
    percent?: null | number;
    totalCount: number;
  },
>(items: T[]) {
  const total = items.reduce(
    (sum, item) => sum + toSafeNumber(item.totalCount),
    0,
  );

  return items
    .map((item) => ({
      ...item,
      percent: getPercent(item.totalCount, total),
    }))
    .sort(
      (previous, current) =>
        toSafeNumber(current.totalCount) - toSafeNumber(previous.totalCount),
    );
}

function getAuditIssueType(item: PublicCrawlAuditPreviewItem) {
  if (item.issueFlags.nonGuangdong) {
    return '非广东数据';
  }
  if (item.issueFlags.missingSourceUrl) {
    return '缺少来源链接';
  }
  if (item.issueFlags.missingPublishedAt) {
    return '缺少发布时间';
  }
  if (item.issueFlags.missingSupplyLocation) {
    return '房源缺少城市或区域';
  }
  if (item.issueFlags.suspiciousPublishedAt) {
    return '发布时间异常';
  }
  if (item.issueFlags.missingHashOrDetailEvidence) {
    return '缺少详情证据';
  }
  return '审计待核验';
}

function getAuditIssueLevel(
  item: PublicCrawlAuditPreviewItem,
): PublicCrawlIssueLevel {
  if (item.issueFlags.nonGuangdong || item.issueFlags.missingSourceUrl) {
    return 'HIGH';
  }
  if (
    item.issueFlags.missingPublishedAt ||
    item.issueFlags.missingSupplyLocation ||
    item.issueFlags.suspiciousPublishedAt ||
    item.issueFlags.missingHashOrDetailEvidence
  ) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function normalizeOpportunityType(
  opportunityType?: null | string,
): PublicCrawlOpportunityType {
  const normalized = String(opportunityType || '').toUpperCase();
  if (normalized === 'DEMAND' || normalized === 'SUPPLY') {
    return normalized;
  }
  return 'UNKNOWN';
}

function getPercent(value?: null | number, total?: null | number) {
  const denominator = toSafeNumber(total);
  if (denominator <= 0) {
    return 0;
  }
  return Number(((toSafeNumber(value) / denominator) * 100).toFixed(1));
}

function getTargetProgressPercent(value: number, target: number) {
  if (target <= 0) {
    return 0;
  }
  return Number(Math.min(100, (value / target) * 100).toFixed(1));
}

function toSafeNumber(value?: null | number) {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function getDateText(value?: null | string) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).format(date);
}

function formatDashboardTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(date);
}

onMounted(() => {
  void loadDashboard();
});
</script>

<template>
  <Page
    auto-content-height
    class="public-crawl-dashboard-page"
    content-class="public-crawl-dashboard-content"
  >
    <div class="public-crawl-dashboard">
      <section class="dashboard-toolbar">
        <div>
          <h2>广东公开采集结果看板</h2>
          <p>统计日 {{ statDateText }} / 更新 {{ refreshedAtText }}</p>
          <p class="dashboard-toolbar-note">
            老板验收只看
            investment_public_opportunity.EFFECTIVE；抓取、入库、队列数仅作为过程诊断。
          </p>
        </div>
        <Space wrap>
          <Tag :color="auditModeColor">{{ auditModeText }}</Tag>
          <Button :loading="batchRunning" @click="runBatch('SUPPLY')">
            跑房源
          </Button>
          <Button :loading="batchRunning" @click="runBatch('DEMAND')">
            跑需求
          </Button>
          <Button
            type="primary"
            :loading="batchRunning"
            @click="runBatch('ALL')"
          >
            全部跑批
          </Button>
          <Button :loading="repairing" @click="previewRepairHistory">
            预览清洗
          </Button>
          <Popconfirm
            ok-text="执行清洗"
            title="将历史硬性不合格数据降级并从有效列表移除，确认执行？"
            @confirm="applyRepairHistory"
          >
            <Button danger :loading="repairing">执行清洗</Button>
          </Popconfirm>
          <Button
            :loading="loading"
            type="primary"
            @click="loadDashboard({ refresh: true })"
          >
            刷新
          </Button>
        </Space>
      </section>

      <Alert v-if="loadError" :message="loadError" show-icon type="warning" />

      <Alert
        v-if="summary && bossVerdict"
        :message="bossVerdict.text"
        show-icon
        :type="bossVerdict.color"
      >
        <template #description>
          <div class="boss-verdict-description">
            <span>
              广东房源 EFFECTIVE
              {{
                summary.guangdongListingEffectiveCount.toLocaleString('zh-CN')
              }}
              / {{ TARGET_LISTING_COUNT.toLocaleString('zh-CN') }}
            </span>
            <span>
              广东需求 EFFECTIVE
              {{
                summary.guangdongDemandEffectiveCount.toLocaleString('zh-CN')
              }}
              / {{ TARGET_DEMAND_COUNT.toLocaleString('zh-CN') }}
            </span>
            <span>
              零抓取平台
              {{ summary.zeroFetchedPlatformCount.toLocaleString('zh-CN') }}
            </span>
            <span>
              待纠偏
              {{ summary.pendingVerifyCount.toLocaleString('zh-CN') }}
            </span>
          </div>
        </template>
      </Alert>

      <Alert
        v-if="lastBatchResult"
        show-icon
        type="info"
        :message="`${getBatchModeLabel(lastBatchResult.mode)}最近跑批结果`"
      >
        <template #description>
          <div class="batch-result-description">
            <span>
              有效产出平台
              {{
                (
                  lastBatchResult.total.productivePlatformCount || 0
                ).toLocaleString('zh-CN')
              }}
              / {{ lastBatchResult.total.platformCount }}
            </span>
            <span>
              发现 URL
              {{
                lastBatchResult.total.discoveredUrlCount.toLocaleString('zh-CN')
              }}
            </span>
            <span>
              抓取
              {{ lastBatchResult.total.fetchedCount.toLocaleString('zh-CN') }}
            </span>
            <span>
              入库
              {{ lastBatchResult.total.upsertedCount.toLocaleString('zh-CN') }}
            </span>
            <span>
              本次入库有效
              {{ lastBatchResult.total.effectiveCount.toLocaleString('zh-CN') }}
            </span>
            <span>
              老板口径累计
              {{
                lastBatchResult.total.collectedEffectiveCount.toLocaleString(
                  'zh-CN',
                )
              }}
            </span>
            <span v-if="lastBatchResult.targetCount">
              目标
              {{ lastBatchResult.targetCount.toLocaleString('zh-CN') }}
            </span>
            <span v-if="lastBatchResult.roundCount">
              轮次 {{ lastBatchResult.roundCount }}/{{
                lastBatchResult.maxRounds || lastBatchResult.roundCount
              }}
            </span>
            <span v-if="lastBatchResult.remainingCount !== undefined">
              缺口
              {{ lastBatchResult.remainingCount.toLocaleString('zh-CN') }}
            </span>
            <span>
              跳过
              {{ lastBatchResult.total.skippedCount.toLocaleString('zh-CN') }}
            </span>
            <span v-if="lastBatchResult.total.failedPlatformCount > 0">
              失败平台
              {{
                lastBatchResult.total.failedPlatformCount.toLocaleString(
                  'zh-CN',
                )
              }}
            </span>
            <span v-if="lastBatchResult.total.zeroOutputPlatformCount">
              空跑平台
              {{
                lastBatchResult.total.zeroOutputPlatformCount.toLocaleString(
                  'zh-CN',
                )
              }}
            </span>
          </div>
        </template>
      </Alert>

      <Alert
        v-if="batchOutputNotice"
        show-icon
        :description="batchOutputNotice.description"
        :message="batchOutputNotice.message"
        :type="batchOutputNotice.type"
      />

      <Alert
        v-if="batchProblemItems.length > 0"
        show-icon
        type="warning"
        message="低产出/空跑平台需要优先处理"
      >
        <template #description>
          <div class="batch-problem-list">
            <span v-for="item in batchProblemItems" :key="item.sourceCode">
              {{ item.sourceName || item.sourceCode }}：
              {{
                item.status === 'FAILED'
                  ? '运行失败'
                  : item.zeroOutput
                    ? '空跑无产出'
                    : '有效产出偏低'
              }}
              / {{ formatFailureReasons(item.failedReasonTop5) }}
            </span>
          </div>
        </template>
      </Alert>

      <Card
        v-if="lastBatchResult"
        class="batch-platform-card"
        title="最近跑批平台明细（过程指标）"
      >
        <div class="batch-platform-list">
          <div
            v-for="item in lastBatchResult.items"
            :key="item.sourceCode"
            class="batch-platform-item"
          >
            <div class="batch-platform-head">
              <div>
                <strong>{{ item.sourceName || item.sourceCode }}</strong>
                <span>{{ item.sourceCode }}</span>
              </div>
              <Space :size="4">
                <Tag color="blue">
                  {{ getBatchOpportunityTypeLabel(item.opportunityType) }}
                </Tag>
                <Tag :color="getBatchStatusColor(item.status)">
                  {{ item.status === 'SUCCESS' ? '成功' : '失败' }}
                </Tag>
                <Tag :color="getBatchOutputStatusColor(item)">
                  {{ getBatchOutputStatusText(item) }}
                </Tag>
              </Space>
            </div>
            <div class="batch-platform-metrics">
              <span v-if="item.roundIndex">第 {{ item.roundIndex }} 轮</span>
              <span>发现 {{ item.discoveredUrlCount }}</span>
              <span>抓取 {{ item.fetchedCount }}</span>
              <span>成功抓取 {{ item.fetchSuccessCount }}</span>
              <span>入库 {{ item.upsertedCount }}</span>
              <span>本次入库有效 {{ item.effectiveCount }}</span>
              <span>老板口径累计 {{ item.collectedEffectiveCount }}</span>
              <span>跳过 {{ item.skippedCount }}</span>
            </div>
            <p>
              {{
                item.errorMessage || formatFailureReasons(item.failedReasonTop5)
              }}
            </p>
          </div>
        </div>
      </Card>

      <Card
        v-if="summary"
        class="boss-result-card"
        title="老板验收口径 EFFECTIVE"
      >
        <div class="boss-result-grid">
          <div
            v-for="item in targetProgressItems"
            :key="item.key"
            class="boss-result-item"
          >
            <div class="boss-result-head">
              <strong>{{ item.label }}</strong>
              <span>
                {{ item.count.toLocaleString('zh-CN') }} /
                {{ item.target.toLocaleString('zh-CN') }}
              </span>
            </div>
            <Progress
              :percent="item.percent"
              :status="item.percent >= 100 ? 'success' : 'active'"
            />
            <div class="boss-result-gap">
              {{
                item.shortage > 0
                  ? `还差 ${item.shortage.toLocaleString('zh-CN')} 条`
                  : '已达标'
              }}
            </div>
          </div>
        </div>
      </Card>

      <PublicCrawlStatsPanel
        :city-distribution="cityDistribution"
        :loading="loading"
        :mock-fallback="false"
        :platform-distribution="platformDistribution"
        :summary="summary"
      />

      <PublicCrawlIssueTable
        :items="issueItems"
        :issue-distribution="dashboard?.issueDistribution || []"
        :issue-reason-distribution="issueReasonDistribution"
        :loading="loading || previewLoading"
        :mock-fallback="false"
        :total="issueTotal"
      />
    </div>
  </Page>
</template>

<style scoped>
.public-crawl-dashboard-page,
:deep(.public-crawl-dashboard-content) {
  min-height: 100%;
}

.public-crawl-dashboard {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 100%;
}

.dashboard-toolbar {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 18px;
  background: var(--ant-color-bg-container);
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 8px;
}

.dashboard-toolbar h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;
  color: var(--ant-color-text);
}

.dashboard-toolbar p {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.dashboard-toolbar-note {
  max-width: 720px;
}

.boss-result-card :deep(.ant-card-body) {
  padding: 16px 18px;
}

.boss-result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.boss-verdict-description {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  font-size: 13px;
  line-height: 20px;
}

.batch-result-description {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  font-size: 13px;
  line-height: 20px;
}

.batch-result-description span {
  white-space: nowrap;
}

.batch-problem-list {
  display: grid;
  gap: 4px;
  font-size: 13px;
  line-height: 20px;
}

.batch-problem-list span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.batch-platform-card :deep(.ant-card-body) {
  padding: 14px 16px;
}

.batch-platform-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.batch-platform-item {
  min-width: 0;
  padding: 12px;
  background: var(--ant-color-fill-tertiary);
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 6px;
}

.batch-platform-head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  justify-content: space-between;
}

.batch-platform-head > div {
  min-width: 0;
}

.batch-platform-head strong,
.batch-platform-head span {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.batch-platform-head strong {
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: var(--ant-color-text);
}

.batch-platform-head span {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.batch-platform-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-top: 10px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text);
}

.batch-platform-item p {
  margin: 8px 0 0;
  overflow: hidden;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.boss-verdict-description span {
  white-space: nowrap;
}

.boss-result-item {
  min-width: 0;
}

.boss-result-head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.boss-result-head strong {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  line-height: 22px;
  color: var(--ant-color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.boss-result-head span {
  flex: none;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  color: var(--ant-color-text);
}

.boss-result-gap {
  margin-top: 6px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

@media (max-width: 767px) {
  .public-crawl-dashboard {
    gap: 10px;
  }

  .dashboard-toolbar {
    display: grid;
    padding: 14px;
  }

  .dashboard-toolbar h2 {
    font-size: 18px;
    line-height: 26px;
  }

  .boss-result-card :deep(.ant-card-body) {
    padding: 14px;
  }

  .boss-result-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .batch-platform-list {
    grid-template-columns: 1fr;
  }

  .batch-problem-list span {
    word-break: break-word;
    white-space: normal;
  }

  .batch-platform-item p {
    word-break: break-word;
    white-space: normal;
  }
}
</style>
