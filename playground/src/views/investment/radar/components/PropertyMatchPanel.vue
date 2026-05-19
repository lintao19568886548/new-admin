<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type { RadarLeadDetail } from '#/api/investment';

import { computed, h, onMounted, ref, watch } from 'vue';

import {
  Button,
  Card,
  Empty,
  Progress,
  Space,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';

import { getAvailableFactoryList } from '#/api/factory';
import { getRadarLeadDetail } from '#/api/investment';

const props = defineProps<{
  leadId: number | string;
}>();

interface FactoryMatchItem {
  address?: null | string;
  availableArea?: number;
  factoryId?: number;
  factoryName?: string;
  floorCount?: number;
  id?: number;
  parkId?: null | number;
  parkName?: null | string;
  rentPrice?: number;
  rentPriceText?: string;
  tag?: string;
  title?: string;
  totalArea?: number;
  usedArea?: number;
}

type ScoredFactoryMatchItem = FactoryMatchItem & {
  availableAreaValue: number;
  matchReasons: string[];
  matchScore: number;
};

const detail = ref<null | RadarLeadDetail>(null);
const items = ref<FactoryMatchItem[]>([]);
const loading = ref(false);
const loadError = ref('');

const displayItems = computed<ScoredFactoryMatchItem[]>(() => {
  return items.value
    .map((item) => {
      const availableArea = getAvailableArea(item);
      const scoreResult = calculateMatchScore(item, availableArea);
      return {
        ...item,
        availableAreaValue: availableArea,
        matchReasons: scoreResult.reasons,
        matchScore: scoreResult.score,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);
});

const columns: TableColumnsType<ScoredFactoryMatchItem> = [
  {
    customRender: ({ record }) =>
      h('div', { class: 'property-name-cell' }, [
        h(
          'div',
          { class: 'property-name' },
          record.factoryName || record.title || '未命名房源',
        ),
        h(
          'div',
          { class: 'property-location' },
          `${record.parkName || '-'} / ${record.address || '-'}`,
        ),
      ]),
    key: 'name',
    title: '房源',
    width: 260,
  },
  {
    customRender: ({ record }) =>
      h('div', { class: 'property-score-cell' }, [
        h(Progress, {
          percent: record.matchScore,
          showInfo: false,
          size: 'small',
          strokeWidth: 6,
        }),
        h('span', `${record.matchScore}%`),
      ]),
    key: 'matchScore',
    title: '匹配度',
    width: 130,
  },
  {
    customRender: ({ record }) =>
      h('div', [
        h('div', `空置 ${formatArea(record.availableAreaValue)}`),
        h(
          'div',
          { class: 'property-muted' },
          `总面积 ${formatArea(record.totalArea)}`,
        ),
      ]),
    key: 'area',
    title: '面积',
    width: 150,
  },
  {
    customRender: ({ record }) => formatPrice(record),
    key: 'rentPrice',
    title: '租金',
    width: 130,
  },
  {
    customRender: ({ record }) =>
      h(Space, { size: 4, wrap: true }, () =>
        record.matchReasons.map((reason) =>
          h(Tag, { color: 'blue' }, () => reason),
        ),
      ),
    key: 'reason',
    title: '匹配依据',
    width: 170,
  },
];

function calculateMatchScore(item: FactoryMatchItem, availableArea: number) {
  const reasons: string[] = [];
  let score = 60;

  const intentArea = Number(detail.value?.intentArea || 0);
  if (intentArea > 0 && availableArea > 0) {
    const lowerBound = intentArea * 0.8;
    const upperBound = intentArea * 1.5;
    if (availableArea >= lowerBound && availableArea <= upperBound) {
      score += 25;
      reasons.push('面积匹配');
    } else if (availableArea >= intentArea * 0.5) {
      score += 12;
      reasons.push('面积接近');
    }
  }

  if (detail.value?.parkId && item.parkId === detail.value.parkId) {
    score += 10;
    reasons.push('同园区');
  }

  if (item.tag) {
    score += 5;
    reasons.push(item.tag);
  }

  if (reasons.length === 0) {
    reasons.push('可用房源');
  }

  return {
    reasons,
    score: Math.min(score, 100),
  };
}

function formatArea(value?: null | number) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }
  return `${Number(value).toLocaleString('zh-CN')}m²`;
}

function formatPrice(item: FactoryMatchItem) {
  if (item.rentPriceText) {
    return item.rentPriceText;
  }
  if (item.rentPrice === null || item.rentPrice === undefined) {
    return '-';
  }
  return `${Number(item.rentPrice).toLocaleString('zh-CN')}元/m²/月`;
}

function getAvailableArea(item: FactoryMatchItem) {
  if (item.availableArea !== null && item.availableArea !== undefined) {
    return Math.max(Number(item.availableArea || 0), 0);
  }
  const total = Number(item.totalArea || 0);
  const used = Number(item.usedArea || 0);
  return Math.max(total - used, 0);
}

async function loadMatches() {
  const leadId = Number(props.leadId);
  if (!leadId) {
    return;
  }

  loading.value = true;
  loadError.value = '';
  try {
    const [leadDetail, result] = await Promise.all([
      getRadarLeadDetail(leadId),
      getAvailableFactoryList({
        currentPage: 1,
        pageSize: 20,
      }),
    ]);
    detail.value = leadDetail;

    let records: unknown[] = [];
    if (Array.isArray(result?.items)) {
      records = result.items;
    } else if (Array.isArray(result)) {
      records = result;
    }
    items.value = records as FactoryMatchItem[];
  } catch (error) {
    console.error('load property matches failed:', error);
    detail.value = null;
    items.value = [];
    loadError.value = '房源匹配数据加载失败';
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.leadId,
  () => {
    void loadMatches();
  },
);

onMounted(() => {
  void loadMatches();
});
</script>

<template>
  <Card class="property-match-panel" title="房源匹配">
    <template #extra>
      <Button size="small" :loading="loading" @click="loadMatches">刷新</Button>
    </template>

    <Spin :spinning="loading">
      <Table
        v-if="displayItems.length > 0"
        bordered
        :columns="columns"
        :data-source="displayItems"
        :pagination="false"
        row-key="factoryId"
        :scroll="{ x: 840 }"
        size="small"
      />
      <Empty
        v-else-if="!loading"
        class="panel-empty"
        :description="loadError || '暂无可匹配房源'"
      />
    </Spin>
  </Card>
</template>

<style scoped>
.property-match-panel :deep(.ant-card-body) {
  padding: 12px 16px 14px;
}

.property-match-panel :deep(.ant-table-thead > tr > th) {
  padding: 9px 10px;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  color: var(--ant-color-text);
  text-align: center;
  vertical-align: middle;
}

.property-match-panel :deep(.ant-table-tbody > tr > td) {
  padding: 9px 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
  text-align: center;
  vertical-align: middle;
}

.property-name-cell {
  min-width: 0;
}

.property-name {
  overflow: hidden;
  font-weight: 600;
  color: var(--ant-color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.property-location,
.property-muted {
  overflow: hidden;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.property-score-cell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 38px;
  gap: 8px;
  align-items: center;
}

.panel-empty {
  padding: 18px 0;
}

@media (max-width: 767px) {
  .property-match-panel {
    margin-top: 8px;
  }

  .property-match-panel :deep(.ant-card-body) {
    padding: 12px;
  }
}
</style>
