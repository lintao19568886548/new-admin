<script lang="ts" setup>
import type { BillSummary } from './modules/data';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { Area } from '#/components/AreaSelector.vue';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';
import dayjs, { Dayjs } from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import {
  electricityFormConfig,
  summaryDetailConfig,
  summaryFormConfig,
  useColumns,
  useGridFormSchema,
  waterFormConfig,
} from './modules/data';
import MultipageBillDetail from './MultipageBillDetail.vue';
import MultipageBillForm from './MultipageBillForm.vue';

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

const areaSelectorRef = ref();

function handleAreaChange(area: Area) {
  // 更新当前选中的区域
  currentArea.value = area;

  // 延迟关闭提示
  setTimeout(() => {
    message.success({
      content: `已切换到${area.name}`,
      duration: 2,
      key: 'area_change_msg',
    });
    // 刷新表格数据
    refreshGrid();
  }, 500);
}

// 账单表单组件引用
const billFormRef = ref();

// 账单详情组件引用
const billDetailRef = ref();

// 配置对象，用于传递给组件
const detailConfig = {
  ...summaryDetailConfig,
};

const formConfig = {
  ...summaryFormConfig,
  electricityConfig: electricityFormConfig,
  waterConfig: waterFormConfig,
};

/**
 * 编辑账单
 * @param row
 */
function onEdit(row: BillSummary) {
  billFormRef.value?.open(row);
}

/**
 * 创建新账单
 */
function onCreate() {
  const newBill: BillSummary = {
    billMonth: dayjs().format('YYYY-MM'),
    companyName: '',
    electricityItems: [],
    electricityTotal: 0,
    factoryRent: 0,
    id: 0,
    invoiceTax: 0,
    managementFee: 0,
    otherItems: [],
    paymentTime: ref<Dayjs>(dayjs()),
    projectName: '',
    serviceFee: 0,
    totalAmount: 0,
    waterItems: [],
    waterTotal: 0,
  };
  billFormRef.value?.open(newBill);
}

/**
 * 删除账单
 * @param row
 */
function onDelete(row: BillSummary) {
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
 * 查看账单详情
 * @param row
 */
function onView(row: BillSummary) {
  billDetailRef.value?.open(row);
}

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({ code, row }: OnActionClickParams<BillSummary>) {
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
const billSummaries: BillSummary[] = [
  {
    billMonth: '2023-05',
    companyName: '示例公司一',
    electricityBillId: 1,
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
      {
        actualUsage: 800,
        amount: 775,
        currentMonthReading: 0,
        id: 3,
        key: '3',
        lastMonthReading: 0,
        monthlyUsage: 0,
        multiplier: 0,
        name: '合计',
        remark: '',
        unitPrice: 0,
      },
    ],
    electricityTotal: 980,
    factoryRent: 12_000,
    id: 1,
    invoiceTax: 680,
    managementFee: 2000,
    paymentTime: ref<Dayjs>(dayjs('2023-05-15')),
    projectName: '项目A',
    serviceFee: 1500,
    totalAmount: 17_445,
    waterBillId: 1,
    waterItems: [
      {
        actualUsage: 150,
        amount: 285,
        currentMonthReading: 850,
        id: 1,
        key: '1',
        lastMonthReading: 700,
        monthlyUsage: 150,
        multiplier: 1,
        name: '主楼水费',
        remark: '正常缴费',
        unitPrice: 1.9,
      },
    ],
    waterTotal: 285,
  },
  {
    billMonth: '2023-06',
    companyName: '示例公司二',
    electricityBillId: 2,
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
    electricityTotal: 1250,
    factoryRent: 15_000,
    id: 2,
    invoiceTax: 750,
    managementFee: 2200,
    paymentTime: ref<Dayjs>(dayjs('2023-06-15')),
    projectName: '项目B',
    serviceFee: 1800,
    totalAmount: 21_540,
    waterBillId: 2,
    waterItems: [
      {
        actualUsage: 300,
        amount: 540,
        currentMonthReading: 1200,
        id: 2,
        key: '1',
        lastMonthReading: 900,
        monthlyUsage: 300,
        multiplier: 1,
        name: '主楼水费',
        remark: '水价上调',
        unitPrice: 1.8,
      },
    ],
    waterTotal: 540,
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
          let filteredData = [...billSummaries];

          // 如果不是"全部区域"，则按照一些规则进行筛选
          if (currentArea.value.key !== 'all') {
            filteredData = billSummaries.filter((_, index) => index % 2 === 0);
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

/**
 * 表单提交成功回调
 */
function handleFormSuccess(_data: any) {
  message.success('保存成功');
  refreshGrid();
}
</script>

<template>
  <Page auto-content-height class="amount-bill-page">
    <MultipageBillForm
      ref="billFormRef"
      :config="formConfig"
      @success="handleFormSuccess"
    />
    <MultipageBillDetail ref="billDetailRef" :config="detailConfig" />
    <Grid table-title="总账单" class="amount-bill-grid">
      <template #toolbar-actions>
        <!-- 区域选择下拉菜单 -->
        <AreaSelector
          :area-list="areaList"
          :default-area="currentArea"
          @change="handleAreaChange"
          ref="areaSelectorRef"
        />
      </template>
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', ['总账单']) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>

<style lang="less" scoped></style>
