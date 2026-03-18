<script lang="ts" setup>
import type { CarItem } from './types';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteCar, getCarList } from '#/api/access/car';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

/**
 * 清理和处理表单参数
 * @param formValues
 */
function processFormParams(formValues: Record<string, any>) {
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
  return params;
}

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

/**
 * 编辑车辆记录
 * @param row
 */
function onEdit(row: CarItem) {
  // 直接传递原始数据，依赖表单组件内部处理
  formModalApi.setData(row).open();
}

/**
 * 查看车辆记录详情
 * @param row
 */
function onView(row: CarItem) {
  // 创建一个新对象，只添加readonly属性
  const viewData = { ...row, readonly: true };
  formModalApi.setData(viewData).open();
}

/**
 * 创建新车辆记录
 */
function onCreate() {
  formModalApi.setData(null).open();
}

/**
 * 删除车辆记录
 * @param row
 */
function onDelete(row: CarItem) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.carNumber]),
    duration: 0,
    key: 'action_process_msg',
  });

  deleteCar(row.carId)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.carNumber]),
        key: 'action_process_msg',
      });
      refreshGrid();
    })
    .catch((error) => {
      console.error('删除车辆记录失败:', error);
      message.error({
        content: $t('ui.actionMessage.deleteFailed', [row.carNumber]),
        key: 'action_process_msg',
      });
    });
}

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({ code, row }: OnActionClickParams) {
  const record = row as CarItem;
  switch (code) {
    case 'delete': {
      onDelete(record);
      break;
    }
    case 'edit': {
      onEdit(record);
      break;
    }
    case 'view': {
      onView(record);
      break;
    }
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
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
        query: async ({ page }) => {
          try {
            // 直接从formApi获取表单数据
            const formValues = (await gridApi.formApi?.getValues?.()) || {};

            // 使用辅助函数处理参数
            const params = processFormParams(formValues);

            params.currentPark = formValues.parkId ?? -1;

            // 添加分页参数
            params.currentPage = page?.currentPage || 1;
            params.pageSize = page?.pageSize || 20;

            console.warn('处理后的查询参数:', params);

            // 调用API获取数据
            const result = await getCarList(params);

            return {
              ...result,
            };
          } catch (error) {
            console.error('获取车辆列表失败:', error);
            message.error('获取车辆列表失败');
            return {
              page: { currentPage: 1, pageSize: 20, total: 0 },
              items: [],
            };
          }
        },
      },
    },
    rowConfig: {
      keyField: 'carId',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions,
} as Parameters<typeof useVbenVxeGrid>[0]);

/**
 * 刷新表格
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
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="onFormSuccess" />
    <Grid table-title="车辆出入信息列表">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('记录')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
