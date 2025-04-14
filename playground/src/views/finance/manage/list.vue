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
const currentArea = ref({
  key: 'all',
  value: '全部区域',
});
const areaSelectorRef = ref();

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
        query: async (page) => {
          try {
            // 直接从formApi获取表单数据
            const params = (await gridApi.formApi?.getValues?.()) || {};

            // 处理日期范围
            if (params.startTime && params.endTime) {
              params.startTime = `${params.startTime} 00:00:00`;
              params.endTime = `${params.endTime} 23:59:59`;
            }

            // 处理金额查询
            if (params.amount !== undefined && params.amount !== null) {
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
            if (currentArea.value && currentArea.value.key !== 'all') {
              params.area = currentArea.value;
            }
            // 添加分页参数
            const currentPage = page.page?.currentPage || 1;
            const pageSize = page.page?.pageSize || 20;

            params.currentPage = currentPage;
            params.pageSize = pageSize;
            params.area = currentArea.value.key;

            console.warn('处理后的查询参数:', params);

            // 调用API获取数据
            const result = await getFinanceList(params);

            // 返回格式化后的数据，包含分页信息
            return {
              ...result,
            };
          } catch (error) {
            console.error('获取财务数据失败:', error);
            message.error('获取账单列表失败');
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
  // 复制行数据以避免修改原始数据
  const editData = { ...row };

  if (editData.transactionTime) {
    editData.transactionTime = formatDateTime(
      editData.transactionTime,
    ) as string;
  }

  formModalApi.setData(editData).open();
}

function onDelete(row: FinanceItem) {
  Modal.confirm({
    cancelText: $t('common.no'),
    content: $t('ui.actionMessage.deleteConfirm', [row.billName]),
    okText: $t('common.yes'),
    okType: 'danger',
    async onOk() {
      try {
        const hideLoading = message.loading({
          content: $t('ui.actionMessage.deleting', [row.billName]),
          duration: 0,
          key: 'action_process_msg',
        });

        await deleteFinance(row.financeId);

        // 手动关闭加载提示
        hideLoading();

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
    title: $t('ui.actionTitle.delete', [row.billName]),
  });
}

function onRefresh() {
  // 直接从formApi获取最新表单数据并传递给query方法
  gridApi.formApi
    .getValues()
    .then((formValues) => {
      gridApi.query({
        form: formValues || {},
      });
      console.warn('刷新表格数据');
    })
    .catch((error) => {
      console.error('获取表单数据失败:', error);
      // 出错时使用空对象查询
      gridApi.query({
        form: {},
      });
    });
}

function onCreate() {
  formModalApi.setData({}).open();
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
          :default-area="currentArea"
          :refresh-callback="onRefresh"
          @change="(area) => (currentArea = area)"
          ref="areaSelectorRef"
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
