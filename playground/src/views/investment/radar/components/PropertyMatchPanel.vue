<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type { PropertyMatchItem } from '#/api/investment';

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

import { getPropertyMatchList, rebuildPropertyMatch } from '#/api/investment';

const props = defineProps<{
  leadId: number | string;
}>();

const items = ref<PropertyMatchItem[]>([]);
const loading = ref(false);
const loadError = ref('');

const displayItems = computed<PropertyMatchItem[]>(() => {
  return items.value.slice(0, 5);
});

const columns: TableColumnsType<PropertyMatchItem> = [
  {
    customRender: ({ record }) =>
      h('div', { class: 'property-name-cell' }, [
        h(
          'div',
          { class: 'property-name' },
          record.factoryName || '未命名房源',
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
        h('div', `空置 ${formatArea(record.availableArea)}`),
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
  {
    customRender: ({ record }) =>
      h('div', { class: 'property-note-cell' }, [
        h('div', { class: 'property-sales-pitch' }, record.salesPitch || '-'),
        record.mismatchReminders.length > 0
          ? h(
              Space,
              { class: 'property-warning-list', size: 4, wrap: true },
              () =>
                record.mismatchReminders.map((item) =>
                  h(Tag, { color: 'orange' }, () => item),
                ),
            )
          : null,
      ]),
    key: 'salesPitch',
    title: '销售话术',
    width: 300,
  },
];

function formatArea(value?: null | number) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }
  return `${Number(value).toLocaleString('zh-CN')}m²`;
}

function formatPrice(item: PropertyMatchItem) {
  if (item.rentPriceText) {
    return item.rentPriceText;
  }
  if (item.rentPrice === null || item.rentPrice === undefined) {
    return '-';
  }
  return `${Number(item.rentPrice).toLocaleString('zh-CN')}元/m²/月`;
}

async function loadMatches() {
  const leadId = Number(props.leadId);
  if (!leadId) {
    return;
  }

  loading.value = true;
  loadError.value = '';
  try {
    const result = await getPropertyMatchList(leadId);
    items.value = Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('load property matches failed:', error);
    items.value = [];
    loadError.value = '房源匹配数据加载失败';
  } finally {
    loading.value = false;
  }
}

async function handleRebuild() {
  const leadId = Number(props.leadId);
  if (!leadId) {
    return;
  }

  loading.value = true;
  try {
    await rebuildPropertyMatch(leadId);
    await loadMatches();
  } catch (error) {
    console.error('rebuild property match failed:', error);
    loadError.value = '重新计算房源匹配失败';
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
      <Space :size="8">
        <Button size="small" :loading="loading" @click="handleRebuild">
          重新计算
        </Button>
        <Button size="small" :loading="loading" @click="loadMatches">
          刷新
        </Button>
      </Space>
    </template>

    <Spin :spinning="loading">
      <Table
        v-if="displayItems.length > 0"
        bordered
        :columns="columns"
        :data-source="displayItems"
        :pagination="false"
        row-key="factoryId"
        :scroll="{ x: 1140 }"
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
.property-muted,
.property-sales-pitch {
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

.property-note-cell {
  min-width: 0;
  text-align: left;
}

.property-sales-pitch {
  white-space: normal;
}

.property-warning-list {
  margin-top: 6px;
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
