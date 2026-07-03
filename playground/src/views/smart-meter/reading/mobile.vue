<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import { computed, reactive, ref, watch } from 'vue';

import { Search } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import { FilterOutlined } from '@ant-design/icons-vue';
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  message,
  Row,
  Segmented,
  Select,
  Spin,
  Tag,
  TreeSelect,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  getMeterData,
  getMeterTree,
  getWaterData,
  getWaterTree,
} from '#/api/hezhong';
import MobilePage from '#/components/mobile/MobilePage.vue';
import MobilePagination from '#/components/mobile/MobilePagination.vue';
import MobilePanel from '#/components/mobile/MobilePanel.vue';
import MobileDateRange from '#/components/MobileDateRange.vue';
import { $t } from '#/locales';

type ReadingTab = 'meter' | 'water';

interface ReadingConfig {
  amountClass: string;
  cardKey: (item: any) => string;
  getData: (params?: any) => Promise<any>;
  getTree: (params?: any) => Promise<any>;
  inputLabel: string;
  inputPlaceholder: string;
  label: string;
  segmentedClass: string;
  timeField: 'freezeTime' | 'writeTime';
  timeLabel: string;
  totalLabel: string;
}

interface ReadingState {
  buildingTreeData: any[];
  freezeRange: [Dayjs, Dayjs];
  hasLoaded: boolean;
  list: any[];
  loading: boolean;
  nameMap: Record<string, string>;
  pagination: {
    current: number;
    pageSize: number;
    total: number;
  };
  searchForm: {
    comAddress: string;
    type: number;
  };
  selectedBuildingValue: string | undefined;
  treeLoaded: boolean;
  treeLoading: boolean;
  treeRaw: any[];
}

const readingConfigs: Record<ReadingTab, ReadingConfig> = {
  meter: {
    amountClass: 'text-orange-500',
    cardKey: (item) =>
      `${item.comAddress}${String(item.freezeTime)}${String(item.writeTime)}`,
    getData: getMeterData,
    getTree: getMeterTree,
    inputLabel: '电表编号',
    inputPlaceholder: '请输入电表编号',
    label: '电表',
    segmentedClass:
      '[&_.ant-segmented-item-selected]:text-orange-500 [&_.ant-segmented-item-selected]:shadow-sm',
    timeField: 'writeTime',
    timeLabel: '写入时间',
    totalLabel: '总用电量(度)',
  },
  water: {
    amountClass: 'text-blue-500',
    cardKey: (item) => `${item.comAddress}${String(item.freezeTime)}`,
    getData: getWaterData,
    getTree: getWaterTree,
    inputLabel: '水表编号',
    inputPlaceholder: '请输入水表编号',
    label: '水表',
    segmentedClass:
      '[&_.ant-segmented-item-selected]:text-blue-500 [&_.ant-segmented-item-selected]:shadow-sm',
    timeField: 'freezeTime',
    timeLabel: '冻结时间',
    totalLabel: '总用水量(吨)',
  },
};

const typeOptions = [
  { label: '小时冻结数据', value: 1 },
  { label: '日冻结数据', value: 2 },
  { label: '月冻结数据', value: 3 },
];

const tabOptions = [
  { label: '电表', value: 'meter' },
  { label: '水表', value: 'water' },
];

function createState(): ReadingState {
  return reactive({
    buildingTreeData: [],
    freezeRange: [dayjs(), dayjs()] as [Dayjs, Dayjs],
    hasLoaded: false,
    loading: false,
    nameMap: {},
    pagination: {
      current: 1,
      pageSize: 20,
      total: 0,
    },
    searchForm: {
      comAddress: '',
      type: 2,
    },
    selectedBuildingValue: undefined,
    treeLoaded: false,
    treeLoading: false,
    treeRaw: [],
    list: [],
  }) as ReadingState;
}

const states: Record<ReadingTab, ReadingState> = {
  meter: createState(),
  water: createState(),
};

const activeTab = ref<ReadingTab>('meter');
const filterExpanded = ref(false);

const currentConfig = computed(() => readingConfigs[activeTab.value]);
const currentState = computed(() => states[activeTab.value]);
const segmentedClass = computed(() =>
  ['w-full rounded-md bg-gray-100', currentConfig.value.segmentedClass].join(
    ' ',
  ),
);
const hasAdvancedFilters = computed(() => {
  const state = currentState.value;
  return (
    Boolean(state.selectedBuildingValue) ||
    Boolean(state.searchForm.comAddress) ||
    state.searchForm.type !== 2
  );
});

function convertToTreeSelect(nodes: any[]): any[] {
  return (nodes || []).map((node: any) => ({
    title: String(node?.title ?? ''),
    value:
      node?.isLeaf === true && node?.dataRef?.comAddress
        ? String(node.dataRef.comAddress)
        : String(node?.key ?? ''),
    children: Array.isArray(node?.children)
      ? convertToTreeSelect(node.children)
      : undefined,
  }));
}

function findNodeByValue(nodes: any[], value?: string) {
  if (!value) return null;
  const stack = Array.isArray(nodes) ? [...nodes] : [];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    const isLeaf = node.isLeaf === true && node?.dataRef?.comAddress;
    if (isLeaf) {
      if (String(node.dataRef.comAddress) === String(value)) return node;
    } else if (String(node.key) === String(value)) {
      return node;
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      stack.push(...node.children);
    }
  }
  return null;
}

function collectLeafAddresses(node: any): string[] {
  const out: string[] = [];
  const stack = node ? [node] : [];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (current.isLeaf === true && current?.dataRef?.comAddress) {
      out.push(String(current.dataRef.comAddress));
    } else if (Array.isArray(current.children)) {
      stack.push(...current.children);
    }
  }
  return [...new Set(out)];
}

async function fetchTreeNameMap(tab: ReadingTab) {
  const state = states[tab];
  const config = readingConfigs[tab];
  try {
    state.treeLoading = true;
    const nodes: any[] = await config.getTree();
    state.treeRaw = nodes || [];

    const map: Record<string, string> = {};
    const stack = Array.isArray(nodes) ? [...nodes] : [];
    while (stack.length > 0) {
      const node = stack.pop();
      if (!node) continue;
      if (node.isLeaf === true && node?.dataRef?.comAddress) {
        const address = String(node.dataRef.comAddress);
        const name = String(node?.dataRef?.piplineName ?? node?.title ?? '');
        if (address && name) {
          map[address] = name;
        }
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        stack.push(...node.children);
      }
    }

    state.nameMap = map;
    state.buildingTreeData = convertToTreeSelect(nodes || []);
    state.treeLoaded = true;
  } catch {
    message.error(`加载${config.label}建筑列表失败`);
  } finally {
    state.treeLoading = false;
  }
}

async function fetchList(tab: ReadingTab) {
  const state = states[tab];
  const config = readingConfigs[tab];

  state.loading = true;
  try {
    const startDate = state.freezeRange?.[0]?.format('YYYY-MM-DD');
    const endDate = state.freezeRange?.[1]?.format('YYYY-MM-DD');
    const timeFrom = startDate ? `${startDate} 00:00:00` : undefined;
    const timeTo = endDate ? `${endDate} 23:59:59` : undefined;
    const payload: any = {
      page: state.pagination.current,
      pageSize: state.pagination.pageSize,
      timeFrom,
      timeTo,
      type: Number(state.searchForm.type),
    };

    let effectiveComAddress: string | undefined;
    let effectiveComAddresses: string[] | undefined;

    if (state.searchForm.comAddress) {
      effectiveComAddress = state.searchForm.comAddress;
    } else if (state.selectedBuildingValue) {
      const node = findNodeByValue(state.treeRaw, state.selectedBuildingValue);
      if (node?.isLeaf === true && node?.dataRef?.comAddress) {
        effectiveComAddress = String(node.dataRef.comAddress);
      } else if (node) {
        effectiveComAddresses = collectLeafAddresses(node);
      }
    }

    if (effectiveComAddress) {
      payload.comAddress = effectiveComAddress;
    } else if (effectiveComAddresses && effectiveComAddresses.length > 0) {
      payload.comAddress = effectiveComAddresses.join(',');
    }

    const response = await config.getData(payload);
    let items: any[] = (response as any)?.items ?? (response as any);
    items = Array.isArray(items) ? items : [];
    items = items.map((item) => {
      const address = String(item?.comAddress ?? '');
      const pipelineName = state.nameMap[address];
      return pipelineName ? { ...item, piplineName: pipelineName } : item;
    });

    state.list = items;
    state.pagination.total = Number((response as any)?.total ?? items.length);
    state.hasLoaded = true;
  } catch (error) {
    console.error(`获取${config.label}列表失败`, error);
    state.list = [];
    state.pagination.total = 0;
    message.error(`获取${config.label}列表失败`);
  } finally {
    state.loading = false;
  }
}

async function ensureTabReady(tab: ReadingTab) {
  const state = states[tab];
  if (!state.treeLoaded) {
    await fetchTreeNameMap(tab);
  }
  if (!state.hasLoaded) {
    await fetchList(tab);
  }
}

function handleSearch() {
  const state = currentState.value;
  state.pagination.current = 1;
  filterExpanded.value = false;
  void fetchList(activeTab.value);
}

function resetSearch() {
  const state = currentState.value;
  state.freezeRange = [dayjs(), dayjs()];
  state.searchForm.comAddress = '';
  state.searchForm.type = 2;
  state.selectedBuildingValue = undefined;
  state.pagination.current = 1;
  filterExpanded.value = false;
  void fetchList(activeTab.value);
}

function handlePageChange(page: number, pageSize: number) {
  const state = currentState.value;
  state.pagination.current = page;
  state.pagination.pageSize = pageSize;
  void fetchList(activeTab.value);
}

function formatItemTime(item: any) {
  const value = item?.[currentConfig.value.timeField];
  return value ? formatDateTime(value) : '-';
}

watch(
  activeTab,
  (tab) => {
    filterExpanded.value = false;
    void ensureTabReady(tab);
  },
  { immediate: true },
);
</script>

<template>
  <MobilePage :bottom-inset="false">
    <MobilePanel tight>
      <Segmented
        v-model:value="activeTab"
        :options="tabOptions"
        block
        :class="segmentedClass"
      />
    </MobilePanel>

    <MobilePanel>
      <Form layout="vertical">
        <Row :gutter="16">
          <Col :span="24">
            <Form.Item label="冻结时间">
              <MobileDateRange v-model:value="currentState.freezeRange" />
            </Form.Item>
          </Col>
          <template v-if="filterExpanded">
            <Col :span="24">
              <Form.Item label="建筑">
                <TreeSelect
                  v-model:value="currentState.selectedBuildingValue"
                  :tree-data="currentState.buildingTreeData"
                  :tree-default-expand-all="true"
                  :loading="currentState.treeLoading"
                  class="w-full"
                  placeholder="请选择建筑或设备"
                  allow-clear
                />
              </Form.Item>
            </Col>
            <Col :span="12">
              <Form.Item :label="currentConfig.inputLabel">
                <Input
                  v-model:value="currentState.searchForm.comAddress"
                  :placeholder="currentConfig.inputPlaceholder"
                  allow-clear
                />
              </Form.Item>
            </Col>
            <Col :span="12">
              <Form.Item label="数据类型">
                <Select
                  v-model:value="currentState.searchForm.type"
                  :options="typeOptions"
                  placeholder="选择数据类型"
                  allow-clear
                />
              </Form.Item>
            </Col>
          </template>
        </Row>
        <div class="mt-2 flex gap-2">
          <Button
            class="min-w-[88px]"
            @click="filterExpanded = !filterExpanded"
          >
            <FilterOutlined class="mr-1" />
            {{
              filterExpanded ? '收起' : hasAdvancedFilters ? '筛选中' : '筛选'
            }}
          </Button>
          <Button type="primary" class="flex-1" @click="handleSearch">
            <Search class="mr-1 h-4 w-4" />
            {{ $t('搜索') }}
          </Button>
          <Button class="flex-1" @click="resetSearch">
            {{ $t('重置') }}
          </Button>
        </div>
      </Form>
    </MobilePanel>

    <Spin :spinning="currentState.loading" :tip="$t('加载中...')">
      <div v-if="currentState.list.length > 0" class="pb-2">
        <Card
          v-for="item in currentState.list"
          :key="readingConfigs[activeTab].cardKey(item)"
          class="mb-3 overflow-hidden rounded-lg bg-white text-sm shadow-md"
          :body-style="{ padding: '0' }"
        >
          <div
            class="flex items-center justify-between border-b border-gray-100 px-4 py-3"
          >
            <span
              class="mr-2 whitespace-normal break-words text-base font-semibold text-gray-800"
            >
              {{ item.piplineName || item.comAddress }}
            </span>
            <Tag>{{ item.dataItemName }}</Tag>
          </div>

          <div class="p-4">
            <div class="mb-4 text-center">
              <span class="mb-1 block text-[13px] text-gray-400">
                {{ currentConfig.totalLabel }}
              </span>
              <span
                class="text-2xl font-semibold"
                :class="currentConfig.amountClass"
              >
                {{ item.dataValue ?? '-' }}
              </span>
            </div>

            <div v-if="activeTab === 'meter'" class="grid grid-cols-4 gap-2">
              <div
                class="flex flex-col items-center rounded-md bg-gray-50 px-2 py-2"
              >
                <span class="text-xs text-gray-400">尖</span>
                <span class="mt-1 text-sm text-gray-800">
                  {{ item.dataValue1 ?? '-' }}
                </span>
              </div>
              <div
                class="flex flex-col items-center rounded-md bg-gray-50 px-2 py-2"
              >
                <span class="text-xs text-gray-400">峰</span>
                <span class="mt-1 text-sm text-gray-800">
                  {{ item.dataValue2 ?? '-' }}
                </span>
              </div>
              <div
                class="flex flex-col items-center rounded-md bg-gray-50 px-2 py-2"
              >
                <span class="text-xs text-gray-400">平</span>
                <span class="mt-1 text-sm text-gray-800">
                  {{ item.dataValue3 ?? '-' }}
                </span>
              </div>
              <div
                class="flex flex-col items-center rounded-md bg-gray-50 px-2 py-2"
              >
                <span class="text-xs text-gray-400">谷</span>
                <span class="mt-1 text-sm text-gray-800">
                  {{ item.dataValue4 ?? '-' }}
                </span>
              </div>
            </div>

            <div
              class="grid grid-cols-2 gap-3"
              :class="{ 'mt-3': activeTab === 'meter' }"
            >
              <div class="flex flex-col">
                <span class="mb-0.5 text-[13px] text-gray-400">设备编号</span>
                <span class="text-sm text-gray-800">{{ item.comAddress }}</span>
              </div>
              <div class="flex flex-col">
                <span class="mb-0.5 text-[13px] text-gray-400">
                  {{ currentConfig.timeLabel }}
                </span>
                <span class="text-sm text-gray-800">
                  {{ formatItemTime(item) }}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <MobilePagination
          :current="currentState.pagination.current"
          :page-size="currentState.pagination.pageSize"
          :total="currentState.pagination.total"
          @change="handlePageChange"
        />
      </div>

      <Empty
        v-else
        :description="currentState.loading ? $t('加载中...') : $t('暂无数据')"
      />
    </Spin>
  </MobilePage>
</template>
