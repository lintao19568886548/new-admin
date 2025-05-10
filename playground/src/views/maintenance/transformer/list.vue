<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { onMounted, ref } from 'vue'; // <-- 修改：确保导入 ref

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteTransformer, getTransformerList } from '#/api/maintenance';
// AreaSelector 可能不再需要，或者其逻辑需要调整
// import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import {
  getParkFactoryCascaderOptions,
  useColumns,
  useGridFormSchema,
} from './data'; // 新增导入 getParkFactoryCascaderOptions
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
          const rawFormData = (await gridApi.formApi?.getValues?.()) || {};
          const params: Record<string, any> = {
            ...rawFormData,
            currentPage: page.page?.currentPage || 1,
            pageSize: page.page?.pageSize || 20,
            // currentPark: currentPark.value ? currentPark.value.parkId : -1, // 此行可能不再需要
          };

          // 处理 Cascader 的 factoryId
          if (rawFormData.factoryId && Array.isArray(rawFormData.factoryId)) {
            if (rawFormData.factoryId.length === 2) {
              params.parkId = rawFormData.factoryId[0];
              params.factoryId = rawFormData.factoryId[1]; // 后端查询需要的是 factoryId
            } else if (rawFormData.factoryId.length === 1) {
              params.parkId = rawFormData.factoryId[0];
              // params.factoryId = undefined; // 或者根据后端API要求处理
            }
            // 从 params 中移除原始的数组 factoryId，因为它已经被拆分
            // delete params.factoryId; // 注意：上面已将 params.factoryId 赋值为 cascaderValue[1]
          } else {
            // 如果 factoryId 不是数组或为空，确保不传递错误的 factoryId 和 parkId
            // delete params.factoryId; // 确保不传递
            // delete params.parkId; // 确保不传递
          }

          // 移除 currentPark，因为园区选择已通过 factoryId[0] (即 parkId) 处理
          delete params.currentPark;

          return getTransformerList(params);
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

// onMounted 用于加载 Grid 表单中 Cascader 的 options
onMounted(async () => {
  try {
    const parkCascaderOptions = await getParkFactoryCascaderOptions();
    if (gridApi.formApi && parkCascaderOptions.length > 0) {
      gridApi.formApi.updateSchema([
        {
          componentProps: {
            options: parkCascaderOptions,
          },
          fieldName: 'factoryId',
        },
      ]);
    } else if (gridApi.formApi) {
      gridApi.formApi.updateSchema([
        {
          componentProps: {
            options: [],
          },
          fieldName: 'factoryId',
        },
      ]);
    }
  } catch (error) {
    console.error('在 list.vue 中加载 Grid 表单的园区及厂房数据失败:', error);
    if (gridApi.formApi) {
      gridApi.formApi.updateSchema([
        {
          componentProps: {
            options: [],
          },
          fieldName: 'factoryId',
        },
      ]);
    }
  }
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
