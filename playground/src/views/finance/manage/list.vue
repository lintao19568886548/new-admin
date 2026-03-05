<script lang="ts" setup>
import type { FinanceItem } from './types';

import type { OnActionClickParams } from '#/adapter/vxe-table';

import { computed, onActivated, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Switch } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteFinance, getFinanceList } from '#/api/finance';
import { getParkList } from '#/api/park';
import AreaSelector from '#/components/AreaSelector.vue';
import SmsVerificationModal from '#/components/SmsVerificationModal.vue';
import { usePlatform } from '#/hooks/usePlatform';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

// 使用 usePlatform Hook 获取平台信息
const { isNativePlatform } = usePlatform();

// 路由和导航
const route = useRoute();
const router = useRouter();

// 脱敏开关 - 从 localStorage 读取持久化状态
const enableMask = ref(localStorage.getItem('finance-enableMask') !== 'false');

const verificationModalRef = ref<InstanceType<typeof SmsVerificationModal>>();

// 验证状态
const isVerified = ref(false);
const VERIFIED_KEY = 'finance-verified';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

// 当前选中的区域
const currentPark = ref();
const parkSelectorRef = ref();
const parkNameMap = ref<Record<number, string>>({});

// 组件挂载后初始化查询
function ensureVerification() {
  const verified = sessionStorage.getItem(VERIFIED_KEY) === 'true';
  if (verified) {
    isVerified.value = true;
    initPage();
    return;
  }
  isVerified.value = false;
  setTimeout(() => {
    verificationModalRef.value?.open();
  }, 0);
}

onMounted(() => {
  ensureVerification();
});

onActivated(() => {
  ensureVerification();
});

// 初始化页面
function initPage() {
  getParkList()
    .then((list: any[]) => {
      if (!Array.isArray(list)) return;
      parkNameMap.value = Object.fromEntries(
        list.map((p: any) => [Number(p.parkId), String(p.parkName)]),
      );
    })
    .catch(() => {
      parkNameMap.value = {};
    })
    .finally(() => {
      gridApi.query();
    });
}

// 验证成功回调
function onVerificationSuccess() {
  isVerified.value = true;
  sessionStorage.setItem(VERIFIED_KEY, 'true');
  initPage();
}

// 取消验证，返回首页
function onCancelVerification() {
  verificationModalRef.value?.close();
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push({ name: 'Workspace' });
  message.info('已取消验证，返回首页');
}

// 监听路由变化，清除验证状态
watch(
  () => route.fullPath,
  (newPath, oldPath) => {
    if (newPath !== oldPath) {
      isVerified.value = false;
      sessionStorage.removeItem(VERIFIED_KEY);
    }
  },
);

const columns = computed(() => useColumns(onActionClick, enableMask.value));

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    fieldMappingTime: [['transactionTime', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
    submitOnChange: false, // 修改为false，不再自动提交
  },
  gridOptions: {
    border: true,
    columns: columns.value,
    height: 'auto',
    keepSource: true,
    // 添加分页配置
    pagerConfig: {
      enabled: true,
      pageSize: 20,
      pageSizes: [10, 20, 30, 50, 100],
    },
    proxyConfig: {
      ajax: {
        query: async (page: any) => {
          try {
            const formData = (await gridApi.formApi?.getValues?.()) || {};

            // 处理金额查询
            if (formData.amount) {
              const amountStr = String(formData.amount);
              if (
                amountStr.includes('>') ||
                amountStr.includes('<') ||
                amountStr.includes('-')
              ) {
                formData.amount = amountStr;
              }
            }

            const params = {
              ...formData,
              currentPage: page.page?.currentPage || 1,
              pageSize: page.page?.pageSize || 20,
              parkId: currentPark.value ? currentPark.value.parkId : -1,
            };

            const cleanParams: Record<string, any> = {};
            for (const [key, value] of Object.entries(params)) {
              if (value !== null && value !== undefined && value !== '') {
                cleanParams[key] = value;
              }
            }

            console.warn('发送查询参数:', cleanParams);
            const response = await getFinanceList(cleanParams);
            console.warn('获取到的响应数据:', response);

            const items = Array.isArray(response?.items) ? response.items : [];
            const normalizedItems = items.map((item: any) => {
              const n = String(item?.parkName || '').trim();
              if (n) return item;
              const id = item?.parkId;
              if (typeof id === 'number') {
                return { ...item, parkName: parkNameMap.value[id] };
              }
              return item;
            });

            return {
              ...response,
              items: normalizedItems,
            };
          } catch (error) {
            console.error('获取财务数据失败:', error);
            message.error('获取账单列表失败');
            return {
              currentPage: page.page?.currentPage || 1,
              pageSize: page.page?.pageSize || 20,
              total: 0,
              items: [],
            };
          }
        },
      },
    },
    rowConfig: {
      keyField: 'financeId', // 使用financeId作为主键
    },
    // 添加滚动配置
    scrollX: {
      enabled: true,
    },
    scrollY: {
      enabled: true,
    },
    showOverflow: true,
    toolbarConfig: {
      custom: true,
      // 根据平台动态配置 refresh 和 zoom 按钮
      // 如果不是原生平台 (即网页端)，则启用刷新按钮，并指定其行为代码为 'query'
      // 如果是原生平台，则禁用刷新按钮 (设置为 false)
      refresh: true, // .value ? false : { code: 'query' },
      search: !isNativePlatform.value,
      // 如果不是原生平台 (即网页端)，则启用缩放按钮
      // 如果是原生平台，则禁用缩放按钮 (设置为 false)
      zoom: !isNativePlatform.value,
    },
  },
});

// 监听脱敏开关变化并持久化
watch(enableMask, (val) => {
  localStorage.setItem('finance-enableMask', String(val));
  const newColumns = useColumns(onActionClick, val);
  if (newColumns) {
    gridApi.grid?.loadColumn(newColumns);
  }
});

function onActionClick(e: OnActionClickParams<FinanceItem>) {
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

function onEdit(row: FinanceItem) {
  formModalApi.setData({ ...row }).open();
}

async function onDelete(row: FinanceItem) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.billName || '']), // 使用 agentName 或其他合适字段
    duration: 0,
    key: 'action_process_msg',
  });

  if (row.financeId) {
    try {
      await deleteFinance(row.financeId);
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.billName]), // 使用 tenantName
        key: 'action_process_msg',
      });
      onRefresh();
    } catch (error) {
      console.error('删除财务记录失败:', error); // 修正错误消息
      message.error({
        content: $t('ui.actionMessage.operationFailed', [error]),
        key: 'action_process_msg',
      });
    }
  }
}

function onRefresh() {
  gridApi.query();
}

function onCreate() {
  formModalApi.setData({}).open();
}

function onParkChange(area: any) {
  currentPark.value = area;
  gridApi.query();
}
</script>
<template>
  <Page auto-content-height>
    <FormModal @success="onRefresh" />
    <SmsVerificationModal
      ref="verificationModalRef"
      @success="onVerificationSuccess"
      @cancel="onCancelVerification"
    />
    <Grid v-if="isVerified" :table-title="$t('page.finance.list-title')">
      <template #toolbar-actions>
        <!-- 区域选择下拉菜单 -->
        <AreaSelector
          :default-area="currentPark"
          :refresh-callback="onRefresh"
          @change="onParkChange"
          ref="parkSelectorRef"
        />
        <!-- 脱敏开关 -->
        <div class="ml-4 flex items-center">
          <span class="mr-2 text-sm">金额脱敏</span>
          <Switch
            v-model:checked="enableMask"
            checked-children="开"
            un-checked-children="关"
          />
        </div>
      </template>
      <template #toolbar-tools>
        <!-- 网页端按钮样式 -->
        <Button v-if="!isNativePlatform" type="primary" @click="onCreate">
          <Plus class="mr-1 size-5" />
          <!-- 稍微调整图标和文字间距 -->
          {{ $t('ui.actionTitle.create', [$t('page.finance.name')]) }}
        </Button>
        <!-- 原生移动端按钮样式 (圆形) -->
        <Button v-else type="primary" shape="circle" @click="onCreate">
          <Plus class="size-5" />
        </Button>
      </template>
    </Grid>
  </Page>
</template>
