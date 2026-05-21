<script lang="ts" setup>
import type { PublicOpportunityItem } from '#/api/investment';

import { computed } from 'vue';

import { formatDateTime } from '@vben/utils';

import { useMediaQuery } from '@vueuse/core';
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

const isMobile = useMediaQuery('(max-width: 767px)');
const drawerWidth = computed(() => (isMobile.value ? '100%' : 720));
const mobileScrollTextThreshold = 90;

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

const opportunityStatusMeta = computed(() => {
  const status = props.item?.opportunityStatus;
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
});

const regionText = computed(
  () =>
    [props.item?.city, props.item?.district].filter(Boolean).join(' / ') || '-',
);

const mobileMainDescription = computed(() =>
  extractPrimaryDescription(props.item?.description),
);

const mobileRawDescription = computed(() =>
  compactText(props.item?.description),
);

const showRawDescription = computed(() => {
  const raw = mobileRawDescription.value;
  const main = mobileMainDescription.value;
  return Boolean(raw && raw !== main && raw.length > main.length + 80);
});

const mobileParameterDescription = computed(() =>
  getRelevantDescriptionSegment(props.item?.description),
);

const mobileDetailEntries = computed(() =>
  flattenJsonEntries(props.item?.detailJson),
);

const mobileCoreDescription = computed(() => {
  if (!props.item) {
    return '';
  }
  return joinMobileFields([
    ['面积', formatArea(props.item)],
    ['价格 / 预算', props.item.priceText || '-'],
    ['联系人', props.item.contactName || '-'],
    ['电话', props.item.phoneNumber || '-'],
    ['区域', regionText.value],
    ['分数', props.item.score ?? '-'],
  ]);
});

const mobileTimeDescription = computed(() => {
  if (!props.item) {
    return '';
  }
  return joinMobileFields([
    ['发布日期', formatPublishedDate(props.item.publishedAt)],
    ['原始发布时间', props.item.publishedDateText || '-'],
    [
      '有效至',
      props.item.effectiveUntil
        ? formatDateTime(props.item.effectiveUntil)
        : '-',
    ],
  ]);
});

const mobileSourceDescription = computed(() => {
  if (!props.item) {
    return '';
  }
  return joinMobileFields([
    ['来源网站', props.item.sourceSite || '-'],
    ['来源表', props.item.sourceTable || '-'],
    ['来源链接', props.item.sourceUrl || '-'],
  ]);
});

const mobileCollectionDescription = computed(() => {
  if (!props.item) {
    return '';
  }
  const tags = getTags(props.item.tagsJson).join('、') || '-';
  const details =
    mobileDetailEntries.value
      .map((entry) => `${entry.label}：${entry.value}`)
      .join('；') || '-';
  return joinMobileFields([
    ['标签', tags],
    ['扩展信息', details],
    [
      '最后同步时间',
      props.item.lastSyncedAt ? formatDateTime(props.item.lastSyncedAt) : '-',
    ],
  ]);
});

const mobileWholeDescription = computed(() =>
  joinMobileFields([
    ['核心信息', mobileCoreDescription.value],
    ['参数信息', mobileParameterDescription.value || '-'],
    ['时间信息', mobileTimeDescription.value],
    ['来源信息', mobileSourceDescription.value],
    ['采集信息', mobileCollectionDescription.value],
    ['正文描述', mobileMainDescription.value],
  ]),
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

function compactText(value?: null | string) {
  return String(value || '')
    .replaceAll(/\s+/g, ' ')
    .replaceAll(/\s+([，。；：、])/g, '$1')
    .trim();
}

function shouldUseMobileScroll(
  value?: null | string,
  threshold = mobileScrollTextThreshold,
) {
  return compactText(value).length > threshold;
}

function joinMobileFields(fields: Array<[string, unknown]>) {
  return fields
    .map(([label, value]) => {
      const normalized =
        value === null || value === undefined || value === ''
          ? '-'
          : compactText(String(value));
      return `${label}：${normalized || '-'}`;
    })
    .join('；');
}

function findFirstMarker(text: string, markers: string[]) {
  let matchedIndex = -1;
  let matchedMarker = '';
  for (const marker of markers) {
    const index = text.indexOf(marker);
    if (index !== -1 && (matchedIndex === -1 || index < matchedIndex)) {
      matchedIndex = index;
      matchedMarker = marker;
    }
  }
  return { index: matchedIndex, marker: matchedMarker };
}

function trimLeadingDetailSeparators(value: string) {
  let text = value.trimStart();
  while (
    text.startsWith('-') ||
    text.startsWith(':') ||
    text.startsWith('：') ||
    text.startsWith('>')
  ) {
    text = text.slice(1).trimStart();
  }
  return text;
}

function extractPrimaryDescription(value?: null | string) {
  const raw = compactText(value);
  if (!raw) {
    return '-';
  }

  let text = raw;
  const start = findFirstMarker(text, [
    '房源详情>>',
    '需求详情>>',
    '详情>>',
    '房源详情',
    '需求详情',
  ]);
  if (start.index !== -1) {
    text = text.slice(start.index + start.marker.length);
  }

  const end = findFirstMarker(text, [
    '上一篇：',
    '下一篇：',
    '相关推荐',
    '网站首页 |',
    '服务热线：',
    '快速导航',
  ]);
  if (end.index > 0) {
    text = text.slice(0, end.index);
  }

  text = trimLeadingDetailSeparators(compactText(text))
    .replaceAll(/本网站信息全部真实有效.*?现场实拍！\s*/g, '')
    .trim();

  if (!text) {
    text = raw;
  }

  return text;
}

function getRelevantDescriptionSegment(value?: null | string) {
  const raw = compactText(value);
  if (!raw) {
    return '';
  }

  const start = findFirstMarker(raw, ['有效期', '所在区域', '发布时间：']);
  const endMarkers = ['房源详情>>', '需求详情>>', '上一篇：', '下一篇：'];
  const end = findFirstMarker(raw, endMarkers);
  if (start.index !== -1) {
    const endIndex = end.index > start.index ? end.index : raw.length;
    return raw.slice(start.index, endIndex);
  }
  return raw;
}

function stringifyJsonDisplay(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (typeof value === 'string') {
    return compactText(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return compactText(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function resolveJsonLabel(key: string) {
  const labelMap: Record<string, string> = {
    areaText: '面积',
    city: '城市',
    companyName: '公司',
    contactName: '联系人',
    crawledFrom: '采集方式',
    district: '区域',
    industryText: '行业',
    parseMeta: '解析信息',
    phoneNumber: '电话',
    priceText: '价格',
    publishedAt: '发布时间',
    responseHash: '响应指纹',
    sourceUrl: '来源链接',
    title: '标题',
  };
  return labelMap[key] || key;
}

function flattenJsonEntries(
  value: unknown,
  parentLabel = '',
): Array<{ label: string; value: string }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, entryValue]) => {
      const label = [parentLabel, resolveJsonLabel(key)]
        .filter(Boolean)
        .join(' / ');
      if (
        entryValue &&
        typeof entryValue === 'object' &&
        !Array.isArray(entryValue)
      ) {
        return flattenJsonEntries(entryValue, label);
      }
      const normalized = stringifyJsonDisplay(entryValue);
      return normalized ? [{ label, value: normalized }] : [];
    })
    .slice(0, 12);
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
  <Drawer :open="open" :title="title" :width="drawerWidth" @close="closeDrawer">
    <template #extra>
      <Button v-if="item?.sourceUrl" type="link" @click="handleOpenSource">
        原网页
      </Button>
    </template>

    <div v-if="loading" class="text-text-secondary py-10 text-center">
      加载中...
    </div>

    <div v-else-if="item && isMobile" class="opportunity-detail-mobile">
      <section class="opportunity-mobile-hero">
        <div class="opportunity-mobile-title">
          {{ item.title || '-' }}
        </div>
        <div class="opportunity-mobile-tags">
          <Tag :color="opportunityMeta.color">
            {{ opportunityMeta.label }}
          </Tag>
          <Tag :color="opportunityStatusMeta.color">
            {{ opportunityStatusMeta.label }}
          </Tag>
          <Tag v-if="item.publishedAgeLabel">
            {{ item.publishedAgeLabel }}
          </Tag>
        </div>
      </section>

      <section class="opportunity-mobile-section">
        <div class="opportunity-mobile-section-title">详情信息</div>
        <div class="opportunity-mobile-block">
          <p
            class="opportunity-mobile-description"
            :class="{
              'opportunity-mobile-scroll-text': shouldUseMobileScroll(
                mobileWholeDescription,
              ),
            }"
          >
            {{ mobileWholeDescription }}
          </p>
        </div>
      </section>

      <section v-if="showRawDescription" class="opportunity-mobile-section">
        <details class="opportunity-mobile-raw">
          <summary>原始抓取文本</summary>
          <p>{{ mobileRawDescription }}</p>
        </details>
      </section>
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
        <Tag :color="opportunityStatusMeta.color">
          {{ opportunityStatusMeta.label }}
        </Tag>
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
      <Descriptions.Item label="来源链接">
        <Button
          type="link"
          class="opportunity-detail-link px-0"
          @click="handleOpenSource"
        >
          {{ item.sourceUrl || '-' }}
        </Button>
      </Descriptions.Item>
      <Descriptions.Item label="描述">
        <div class="opportunity-detail-text">
          {{ item.description || '-' }}
        </div>
      </Descriptions.Item>
      <Descriptions.Item label="标签">
        <Space class="opportunity-detail-tags" wrap>
          <Tag v-for="tag in getTags(item.tagsJson)" :key="tag" color="blue">
            {{ tag }}
          </Tag>
          <span v-if="getTags(item.tagsJson).length === 0">-</span>
        </Space>
      </Descriptions.Item>
      <Descriptions.Item label="扩展信息">
        <div class="opportunity-detail-meta-list">
          <div
            v-for="[key, value] in getJsonEntries(item.detailJson)"
            :key="key"
            class="opportunity-detail-meta-item"
          >
            <span>{{ key }}:</span>
            <strong>{{ value }}</strong>
          </div>
          <span v-if="getJsonEntries(item.detailJson).length === 0">-</span>
        </div>
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

  :deep(.ant-descriptions-item-content) {
    min-width: 0;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
}

.opportunity-detail-link {
  display: inline-flex;
  align-items: flex-start;
  justify-content: flex-start;
  max-width: 100%;
  height: auto;
  min-width: 0;
  padding: 0;
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-all;
}

.opportunity-detail-text {
  max-width: 100%;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  word-break: break-word;
}

.opportunity-detail-tags {
  max-width: 100%;
}

.opportunity-detail-tags :deep(.ant-tag) {
  max-width: 100%;
  height: auto;
  line-height: 1.5;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.opportunity-detail-meta-list {
  display: grid;
  width: 100%;
  max-width: 100%;
  gap: 8px;
}

.opportunity-detail-meta-item {
  display: grid;
  grid-template-columns: minmax(96px, max-content) minmax(0, 1fr);
  gap: 6px;
  max-width: 100%;
  min-width: 0;
  padding: 6px 8px;
  background: var(--ant-color-fill-tertiary);
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 6px;
}

.opportunity-detail-meta-item > span {
  color: var(--ant-color-text-secondary);
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.opportunity-detail-meta-item > strong {
  min-width: 0;
  color: var(--ant-color-text);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.6;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.opportunity-detail-mobile {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 100%;
  padding: 10px 8px 22px;
  background: #f6f7f9;
}

.opportunity-mobile-hero,
.opportunity-mobile-section {
  background: #fff;
  border: 1px solid #edf0f5;
  border-radius: 8px;
}

.opportunity-mobile-hero {
  padding: 12px;
}

.opportunity-mobile-title {
  min-width: 0;
  color: #1f2937;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.55;
  text-align: center;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.opportunity-mobile-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin-top: 10px;
}

.opportunity-mobile-section {
  overflow: hidden;
}

.opportunity-mobile-section-title {
  padding: 11px 12px 0;
  color: #101828;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.4;
  text-align: center;
}

.opportunity-mobile-block {
  min-width: 0;
  padding: 11px 12px;
  border-bottom: 1px solid #edf0f5;
}

.opportunity-mobile-block:last-child {
  border-bottom: 0;
}

.opportunity-mobile-block > span {
  color: #667085;
  font-size: 12px;
  line-height: 1.45;
  text-align: center;
}

.opportunity-mobile-block > strong,
.opportunity-mobile-block > p {
  min-width: 0;
  margin: 0;
  color: #344054;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.6;
  text-align: center;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.opportunity-mobile-description {
  color: #1f2937 !important;
  font-size: 14px !important;
  line-height: 1.75 !important;
}

.opportunity-mobile-scroll-text {
  max-height: 168px;
  padding: 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  -webkit-overflow-scrolling: touch;
}

.opportunity-mobile-block {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.opportunity-mobile-raw {
  padding: 12px;
}

.opportunity-mobile-raw > summary {
  color: #475467;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
}

.opportunity-mobile-raw > p {
  max-height: 260px;
  padding: 10px;
  margin: 10px 0 0;
  overflow: auto;
  color: #475467;
  font-size: 12px;
  line-height: 1.65;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.dark {
  .opportunity-detail-mobile {
    background: #111827;
  }

  .opportunity-mobile-hero,
  .opportunity-mobile-section {
    background: #1f2937;
    border-color: #374151;
  }

  .opportunity-mobile-title,
  .opportunity-mobile-section-title,
  .opportunity-mobile-block > strong,
  .opportunity-mobile-block > p {
    color: #f3f4f6;
  }

  .opportunity-mobile-scroll-text,
  .opportunity-mobile-raw > p {
    background: #111827;
    border-color: #374151;
  }

  .opportunity-mobile-block {
    border-color: #374151;
  }

  .opportunity-mobile-raw > summary,
  .opportunity-mobile-block > span {
    color: #9ca3af;
  }
}
</style>
