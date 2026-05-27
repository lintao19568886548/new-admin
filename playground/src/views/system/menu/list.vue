<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { computed } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';
import { $t } from '@vben/locales';
import { useUserStore } from '@vben/stores';

import { MenuBadge } from '@vben-core/menu-ui';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteMenu, getMenuList, SystemMenuApi } from '#/api/system/menu';

import { useColumns } from './data';
import Form from './modules/form.vue';
import TemplateSyncDrawer from './modules/template-sync-drawer.vue';

const userStore = useUserStore();

const canManageTemplateSync = computed(() => {
  const customerId = String(userStore.userInfo?.customerId || '');
  return customerId === 'default' && userStore.userRoles.includes('Super');
});

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [TemplateSync, templateSyncApi] = useVbenDrawer({
  connectedComponent: TemplateSyncDrawer,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        query: async (_params) => {
          return await getMenuList();
        },
      },
    },
    rowConfig: {
      keyField: 'menuId',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      zoom: true,
    },
    treeConfig: {
      parentField: 'pid',
      reserve: true,
      rowField: 'menuId', // 使用menuId而不是id
      transform: false,
    },
  } as VxeTableGridOptions,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<SystemMenuApi.SystemMenu>) {
  switch (code) {
    case 'append': {
      onAppend(row);
      break;
    }
    case 'delete': {
      onDelete(row);
      break;
    }
    case 'edit': {
      onEdit(row);
      break;
    }
    default: {
      break;
    }
  }
}

function onRefresh() {
  gridApi.query();
}
function onEdit(row: SystemMenuApi.SystemMenu) {
  formDrawerApi.setData(row).open();
}
function onCreate() {
  formDrawerApi.setData({}).open();
}
function onOpenTemplateSync() {
  templateSyncApi.open();
}
function onAppend(row: SystemMenuApi.SystemMenu) {
  formDrawerApi.setData({ pid: row.menuId }).open(); // 使用menuId而不是id
}

function onDelete(row: SystemMenuApi.SystemMenu) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteMenu(row.menuId)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.name]),
        key: 'action_process_msg',
      });
      onRefresh();
    })
    .catch(() => {
      hideLoading();
    });
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <TemplateSync />
    <Grid>
      <template #toolbar-tools>
        <div class="toolbar-actions">
          <Button v-if="canManageTemplateSync" @click="onOpenTemplateSync">
            <IconifyIcon icon="lucide:send" class="size-4" />
            模板发布
          </Button>
          <Button type="primary" @click="onCreate">
            <Plus class="size-5" />
            {{ $t('ui.actionTitle.create', [$t('system.menu.name')]) }}
          </Button>
        </div>
      </template>
      <template #title="{ row }">
        <div class="flex w-full items-center gap-1">
          <div class="size-5 flex-shrink-0">
            <IconifyIcon
              v-if="row.type === 'button'"
              icon="carbon:security"
              class="size-full"
            />
            <IconifyIcon
              v-else-if="row.meta?.icon"
              :icon="row.meta?.icon || 'carbon:circle-dash'"
              class="size-full"
            />
          </div>
          <span class="flex-auto">{{ $t(row.meta?.title) }}</span>
          <div class="items-center justify-end"></div>
        </div>
        <MenuBadge
          v-if="row.meta?.badgeType"
          class="menu-badge"
          :badge="row.meta.badge"
          :badge-type="row.meta.badgeType"
          :badge-variants="row.meta.badgeVariants"
        />
      </template>
    </Grid>
  </Page>
</template>
<style lang="scss" scoped>
.menu-badge {
  top: 50%;
  right: 0;
  transform: translateY(-50%);

  & > :deep(div) {
    padding-top: 0;
    padding-bottom: 0;
  }
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}
</style>
