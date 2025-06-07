<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { EmployeeApi } from '#/api/hrm/employee';

import { shallowRef } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteEmployee, getEmployeeList } from '#/api/hrm/employee';

import { useColumns, useSearchSchema } from './data';
import Form from './modules/form.vue';

// 定义查询参数接口
interface QueryParams {
  [key: string]: any;
  currentPage?: number;
  pageSize?: number;
}

// 使用shallowRef存储表格实例和数据，提升性能
const tableLoading = shallowRef(false);
const employeeData = shallowRef<any>({ total: 0, items: [] });

// 表单模态窗口
const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

/**
 * 消息提示统一处理
 */
const messageHandler = {
  error: (error: any, customMessage?: string) => {
    const errorMsg = error?.message || '未知错误';
    message.error({
      content: customMessage ? `${customMessage}: ${errorMsg}` : errorMsg,
      key: 'action_process_msg',
    });
    console.error(customMessage || '操作失败', error);
  },
  loading: (content: string) => {
    return message.loading({
      content,
      duration: 0,
      key: 'action_process_msg',
    });
  },
  success: (content: string) => {
    message.success({
      content,
      key: 'action_process_msg',
    });
  },
};

/**
 * 员工操作方法
 */
const employeeActions = {
  /**
   * 创建新员工
   */
  create: () => {
    formModalApi.setData(null).open();
  },

  /**
   * 删除员工
   */
  delete: (row: EmployeeApi.Employee) => {
    const hideLoading = messageHandler.loading(`正在删除员工 ${row.name}`);

    deleteEmployee(row.employeeId)
      .then(() => {
        messageHandler.success(`成功删除员工 ${row.name}`);
        refreshGrid();
      })
      .catch((error) => {
        messageHandler.error(error, '删除员工失败');
      })
      .finally(() => {
        hideLoading();
      });
  },

  /**
   * 编辑员工
   */
  edit: (row: EmployeeApi.Employee) => {
    formModalApi.setData(row).open();
  },
};

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({
  code,
  row,
}: OnActionClickParams<EmployeeApi.Employee>) {
  switch (code) {
    case 'delete': {
      employeeActions.delete(row);
      break;
    }
    case 'edit': {
      employeeActions.edit(row);
      break;
    }
  }
}

// 搜索表单配置
const [SearchForm] = useVbenForm({
  handleReset: () => {
    gridApi.query({});
  },
  handleSubmit: (data: QueryParams) => {
    gridApi.query(data);
  },
  layout: 'horizontal',
  resetButtonOptions: {
    content: '重置',
  },
  schema: useSearchSchema(),
  showDefaultActions: true,
  submitButtonOptions: {
    content: '查询',
  },
});

/**
 * 获取员工列表数据
 * @param params 查询参数
 */
async function fetchEmployeeList(params: QueryParams) {
  try {
    tableLoading.value = true;
    const currentPage = params.page?.currentPage || 1;
    const pageSize = params.page?.pageSize || 20;
    const queryParams = params.page?.queryParams || {};

    // 添加未删除的过滤条件（同时处理布尔值和数值类型）
    const requestParams = {
      ...queryParams,
      currentPage,
      pageSize,
    };

    const result = await getEmployeeList(requestParams);

    // 保存原始数据
    employeeData.value = result;

    // 返回过滤后的数据（作为双重保障）
    return result;
  } catch (error) {
    messageHandler.error(error, '获取员工列表失败');
    throw error;
  } finally {
    tableLoading.value = false;
  }
}

// 表格配置
const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    border: true,
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      pageSize: 20,
    },
    proxyConfig: {
      ajax: {
        error: (error: any) => {
          messageHandler.error(error, '加载员工数据失败');
        },
        query: fetchEmployeeList,
        success: (data: any) => {
          console.warn('表格数据加载成功', data?.total || 0, '条记录');
        },
      },
    },

    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      zoom: true,
    },
  } as VxeTableGridOptions,
});

/**
 * 刷新表格
 */
function refreshGrid() {
  gridApi.query();
}

// 初始化加载数据
gridApi.query();
</script>
<template>
  <Page auto-content-height>
    <FormModal @success="refreshGrid" />
    <Grid table-title="员工列表" :loading="tableLoading">
      <template #toolbar-search>
        <SearchForm />
      </template>
      <template #toolbar-tools>
        <Button type="primary" @click="employeeActions.create">
          <Plus class="size-5" />
          新建员工
        </Button>
      </template>
    </Grid>
  </Page>
</template>
