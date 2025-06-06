<script lang="ts" setup>
import type { FinanceItem } from './types';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteFinance, getFinanceList } from '#/api/finance';
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

// 当前选中的区域
const currentPark = ref();
const parkSelectorRef = ref();

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    fieldMappingTime: [['transactionTime', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
    submitOnChange: false, // 修改为false，不再自动提交
  },
  gridOptions: {
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
        query: async ({ page }) => {
          try {
            const params = (await gridApi.formApi?.getValues?.()) || {};

            // 处理日期范围
            if (params.startTime && params.endTime) {
              params.startTime = `${params.startTime} 00:00:00`;
              params.endTime = `${params.endTime} 23:59:59`;
            }

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
            params.currentPark = currentPark.value
              ? currentPark.value.parkId
              : -1;

            const cleanParams: Record<string, any> = {};
            for (const key in params) {
              if (
                Object.prototype.hasOwnProperty.call(params, key) &&
                params[key] !== null &&
                params[key] !== undefined &&
                params[key] !== ''
              ) {
                cleanParams[key] = params[key];
              }
            }

            cleanParams.currentPage = page.currentPage;
            cleanParams.pageSize = page.pageSize;

            const response = await getFinanceList(cleanParams);

            return {
              page: {
                total: response.total || 0,
              },
              result: response.items || [],
            };
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
      export: false,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
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
  const editData = { ...row };

  if (editData.transactionTime) {
    editData.transactionTime = formatDateTime(editData.transactionTime);
  }

  formModalApi.setData(editData).open();
}

function onDelete(row: FinanceItem) {
  Modal.confirm({
    cancelText: $t('common.cancel'),
    content: $t('ui.actionMessage.deleteConfirm', [row.billName]),
    okText: $t('common.confirm'),
    okType: 'danger',
    async onOk() {
      try {
        message.loading({
          content: $t('ui.actionMessage.deleting', [row.billName]),
          duration: 0,
          key: 'action_process_msg',
        });

        await deleteFinance(row.financeId);

        message.success({
          content: $t('ui.actionMessage.deleteSuccess', [row.billName]),
          key: 'action_process_msg',
        });
        onRefresh();
      } catch (error) {
        console.error('删除失败:', error);
        message.error({
          content: $t('ui.actionMessage.deleteFailed', [row.billName]),
          key: 'action_process_msg',
        });
      }
    },
    title: $t('common.confirmDelete'),
  });
}

function onRefresh() {
  gridApi.commitProxy('query');
}

function onCreate() {
  formModalApi.setData({}).open();
}

function onParkChange(area: any) {
  currentPark.value = area;
  onRefresh();
}

// 修改搜索函数，添加参数类型定义
// 修改搜索函数，正确处理搜索事件参数
function onSearch(params: any) {
  console.warn('触发搜索，原始参数:', params);

  // 检查参数格式
  let searchParams = params;

  // 如果params是事件对象，尝试从中提取表单数据
  if (params && params.form) {
    searchParams = params.form;
  } else if (params && params.$event && params.$event.form) {
    searchParams = params.$event.form;
  } else if (params && params.data) {
    // vxe-table可能将表单数据放在data属性中
    searchParams = params.data;
  } else if (!params || typeof params !== 'object') {
    // 如果没有有效参数，则使用空对象
    searchParams = {};
  }

  console.warn('处理后的搜索参数对象:', searchParams);

  // 清理空值参数
  const cleanParams: Record<string, any> = {};
  if (searchParams && typeof searchParams === 'object') {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== null && value !== undefined && value !== '') {
        cleanParams[key] = value;
      }
    }
  }

  console.warn('清理后的搜索参数:', cleanParams);

  // 使用表单数据进行查询
  gridApi.query({
    form: cleanParams,
  });
}
</script>
<template>
  <Page auto-content-height>
    <FormModal @success="onRefresh" />
    <Grid
      :table-title="$t('page.finance.list-title')"
      @search="onSearch"
      @form-submit="onSearch"
    >
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
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('page.finance.name')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
