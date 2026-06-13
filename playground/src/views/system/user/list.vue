<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemUserApi } from '#/api';

import { ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Tabs } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteSystemUser, getSystemUserList } from '#/api/system/user';
import { $t } from '#/locales';

import ParkManagePanel from '../park/modules/manage-panel.vue';
import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const activeTab = ref('parks');

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
    height: '100%',
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
  <Page auto-content-height content-class="system-account-page-content">
    <Tabs v-model:active-key="activeTab" class="system-account-tabs">
      <Tabs.TabPane key="parks" :tab="$t('system.park.title')">
        <div class="system-account-tab-pane">
          <ParkManagePanel v-if="activeTab === 'parks'" />
        </div>
      </Tabs.TabPane>

      <Tabs.TabPane key="accounts" :tab="$t('system.user.list')">
        <div class="system-account-tab-pane">
          <FormModal @success="refreshGrid" />
          <Grid :table-title="$t('system.user.list')">
            <template #toolbar-tools>
              <Button type="primary" @click="onCreate">
                <Plus class="size-5" />
                {{ $t('ui.actionTitle.create', [$t('system.user.name')]) }}
              </Button>
            </template>
          </Grid>
        </div>
      </Tabs.TabPane>
    </Tabs>
  </Page>
</template>

<style lang="less" scoped>
:deep(.system-account-page-content) {
  min-height: 0;
  overflow: hidden !important;
}

.system-account-tabs {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

:deep(.system-account-tabs > .ant-tabs-nav) {
  flex: none;
  margin-bottom: 12px;
}

:deep(.system-account-tabs .ant-tabs-content-holder) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

:deep(.system-account-tabs .ant-tabs-content) {
  height: 100%;
  min-height: 0;
}

:deep(.system-account-tabs .ant-tabs-tabpane) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.system-account-tab-pane {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
</style>
