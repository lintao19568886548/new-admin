<script lang="ts" setup>
import { ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createFinance,
  deleteFinance,
  getFinanceList,
  updateFinance,
} from '#/api/finance';
import AreaSelector from '#/components/AreaSelector.vue';
import CrudForm from '#/components/CrudForm.vue';
import { useCrud } from '#/hooks/useCrud';
import { $t } from '#/locales';

import { useColumns, useFormSchema, useGridFormSchema } from './data';

// 当前选中的区域
const currentPark = ref();
const parkSelectorRef = ref();

// 使用通用CRUD钩子
const { FormModal, handleFormSubmit, onActionClick, onCreate } = useCrud({
  createApi: createFinance,
  deleteApi: ((id: number | string) => deleteFinance(Number(id))) as (
    id: number | string,
  ) => Promise<any>,
  entityName: $t('page.finance.name'),
  formComponent: CrudForm,
  idField: 'financeId',
  nameField: 'billName',
  refreshCallback: () => onRefresh(),
  updateApi: ((id: number | string, data: any) =>
    updateFinance(Number(id), data)) as (
    id: number | string,
    data: any,
  ) => Promise<any>,
});

// 表格API引用
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    fieldMappingTime: [['transactionTime', ['startTime', 'endTime']]],
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
      pageSizes: [10, 20, 30, 50, 100],
    },
    proxyConfig: {
      ajax: {
        query: async ({
          page,
        }: {
          page: { currentPage: number; pageSize: number };
        }) => {
          try {
            const formValues = (await gridApi.formApi?.getValues?.()) || {};
            const params: Record<string, any> = {};

            Object.keys(formValues).forEach((key) => {
              if (
                formValues[key] !== undefined &&
                formValues[key] !== null &&
                formValues[key] !== ''
              ) {
                params[key] = formValues[key];
              }
            });

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
            if (currentPark.value && currentPark.value.parkId !== -1) {
              params.parkId = currentPark.value.parkId;
            }

            params.currentPage = page?.currentPage || 1;
            params.pageSize = page?.pageSize || 20;

            console.warn('处理后的查询参数:', params);

            const result = await getFinanceList(params);

            return {
              currentPage: result.currentPage || 1,
              pageSize: result.pageSize || 20,
              total: result.total || 0,
              items: result.items || [],
            };
          } catch (error) {
            console.error('获取财务数据失败:', error);
            message.error('获取账单列表失败');
            return {
              currentPage: 1,
              pageSize: 20,
              total: 0,
              items: [],
            };
          }
        },
      },
    },
    rowConfig: {
      keyField: 'financeId',
    },
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
  },
});

// 刷新表格数据
function onRefresh() {
  gridApi.query();
}

// 搜索处理函数
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
    searchParams = params.data;
  } else if (!params || typeof params !== 'object') {
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
    <FormModal
      :schema="useFormSchema()"
      :entity-name="$t('page.finance.name')"
      id-field="financeId"
      :date-fields="['transactionTime']"
      :handle-submit="handleFormSubmit"
      @success="onRefresh"
    />
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
          @change="(area) => (currentPark = area)"
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
