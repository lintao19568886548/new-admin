<script lang="ts" setup>
import type { AmountBill } from './modules/data';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { Area } from '#/components/AreaSelector.vue';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getAmountBillList } from '#/api/bill';
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
function onEdit(row: AmountBill) {
  billFormRef.value?.open(row);
}

/**
 * 创建新账单
 */
function onCreate() {
  const newBill: AmountBill = {
    eleBills: [],
    eleFee: 0,
    factoryRent: 0,
    invoiceTax: 0,
    managementFee: 0,
    receiptTime: dayjs().format('YYYY-MM-DD'),
    serviceFee: 0,
    tenantName: '',
    totalFee: 0,
    waterBills: [],
    waterFee: 0,
  };
  billFormRef.value?.open(newBill);
}

/**
 * 删除账单
 * @param row
 */
function onDelete(row: AmountBill) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.tenantName]),
    duration: 0,
    key: 'action_process_msg',
  });

  // 模拟API请求
  setTimeout(() => {
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.tenantName]),
      key: 'action_process_msg',
    });
    refreshGrid();
  }, 1000);
}

/**
 * 查看账单详情
 * @param row
 */
function onView(row: AmountBill) {
  billDetailRef.value?.open(row);
}

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({ code, row }: OnActionClickParams<AmountBill>) {
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

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
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
          const amountList = (await getAmountBillList()) || [];
          // let filteredData = [...billSummaries];

          // // 如果不是"全部区域"，则按照一些规则进行筛选
          // if (currentArea.value.key !== 'all') {
          //   filteredData = billSummaries.filter((_, index) => index % 2 === 0);
          // }

          return {
            page: {
              pageSize: 20,
              total: amountList.length,
            },
            items: amountList,
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
