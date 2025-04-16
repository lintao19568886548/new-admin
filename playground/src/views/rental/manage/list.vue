<script lang="ts" setup>
import type { RentalManagementItem } from './types';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteManage, getManageList } from '#/api/rental';
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

/**
 * 编辑租赁项目
 * @param row
 */
function onEdit(row: RentalManagementItem) {
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
function onDelete(row: RentalManagementItem) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.factoryName]),
    duration: 0,
    key: 'action_process_msg',
  });

  deleteManage(row.factoryId)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.factoryName]),
        key: 'action_process_msg',
      });
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
function onView(row: RentalManagementItem) {
  // 可以跳转到详情页面
  window.open(`/rental/detail/${row.factoryId}`, '_blank');
}

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({
  code,
  row,
}: OnActionClickParams<RentalManagementItem>) {
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

// 当前选中的区域
const currentPark = ref();
const parkSelectorRef = ref();

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
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
                if (key === 'rentPrice') {
                  params[key] = formValues[key].join(',');
                }
              }
            });

            params.currentPark = currentPark.value
              ? currentPark.value.parkId
              : -1;

            // 添加分页参数
            params.currentPage = page?.currentPage || 1;
            params.pageSize = page?.pageSize || 20;

            console.warn('处理后的查询参数:', params);

            // 调用API获取数据
            const result = await getManageList(params);

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
      keyField: 'factoryId', // 修改为正确的主键字段
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
    <Grid :table-title="$t('system.rental.list')">
      <template #toolbar-actions>
        <!-- 区域选择下拉菜单 -->
        <AreaSelector
          :default-park="currentPark"
          :refresh-callback="refreshGrid"
          @change="(park) => (currentPark = park)"
          ref="parkSelectorRef"
        />
      </template>
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.rental.name')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
