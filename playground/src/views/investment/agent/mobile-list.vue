<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { InvestmentAgent } from './data';

import {
  createApp,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
} from 'vue';
import { useRoute } from 'vue-router';

import { useVbenModal } from '@vben/common-ui';
import { Search } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue';
import {
  AutoComplete,
  Button,
  Card,
  Empty,
  Form,
  Image,
  message,
  Pagination,
  Select,
  Spin,
  Tag,
} from 'ant-design-vue';

import {
  deleteInvestment,
  getInvestmentList,
  getInvestmentParkList,
} from '#/api/investment';
import MobileDateRange from '#/components/MobileDateRange.vue';
import { $t } from '#/locales';
import { getInvestmentTodoPriorityInfo } from '#/utils/workbench-todo-priority';

import { searchableDropdownProps, useSearchHistory } from '../search-history';
import { getTagTypeOptions } from './data';
import AgentForm from './modules/form.vue';
import RecommendFab from './modules/recommend-fab.vue';

const meetingRange = ref<[Dayjs | undefined, Dayjs | undefined]>([
  undefined,
  undefined,
]);

const searchForm = reactive({
  agentName: '',
  intentLevel: undefined as string | undefined,
  progress: undefined as string | undefined,
  tenantName: '',
});
const tenantNameSearchHistory = useSearchHistory(
  'agent.mobile-list.tenantName',
);
const agentNameSearchHistory = useSearchHistory('agent.mobile-list.agentName');
const tenantNameOptions = tenantNameSearchHistory.options();
const agentNameOptions = agentNameSearchHistory.options();

const parkOptions = ref<{ label: string; value: number }[]>([
  { label: '全部区域', value: -1 },
]);
const selectedParkId = ref<number | undefined>(undefined);
const route = useRoute();
const parkNameMap = ref<Record<number, string>>({});

const loading = ref(false);
const filterOpen = ref(false);
const investmentList = ref<InvestmentAgent[]>([]);
const pagination = reactive({ current: 1, pageSize: 10, total: 0 });

const tagTypeOptions = getTagTypeOptions();
const intentLevelOptions = tagTypeOptions.map((opt) => ({
  label: opt.label,
  value: opt.value,
}));
const progressOptions = [
  { label: '初步接洽', value: '初步接洽' },
  { label: '深入沟通', value: '深入沟通' },
  { label: '合同准备', value: '合同准备' },
  { label: '签约完成', value: '签约完成' },
];

function getTagColor(value?: string) {
  const option = tagTypeOptions.find((opt) => opt.value === value);
  return option ? option.color : 'default';
}

function formatValue(value?: null | number | string) {
  const text = String(value ?? '').trim();
  return text || '-';
}

function formatIntentArea(value?: number) {
  if (value === undefined || value === null) {
    return '-';
  }
  return `${value} ㎡`;
}

function formatMeetingTime(value?: string) {
  return formatValue(value ? formatDateTime(value) : '');
}

function getInvestmentPriorityInfo(item: InvestmentAgent) {
  return getInvestmentTodoPriorityInfo(
    item.progress,
    item.meetingTime,
    item.intentLevel,
  );
}

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: AgentForm,
  destroyOnClose: true,
});

function onEdit(row: InvestmentAgent) {
  const rowData = { ...row };
  rowData.meetingTime = String(formatDateTime(rowData.meetingTime));
  formModalApi.setData(rowData).open();
}

function onAdd() {
  formModalApi.setData({}).open();
}

function openAddWithPark(park?: {
  address?: string;
  distance?: string;
  name: string;
  tel?: string;
}) {
  const parkName = (park?.name || '').trim();
  const payload: Partial<InvestmentAgent> = {};

  if (parkName) {
    const matchedPark = parkOptions.value.find(
      (option) =>
        option.label === parkName ||
        option.label.includes(parkName) ||
        parkName.includes(option.label),
    );
    if (
      matchedPark &&
      typeof matchedPark.value === 'number' &&
      matchedPark.value > 0
    ) {
      payload.parkId = matchedPark.value;
      payload.parkName = matchedPark.label;
    } else {
      payload.parkName = parkName;
    }
  }

  const recommendRemark = [
    parkName ? `推荐工厂：${parkName}` : '',
    park?.address ? `地址：${park.address}` : '',
    park?.tel ? `电话：${park.tel}` : '',
    park?.distance ? `距离：${park.distance} 米` : '',
  ]
    .filter(Boolean)
    .join('；');
  if (recommendRemark) {
    payload.remark = recommendRemark;
  }

  formModalApi.setData(payload).open();
}

async function onDelete(row: InvestmentAgent) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.agentName || '']),
    duration: 0,
    key: 'action_process_msg',
  });

  const { investmentId } = row;
  if (investmentId) {
    try {
      await deleteInvestment(investmentId);
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.tenantName || '']),
        key: 'action_process_msg',
      });
      fetchList();
    } catch (error) {
      console.error('删除投资项目失败:', error);
      message.error({
        content: $t('ui.actionMessage.operationFailed', [error]),
        key: 'action_process_msg',
      });
    }
  }
}

function onView(row: InvestmentAgent) {
  let imgList: string[] = [];
  if (Array.isArray(row.imageUrlList)) {
    imgList = row.imageUrlList;
  } else if (row.imageUrlList) {
    imgList = [row.imageUrlList];
  }

  if (imgList.length === 0) {
    message.info($t('page.agent.noImages'));
    return;
  }

  const previewContainer = document.createElement('div');
  document.body.append(previewContainer);

  const previewApp = createApp({
    setup() {
      const visible = ref(false);
      onUnmounted(() => {
        if (document.body.contains(previewContainer)) {
          previewContainer.remove();
        }
      });
      onMounted(() => {
        nextTick(() => {
          visible.value = true;
        });
      });
      return () =>
        h(
          Image.PreviewGroup,
          {
            preview: {
              onVisibleChange: (v) => {
                visible.value = v;
                if (!v) {
                  setTimeout(() => {
                    previewApp.unmount();
                  }, 200);
                }
              },
              visible: visible.value,
            },
          },
          imgList.map((src: string) =>
            h(Image, {
              preview: {},
              src,
              style: { display: 'none' },
            }),
          ),
        );
    },
  });
  previewApp.mount(previewContainer);
}

async function fetchList() {
  loading.value = true;
  const startDate = meetingRange.value?.[0]?.format('YYYY-MM-DD');
  const endDate = meetingRange.value?.[1]?.format('YYYY-MM-DD');
  const startTime = startDate ? `${startDate} 00:00:00` : undefined;
  const endTime = endDate ? `${endDate} 23:59:59` : undefined;
  const params: any = {
    agentName: searchForm.agentName || undefined,
    currentPage: pagination.current,
    currentPark: selectedParkId.value ?? -1,
    endTime,
    intentLevel: searchForm.intentLevel || undefined,
    pageSize: pagination.pageSize,
    progress: searchForm.progress || undefined,
    startTime,
    tenantName: searchForm.tenantName || undefined,
  };
  try {
    const result = await getInvestmentList(params);
    const items: InvestmentAgent[] = Array.isArray(result?.items)
      ? result.items
      : [];
    investmentList.value = items;
    pagination.total = Number(result?.total ?? items.length);
  } catch (error) {
    console.error('获取投资项目列表失败:', error);
    message.error('获取投资项目列表失败');
    investmentList.value = [];
    pagination.total = 0;
  } finally {
    loading.value = false;
  }
}

function handlePageChange(page: number, pageSize: number) {
  pagination.current = page;
  pagination.pageSize = pageSize;
  fetchList();
}

function handleSearch() {
  tenantNameSearchHistory.add(searchForm.tenantName);
  agentNameSearchHistory.add(searchForm.agentName);
  pagination.current = 1;
  filterOpen.value = false;
  fetchList();
}

function resetSearch() {
  meetingRange.value = [undefined, undefined];
  selectedParkId.value = undefined;
  searchForm.agentName = '';
  searchForm.tenantName = '';
  searchForm.intentLevel = undefined;
  searchForm.progress = undefined;
  filterOpen.value = false;
  pagination.current = 1;
  fetchList();
}

function onParkChange(value: any) {
  selectedParkId.value = value as number;
  handleSearch();
}

function getRouteQueryText(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }

  return String(value || '').trim();
}

function applyRouteFilters() {
  const parkId = Number(route.query.parkId ?? route.query.currentPark);
  const tenantName = getRouteQueryText(route.query.tenantName);
  const progress = getRouteQueryText(route.query.progress);

  if (Number.isInteger(parkId) && parkId > 0) {
    selectedParkId.value = parkId;
  }
  if (tenantName) {
    searchForm.tenantName = tenantName;
  }
  if (progress) {
    searchForm.progress = progress;
  }
}

onMounted(() => {
  applyRouteFilters();
  fetchList();
  getInvestmentParkList()
    .then((list: any[]) => {
      const options = Array.isArray(list)
        ? list.map((p: any) => ({ label: p.parkName, value: p.parkId }))
        : [];
      parkOptions.value = [{ label: '全部区域', value: -1 }, ...options];
      if (Array.isArray(list)) {
        parkNameMap.value = Object.fromEntries(
          list.map((p: any) => [p.parkId as number, String(p.parkName)]),
        );
      }
    })
    .catch(() => {
      parkOptions.value = [{ label: '全部区域', value: -1 }];
    });
});

const showFloatingActions = ref(false);

onMounted(async () => {
  await waitForSafeAreaBottomStable();
  showFloatingActions.value = true;
});

function readSafeAreaBottomInset() {
  const probe = document.createElement('div');
  probe.style.position = 'fixed';
  probe.style.bottom = '0';
  probe.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  document.body.append(probe);
  const inset = Number.parseFloat(getComputedStyle(probe).paddingBottom) || 0;
  probe.remove();
  return inset;
}

function waitForSafeAreaBottomStable(
  stableFrames = 3,
  timeoutMs = 1200,
): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    let stableCount = 0;
    let lastInset = readSafeAreaBottomInset();

    const check = () => {
      const currentInset = readSafeAreaBottomInset();
      if (Math.abs(currentInset - lastInset) < 0.5) {
        stableCount += 1;
      } else {
        stableCount = 0;
      }
      lastInset = currentInset;

      if (
        stableCount >= stableFrames ||
        performance.now() - start >= timeoutMs
      ) {
        resolve();
        return;
      }
      requestAnimationFrame(check);
    };

    requestAnimationFrame(check);
  });
}

function resolveParkName(id?: null | number, name?: string) {
  const n = (name || '').trim();
  if (n) return n;
  if (typeof id === 'number') {
    return parkNameMap.value[id] || '';
  }
  return '';
}
</script>

<template>
  <div class="investment-mobile-page">
    <FormModal @success="handleSearch" />

    <div class="investment-mobile-filter">
      <Form class="investment-mobile-filter-form" layout="vertical">
        <div class="investment-mobile-search-bar">
          <Form.Item>
            <AutoComplete
              v-model:value="searchForm.tenantName"
              v-bind="searchableDropdownProps"
              placeholder="租户 / 中介人"
              size="small"
              allow-clear
              :options="tenantNameOptions"
              @press-enter="handleSearch"
              @select="handleSearch"
            />
          </Form.Item>
          <Button type="primary" size="small" @click="handleSearch">
            搜索
          </Button>
          <Button size="small" @click="filterOpen = !filterOpen">筛选</Button>
        </div>
        <div v-show="filterOpen" class="investment-mobile-filter-panel">
          <div class="investment-mobile-filter-grid">
            <Form.Item class="filter-date">
              <MobileDateRange v-model:value="meetingRange" size="small" />
            </Form.Item>
            <Form.Item>
              <Select
                v-model:value="selectedParkId"
                :options="parkOptions"
                placeholder="全部区域"
                size="small"
                allow-clear
                @change="onParkChange"
              />
            </Form.Item>
            <Form.Item>
              <Select
                v-model:value="searchForm.intentLevel"
                :options="intentLevelOptions"
                placeholder="意向等级"
                size="small"
                allow-clear
              />
            </Form.Item>
            <Form.Item>
              <AutoComplete
                v-model:value="searchForm.agentName"
                v-bind="searchableDropdownProps"
                placeholder="中介人"
                size="small"
                allow-clear
                :options="agentNameOptions"
                @press-enter="handleSearch"
                @select="handleSearch"
              />
            </Form.Item>
            <Form.Item>
              <Select
                v-model:value="searchForm.progress"
                :options="progressOptions"
                placeholder="跟进进度"
                size="small"
                allow-clear
              />
            </Form.Item>
          </div>
          <div class="investment-mobile-filter-actions">
            <Button type="primary" size="small" @click="handleSearch">
              <Search class="mr-1 h-4 w-4" />
              {{ $t('应用筛选') }}
            </Button>
            <Button size="small" @click="resetSearch">{{ $t('重置') }}</Button>
          </div>
        </div>
      </Form>
    </div>

    <Spin :spinning="loading" :tip="$t('加载中...')">
      <div v-if="investmentList.length > 0" class="investment-mobile-list">
        <Card
          v-for="item in investmentList"
          :key="
            item.investmentId +
            String(item.meetingTime) +
            String(item.updateTime)
          "
          class="investment-mobile-card"
          :body-style="{ padding: '0' }"
        >
          <div class="investment-card-head">
            <div class="investment-card-title-wrap">
              <div
                class="investment-card-title"
                :title="formatValue(item.tenantName || item.agentName)"
              >
                {{ formatValue(item.tenantName || item.agentName) }}
              </div>
              <div
                class="investment-card-subtitle"
                :title="`中介人：${formatValue(item.agentName)}`"
              >
                中介人：{{ formatValue(item.agentName) }}
              </div>
            </div>
            <Tag
              class="investment-card-level"
              :color="getTagColor(item.intentLevel)"
            >
              {{ formatValue(item.intentLevel) }}
            </Tag>
          </div>

          <div class="investment-card-tags">
            <Tag
              v-if="getInvestmentPriorityInfo(item).visible"
              :color="getInvestmentPriorityInfo(item).color"
            >
              {{ getInvestmentPriorityInfo(item).label }}
            </Tag>
            <Tag color="blue">{{ formatValue(item.progress) }}</Tag>
            <span :title="resolveParkName(item.parkId, item.parkName) || '-'">
              园区：{{ resolveParkName(item.parkId, item.parkName) || '-' }}
            </span>
          </div>

          <div class="investment-card-body">
            <div class="investment-card-meta investment-card-meta-primary">
              <div class="meta-area">
                <span>意向面积</span>
                <strong>{{ formatIntentArea(item.intentArea) }}</strong>
              </div>
              <div class="meta-phone">
                <span>联系电话</span>
                <strong>{{ formatValue(item.phoneNumber) }}</strong>
              </div>
              <div class="meta-time">
                <span>会谈时间</span>
                <strong>{{ formatMeetingTime(item.meetingTime) }}</strong>
              </div>
              <div class="meta-tenant">
                <span>租户名称</span>
                <strong>{{ formatValue(item.tenantName) }}</strong>
              </div>
              <div v-if="getInvestmentPriorityInfo(item).visible">
                <span>处理提醒</span>
                <strong>{{ getInvestmentPriorityInfo(item).reason }}</strong>
              </div>
            </div>

            <p
              v-if="item.remark"
              class="investment-card-remark"
              :title="item.remark"
            >
              备注：{{ item.remark }}
            </p>
          </div>

          <div class="investment-card-actions">
            <Button size="small" @click="onView(item)">
              <EyeOutlined />
              {{ $t('ui.action.view') }}
            </Button>
            <Button size="small" @click="onEdit(item)">
              <EditOutlined />
              {{ $t('ui.action.edit') }}
            </Button>
            <Button size="small" danger @click="onDelete(item)">
              <DeleteOutlined />
              {{ $t('ui.action.delete') }}
            </Button>
          </div>
        </Card>
        <Pagination
          v-if="pagination.total > 0"
          :current="pagination.current"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          @change="handlePageChange"
          size="small"
          class="investment-mobile-pagination"
        />
      </div>
      <Empty v-else :description="loading ? $t('加载中...') : $t('暂无数据')" />
    </Spin>

    <Teleport to="body">
      <div
        v-if="showFloatingActions"
        class="investment-mobile-floating-actions"
      >
        <Button
          type="primary"
          shape="circle"
          size="large"
          @click="onAdd"
          class="!inline-flex !h-14 !w-14 items-center justify-center !p-0 shadow-md transition-transform duration-200 hover:-translate-y-0.5"
        >
          <PlusOutlined class="text-xl" />
        </Button>
        <RecommendFab @select="openAddWithPark" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.investment-mobile-page {
  box-sizing: border-box;
  min-height: 100%;
  padding: 8px 8px calc(136px + env(safe-area-inset-bottom));
  background: #f0f2f5;
}

.dark .investment-mobile-page {
  background: #1a1a1a;
}

.investment-mobile-filter {
  padding: 8px;
  margin-bottom: 8px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
}

.dark .investment-mobile-filter,
.dark .investment-mobile-card {
  background: #2d2d2d;
}

.investment-mobile-filter-form {
  overflow-x: hidden;
}

.investment-mobile-search-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 58px 58px;
  gap: 6px;
  align-items: center;
}

.investment-mobile-search-bar :deep(.ant-form-item) {
  margin-bottom: 0;
}

.investment-mobile-filter-panel {
  padding-top: 8px;
  margin-top: 8px;
  border-top: 1px solid var(--ant-color-border-secondary);
}

.investment-mobile-filter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.investment-mobile-filter-grid .filter-date,
.investment-mobile-filter-grid .filter-wide {
  grid-column: 1 / -1;
}

.investment-mobile-filter-form :deep(.ant-form-item) {
  min-width: 0;
  margin-bottom: 0;
}

.investment-mobile-filter-form :deep(.ant-form-item-label) {
  display: none;
}

.investment-mobile-filter-form :deep(.ant-form-item-control-input) {
  min-height: 28px;
}

.investment-mobile-filter-form :deep(.ant-picker),
.investment-mobile-filter-form :deep(.ant-select),
.investment-mobile-filter-form :deep(.ant-input-affix-wrapper) {
  width: 100%;
  max-width: 100%;
}

.investment-mobile-filter-form :deep(.mobile-date-range) {
  gap: 6px;
}

.investment-mobile-filter-form :deep(.range-separator) {
  font-size: 12px;
}

.investment-mobile-filter-form :deep(.ant-select-selection-placeholder),
.investment-mobile-filter-form :deep(.ant-input::placeholder) {
  font-size: 12px;
}

.investment-mobile-filter-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 6px;
}

.investment-mobile-filter-actions :deep(.ant-btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 28px;
}

.investment-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.investment-mobile-card {
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 8px;
  box-shadow: 0 1px 4px rgb(0 0 0 / 6%);
}

.investment-mobile-card :deep(.ant-card-body) {
  padding: 11px 12px 10px !important;
}

.investment-card-head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  justify-content: space-between;
}

.investment-card-title-wrap {
  flex: 1;
  min-width: 0;
}

.investment-card-title {
  display: -webkit-box;
  overflow: hidden;
  font-size: 16px;
  font-weight: 700;
  line-height: 22px;
  color: var(--ant-color-text);
  -webkit-line-clamp: 2;
  word-break: break-word;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
}

.investment-card-subtitle {
  margin-top: 2px;
  overflow: hidden;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.investment-card-level {
  flex-shrink: 0;
  max-width: 88px;
  margin-inline-end: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.investment-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
  padding-bottom: 8px;
  margin-top: 7px;
  font-size: 12px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
  border-bottom: 1px solid var(--ant-color-border-secondary);
}

.investment-card-tags > span {
  flex: 1 1 120px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.investment-card-body {
  margin-top: 9px;
}

.investment-card-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px 10px;
}

.investment-card-meta > div {
  min-width: 0;
  padding: 7px 8px;
  background: var(--ant-color-fill-quaternary);
  border-radius: 6px;
}

.investment-card-meta span {
  display: block;
  font-size: 12px;
  line-height: 17px;
  color: var(--ant-color-text-secondary);
}

.investment-card-meta strong {
  display: block;
  min-height: 19px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  line-height: 19px;
  color: var(--ant-color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.investment-card-meta .meta-time {
  grid-column: 1 / -1;
}

.investment-card-meta .meta-time strong {
  overflow-wrap: anywhere;
  white-space: normal;
}

.investment-card-remark {
  display: -webkit-box;
  padding: 7px 8px;
  margin: 8px 0 0;
  overflow: hidden;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  -webkit-line-clamp: 2;
  word-break: break-word;
  overflow-wrap: anywhere;
  background: var(--ant-color-fill-quaternary);
  border-radius: 6px;
  -webkit-box-orient: vertical;
}

.investment-card-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  padding-top: 9px;
  margin-top: 10px;
  border-top: 1px solid var(--ant-color-border-secondary);
}

.investment-card-actions :deep(.ant-btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 32px;
  padding-inline: 4px;
}

.investment-card-actions :deep(.ant-btn > span:not(.anticon)) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.investment-mobile-pagination {
  margin-top: 10px;
  text-align: center;
}

.investment-mobile-floating-actions {
  position: fixed;
  right: max(10px, env(safe-area-inset-right));
  bottom: calc(76px + env(safe-area-inset-bottom));
  z-index: 1000;
  display: flex;
  gap: 10px;
  align-items: center;
}

.investment-mobile-floating-actions :deep(.ant-btn) {
  flex: 0 0 auto;
  box-shadow: 0 6px 18px rgb(0 0 0 / 18%);
}

@media (width <= 360px) {
  .investment-card-actions {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .investment-card-actions :deep(.ant-btn) {
    font-size: 12px;
  }
}
</style>
