<script lang="ts" setup>
import type { VisitorItem } from './types';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { ref, watch } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteVisitor, getVisitorList } from '#/api/access/visitor';
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

// 当前选中的区域
const currentPark = ref();

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
      // 处理状态值，将字符串转换为数字
      if (key === 'status') {
        if (formValues[key] === '进入') {
          params[key] = 0;
        } else if (formValues[key] === '离开') {
          params[key] = 1;
        } else {
          params[key] = formValues[key];
        }
      }
      // 处理日期范围，将数组转换为逗号分隔的字符串
      else if (key === 'registerTime' && Array.isArray(formValues[key])) {
        params[key] = formValues[key].join(',');
      } else {
        params[key] = formValues[key];
      }
    }
  });
  return params;
}

const parkSelectorRef = ref();

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

/**
 * 编辑访客记录
 * @param row
 */
function onEdit(row: VisitorItem) {
  formModalApi.setData(row).open();
}

/**
 * 创建新访客记录
 */
function onCreate() {
  formModalApi.setData(null).open();
}

/**
 * 删除访客记录
 * @param row
 */
function onDelete(row: VisitorItem) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.visitorName]),
    duration: 0,
    key: 'action_process_msg',
  });

  deleteVisitor(row.visitorId)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.visitorName]),
        key: 'action_process_msg',
      });
      refreshGrid();
    })
    .catch((error) => {
      console.error('删除访客记录失败:', error);
      message.error({
        content: $t('ui.actionMessage.deleteFailed', [row.visitorName]),
        key: 'action_process_msg',
      });
    });
}

/**
 * 查看访客记录详情
 * @param row
 */
function onView(row: VisitorItem) {
  // 可以实现查看详情功能
  formModalApi.setData({ ...row, readonly: true }).open();
}

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({ code, row }: OnActionClickParams) {
  const record = row as VisitorItem;
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

            params.currentPark = currentPark.value
              ? currentPark.value.parkId
              : -1;

            // 添加分页参数
            params.currentPage = page?.currentPage || 1;
            params.pageSize = page?.pageSize || 20;

            console.warn('处理后的查询参数:', params);

            // 调用API获取数据
            const result = await getVisitorList(params);

            return {
              ...result,
            };
          } catch (error) {
            console.error('获取访客列表失败:', error);
            message.error('获取访客列表失败');
            return {
              page: { currentPage: 1, pageSize: 20, total: 0 },
              items: [],
            };
          }
        },
      },
    },
    rowConfig: {
      keyField: 'visitorId', // 修改为正确的主键字段
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

// 监听园区选择变化，自动刷新表格
watch(
  () => currentPark.value,
  () => {
    refreshGrid();
  },
);
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="onFormSuccess" />
    <Grid table-title="来访信息列表">
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
          {{ $t('ui.actionTitle.create', [$t('记录')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
