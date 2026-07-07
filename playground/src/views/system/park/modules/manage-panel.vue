<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { createSourceOrganizationApi } from '#/api/organization';
import { deleteSystemPark, getSystemParkList } from '#/api/system/park';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';

import { useColumns } from '../data';
import FactoryManageModal from './factory-manage-modal.vue';
import Form from './form.vue';

interface ParkFormSuccessPayload {
  action?: 'create' | 'update';
  record?: {
    address?: string;
    parkId?: number | string;
    parkName?: string;
  };
  setupFlow?: boolean;
}

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const userStore = useUserStore();

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [FactoryModal, factoryModalApi] = useVbenModal({
  connectedComponent: FactoryManageModal,
  destroyOnClose: true,
});

function onEdit(row: any) {
  formModalApi.setData({ ...row }).open();
}

function onCreate() {
  formModalApi.setData({ setupFlow: true }).open();
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

function onFactory(row: any) {
  factoryModalApi
    .setData({ parkId: row.parkId, parkName: row.parkName })
    .open();
}

function getQueryText(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }
  return String(value || '').trim();
}

function isTrueQuery(value: unknown) {
  return ['1', 'true'].includes(getQueryText(value).toLowerCase());
}

function isSetupFlowQuery() {
  return (
    isTrueQuery(route.query.setupFlow) || isTrueQuery(route.query.onboarding)
  );
}

function isAutoCreateFactoryQuery() {
  const autoCreate = getQueryText(route.query.autoCreate).toLowerCase();
  return autoCreate === 'factory' || autoCreate === 'true';
}

function extractCity(address: unknown) {
  const text = String(address || '').trim();
  const cityMatch = text.match(/([\u4E00-\u9FA5]{2,20})市/u);
  if (cityMatch?.[1]) {
    return cityMatch[1];
  }

  const provinceMatch = text.match(/([\u4E00-\u9FA5]{2,20})省/u);
  return provinceMatch?.[1] || '本地';
}

function getCompanyShortName(parkName: unknown) {
  const name = String(parkName || '').trim();
  return name.slice(0, 50) || '园区';
}

async function ensureSetupOrganization(
  record?: ParkFormSuccessPayload['record'],
) {
  const userInfo = (userStore.userInfo || {}) as Record<string, unknown>;
  if (String(userInfo.customerId || '') !== 'public') {
    return;
  }

  try {
    await createSourceOrganizationApi({
      organizationIdentity: {
        city: extractCity(record?.address),
        companyShortName: getCompanyShortName(record?.parkName),
      },
    });
    await authStore.fetchUserInfo().catch((error) => {
      console.warn('创建组织后刷新用户信息失败:', error);
    });
  } catch (error) {
    console.warn('初始化流程自动创建组织锚点失败:', error);
  }
}

function clearAutoCreateQuery() {
  const query = { ...route.query };
  delete query.autoCreate;
  delete query.onboarding;
  delete query.parkId;
  delete query.parkName;
  delete query.setupFlow;
  void router.replace({
    path: route.path,
    query,
  });
}

function openFactoryCreateDialog(
  parkId: number,
  parkName = '',
  setupFlow = false,
) {
  factoryModalApi
    .setData({
      autoCreate: true,
      parkId,
      parkName,
      setupFlow,
    })
    .open();
}

function handleAutoCreateQuery() {
  if (!isAutoCreateFactoryQuery()) {
    return;
  }

  const parkId = Number(getQueryText(route.query.parkId));
  if (!Number.isInteger(parkId) || parkId <= 0) {
    clearAutoCreateQuery();
    return;
  }

  openFactoryCreateDialog(
    parkId,
    getQueryText(route.query.parkName),
    isTrueQuery(route.query.setupFlow),
  );
  clearAutoCreateQuery();
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
    case 'factory': {
      onFactory(row);
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

async function onFormSuccess(payload?: ParkFormSuccessPayload) {
  refreshGrid();

  if (
    payload?.action !== 'create' ||
    (!payload.setupFlow && !isSetupFlowQuery())
  ) {
    return;
  }

  const parkId = Number(payload.record?.parkId);
  if (!Number.isInteger(parkId) || parkId <= 0) {
    return;
  }

  const query: Record<string, string> = {
    autoCreate: 'factory',
    parkId: String(parkId),
    setupFlow: '1',
  };
  const parkName = String(payload.record?.parkName || '').trim();
  if (parkName) {
    query.parkName = parkName;
  }

  await ensureSetupOrganization(payload.record);
  void router.push({
    path: '/system/park',
    query,
  });
}

watch(
  () => [route.query.autoCreate, route.query.parkId],
  () => {
    handleAutoCreateQuery();
  },
);

onMounted(() => {
  handleAutoCreateQuery();
});
</script>

<template>
  <div class="system-park-manage-panel">
    <FormModal @success="onFormSuccess" />
    <FactoryModal />
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
