<script lang="ts" setup>
import type { SalaryItem } from './types';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { SyncOutlined } from '@ant-design/icons-vue';
import { Button, message, Tooltip } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteSalary, getSalaryList, syncSalaryTenants } from '#/api/rental';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const syncingTenants = ref(false);

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

// 表格API引用
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    schema: useGridFormSchema(),
    submitOnChange: false,
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
        query: async ({ page }) => {
          try {
            // 直接从formApi获取表单数据
            const formValues = (await gridApi.formApi?.getValues?.()) || {};

            // 清理表单数据，移除空值
            const params: Record<string, any> = {}; // 添加类型声明
            Object.keys(formValues).forEach((key) => {
              if (
                formValues[key] !== undefined &&
                formValues[key] !== null &&
                formValues[key] !== ''
              ) {
                params[key] = formValues[key];
              }
            });

            params.currentPark = formValues.parkId ?? -1;

            // 添加分页参数
            params.currentPage = page?.currentPage || 1;
            params.pageSize = page?.pageSize || 20;
            // 调用API获取数据
            const result = await getSalaryList(params);

            // 返回格式化后的数据
            return {
              currentPage: result.currentPage || 1,
              pageSize: result.pageSize || 20,
              total: result.total || 0,
              items: result.items || [],
            };
          } catch (error) {
            console.error('获取工资列表失败:', error);
            message.error('获取工资列表失败');
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
      keyField: 'salaryId',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SalaryItem>,
});

/**
 * 处理表格操作按钮点击
 */
function onActionClick(e: OnActionClickParams<SalaryItem>) {
  switch (e.code) {
    case 'delete': {
      onDelete(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
    case 'view': {
      onView(e.row);
      break;
    }
  }
}

/**
 * 编辑工资记录
 */
function onEdit(row: SalaryItem) {
  formModalApi.setData(row).open();
}

/**
 * 创建工资记录
 */
function onCreate() {
  formModalApi.setData(null).open();
}

/**
 * 删除工资记录
 */
function onDelete(row: SalaryItem) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.tenantName]),
    duration: 0,
    key: 'action_process_msg',
  });

  deleteSalary(row.salaryId)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.tenantName]),
        key: 'action_process_msg',
      });
      refreshGrid();
    })
    .catch((error) => {
      console.error('删除工资记录失败:', error);
      message.error({
        content: $t('ui.actionMessage.deleteFailed', [row.tenantName]),
        key: 'action_process_msg',
      });
    });
}

/**
 * 查看工资记录详情
 */
function onView(row: SalaryItem) {
  formModalApi.setData({ ...row, readonly: true }).open();
}

/**
 * 刷新表格数据
 */
function refreshGrid() {
  gridApi.query();
}

async function onSyncTenants() {
  if (syncingTenants.value) return;
  syncingTenants.value = true;
  const messageKey = 'sync_salary_tenants';
  message.loading({
    content: $t('system.rental.salary.syncLoading'),
    duration: 0,
    key: messageKey,
  });

  try {
    const formValues = (await gridApi.formApi?.getValues?.()) || {};
    const parkId = formValues.parkId ?? -1;

    const result = await syncSalaryTenants({ currentPark: parkId });

    message.success({
      content: $t('system.rental.salary.syncSuccess', [
        String(result?.created ?? 0),
      ]),
      key: messageKey,
    });

    refreshGrid();
  } catch (error) {
    console.error('同步合同列表失败:', error);
    message.error({
      content: $t('system.rental.salary.syncFailed'),
      key: messageKey,
    });
  } finally {
    syncingTenants.value = false;
  }
}
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="refreshGrid" />
    <Grid :table-title="$t('system.rental.salary.list')">
      <template #toolbar-tools>
        <Tooltip :title="$t('system.rental.salary.syncTip')">
          <Button
            class="mr-2"
            :loading="syncingTenants"
            type="default"
            @click="onSyncTenants"
          >
            <SyncOutlined class="mr-1" />
            {{ $t('system.rental.salary.syncButton') }}
          </Button>
        </Tooltip>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.rental.salary.item')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
