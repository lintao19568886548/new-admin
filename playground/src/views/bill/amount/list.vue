<script lang="ts" setup>
import type { AmountBill } from './data';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteAmountBill, getAmountBillList } from '#/api/bill';
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import {
  electricityFormConfig,
  summaryDetailConfig,
  summaryFormConfig,
  useColumns,
  useGridFormSchema,
  waterFormConfig,
} from './data';
import MultipageBillDetail from './modules/MultipageBillDetail.vue';
import MultipageBillForm from './modules/MultipageBillForm.vue';

const currentPark = ref();
const parkSelectorRef = ref();

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
    receiptTime: dayjs(),
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
async function onDelete(row: AmountBill) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.tenantName]),
    duration: 0,
    key: 'action_process_msg',
  });

  const { billId } = row;
  if (billId) {
    try {
      // 使用 try-catch 替代 then-catch 链
      await deleteAmountBill(billId);
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.tenantName]),
        key: 'action_process_msg',
      });
      refreshGrid();
    } catch (error) {
      console.error('删除账单失败:', error);
      message.error({
        content: $t('ui.actionMessage.operationFailed', [error]),
        key: 'action_process_msg',
      });
    }
  }
}

/**
 * 查看账单详情
 * @param row
 */
function onView(row: AmountBill) {
  billDetailRef.value?.open(row);
}

/**
 * 打印账单详情
 * @param row
 */
function onPrint(row: AmountBill) {
  // 创建一个新窗口用于打印
  window.open(`/bill/print/${row.billId}`);
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
    case 'print': {
      onPrint(row);
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
    fieldMappingTime: [['receiptTime', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
    showCollapseButton: true,
    wrapperClass: 'grid-cols-1 lg:grid-cols-3 gap-4',
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: '100%',
    keepSource: true,
    // 添加分页配置
    pagerConfig: {
      enabled: true,
      pageSize: 20,
      pageSizes: [10, 20, 30, 50, 100],
    },
    proxyConfig: {
      ajax: {
        query: async (page) => {
          // 获取表单数据
          const formData = (await gridApi.formApi?.getValues?.()) || {};

          // 构建查询参数，包含分页信息
          const params = {
            ...formData,
            currentPage: page.page?.currentPage || 1,
            currentPark: currentPark.value ? currentPark.value.parkId : -1,
            pageSize: page.page?.pageSize || 20,
          };
          try {
            // 调用API获取数据
            const result = await getAmountBillList(params);
            // 返回格式化后的数据
            return {
              ...result,
            };
          } catch (error) {
            console.error('获取账单列表失败:', error);
            message.error('获取账单列表失败');
            return {
              page: {
                currentPage: 1,
                pageSize: 20,
                total: 0,
              },
              items: [],
            };
          }
        },
      },
    },
    rowConfig: {
      keyField: 'billId', // 确保使用正确的主键字段
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
          :default-area="currentPark"
          :refresh-callback="refreshGrid"
          @change="(park) => (currentPark = park)"
          ref="parkSelectorRef"
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
