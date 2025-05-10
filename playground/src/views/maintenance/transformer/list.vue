<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { ref } from 'vue'; // <-- 修改：确保导入 ref

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteTransformer, getTransformerList } from '#/api/maintenance';
// AreaSelector 可能不再需要，或者其逻辑需要调整
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data'; // 新增导入 getParkFactoryCascaderOptions
import Form from './modules/form.vue';

// 当前选中的区域 (currentPark 和 parkSelectorRef 可能不再直接用于主列表筛选，因为筛选条件已移入 GridForm)
const currentPark = ref(); // <-- 修改：取消注释
const parkSelectorRef = ref(); // <-- 修改：取消注释

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

/**
 * 编辑租赁项目
 * @param row
 */
function onEdit(row: any) {
  // 当打开编辑模态框时，确保传递 parkId 和 factoryId
  // 如果 row 中直接有 parkId 和 factoryId，则无需转换
  // 如果 row.factoryId 是一个包含 [parkId, factoryId] 的数组，也无需转换
  // 此处假设 row 的结构与 modalApi.setData 期望的一致
  // 复制行数据以避免修改原始数据
  const editData = { ...row };

  if (editData.checkTime) {
    editData.checkTime = formatDateTime(editData.checkTime) as string;
  }
  formModalApi.setData(editData).open();
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
  // 假设 row 中有 factoryName 字段用于显示，或者 transformerName 仍然代表主要标识
  // 如果 transformerName 被替换，应使用新的名称字段，例如 row.factoryName
  const displayName =
    row.factoryName || row.transformerName || $t('page.maintenance.title');
  message.loading({
    content: $t('ui.actionMessage.deleting', [displayName]),
    duration: 0,
    key: 'action_process_msg',
  });

  const { transformerId } = row;
  if (transformerId) {
    try {
      // 使用 try-catch 替代 then-catch 链
      await deleteTransformer(transformerId);
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.transformerName]),
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
    schema: useGridFormSchema(), // 使用更新后的 schema
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
            const result = await getTransformerList(params);
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
    <Grid :table-title="$t('page.maintenance.transformerList')">
      <template #toolbar-actions>
        <!-- 区域选择下拉菜单 -->
        <AreaSelector
          :default-park="currentPark"
          :refresh-callback="refreshGrid"
          @change="(park: any) => (currentPark = park)"
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
