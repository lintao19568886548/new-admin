<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type {
  EnterpriseProfile,
  EnterpriseTag,
  SignalEvent,
  SignalEventType,
} from '#/api/investment';

import { h, onMounted, ref } from 'vue';

import { formatDateTime } from '@vben/utils';

import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  message,
  Progress,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  getEnterpriseProfileDetail,
  getEnterpriseProfileList,
  getEnterpriseProfileSignals,
  getEnterpriseProfileTags,
  rebuildEnterpriseProfileDemo,
} from '#/api/investment';

defineOptions({ name: 'InvestmentRadarEnterpriseProfiles' });

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
const searchForm = ref({
  industryName: '',
  keyword: '',
  regionCity: '',
});
const pagination = ref({
  current: 1,
  pageSize: 20,
  showSizeChanger: true,
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
const tableLocale = {
  emptyText: '暂无企业画像',
};

function formatOptionalTime(value?: null | string) {
  return value ? formatDateTime(value) : '-';
}

function formatRegion(record: EnterpriseProfile) {
  return (
    [record.regionProvince, record.regionCity, record.regionDistrict]
      .filter(Boolean)
      .join(' / ') || '-'
  );
}

function renderEventType(eventType?: null | string) {
  if (!eventType) {
    return '-';
  }
  const meta = eventTypeMeta[eventType] || {
    color: 'default',
    label: eventType,
  };
  return h(Tag, { color: meta.color }, () => meta.label);
}

function buildQuery() {
  return {
    currentPage: pagination.value.current,
    industryName: searchForm.value.industryName || undefined,
    keyword: searchForm.value.keyword || undefined,
    pageSize: pagination.value.pageSize,
    regionCity: searchForm.value.regionCity || undefined,
  };
}

async function loadProfiles() {
  loading.value = true;
  try {
    const result = await getEnterpriseProfileList(buildQuery());
    items.value = result.items;
    pagination.value.total = result.total;
  } catch (error) {
    console.error('load enterprise profiles failed:', error);
    message.error('企业画像加载失败');
  } finally {
    loading.value = false;
  }
}

function searchProfiles() {
  pagination.value.current = 1;
  void loadProfiles();
}

function resetSearch() {
  searchForm.value = {
    industryName: '',
    keyword: '',
    regionCity: '',
  };
  searchProfiles();
}

function handleTableChange(page: { current?: number; pageSize?: number }) {
  pagination.value.current = page.current || 1;
  pagination.value.pageSize = page.pageSize || 20;
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
    pagination.value.current = 1;
    await loadProfiles();
  } catch (error) {
    console.error('rebuild enterprise profiles failed:', error);
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
    console.error('load enterprise profile detail failed:', error);
    message.error('企业画像详情加载失败');
  } finally {
    detailLoading.value = false;
  }
}

const columns: TableColumnsType<EnterpriseProfile> = [
  {
    customRender: ({ record }) =>
      h('div', { class: 'profile-company-cell' }, [
        h('div', { class: 'font-medium' }, record.companyName),
        h(
          'div',
          { class: 'text-xs text-gray-500' },
          record.industryTags?.join(' / ') || '-',
        ),
      ]),
    dataIndex: 'companyName',
    key: 'companyName',
    title: '企业',
    width: 260,
  },
  {
    customRender: ({ record }) => record.industryName || '-',
    dataIndex: 'industryName',
    key: 'industryName',
    title: '行业',
    width: 130,
  },
  {
    customRender: ({ record }) => formatRegion(record),
    key: 'region',
    title: '地区',
    width: 180,
  },
  {
    dataIndex: 'signalCount',
    key: 'signalCount',
    title: '信号数',
    width: 90,
  },
  {
    customRender: ({ record }) => renderEventType(record.latestIntentType),
    dataIndex: 'latestIntentType',
    key: 'latestIntentType',
    title: '最新意图',
    width: 140,
  },
  {
    customRender: ({ record }) =>
      h(Progress, {
        percent: record.profileCompleteness,
        size: 'small',
        status: record.profileCompleteness >= 70 ? 'success' : 'normal',
      }),
    dataIndex: 'profileCompleteness',
    key: 'profileCompleteness',
    title: '完整度',
    width: 160,
  },
  {
    customRender: ({ record }) => formatOptionalTime(record.lastSignalTime),
    dataIndex: 'lastSignalTime',
    key: 'lastSignalTime',
    title: '最新信号时间',
    width: 170,
  },
  {
    customRender: ({ record }) =>
      h(
        Button,
        {
          onClick: () => void openDetail(record),
          size: 'small',
          type: 'link',
        },
        () => '详情',
      ),
    fixed: 'right',
    key: 'operation',
    title: '操作',
    width: 90,
  },
];

const tagColumns: TableColumnsType<EnterpriseTag> = [
  {
    dataIndex: 'tagType',
    key: 'tagType',
    title: '类型',
    width: 110,
  },
  {
    dataIndex: 'tagName',
    key: 'tagName',
    title: '标签',
    width: 160,
  },
  {
    dataIndex: 'tagSource',
    key: 'tagSource',
    title: '来源',
    width: 130,
  },
  {
    dataIndex: 'confidenceScore',
    key: 'confidenceScore',
    title: '置信度',
    width: 100,
  },
];

const signalColumns: TableColumnsType<SignalEvent> = [
  {
    customRender: ({ record }) =>
      h('div', [
        h('div', { class: 'font-medium' }, record.eventTitle),
        h('div', { class: 'text-xs text-gray-500' }, record.sourceName),
      ]),
    dataIndex: 'eventTitle',
    key: 'eventTitle',
    title: '信号',
    width: 300,
  },
  {
    customRender: ({ record }) => renderEventType(record.eventType),
    dataIndex: 'eventType',
    key: 'eventType',
    title: '类型',
    width: 130,
  },
  {
    dataIndex: 'confidenceScore',
    key: 'confidenceScore',
    title: '置信度',
    width: 90,
  },
  {
    customRender: ({ record }) => formatOptionalTime(record.eventTime),
    dataIndex: 'eventTime',
    key: 'eventTime',
    title: '时间',
    width: 170,
  },
];

onMounted(() => {
  void loadProfiles();
});
</script>

<template>
  <div class="enterprise-profiles-pane">
    <Alert
      class="mb-3"
      message="企业画像由企业信号事件重建生成，本阶段只沉淀画像、标签和评分输入，不接真实网站。"
      show-icon
      type="info"
    />

    <Card class="mb-3" title="筛选">
      <Form class="radar-search-form" layout="inline">
        <Form.Item label="关键词">
          <Input
            v-model:value="searchForm.keyword"
            allow-clear
            class="radar-filter-keyword"
            placeholder="企业 / 行业 / 地区"
            @press-enter="searchProfiles"
          />
        </Form.Item>
        <Form.Item label="行业">
          <Input
            v-model:value="searchForm.industryName"
            allow-clear
            class="radar-filter-control"
            @press-enter="searchProfiles"
          />
        </Form.Item>
        <Form.Item label="城市">
          <Input
            v-model:value="searchForm.regionCity"
            allow-clear
            class="radar-filter-control"
            @press-enter="searchProfiles"
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" @click="searchProfiles">查询</Button>
            <Button @click="resetSearch">重置</Button>
            <Button :loading="loading" @click="loadProfiles">刷新</Button>
            <Button
              type="primary"
              :loading="rebuilding"
              @click="rebuildDemoProfiles"
            >
              重建 demo 画像
            </Button>
          </Space>
        </Form.Item>
      </Form>
      <div v-if="rebuildSummary" class="text-text-secondary mt-3 text-sm">
        最近重建：信号 {{ rebuildSummary.signalEventCount }}，企业
        {{ rebuildSummary.sourceCompanyCount }}，画像新增
        {{ rebuildSummary.createdProfileCount }}，画像更新
        {{ rebuildSummary.updatedProfileCount }}，标签新增
        {{ rebuildSummary.createdTagCount }}，标签更新
        {{ rebuildSummary.updatedTagCount }}
      </div>
    </Card>

    <Card class="profile-table-card" title="企业画像">
      <Table
        :columns="columns"
        :data-source="items"
        :loading="loading"
        :locale="tableLocale"
        :pagination="pagination"
        row-key="profileId"
        :scroll="{ x: 1230 }"
        size="small"
        @change="handleTableChange"
      />
    </Card>

    <Drawer
      v-model:open="detailOpen"
      destroy-on-close
      title="企业画像详情"
      width="920"
    >
      <div v-if="detailLoading" class="py-8 text-center">加载中...</div>
      <template v-else-if="currentProfile">
        <Descriptions bordered :column="2" size="small">
          <Descriptions.Item label="企业" :span="2">
            {{ currentProfile.companyName }}
          </Descriptions.Item>
          <Descriptions.Item label="行业">
            {{ currentProfile.industryName || '-' }}
          </Descriptions.Item>
          <Descriptions.Item label="地区">
            {{ formatRegion(currentProfile) }}
          </Descriptions.Item>
          <Descriptions.Item label="信号数量">
            {{ currentProfile.signalCount }}
          </Descriptions.Item>
          <Descriptions.Item label="最新意图">
            <component :is="renderEventType(currentProfile.latestIntentType)" />
          </Descriptions.Item>
          <Descriptions.Item label="统一社会信用代码">
            {{ currentProfile.unifiedSocialCreditCode || '-' }}
          </Descriptions.Item>
          <Descriptions.Item label="注册资本">
            {{ currentProfile.registeredCapital ?? '-' }}
          </Descriptions.Item>
          <Descriptions.Item label="地址" :span="2">
            {{ currentProfile.address || '-' }}
          </Descriptions.Item>
          <Descriptions.Item label="画像完整度" :span="2">
            <Progress :percent="currentProfile.profileCompleteness" />
          </Descriptions.Item>
        </Descriptions>

        <Card class="mt-4" title="企业标签">
          <Table
            :columns="tagColumns"
            :data-source="tagItems"
            :pagination="false"
            row-key="tagId"
            size="small"
          />
        </Card>

        <Card class="mt-4" title="关联信号">
          <Table
            :columns="signalColumns"
            :data-source="signalItems"
            :pagination="false"
            row-key="eventId"
            :scroll="{ x: 720 }"
            size="small"
          />
        </Card>
      </template>
    </Drawer>
  </div>
</template>

<style lang="less" scoped>
.enterprise-profiles-pane {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: auto;
}

.profile-table-card {
  min-height: 0;
  flex: 1;
}

.profile-company-cell {
  max-width: 240px;
}

.radar-search-form {
  row-gap: 12px;
}

.radar-filter-control {
  width: 180px;
  min-width: 180px;
}

.radar-filter-keyword {
  width: 320px;
  max-width: 100%;
  min-width: 320px;
}

.radar-search-form :deep(.ant-input),
.radar-search-form :deep(.ant-select-selection-item),
.radar-search-form :deep(.ant-select-selection-placeholder) {
  font-size: 14px;
}

.radar-search-form :deep(.ant-input),
.radar-search-form :deep(.ant-select-single .ant-select-selector) {
  min-height: 34px;
}

.radar-search-form :deep(.ant-form-item-label > label) {
  color: var(--ant-color-text);
  font-size: 14px;
}

:deep(.ant-table-thead > tr > th) {
  color: var(--ant-color-text);
  font-size: 14px;
  font-weight: 600;
}

:deep(.ant-table-tbody > tr > td) {
  color: var(--ant-color-text);
  font-size: 14px;
  line-height: 22px;
}
</style>
