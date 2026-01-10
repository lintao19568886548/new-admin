<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { EmployeeApi } from '#/api/hrm/employee';

import { onMounted, shallowRef } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Download, Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteEmployee, getEmployeeList } from '#/api/hrm/employee';
import { $t } from '#/locales';
import { exportArrayToExcel } from '#/utils/excel';

import { useColumns, useSearchSchema } from './data';
import Form from './modules/form.vue';

// 使用shallowRef存储表格实例和数据，提升性能
const tableLoading = shallowRef(false);
const exportLoading = shallowRef(false);

// 表单模态窗口
const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({
  code,
  row,
}: OnActionClickParams<EmployeeApi.Employee>) {
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
// 表格配置
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    fieldMappingTime: [['hireDate', ['hireDateStart', 'hireDateEnd']]],
    schema: useSearchSchema(),
    submitOnChange: false, // 修改为false，不再自动提交
  },
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
        query: async ({ page }) => {
          try {
            tableLoading.value = true;
            const formData = (await gridApi.formApi?.getValues?.()) || {};

            const cleanParams: Record<string, any> = {};
            for (const [key, value] of Object.entries(formData)) {
              if (value !== null && value !== undefined && value !== '') {
                cleanParams[key] = value;
              }
            }

            cleanParams.currentPage = page.currentPage;
            cleanParams.pageSize = page.pageSize;

            return await getEmployeeList(cleanParams);
          } catch (error) {
            console.error('获取员工列表失败', error);
            message.error('获取员工列表失败');
            return {
              page: {
                total: 0,
              },
              result: [],
            };
          } finally {
            tableLoading.value = false;
          }
        },
      },
    },

    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions,
});

function onEdit(row: EmployeeApi.Employee) {
  formModalApi.setData(row).open();
}

async function onDelete(row: EmployeeApi.Employee) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.name || '']),
    duration: 0,
    key: 'action_process_msg',
  });

  try {
    await deleteEmployee(row.employeeId);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.name]),
      key: 'action_process_msg',
    });
    onRefresh();
  } catch (error) {
    console.error('删除员工失败:', error);
    message.error({
      content: $t('ui.actionMessage.operationFailed', [error as string]),
      key: 'action_process_msg',
    });
  }
}

function onRefresh() {
  gridApi.query();
}

function onCreate() {
  formModalApi.setData({}).open();
}

async function onExport() {
  if (exportLoading.value) return;
  exportLoading.value = true;
  try {
    const formData = (await gridApi.formApi?.getValues?.()) || {};

    const cleanParams: Record<string, any> = {};
    for (const [key, value] of Object.entries(formData)) {
      if (value !== null && value !== undefined && value !== '') {
        cleanParams[key] = value;
      }
    }

    const exportRes = await getEmployeeList({
      ...cleanParams,
      currentPage: 1,
      pageSize: 10_000,
    });

    const columns = (useColumns() ?? [])
      .filter((col: any) => {
        const field = String(col?.field ?? '');
        if (!field) return false;
        if (field === 'operation') return false;
        return Boolean(col?.title);
      })
      .map((col: any) => ({
        field: String(col.field),
        formatter: col.formatter,
        title: String(col.title),
      }));

    const header = columns.map((c: any) => c.title);
    const rows = (exportRes?.items ?? []).map((row: any) => {
      return columns.map((col: any) => {
        const rawValue = row?.[col.field];
        if (typeof col.formatter === 'function') {
          return col.formatter({ cellValue: rawValue, row });
        }
        return rawValue ?? '';
      });
    });

    const fileName = `员工列表_${dayjs().format('YYYYMMDD_HHmmss')}`;
    await exportArrayToExcel([header, ...rows], fileName, '员工列表');
    message.success('导出成功');
  } catch (error) {
    console.error('导出员工列表失败', error);
    message.error('导出员工列表失败');
  } finally {
    exportLoading.value = false;
  }
}

// 组件挂载后初始化查询
onMounted(() => {
  // 初始加载数据
  gridApi.query();
});
</script>
<template>
  <Page auto-content-height>
    <FormModal @success="onRefresh" />
    <Grid table-title="员工列表" :loading="tableLoading">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          新建员工
        </Button>
        <Button class="ml-2" :loading="exportLoading" @click="onExport">
          <Download class="size-5" />
          导出
        </Button>
      </template>
    </Grid>
  </Page>
</template>
