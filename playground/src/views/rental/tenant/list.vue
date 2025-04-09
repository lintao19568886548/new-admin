<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteTenant, getTenantList } from '#/api/rental';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

// 表格API引用
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    schema: useGridFormSchema(),
    submitOnChange: false, // 修改这里：改为false，不再自动提交
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

            // 添加分页参数
            params.currentPage = page?.currentPage || 1;
            params.pageSize = page?.pageSize || 20;

            console.warn('处理后的查询参数:', params);

            // 调用API获取数据
            const result = await getTenantList(params);

            // 返回格式化后的数据
            return {
              currentPage: result.currentPage || 1,
              pageSize: result.pageSize || 20,
              total: result.total || 0,
              items: result.items || [],
            };
          } catch (error) {
            console.error('获取租户列表失败:', error);
            message.error('获取租户列表失败');
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
      keyField: 'tenantId',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<any>,
});

/**
 * 处理表格操作按钮点击
 */
function onActionClick(e: OnActionClickParams<any>) {
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
 * 编辑租户
 */
function onEdit(row: any) {
  formModalApi.setData(row).open();
}

/**
 * 创建新租户
 */
function onCreate() {
  formModalApi.setData(null).open();
}

/**
 * 删除租户
 */
function onDelete(row: any) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.tenantName]),
    duration: 0,
    key: 'action_process_msg',
  });

  deleteTenant(row.tenantId)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.tenantName]),
        key: 'action_process_msg',
      });
      refreshGrid();
    })
    .catch((error) => {
      console.error('删除租户失败:', error);
      message.error({
        content: $t('ui.actionMessage.deleteFailed', [row.tenantName]),
        key: 'action_process_msg',
      });
    });
}

/**
 * 查看租户详情
 */
function onView(row: any) {
  formModalApi.setData({ ...row, readonly: true }).open();
}

/**
 * 刷新表格数据
 */
function refreshGrid() {
  gridApi.query();
}

/**
 * 表单操作成功回调
 */
function onFormSuccess() {
  refreshGrid();
}

// 添加搜索函数
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

  // 使用表单数据进行查询
  gridApi.query({
    form: searchParams,
  });
}
</script>

<template>
  <Page auto-content-height>
    <template #headerContent>
      <Button type="primary" @click="onCreate">
        <template #icon>
          <Plus />
        </template>
        {{ $t('ui.actionTitle.create', [$t('system.rental.tenant.item')]) }}
      </Button>
    </template>

    <Grid @search="onSearch" @form-submit="onSearch" />

    <FormModal @success="onFormSuccess" />
  </Page>
</template>
