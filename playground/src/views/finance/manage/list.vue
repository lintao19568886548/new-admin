<script lang="ts" setup>
import type { FinanceItem } from './types';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { onMounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteFinance, getFinanceList } from '#/api/finance';
import AreaSelector from '#/components/AreaSelector.vue';
import { usePlatform } from '#/hooks/usePlatform';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

// 使用 usePlatform Hook 获取平台信息
const { isNativePlatform } = usePlatform();

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

// 当前选中的区域
const currentPark = ref();
const parkSelectorRef = ref();

// 组件挂载后初始化查询
onMounted(() => {
  // 初始加载数据
  gridApi.query();
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    fieldMappingTime: [['transactionTime', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
    submitOnChange: false, // 修改为false，不再自动提交
  },
  gridOptions: {
    border: true,
    columns: useColumns(onActionClick),
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
        query: async ({ form, page }) => {
          try {
            const params = form || {};

            // 处理金额查询
            if (params.amount) {
              const amountStr = String(params.amount);
              if (
                amountStr.includes('>') ||
                amountStr.includes('<') ||
                amountStr.includes('-')
              ) {
                params.amount = amountStr;
              }
            }

            // 添加区域参数
            params.parkId = currentPark.value ? currentPark.value.parkId : -1;

            const cleanParams: Record<string, any> = {};
            for (const [key, value] of Object.entries(params)) {
              if (value !== null && value !== undefined && value !== '') {
                cleanParams[key] = value;
              }
            }

            cleanParams.currentPage = page.currentPage;
            cleanParams.pageSize = page.pageSize;

            console.warn('发送查询参数:', cleanParams);
            const response = await getFinanceList(cleanParams);
            console.warn('获取到的响应数据:', response);

            return response;
          } catch (error) {
            console.error('获取财务数据失败:', error);
            message.error('获取账单列表失败');
            return {
              page: {
                total: 0,
              },
              result: [],
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
  } as VxeTableGridOptions<FinanceItem>,
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
    <Grid :table-title="$t('page.finance.list-title')">
      <template #toolbar-actions>
        <!-- 区域选择下拉菜单 -->
        <AreaSelector
          :default-area="currentPark"
          :refresh-callback="onRefresh"
          @change="onParkChange"
          ref="parkSelectorRef"
        />
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
