<script lang="ts" setup>
import type { DoorItem } from './types';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteDoor, getDoorList, updateDoorStatus } from '#/api/access/door';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

function processFormParams(formValues: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(formValues).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
}

function confirmSwitch(deviceName: string, status: number) {
  return new Promise<boolean>((resolve, reject) => {
    Modal.confirm({
      content: `确认将 ${deviceName} ${status === 1 ? '开启' : '关闭'}吗？`,
      onCancel() {
        reject(new Error('已取消'));
      },
      onOk() {
        resolve(true);
      },
      title: '切换门禁状态',
    });
  });
}

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

function onCreate() {
  formModalApi.open();
}

async function onStatusChange(newStatus: number, row: DoorItem) {
  try {
    await confirmSwitch(row.deviceName, newStatus);
    await updateDoorStatus(row.deviceId, { status: newStatus as 0 | 1 });
    message.success(`已${newStatus === 1 ? '开启' : '关闭'} ${row.deviceName}`);
    return true;
  } catch {
    return false;
  }
}

function onDelete(row: DoorItem) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.deviceName]),
    duration: 0,
    key: 'action_process_msg',
  });

  deleteDoor(row.deviceId)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.deviceName]),
        key: 'action_process_msg',
      });
      refreshGrid();
    })
    .catch((error) => {
      console.error('删除门禁设备失败:', error);
      message.error({
        content: $t('ui.actionMessage.deleteFailed', [row.deviceName]),
        key: 'action_process_msg',
      });
    });
}

function onActionClick({ code, row }: OnActionClickParams) {
  const record = row as DoorItem;

  switch (code) {
    case 'delete': {
      onDelete(record);
      break;
    }
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    schema: useGridFormSchema(),
    submitOnChange: false,
  },
  gridOptions: {
    border: true,
    columns: useColumns(onStatusChange, onActionClick),
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
          const formValues = (await gridApi.formApi?.getValues?.()) || {};
          const params = processFormParams(formValues);

          params.currentPark = formValues.parkId ?? -1;
          params.currentPage = page?.currentPage || 1;
          params.pageSize = page?.pageSize || 20;

          return await getDoorList(params);
        },
      },
    },
    rowConfig: {
      keyField: 'deviceId',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions,
} as Parameters<typeof useVbenVxeGrid>[0]);

function refreshGrid() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="refreshGrid" />
    <Grid table-title="门禁设备列表">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', ['门禁设备']) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
