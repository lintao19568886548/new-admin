<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemUserApi } from '#/api';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteSystemUser, getSystemUserList } from '#/api/system/user';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

function onCreate() {
  formModalApi.setData(null).open();
}

function onEdit(row: SystemUserApi.SystemUser) {
  formModalApi.setData(row).open();
}

async function onDelete(row: SystemUserApi.SystemUser) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.username]),
    duration: 0,
    key: 'action_process_msg',
  });

  try {
    await deleteSystemUser(Number(row.id));
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.username]),
      key: 'action_process_msg',
    });
    refreshGrid();
  } catch (error) {
    console.error('删除账号失败:', error);
    message.error({
      content: '删除账号失败',
      key: 'action_process_msg',
    });
  }
}

function onActionClick({
  code,
  row,
}: OnActionClickParams<SystemUserApi.SystemUser>) {
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
    schema: useGridFormSchema(),
    submitOnChange: false,
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: true,
      pageSize: 20,
      pageSizes: [10, 20, 50, 100],
    },
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          const formValues = (await gridApi.formApi?.getValues?.()) || {};
          const params: Record<string, any> = {
            currentPage: page?.currentPage || 1,
            pageSize: page?.pageSize || 20,
          };

          Object.entries(formValues).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              params[key] = value;
            }
          });

          const result = await getSystemUserList(params);
          return {
            ...result,
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
  } as VxeTableGridOptions<SystemUserApi.SystemUser>,
});

function refreshGrid() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="refreshGrid" />
    <Grid :table-title="$t('system.user.list')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.user.name')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
