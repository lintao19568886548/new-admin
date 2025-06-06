<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteSystemPark, getSystemParkList } from '#/api/system/park';
import { $t } from '#/locales';
import { useParkStore } from '#/store';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const router = useRouter();
const parkStore = useParkStore();

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

/**
 * 编辑租赁项目
 * @param row
 */
function onEdit(row: any) {
  formModalApi.setData(row).open();
}

/**
 * 创建新租赁项目
 */
function onCreate() {
  formModalApi.setData(null).open();
}

/**
 * 删除租赁项目
 * @param row
 */
function onDelete(row: any) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.factoryName]),
    duration: 0,
    key: 'action_process_msg',
  });

  deleteSystemPark(row.parkId)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.factoryName]),
        key: 'action_process_msg',
      });

      // 删除成功后，强制刷新store中的园区列表
      parkStore.fetchParkList(true);

      refreshGrid();
    })
    .catch((error) => {
      console.error('删除租户失败:', error);
      message.error({
        content: $t('ui.actionMessage.deleteFailed', [row.factoryName]),
        key: 'action_process_msg',
      });
    });
}

/**
 * 查看租赁项目详情
 * @param row
 */
function onView(row: any) {
  // 可以跳转到详情页面
  router.push(`/rental/detail/${row.parkId}`);
}

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({ code, row }: OnActionClickParams) {
  switch (code) {
    case 'delete': {
      onDelete(row);
      break;
    }
    case 'edit': {
      onEdit(row);
      break;
    }
    case 'view': {
      onView(row);
      break;
    }
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    handleReset: async () => {
      // 先重置表单
      await gridApi.formApi?.resetForm();

      // 手动重置所有MultiSelect组件
      // 如果有表单引用，可以通过引用获取组件实例并调用reset方法
      // 或者通过设置特定字段为默认值来触发重置
      const defaultValues = {
        area: ['equal', undefined, undefined],
      };

      // 设置默认值
      Object.entries(defaultValues).forEach(([key, value]) => {
        gridApi.formApi?.setFieldValue(key, value);
      });

      // 刷新表格
      refreshGrid();
    },
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
            // 直接从formApi获取表单数据
            const formValues = (await gridApi.formApi?.getValues?.()) || {};

            // 清理表单数据，移除空值
            const params: Record<string, any> = {};
            Object.keys(formValues).forEach((key) => {
              if (
                formValues[key] !== undefined &&
                formValues[key] !== null &&
                formValues[key] !== ''
              ) {
                params[key] = formValues[key];
                if (key === 'area') {
                  params[key] = formValues[key].join(',');
                }
              }
            });

            // 添加分页参数
            params.currentPage = page?.currentPage || 1;
            params.pageSize = page?.pageSize || 20;

            // 调用API获取数据
            const result = await getSystemParkList(params);

            // 修改这里：返回正确的分页格式
            return {
              ...result,
            };
          } catch (error) {
            console.error('获取租赁列表失败:', error);
            message.error('获取租赁列表失败');
            return {
              page: { currentPage: 1, pageSize: 20, total: 0 },
              items: [],
            };
          }
        },
      },
    },
    rowConfig: {
      keyField: 'rowId', // 修改为正确的主键字段
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
    <Grid :table-title="$t('page.park.list')">
      <template #toolbar-actions>
        <!-- 区域选择下拉菜单 -->
      </template>
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('page.park.item')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
