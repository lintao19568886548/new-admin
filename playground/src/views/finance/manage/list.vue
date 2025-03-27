<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemFinanceApi } from '#/api';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

// 模拟的财务数据
const financeItems = [
  {
    amount: 5000,
    billCategory: '房租',
    billName: '5月房租',
    id: '1',
    transactionTime: '2023-05-01 10:00:00',
    transactionType: '支出',
  },
  {
    amount: 320.5,
    billCategory: '水费',
    billName: '4月水费',
    id: '2',
    transactionTime: '2023-04-25 14:30:00',
    transactionType: '支出',
  },
  {
    amount: 750.8,
    billCategory: '电费',
    billName: '4月电费',
    id: '3',
    transactionTime: '2023-04-26 09:15:00',
    transactionType: '支出',
  },
  {
    amount: 12_000,
    billCategory: '房租',
    billName: '厂房租赁收入',
    id: '4',
    transactionTime: '2023-05-05 11:20:00',
    transactionType: '收入',
  },
  {
    amount: 1500,
    billCategory: '其他费用',
    billName: '设备维修费',
    id: '5',
    transactionTime: '2023-05-10 16:45:00',
    transactionType: '支出',
  },
  {
    amount: 420.3,
    billCategory: '燃气费',
    billName: '燃气费',
    id: '6',
    transactionTime: '2023-05-12 10:30:00',
    transactionType: '支出',
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    fieldMappingTime: [['transactionTime', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          console.warn('查询财务数据', page); // 将 console.log 改为 console.warn
          // 返回模拟数据和分页信息
          return {
            total: financeItems.length,
            items: financeItems,
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
  } as VxeTableGridOptions<SystemFinanceApi.SystemFinance>,
});

function onActionClick(e: OnActionClickParams<SystemFinanceApi.SystemFinance>) {
  switch (e.code) {
    case 'delete': {
      onDelete(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
  }
}

function onEdit(row: SystemFinanceApi.SystemFinance) {
  formDrawerApi.setData(row).open();
}

function onDelete(row: SystemFinanceApi.SystemFinance) {
  // const hideLoading = message.loading({
  //   content: $t('ui.actionMessage.deleting', [row.billName]),
  //   duration: 0,
  //   key: 'action_process_msg',
  // });
  // 模拟删除操作
  setTimeout(() => {
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.billName]),
      key: 'action_process_msg',
    });
    onRefresh();
  }, 1000);
}

function onRefresh() {
  gridApi.query();
}

function onCreate() {
  formDrawerApi.setData({}).open();
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer />
    <Grid :table-title="$t('page.finance.list-title')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('page.finance.name')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
