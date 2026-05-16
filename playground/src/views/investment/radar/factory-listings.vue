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
  message,
  Modal,
  Row,
  Space,
  Statistic,
  Table,
} from 'ant-design-vue';

import {
  createManualPublicOpportunity,
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
const manualModalOpen = ref(false);
const manualSaving = ref(false);
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
const manualForm = ref({
  areaText: '',
  city: '',
  contactName: '',
  description: '',
  district: '',
  priceText: '',
  sourceSite: 'manual',
  sourceUrl: '',
  title: '',
});

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
    align: 'center',
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
    align: 'center',
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      [record.city, record.district].filter(Boolean).join(' / ') || '-',
    dataIndex: 'city',
    key: 'city',
    title: '城市 / 区域',
  },
  {
    align: 'center',
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      formatArea(record),
    dataIndex: 'areaText',
    key: 'areaText',
    title: '面积',
  },
  {
    align: 'center',
    customRender: ({ text }) => text || '-',
    dataIndex: 'priceText',
    key: 'priceText',
    title: '价格',
  },
  {
    align: 'center',
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      renderSourceSite(record),
    dataIndex: 'sourceSite',
    key: 'sourceSite',
    title: '来源站点',
  },
  {
    align: 'center',
    customRender: ({ text }) => formatPublishedDate(text),
    dataIndex: 'publishedAt',
    key: 'publishedAt',
    title: '发布时间',
  },
  {
    align: 'center',
    customRender: ({ text }) => text || '-',
    dataIndex: 'publishedAgeLabel',
    key: 'publishedAgeLabel',
    title: '时效',
  },
  {
    align: 'center',
    customRender: ({ text }) => text ?? '-',
    dataIndex: 'score',
    key: 'score',
    title: '分数',
  },
  {
    align: 'center',
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

function renderSourceSite(record: PublicOpportunityItem) {
  const label = record.sourceSite || record.sourceUrl || '-';
  if (!record.sourceUrl) {
    return label;
  }

  return h(
    'a',
    {
      class: 'source-site-link',
      href: record.sourceUrl,
      onClick: (event: MouseEvent) => event.stopPropagation(),
      rel: 'noopener noreferrer',
      style: {
        color: '#1677ff',
        cursor: 'pointer',
      },
      target: '_blank',
      title: record.sourceUrl,
    },
    label,
  );
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

function resetManualForm() {
  manualForm.value = {
    areaText: '',
    city: searchForm.value.city || '',
    contactName: '',
    description: '',
    district: '',
    priceText: '',
    sourceSite: 'manual',
    sourceUrl: '',
    title: '',
  };
}

function openManualModal() {
  resetManualForm();
  manualModalOpen.value = true;
}

async function submitManualOpportunity() {
  const title = manualForm.value.title.trim();
  if (!title) {
    message.warning('请输入房源标题');
    return;
  }

  manualSaving.value = true;
  try {
    await createManualPublicOpportunity({
      ...manualForm.value,
      opportunityType: 'SUPPLY',
      title,
    });
    message.success('手动房源已写入公开机会池');
    manualModalOpen.value = false;
    handleSearch();
  } catch (error) {
    console.error('manual factory listing failed:', error);
    message.error('手动录入房源失败');
  } finally {
    manualSaving.value = false;
  }
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
  <div class="factory-listings-route">
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
            <Button @click="openManualModal">手动录入房源</Button>
            <Button type="primary" @click="loadFactoryListings">
              刷新数据
            </Button>
          </Space>
        </div>

        <Alert v-if="loadError" :message="loadError" show-icon type="warning" />

        <Row :gutter="[16, 16]">
          <Col :lg="12" :md="12" :sm="24" :xs="24">
            <Card>
              <Statistic
                title="当前页房源数"
                :value="summary.currentPageCount"
              />
            </Card>
          </Col>
          <Col :lg="12" :md="12" :sm="24" :xs="24">
            <Card>
              <Statistic title="总房源数" :value="summary.total" />
            </Card>
          </Col>
        </Row>

        <Card title="查询条件">
          <Form class="radar-search-form" layout="inline">
            <Form.Item label="城市">
              <Input
                v-model:value="searchForm.city"
                allow-clear
                class="radar-filter-control"
                placeholder="惠州"
                @press-enter="handleSearch"
              />
            </Form.Item>
            <Form.Item label="来源">
              <AutoComplete
                v-model:value="searchForm.sourceSite"
                allow-clear
                class="radar-filter-control"
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
                class="radar-filter-control"
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
                class="radar-filter-keyword"
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
            bordered
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

    <Modal
      v-model:open="manualModalOpen"
      title="手动录入公开房源"
      width="720px"
      :confirm-loading="manualSaving"
      @ok="submitManualOpportunity"
    >
      <Form layout="vertical">
        <Form.Item label="房源标题" required>
          <Input
            v-model:value="manualForm.title"
            placeholder="例如：惠州仲恺 1200 平方标准厂房出租"
          />
        </Form.Item>
        <Form.Item label="来源站点">
          <Input v-model:value="manualForm.sourceSite" placeholder="manual" />
        </Form.Item>
        <Form.Item label="来源链接">
          <Input
            v-model:value="manualForm.sourceUrl"
            placeholder="可填原网页地址；不填则自动生成应急来源"
          />
        </Form.Item>
        <Row :gutter="12">
          <Col :span="12">
            <Form.Item label="城市">
              <Input v-model:value="manualForm.city" placeholder="惠州" />
            </Form.Item>
          </Col>
          <Col :span="12">
            <Form.Item label="区域">
              <Input v-model:value="manualForm.district" placeholder="仲恺" />
            </Form.Item>
          </Col>
        </Row>
        <Row :gutter="12">
          <Col :span="12">
            <Form.Item label="面积">
              <Input v-model:value="manualForm.areaText" placeholder="1200㎡" />
            </Form.Item>
          </Col>
          <Col :span="12">
            <Form.Item label="价格">
              <Input
                v-model:value="manualForm.priceText"
                placeholder="18 元/㎡/月"
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="联系人 / 电话">
          <Input
            v-model:value="manualForm.contactName"
            placeholder="张经理 13800000000"
          />
        </Form.Item>
        <Form.Item label="补充描述">
          <Input.TextArea
            v-model:value="manualForm.description"
            :auto-size="{ minRows: 3, maxRows: 6 }"
            placeholder="可写层高、配电、消防、交通等补充信息"
          />
        </Form.Item>
      </Form>
    </Modal>
  </div>
</template>

<style lang="less" scoped>
.factory-title-cell,
.factory-title {
  text-align: center;
}

.factory-title {
  font-weight: 500;
}

.factory-source-url {
  max-width: 360px;
  overflow: hidden;
  color: var(--ant-color-text-description);
  margin: 0 auto;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.radar-search-form {
  --radar-filter-height: 34px;
  --radar-filter-width: 180px;

  align-items: center;
  row-gap: 12px;
  width: 100%;
}

.radar-search-form :deep(.ant-form-item) {
  align-items: center;
  margin-bottom: 0;
}

.radar-search-form :deep(.ant-form-item-control-input) {
  min-height: var(--radar-filter-height);
}

.radar-filter-control {
  width: var(--radar-filter-width);
  max-width: var(--radar-filter-width);
  min-width: var(--radar-filter-width);
}

.radar-filter-keyword {
  width: var(--radar-filter-width);
  max-width: var(--radar-filter-width);
  min-width: var(--radar-filter-width);
}

.radar-search-form :deep(.ant-input),
.radar-search-form :deep(.ant-input-affix-wrapper),
.radar-search-form :deep(.ant-select-selection-item),
.radar-search-form :deep(.ant-select-selection-placeholder) {
  font-size: 14px;
}

.radar-search-form :deep(.ant-input),
.radar-search-form :deep(.ant-input-affix-wrapper),
.radar-search-form :deep(.ant-select-single),
.radar-search-form :deep(.ant-select-single .ant-select-selector),
.radar-search-form :deep(.ant-select-single .ant-select-selection-search-input),
.radar-search-form :deep(.ant-btn) {
  height: var(--radar-filter-height);
}

.radar-search-form :deep(.ant-input),
.radar-search-form :deep(.ant-input-affix-wrapper),
.radar-search-form :deep(.ant-select-single .ant-select-selector),
.radar-search-form :deep(.ant-btn) {
  line-height: calc(var(--radar-filter-height) - 2px);
}

.radar-search-form :deep(.ant-input-affix-wrapper) {
  align-items: center;
  box-sizing: border-box;
  display: flex;
  padding-block: 0;
}

.radar-search-form :deep(.ant-input-affix-wrapper > input.ant-input) {
  height: calc(var(--radar-filter-height) - 2px);
  line-height: calc(var(--radar-filter-height) - 2px);
}

.radar-search-form :deep(.ant-select-single .ant-select-selector) {
  align-items: center;
  display: flex;
}

.radar-search-form :deep(.ant-select-single .ant-select-selection-item),
.radar-search-form :deep(.ant-select-single .ant-select-selection-placeholder) {
  line-height: calc(var(--radar-filter-height) - 2px);
  width: 100%;
}

.radar-search-form
  :deep(.ant-select-single .ant-select-selection-search-input) {
  text-align: left;
}

.radar-search-form :deep(.ant-form-item-label > label) {
  color: var(--ant-color-text);
  font-size: 14px;
  min-height: var(--radar-filter-height);
}

:deep(.ant-table-thead > tr > th) {
  color: var(--ant-color-text);
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  vertical-align: middle;
}

:deep(.ant-table-tbody > tr > td) {
  color: var(--ant-color-text);
  font-size: 14px;
  line-height: 22px;
  text-align: center;
  vertical-align: middle;
}

.source-site-link {
  color: var(--ant-color-primary);
}

.source-site-link:hover {
  text-decoration: underline;
}
</style>
