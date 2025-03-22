<script lang="ts" setup>
import type { ElectricityItem } from './data';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Detail from './modules/detail.vue';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [DetailModal, detailModalApi] = useVbenModal({
  cancelText: '关闭',
  connectedComponent: Detail,
  destroyOnClose: true,
  onCancel: () => {
    detailModalApi.close();
  },
});

/**
 * 编辑电费账单
 * @param row
 */
function onEdit(row: ElectricityItem) {
  formModalApi.setData(row).open();
}

/**
 * 创建新电费账单
 */
function onCreate() {
  formModalApi.setData(null).open();
}

/**
 * 删除电费账单
 * @param row
 */
function onDelete(row: ElectricityItem) {
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
function onView(row: ElectricityItem) {
  detailModalApi.setData(row).open();
}

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({ code, row }: OnActionClickParams<ElectricityItem>) {
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
const electricityItems = [
  {
    actualUsage: 500,
    amount: 490,
    companyName: '示例公司一',
    currentMonthReading: 5500,
    id: 1,
    lastMonthReading: 5000,
    monthlyUsage: 500,
    multiplier: 1,
    name: '5月电费',
    paymentTime: '2023-05-01',
    projectName: '项目A',
    remark: '正常缴费',
    unitPrice: 0.98,
  },
  {
    actualUsage: 1000,
    amount: 950,
    companyName: '示例公司二',
    currentMonthReading: 2800,
    id: 2,
    lastMonthReading: 2300,
    monthlyUsage: 500,
    multiplier: 2,
    name: '5月电费',
    paymentTime: '2023-05-02',
    projectName: '项目B',
    remark: '双倍计费',
    unitPrice: 0.95,
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async () => {
          // 模拟API请求返回数据
          return {
            page: {
              pageSize: 20,
              total: electricityItems.length,
            },
            items: electricityItems,
          };
        },
      },
    },
    rowConfig: {
      keyField: 'id',
    },
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
  <Page auto-content-height>
    <FormModal @success="refreshGrid" />
    <DetailModal />
    <Grid table-title="电费账单">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', ['电费账单']) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
