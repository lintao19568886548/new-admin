<script lang="ts" setup>
import type { WaterItem } from './data';

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
 * 编辑水费账单
 * @param row
 */
function onEdit(row: WaterItem) {
  formModalApi.setData(row).open();
}

/**
 * 创建新水费账单
 */
function onCreate() {
  formModalApi.setData(null).open();
}

/**
 * 删除水费账单
 * @param row
 */
function onDelete(row: WaterItem) {
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
 * 查看水费账单详情
 * @param row
 */
function onView(row: WaterItem) {
  detailModalApi.setData(row).open();
}

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({ code, row }: OnActionClickParams<WaterItem>) {
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
const waterItems = [
  {
    actualUsage: 50,
    amount: 250,
    companyName: '示例公司一',
    currentMonthReading: 550,
    id: 1,
    lastMonthReading: 500,
    monthlyUsage: 50,
    multiplier: 1,
    name: '5月水费',
    paymentTime: '2023-05-01',
    projectName: '项目A',
    remark: '正常缴费',
    unitPrice: 5,
  },
  {
    actualUsage: 100,
    amount: 480,
    companyName: '示例公司二',
    currentMonthReading: 280,
    id: 2,
    lastMonthReading: 230,
    monthlyUsage: 50,
    multiplier: 2,
    name: '5月水费',
    paymentTime: '2023-05-02',
    projectName: '项目B',
    remark: '双倍计费',
    unitPrice: 4.8,
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
              total: waterItems.length,
            },
            items: waterItems,
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
    <Grid table-title="水费账单">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', ['水费账单']) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
