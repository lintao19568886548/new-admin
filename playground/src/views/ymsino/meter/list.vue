<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  YmsinoMeterItem,
  YmsinoPltItem,
  YmsinoTranDayItem,
} from '#/api/ymsino';

import { computed, h, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import {
  Button,
  Card,
  DatePicker,
  Input,
  message,
  Select,
  Space,
  Tabs,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getYmsinoMeterList,
  getYmsinoPltList,
  getYmsinoTranDay,
} from '#/api/ymsino';

type ViewMode = 'meter' | 'reading';

const typeOptions = [
  { label: '全部类型', value: '' },
  { label: '电表', value: '0' },
  { label: '冷水', value: '1' },
  { label: '热水', value: '2' },
];

const activeTab = ref<ViewMode>('meter');
const pltList = ref<YmsinoPltItem[]>([]);
const selectedPtId = ref('');
const selectedTjType = ref('');
const keyword = ref('');
const rmId = ref('');
const tyDate = ref<Dayjs>(dayjs());
const loadingPlt = ref(false);

const selectedPtName = computed(() => {
  const matched = pltList.value.find(
    (item) => item.PtId === selectedPtId.value,
  );
  return matched?.PtName || selectedPtId.value || '-';
});

const meterColumns: VxeTableGridOptions<YmsinoMeterItem>['columns'] = [
  { field: 'RmId', fixed: 'left', title: 'RmId', width: 130 },
  { field: 'RmName', fixed: 'left', title: 'RmName', width: 160 },
  { field: 'DeviceId', title: 'DeviceId', width: 150 },
  { field: 'FactoryNo', title: 'FactoryNo', width: 180 },
  {
    field: 'TjType',
    slots: {
      default: ({ row }) => renderTjType(row.TjType),
    },
    title: 'TjType',
    width: 100,
  },
  { field: 'Pt', title: 'Pt', width: 90 },
  { field: 'Ct', title: 'Ct', width: 90 },
];

const readingColumns: VxeTableGridOptions<YmsinoTranDayItem>['columns'] = [
  { field: 'RmId', fixed: 'left', title: 'RmId', width: 130 },
  { field: 'RmName', fixed: 'left', title: 'RmName', width: 150 },
  { field: 'FactoryNo', fixed: 'left', title: 'FactoryNo', width: 180 },
  { field: 'DeviceId', title: 'DeviceId', width: 150 },
  {
    field: 'TjType',
    slots: {
      default: ({ row }) => renderTjType(row.TjType),
    },
    title: 'TjType',
    width: 100,
  },
  { field: 'TranDate', title: 'TranDate', width: 130 },
  { field: 'ZTotal', title: 'ZTotal', width: 120 },
  { field: 'FTotal', title: 'FTotal', width: 120 },
  { field: 'ZTip', title: 'ZTip', width: 100 },
  { field: 'ZPeak', title: 'ZPeak', width: 100 },
  { field: 'ZComm', title: 'ZComm', width: 100 },
  { field: 'ZVale', title: 'ZVale', width: 100 },
  { field: 'Pt', title: 'Pt', width: 90 },
  { field: 'Ct', title: 'Ct', width: 90 },
];

const [MeterGrid, meterGridApi] = useVbenVxeGrid({
  gridOptions: {
    border: true,
    columns: meterColumns,
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: true,
      pageSize: 20,
      pageSizes: [10, 20, 50, 100],
    },
    proxyConfig: {
      ajax: {
        query: async () => {
          try {
            const response = await getYmsinoMeterList(buildBaseParams());
            const items = filterItems(response.items || []);
            return { total: items.length, items };
          } catch (error) {
            message.error('获取亿玛设备列表失败');
            throw error;
          }
        },
      },
      autoLoad: false,
    },
    rowConfig: { keyField: 'FactoryNo' },
    scrollX: { enabled: true },
    showOverflow: true,
    toolbarConfig: {
      custom: true,
      export: true,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<YmsinoMeterItem>,
});

const [ReadingGrid, readingGridApi] = useVbenVxeGrid({
  gridOptions: {
    border: true,
    columns: readingColumns,
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: true,
      pageSize: 20,
      pageSizes: [10, 20, 50, 100],
    },
    proxyConfig: {
      ajax: {
        query: async () => {
          try {
            const response = await getYmsinoTranDay({
              ...buildBaseParams(),
              tyDate: tyDate.value.format('YYYY-MM-DD'),
            });
            const items = filterItems(response.items || []);
            return { total: items.length, items };
          } catch (error) {
            message.error('获取亿玛冻结数据失败');
            throw error;
          }
        },
      },
      autoLoad: false,
    },
    rowConfig: { keyField: 'FactoryNo' },
    scrollX: { enabled: true },
    showOverflow: true,
    toolbarConfig: {
      custom: true,
      export: true,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<YmsinoTranDayItem>,
});

function buildBaseParams() {
  const params: Record<string, string> = {};
  if (selectedPtId.value) params.ptId = selectedPtId.value;
  if (selectedTjType.value) params.tjType = selectedTjType.value;
  if (rmId.value.trim()) params.rmId = rmId.value.trim();
  return params;
}

function filterItems<T extends YmsinoMeterItem>(items: T[]) {
  const normalized = keyword.value.trim().toLowerCase();
  if (!normalized) return items;

  return items.filter((item) =>
    [
      item.RmId,
      item.RmName,
      item.DeviceId,
      item.FactoryNo,
      item.TjType,
      item.Pt,
      item.Ct,
    ].some((value) =>
      String(value ?? '')
        .toLowerCase()
        .includes(normalized),
    ),
  );
}

function renderTjType(type: unknown) {
  const value = String(type ?? '');
  const typeMap: Record<string, { color: string; text: string }> = {
    0: { color: 'orange', text: '0 电表' },
    1: { color: 'blue', text: '1 冷水' },
    2: { color: 'red', text: '2 热水' },
  };
  const config = typeMap[value] || { color: 'default', text: value || '-' };

  return h(Tag, { color: config.color }, () => config.text);
}

async function loadPltList() {
  loadingPlt.value = true;
  try {
    const response = await getYmsinoPltList();
    pltList.value = response.items || [];
    if (!selectedPtId.value && pltList.value[0]?.PtId) {
      selectedPtId.value = pltList.value[0].PtId;
    }
  } catch {
    message.error('获取亿玛小区列表失败');
  } finally {
    loadingPlt.value = false;
  }
}

function queryActiveGrid() {
  if (activeTab.value === 'reading') {
    readingGridApi.query();
    return;
  }
  meterGridApi.query();
}

function resetFilters() {
  selectedTjType.value = '';
  keyword.value = '';
  rmId.value = '';
  tyDate.value = dayjs();
  queryActiveGrid();
}

function onTabChange() {
  queryActiveGrid();
}

onMounted(async () => {
  await loadPltList();
  queryActiveGrid();
});
</script>

<template>
  <Page auto-content-height>
    <Card :bordered="false" class="ymsino-toolbar">
      <div class="toolbar-row">
        <Select
          v-model:value="selectedPtId"
          :loading="loadingPlt"
          class="toolbar-control toolbar-control-wide"
          placeholder="选择小区"
          show-search
          @change="queryActiveGrid"
        >
          <Select.Option
            v-for="park in pltList"
            :key="park.PtId"
            :value="park.PtId"
          >
            {{ park.PtName }} / {{ park.PtId }}
          </Select.Option>
        </Select>

        <Select
          v-model:value="selectedTjType"
          class="toolbar-control"
          :options="typeOptions"
          @change="queryActiveGrid"
        />

        <Input
          v-model:value="rmId"
          allow-clear
          class="toolbar-control"
          placeholder="RmId"
          @press-enter="queryActiveGrid"
        />

        <Input
          v-model:value="keyword"
          allow-clear
          class="toolbar-control toolbar-control-wide"
          placeholder="RmId / RmName / FactoryNo"
          @press-enter="queryActiveGrid"
        />

        <DatePicker
          v-if="activeTab === 'reading'"
          v-model:value="tyDate"
          class="toolbar-control"
          @change="queryActiveGrid"
        />

        <Space>
          <Button type="primary" @click="queryActiveGrid">
            <template #icon>
              <SearchOutlined />
            </template>
            查询
          </Button>
          <Button @click="resetFilters">
            <template #icon>
              <ReloadOutlined />
            </template>
            重置
          </Button>
        </Space>
      </div>
      <div class="toolbar-meta">
        当前小区：{{
          selectedPtName
        }}；本页面展示亿玛原始字段，不转换为合众格式。
      </div>
    </Card>

    <Tabs
      v-model:active-key="activeTab"
      class="ymsino-tabs"
      @change="onTabChange"
    >
      <Tabs.TabPane key="meter" tab="设备信息">
        <MeterGrid table-title="亿玛设备信息" />
      </Tabs.TabPane>
      <Tabs.TabPane key="reading" tab="日冻结数据">
        <ReadingGrid table-title="亿玛日冻结数据" />
      </Tabs.TabPane>
    </Tabs>
  </Page>
</template>

<style scoped>
.ymsino-toolbar {
  margin-bottom: 12px;
}

.toolbar-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.toolbar-control {
  width: 160px;
}

.toolbar-control-wide {
  width: 260px;
}

.toolbar-meta {
  margin-top: 10px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.ymsino-tabs {
  min-height: 0;
}

@media (max-width: 768px) {
  .toolbar-control,
  .toolbar-control-wide {
    width: 100%;
  }

  .toolbar-row {
    align-items: stretch;
  }
}
</style>
