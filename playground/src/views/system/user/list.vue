<script lang="ts" setup>
import type { LocationQueryRaw } from 'vue-router';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemUserApi } from '#/api';

import { nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { Button, message, Tabs } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { createSourceOrganizationApi } from '#/api/organization';
import { getSystemParkList } from '#/api/system/park';
import { deleteSystemUser, getSystemUserList } from '#/api/system/user';
import OnboardingStepAlert from '#/components/onboarding/OnboardingStepAlert.vue';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';

import ParkManagePanel from '../park/modules/manage-panel.vue';
import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

interface UserFormSuccessPayload {
  action?: 'create' | 'update';
  setupFlow?: boolean;
}

const activeTab = ref('parks');
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const userStore = useUserStore();

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

function openCreateDialog(options: { setupFlow?: boolean } = {}) {
  formModalApi.setData(options.setupFlow ? { setupFlow: true } : null).open();
}

function onCreate() {
  openCreateDialog();
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

function syncTabFromQuery() {
  const tab = Array.isArray(route.query.tab)
    ? route.query.tab[0]
    : route.query.tab;
  if (tab === 'accounts' || tab === 'parks') {
    activeTab.value = tab;
  }
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

function isAutoCreateAccountQuery() {
  const autoCreate = getQueryText(route.query.autoCreate).toLowerCase();
  return autoCreate === 'account' || autoCreate === 'true';
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

async function ensureSetupOrganization() {
  const userInfo = (userStore.userInfo || {}) as Record<string, unknown>;
  if (String(userInfo.customerId || '') !== 'public') {
    return;
  }
  if (userInfo.sourceOrganization) {
    return;
  }

  try {
    const parkResult = await getSystemParkList({
      currentPage: 1,
      pageSize: 1,
    });
    const park = Array.isArray(parkResult?.items)
      ? parkResult.items[0]
      : undefined;
    await createSourceOrganizationApi({
      organizationIdentity: {
        city: extractCity(park?.address),
        companyShortName: getCompanyShortName(park?.parkName),
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
  const query: LocationQueryRaw = { ...route.query, tab: 'accounts' };
  delete query.autoCreate;
  delete query.setupFlow;
  void router.replace({
    path: route.path,
    query,
  });
}

async function handleAutoCreateQuery() {
  if (!isAutoCreateAccountQuery()) {
    return;
  }

  activeTab.value = 'accounts';
  await nextTick();
  openCreateDialog({ setupFlow: isTrueQuery(route.query.setupFlow) });
  clearAutoCreateQuery();
}

async function onFormSuccess(payload?: UserFormSuccessPayload) {
  refreshGrid();

  if (payload?.action !== 'create' || payload.setupFlow !== true) {
    return;
  }

  await ensureSetupOrganization();
  void router.push({
    path: '/system/role',
    query: {
      autoCreate: 'true',
      setupFlow: '1',
    },
  });
}

watch(() => route.query.tab, syncTabFromQuery);
watch(
  () => route.query.autoCreate,
  () => {
    void handleAutoCreateQuery();
  },
);

onMounted(() => {
  syncTabFromQuery();
  void handleAutoCreateQuery();
});
</script>

<template>
  <Page auto-content-height content-class="system-account-page-content">
    <OnboardingStepAlert step-key="accounts" />
    <Tabs v-model:active-key="activeTab" class="system-account-tabs">
      <Tabs.TabPane key="parks" :tab="$t('system.park.title')">
        <div class="system-account-tab-pane">
          <ParkManagePanel v-if="activeTab === 'parks'" />
        </div>
      </Tabs.TabPane>

      <Tabs.TabPane key="accounts" :tab="$t('system.user.list')">
        <div class="system-account-tab-pane">
          <FormModal @success="onFormSuccess" />
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
