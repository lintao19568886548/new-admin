<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteRepairOrder, getRepairOrderList } from '#/api/maintenance';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

function onCreate() {
  formModalApi.setData(null).open();
}

function onEdit(row: Record<string, any>) {
  formModalApi.setData({ ...row }).open();
}

async function onDelete(row: Record<string, any>) {
  message.loading({
    content: `正在删除 ${row.orderNo}`,
    duration: 0,
    key: 'repair_order_action',
  });

  try {
    await deleteRepairOrder(row.repairOrderId);
    message.success({
      content: `已删除 ${row.orderNo}`,
      key: 'repair_order_action',
    });
    refreshGrid();
  } catch (error) {
    console.error('删除报修工单失败:', error);
    message.error({
      content: '删除报修工单失败',
      key: 'repair_order_action',
    });
  }
}

function onActionClick({ code, row }: OnActionClickParams) {
  switch (code) {
    case 'delete': {
      onDelete(row);
      break;
    }
    case 'edit': {
      onEdit(row);
      break;
    }
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    fieldMappingTime: [['createTimeRange', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
  },
  gridOptions: {
    border: true,
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: true,
      pageSize: 20,
      pageSizes: [10, 20, 30, 50, 100],
    },
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          const rawFormData = (await gridApi.formApi?.getValues?.()) || {};
          const params: Record<string, any> = { ...rawFormData };

          params.currentPark = params.parkId ?? -1;
          if (Array.isArray(params.factoryId)) {
            params.factoryId =
              params.factoryId.length > 0
                ? params.factoryId[params.factoryId.length - 1]
                : undefined;
          }
          if (params.startTime && !String(params.startTime).includes(':')) {
            params.startTime = `${params.startTime} 00:00:00`;
          }
          if (params.endTime && !String(params.endTime).includes(':')) {
            params.endTime = `${params.endTime} 23:59:59`;
          }
          params.currentPage = page?.currentPage || 1;
          params.pageSize = page?.pageSize || 20;

          return await getRepairOrderList(params);
        },
      },
    },
    rowConfig: {
      keyField: 'repairOrderId',
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

function refreshGrid() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="refreshGrid" />
    <Grid table-title="报修工单列表">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          新增工单
        </Button>
      </template>
    </Grid>
  </Page>
</template>
