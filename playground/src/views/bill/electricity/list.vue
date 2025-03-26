<script lang="ts" setup>
import type { ElectricityBill } from './data';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';
import { ChevronDown, Plus } from '@vben/icons';

import { Button, Dropdown, Menu, message } from 'ant-design-vue';
import dayjs, { Dayjs } from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { $t } from '#/locales';

import BillDetail from '../modules/BillDetail.vue';
import BillForm from '../modules/BillForm.vue';
import {
  electricityDetailConfig,
  electricityFormConfig,
  useColumns,
  useGridFormSchema,
} from './data';

// 区域定义
interface Area {
  key: string;
  name: string;
}

// 区域列表
const areaList = [
  { key: 'all', name: '全部区域' },
  { key: 'east', name: '东莞' },
  { key: 'central', name: '广州' },
  { key: 'south', name: '深圳' },
  { key: 'north', name: '佛山' },
  { key: 'west', name: '珠海' },
];

// 当前选中的区域
const currentArea = ref(areaList[0]) as any;

// 账单表单组件引用
const billFormRef = ref();

// 账单详情组件引用
const billDetailRef = ref();

// 当前选中的账单数据
const currentBill = ref<ElectricityBill | null>(null);

/**
 * 切换区域
 */
function switchArea(area: Area) {
  currentArea.value = area;

  message.loading({
    content: `正在切换到${area.name}...`,
    duration: 0,
    key: 'area_change_msg',
  });

  // 模拟API请求延迟
  setTimeout(() => {
    refreshGrid();
    message.success({
      content: `已切换到${area.name}`,
      key: 'area_change_msg',
    });
  }, 800);
}

/**
 * 编辑电费账单
 * @param row
 */
function onEdit(row: ElectricityBill) {
  billFormRef.value?.open(row);
}

/**
 * 创建新电费账单
 */
function onCreate() {
  const newBill: ElectricityBill = {
    companyName: '',
    electricityItems: [],
    id: 0,
    paymentTime: ref<Dayjs>(dayjs()),
    position: '',
    projectName: '',
  };
  billFormRef.value?.open(newBill);
}

/**
 * 删除电费账单
 * @param row
 */
function onDelete(row: ElectricityBill) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.companyName]),
    duration: 0,
    key: 'action_process_msg',
  });

  // 模拟API请求
  setTimeout(() => {
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.companyName]),
      key: 'action_process_msg',
    });
    refreshGrid();
  }, 1000);
}

/**
 * 查看电费账单详情
 * @param row
 */
function onView(row: ElectricityBill) {
  currentBill.value = row;
  billDetailRef.value?.open(row);
}

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({ code, row }: OnActionClickParams<ElectricityBill>) {
  switch (code) {
    case 'delete': {
      onDelete(row);
      break;
    }
    case 'edit': {
      onEdit(row);
      break;
    }
    case 'view': {
      onView(row);
      break;
    }
  }
}

// 模拟的数据
const electricityBills: ElectricityBill[] = [
  {
    companyName: '示例公司一',
    electricityItems: [
      {
        actualUsage: 500,
        amount: 490,
        currentMonthReading: 5500,
        id: 1,
        key: '1',
        lastMonthReading: 5000,
        monthlyUsage: 500,
        multiplier: 1,
        name: '主楼电费',
        remark: '正常缴费',
        unitPrice: 0.98,
      },
      {
        actualUsage: 300,
        amount: 285,
        currentMonthReading: 3300,
        id: 2,
        key: '2',
        lastMonthReading: 3000,
        monthlyUsage: 300,
        multiplier: 1,
        name: '附楼电费',
        remark: '新增区域',
        unitPrice: 0.95,
      },
    ],
    id: 0,
    paymentTime: ref<Dayjs>(dayjs('2023-05-01')),
    position: '东莞',
    projectName: '项目A',
  },
  {
    companyName: '示例公司二',
    electricityItems: [
      {
        actualUsage: 1000,
        amount: 950,
        currentMonthReading: 2800,
        id: 3,
        key: '1',
        lastMonthReading: 2300,
        monthlyUsage: 500,
        multiplier: 2,
        name: '主楼电费',
        remark: '双倍计费',
        unitPrice: 0.95,
      },
    ],
    id: 0,
    paymentTime: ref<Dayjs>(dayjs('2023-05-02')),
    position: '广州',
    projectName: '项目B',
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    compact: true,
    schema: useGridFormSchema(),
    showCollapseButton: true,
    submitOnChange: true,
    wrapperClass: 'grid-cols-1 lg:grid-cols-3 gap-4',
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: '100%',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async () => {
          // 模拟API请求返回数据
          // 根据当前选中的区域筛选数据
          let filteredData = [...electricityBills];

          // 如果不是"全部区域"，则根据position进行筛选
          if (currentArea.value.key !== 'all') {
            // 对于演示，我们使用区域名称来匹配position字段
            // 实际应用中可能需要更复杂的匹配逻辑
            const areaName = currentArea.value.name;
            filteredData = electricityBills.filter(
              (bill) => bill.position === areaName,
            );
          }

          return {
            page: {
              pageSize: 20,
              total: filteredData.length,
            },
            items: filteredData,
          };
        },
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    scrollX: {
      enabled: true,
    },
    scrollY: {
      enabled: true,
    },
    showOverflow: true,
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions,
});

/**
 * 刷新表格
 */
function refreshGrid() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height class="electricity-bill-page">
    <BillForm
      ref="billFormRef"
      :config="electricityFormConfig"
      @success="refreshGrid"
    />
    <BillDetail ref="billDetailRef" :config="electricityDetailConfig" />
    <Grid table-title="电费账单" class="electricity-bill-grid">
      <template #toolbar-actions>
        <!-- 区域选择下拉菜单 -->
        <Dropdown class="ml-3">
          <template #overlay>
            <Menu>
              <Menu.Item
                v-for="area in areaList"
                :key="area.key"
                @click="() => switchArea(area)"
              >
                {{ area.name }}
              </Menu.Item>
            </Menu>
          </template>
          <Button :type="currentArea.key !== 'all' ? 'primary' : 'default'">
            {{ currentArea.name }}
            <ChevronDown class="ml-1 size-4" />
          </Button>
        </Dropdown>
      </template>
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', ['电费账单']) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>

<style lang="less" scoped></style>
