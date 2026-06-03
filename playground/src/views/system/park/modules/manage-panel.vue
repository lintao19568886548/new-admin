<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteSystemPark, getSystemParkList } from '#/api/system/park';
import { $t } from '#/locales';

import { useColumns } from '../data';
import Form from './form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

function onEdit(row: any) {
  formModalApi.setData({ ...row }).open();
}

function onCreate() {
  formModalApi.setData(null).open();
}

async function onDelete(row: any) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.parkName]),
    duration: 0,
    key: 'action_process_msg',
  });

  const { parkId } = row;
  if (!parkId) {
    return;
  }

  try {
    await deleteSystemPark(parkId);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.parkName]),
      key: 'action_process_msg',
    });
    refreshGrid();
  } catch (error) {
    console.error('删除园区失败:', error);
    message.error({
      content: $t('ui.actionMessage.operationFailed', [error]),
      key: 'action_process_msg',
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
  gridOptions: {
    columns: useColumns(onActionClick),
    height: '100%',
    keepSource: true,
    pagerConfig: {
      enabled: true,
      pageSize: 20,
      pageSizes: [10, 20, 50, 100],
    },
    proxyConfig: {
      ajax: {
        query: async (page) => {
          const params = {
            currentPage: page.page?.currentPage || 1,
            pageSize: page.page?.pageSize || 20,
          };
          try {
            const result = await getSystemParkList(params);
            return {
              ...result,
            };
          } catch (error) {
            console.error('获取园区列表失败:', error);
            message.error('获取园区列表失败');
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
      keyField: 'parkId',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      search: false,
      zoom: true,
    },
  } as VxeTableGridOptions,
});

function refreshGrid() {
  gridApi.query();
}
</script>

<template>
  <div class="system-park-manage-panel">
    <FormModal @success="refreshGrid" />
    <Grid :table-title="$t('page.park.list')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('page.park.item')]) }}
        </Button>
      </template>
    </Grid>
  </div>
</template>

<style lang="less" scoped>
.system-park-manage-panel {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
</style>
