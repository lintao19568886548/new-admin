<script lang="ts" setup>
import type { PublicOpportunityItem } from '#/api/investment';

import { computed } from 'vue';

import { formatDateTime } from '@vben/utils';

import {
  Button,
  Descriptions,
  Drawer,
  Empty,
  Space,
  Tag,
} from 'ant-design-vue';

const props = withDefaults(
  defineProps<{
    item: null | PublicOpportunityItem;
    loading?: boolean;
    open: boolean;
    title?: string;
  }>(),
  {
    item: null,
    loading: false,
    title: '机会详情',
  },
);

const emit = defineEmits<{
  openSource: [item: PublicOpportunityItem];
  'update:open': [value: boolean];
}>();

const shanghaiDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
});

const opportunityMeta = computed(() => {
  const type = props.item?.opportunityType;
  if (type === 'SUPPLY') {
    return { color: 'green', label: '房源' };
  }
  if (type === 'DEMAND') {
    return { color: 'blue', label: '需求' };
  }
  return { color: 'default', label: type || '-' };
});

const regionText = computed(
  () =>
    [props.item?.city, props.item?.district].filter(Boolean).join(' / ') || '-',
);

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

function getJsonEntries(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value as Record<string, unknown>);
}

function getTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(String).filter(Boolean);
}

function closeDrawer() {
  emit('update:open', false);
}

function handleOpenSource() {
  if (props.item) {
    emit('openSource', props.item);
  }
}
</script>

<template>
  <Drawer :open="open" :title="title" width="720" @close="closeDrawer">
    <template #extra>
      <Button v-if="item?.sourceUrl" type="link" @click="handleOpenSource">
        原网页
      </Button>
    </template>

    <div v-if="loading" class="text-text-secondary py-10 text-center">
      加载中...
    </div>

    <Descriptions
      v-else-if="item"
      :column="1"
      bordered
      class="opportunity-detail"
      size="small"
    >
      <Descriptions.Item label="标题">
        {{ item.title || '-' }}
      </Descriptions.Item>
      <Descriptions.Item label="机会类型">
        <Tag :color="opportunityMeta.color">
          {{ opportunityMeta.label }}
        </Tag>
      </Descriptions.Item>
      <Descriptions.Item label="状态">
        {{ item.opportunityStatus || '-' }}
      </Descriptions.Item>
      <Descriptions.Item label="城市 / 区域">
        {{ regionText }}
      </Descriptions.Item>
      <Descriptions.Item label="面积">
        {{ formatArea(item) }}
      </Descriptions.Item>
      <Descriptions.Item label="价格 / 预算">
        {{ item.priceText || '-' }}
      </Descriptions.Item>
      <Descriptions.Item label="行业 / 用途">
        {{ item.industryText || '-' }}
      </Descriptions.Item>
      <Descriptions.Item label="联系人 / 电话">
        {{
          [item.contactName, item.phoneNumber].filter(Boolean).join(' / ') ||
          '-'
        }}
      </Descriptions.Item>
      <Descriptions.Item label="发布日期">
        {{ formatPublishedDate(item.publishedAt) }}
      </Descriptions.Item>
      <Descriptions.Item label="原始发布时间">
        {{ item.publishedDateText || '-' }}
      </Descriptions.Item>
      <Descriptions.Item label="时效">
        {{ item.publishedAgeLabel || '-' }}
      </Descriptions.Item>
      <Descriptions.Item label="有效至">
        {{ item.effectiveUntil ? formatDateTime(item.effectiveUntil) : '-' }}
      </Descriptions.Item>
      <Descriptions.Item label="分数">
        {{ item.score ?? '-' }}
      </Descriptions.Item>
      <Descriptions.Item label="来源网站">
        {{ item.sourceSite || '-' }}
      </Descriptions.Item>
      <Descriptions.Item label="来源表">
        {{ item.sourceTable || '-' }}
      </Descriptions.Item>
      <Descriptions.Item label="来源 ID">
        {{ item.sourceId ?? '-' }}
      </Descriptions.Item>
      <Descriptions.Item label="来源链接">
        <Button type="link" class="px-0" @click="handleOpenSource">
          {{ item.sourceUrl || '-' }}
        </Button>
      </Descriptions.Item>
      <Descriptions.Item label="描述">
        {{ item.description || '-' }}
      </Descriptions.Item>
      <Descriptions.Item label="标签">
        <Space wrap>
          <Tag v-for="tag in getTags(item.tagsJson)" :key="tag" color="blue">
            {{ tag }}
          </Tag>
          <span v-if="getTags(item.tagsJson).length === 0">-</span>
        </Space>
      </Descriptions.Item>
      <Descriptions.Item label="扩展信息">
        <Space wrap>
          <Tag
            v-for="[key, value] in getJsonEntries(item.detailJson)"
            :key="key"
          >
            {{ key }}: {{ value }}
          </Tag>
          <span v-if="getJsonEntries(item.detailJson).length === 0">-</span>
        </Space>
      </Descriptions.Item>
      <Descriptions.Item label="最后同步时间">
        {{ item.lastSyncedAt ? formatDateTime(item.lastSyncedAt) : '-' }}
      </Descriptions.Item>
    </Descriptions>

    <Empty v-else description="暂无详情数据" />
  </Drawer>
</template>

<style lang="less" scoped>
.opportunity-detail {
  :deep(.ant-descriptions-item-label) {
    width: 120px;
  }
}
</style>
