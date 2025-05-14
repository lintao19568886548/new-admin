<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { ref } from 'vue'; // <-- 确保导入 onMounted

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
// 修改: 导入新的 API 函数
import { deleteHygieneCheck, getHygieneCheckList } from '#/api/maintenance';
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data'; // <-- 新增导入 getParkFactoryCascaderOptions
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
  // 复制行数据以避免修改原始数据
  const editData = { ...row };

  if (editData.checkDate) {
    editData.checkDate = formatDateTime(editData.checkDate) as string;
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
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.checkItems]),
    duration: 0,
    key: 'action_process_msg',
  });
  try {
    // 修改: API 函数调用和参数
    await deleteHygieneCheck(row.hygieneCheckId);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.firefightingName]),
      key: 'action_process_msg',
    });
    refreshGrid();
  } catch (error) {
    message.error({
      content: $t('ui.actionMessage.operationFailed', [error]),
      key: 'action_process_msg',
    });
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
    // 修改: checkTime -> checkDate
    fieldMappingTime: [['checkDate', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async (page) => {
          const rawFormData = (await gridApi.formApi?.getValues?.()) || {};
          const formDataForQuery = { ...rawFormData };

          // 处理来自筛选 Cascader 的 factoryId
          if (
            formDataForQuery.factoryId &&
            Array.isArray(formDataForQuery.factoryId)
          ) {
            if (formDataForQuery.factoryId.length > 0) {
              // 后端需要单个 factoryId
              formDataForQuery.factoryId =
                formDataForQuery.factoryId[
                  formDataForQuery.factoryId.length - 1
                ];
            } else {
              delete formDataForQuery.factoryId; // 如果数组为空，则不以此筛选
            }
          }
          // 如果 factoryId 不是数组而是单个值，则上面的逻辑可能不需要

          // 构建查询参数，包含分页信息
          const params = {
            ...formDataForQuery,
            currentPage: page.page?.currentPage || 1,
            currentPark: currentPark.value ? currentPark.value.parkId : -1,
            pageSize: page.page?.pageSize || 20,
          };
          try {
            // 修改: API 函数调用
            const result = await getHygieneCheckList(params);
            return {
              ...result, // 假设 result 已经是 { items: [], total: 0 } 格式
            };
          } catch (error) {
            // 修改: 错误消息
            console.error('获取卫生检查列表失败:', error);
            message.error('获取卫生检查列表失败');
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
        // 如果有删除操作的 proxy，也需要更新
        // delete: async ({ body }) => {
        //   const idsToDelete = body.removeRecords.map(record => record.hygieneCheckId);
        //   await deleteHygieneCheck(idsToDelete); // 假设 deleteHygieneCheck 支持批量删除
        // },
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
    <Grid :table-title="$t('page.maintenance.hygieneCheckList')">
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
