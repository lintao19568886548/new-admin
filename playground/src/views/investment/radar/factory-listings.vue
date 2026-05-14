<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type { PublicOpportunityItem } from '#/api/investment';

import { computed, h, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Space,
  Statistic,
  Table,
} from 'ant-design-vue';

import {
  getEffectivePublicOpportunityList,
  getPublicOpportunityDetail,
} from '#/api/investment';

import OpportunityDetailDrawer from './opportunity-detail-drawer.vue';

defineOptions({ name: 'InvestmentRadarFactoryListings' });

const router = useRouter();
const loading = ref(false);
const detailLoading = ref(false);
const detailOpen = ref(false);
const loadError = ref('');
const items = ref<PublicOpportunityItem[]>([]);
const currentItem = ref<null | PublicOpportunityItem>(null);
const pagination = ref({
  current: 1,
  pageSize: 20,
  total: 0,
});
const searchForm = ref({
  city: '',
  keyword: '',
  publishedAgeLabel: '',
  sourceSite: '',
});
const publishedAgeLabelOptions = ref<Array<{ value: string }>>([]);
const sourceSiteOptions = ref<Array<{ value: string }>>([]);

const summary = computed(() => ({
  currentPageCount: items.value.length,
  total: pagination.value.total,
}));

const tableLocale = {
  emptyText: '暂无房源采集结果',
};

const shanghaiDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
});

function toAutoCompleteOptions(values?: string[]) {
  return [
    ...new Set((values || []).map((value) => value.trim()).filter(Boolean)),
  ].map((value) => ({ value }));
}

const columns: TableColumnsType<PublicOpportunityItem> = [
  {
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      h('div', { class: 'factory-title-cell' }, [
        h('div', { class: 'factory-title' }, record.title || '-'),
        h('div', { class: 'factory-source-url' }, record.sourceUrl || '-'),
      ]),
    dataIndex: 'title',
    key: 'title',
    title: '标题',
  },
  {
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      [record.city, record.district].filter(Boolean).join(' / ') || '-',
    dataIndex: 'city',
    key: 'city',
    title: '城市 / 区域',
  },
  {
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      formatArea(record),
    dataIndex: 'areaText',
    key: 'areaText',
    title: '面积',
  },
  {
    customRender: ({ text }) => text || '-',
    dataIndex: 'priceText',
    key: 'priceText',
    title: '价格',
  },
  {
    customRender: ({ text }) => text || '-',
    dataIndex: 'sourceSite',
    key: 'sourceSite',
    title: '来源站点',
  },
  {
    customRender: ({ text }) => formatPublishedDate(text),
    dataIndex: 'publishedAt',
    key: 'publishedAt',
    title: '发布时间',
  },
  {
    customRender: ({ text }) => text || '-',
    dataIndex: 'publishedAgeLabel',
    key: 'publishedAgeLabel',
    title: '时效',
  },
  {
    customRender: ({ text }) => text ?? '-',
    dataIndex: 'score',
    key: 'score',
    title: '分数',
  },
  {
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      h(Space, {}, () => [
        h(
          Button,
          {
            onClick: () => void openDetail(record),
            size: 'small',
            type: 'link',
          },
          () => '查看详情',
        ),
        h(
          Button,
          {
            onClick: () => openSource(record),
            size: 'small',
            type: 'link',
          },
          () => '原网页',
        ),
      ]),
    key: 'operation',
    title: '操作',
    width: 180,
  },
];

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

function buildQuery() {
  return {
    city: searchForm.value.city || undefined,
    currentPage: pagination.value.current,
    keyword: searchForm.value.keyword || undefined,
    opportunityType: 'SUPPLY',
    pageSize: pagination.value.pageSize,
    publishedAgeLabel: searchForm.value.publishedAgeLabel || undefined,
    sourceSite: searchForm.value.sourceSite || undefined,
  };
}

async function loadFactoryListings() {
  loading.value = true;
  loadError.value = '';
  try {
    const result = await getEffectivePublicOpportunityList(buildQuery());
    items.value = Array.isArray(result.items)
      ? result.items.filter((item) => item.opportunityType === 'SUPPLY')
      : [];
    const itemCount = items.value.length;
    pagination.value.total =
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
    console.error('加载公开房源采集失败:', error);
    items.value = [];
    pagination.value.total = 0;
    loadError.value = '房源数据加载失败，请检查公开机会相关接口是否可用。';
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.value.current = 1;
  void loadFactoryListings();
}

function handleReset() {
  searchForm.value = {
    city: '',
    keyword: '',
    publishedAgeLabel: '',
    sourceSite: '',
  };
  handleSearch();
}

function handleTableChange(page: { current?: number; pageSize?: number }) {
  pagination.value.current = page.current || 1;
  pagination.value.pageSize = page.pageSize || 20;
  void loadFactoryListings();
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
  window.open(record.sourceUrl, '_blank', 'noopener,noreferrer');
}

function goToRadarList() {
  router.push('/investment/radar');
}

void loadFactoryListings();
</script>

<template>
  <Page auto-content-height>
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-lg font-semibold">公开房源采集</div>
          <div class="text-text-secondary text-sm">
            查看公开渠道采集到的可招商房源信息。
          </div>
        </div>
        <Space>
          <Button @click="goToRadarList">返回雷达列表</Button>
          <Button type="primary" @click="loadFactoryListings">刷新数据</Button>
        </Space>
      </div>

      <Alert v-if="loadError" :message="loadError" show-icon type="warning" />

      <Row :gutter="[16, 16]">
        <Col :lg="12" :md="12" :sm="24" :xs="24">
          <Card>
            <Statistic title="当前页房源数" :value="summary.currentPageCount" />
          </Card>
        </Col>
        <Col :lg="12" :md="12" :sm="24" :xs="24">
          <Card>
            <Statistic title="总房源数" :value="summary.total" />
          </Card>
        </Col>
      </Row>

      <Card title="查询条件">
        <Form layout="inline">
          <Form.Item label="城市">
            <Input
              v-model:value="searchForm.city"
              allow-clear
              class="w-32"
              placeholder="惠州"
              @press-enter="handleSearch"
            />
          </Form.Item>
          <Form.Item label="来源">
            <AutoComplete
              v-model:value="searchForm.sourceSite"
              allow-clear
              class="w-32"
              :options="sourceSiteOptions"
              placeholder="99cfw"
              @press-enter="handleSearch"
              @select="handleSearch"
            />
          </Form.Item>
          <Form.Item label="时效">
            <AutoComplete
              v-model:value="searchForm.publishedAgeLabel"
              allow-clear
              class="w-32"
              :options="publishedAgeLabelOptions"
              placeholder="7 天前"
              @press-enter="handleSearch"
              @select="handleSearch"
            />
          </Form.Item>
          <Form.Item label="关键词">
            <Input
              v-model:value="searchForm.keyword"
              allow-clear
              class="w-64"
              placeholder="标题 / 联系人 / 来源 URL"
              @press-enter="handleSearch"
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" @click="handleSearch">查询</Button>
              <Button @click="handleReset">重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card title="房源采集结果">
        <Table
          :columns="columns"
          :data-source="items"
          :loading="loading"
          :locale="tableLocale"
          :pagination="pagination"
          :scroll="{ x: 1100 }"
          row-key="opportunityId"
          size="small"
          @change="handleTableChange"
        />
      </Card>
    </div>
  </Page>

  <OpportunityDetailDrawer
    :item="currentItem"
    :loading="detailLoading"
    :open="detailOpen"
    title="公开房源详情"
    @open-source="openSource"
    @update:open="handleDetailOpenChange"
  />
</template>

<style lang="less" scoped>
.factory-title {
  font-weight: 500;
}

.factory-source-url {
  max-width: 360px;
  overflow: hidden;
  color: var(--ant-color-text-description);
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
