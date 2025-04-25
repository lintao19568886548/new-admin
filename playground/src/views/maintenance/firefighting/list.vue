<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteFirefighting, getFirefightingList } from '#/api/maintenance';
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

// 当前选中的区域
const currentPark = ref();

const parkSelectorRef = ref();

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
async function onDelete(row: any) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.firefightingName]),
    duration: 0,
    key: 'action_process_msg',
  });

  const { firefightingId } = row;
  if (firefightingId) {
    try {
      // 使用 try-catch 替代 then-catch 链
      await deleteFirefighting(firefightingId);
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.tenantName]),
        key: 'action_process_msg',
      });
      refreshGrid();
    } catch (error) {
      console.error('删除账单失败:', error);
      message.error({
        content: $t('ui.actionMessage.operationFailed', [error]),
        key: 'action_process_msg',
      });
    }
  }
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
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    fieldMappingTime: [['checkTime', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async (page) => {
          const formData = (await gridApi.formApi?.getValues?.()) || {};

          // 构建查询参数，包含分页信息
          const params = {
            ...formData,
            currentPage: page.page?.currentPage || 1,
            currentPark: currentPark.value ? currentPark.value.parkId : -1,
            pageSize: page.page?.pageSize || 20,
          };
          try {
            // 调用API获取数据
            const result = await getFirefightingList(params);
            // 返回格式化后的数据
            return {
              ...result,
            };
          } catch (error) {
            console.error('获取账单列表失败:', error);
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
      keyField: 'id',
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
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="refreshGrid" />
    <Grid :table-title="$t('page.maintenance.firefightingList')">
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
          {{ $t('ui.actionTitle.create', [$t('维护记录')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
