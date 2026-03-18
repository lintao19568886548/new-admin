<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteElevator, getElevatorList } from '#/api/maintenance';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data'; // <-- 新增导入 getParkFactoryCascaderOptions
import Form from './modules/form.vue';

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
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
    key: 'action_process_msg',
  });

  const { elevatorId } = row;
  if (elevatorId) {
    try {
      // 使用 try-catch 替代 then-catch 链
      await deleteElevator(elevatorId);
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.name]),
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
    // 将 productionDate 映射到后端期望的 productionDateStart 和 productionDateEnd
    fieldMappingTime: [
      ['checkTime', ['startTime', 'endTime']],
      ['productionDate', ['productionDateStart', 'productionDateEnd']],
    ],
    schema: useGridFormSchema(), // useGridFormSchema 现在不依赖外部 options
  },
  gridOptions: {
    border: true,
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async (page) => {
          const rawFormData = (await gridApi.formApi?.getValues?.()) || {};
          const formDataForQuery = { ...rawFormData };
          const selectedParkId =
            formDataForQuery.parkId ??
            (Array.isArray(rawFormData.factoryId) &&
            rawFormData.factoryId.length > 0
              ? rawFormData.factoryId[0]
              : undefined);

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

          // 构建查询参数，包含分页信息
          const params = {
            ...formDataForQuery,
            currentPage: page.page?.currentPage || 1,
            currentPark: selectedParkId ?? -1,
            // 后端分页参数已从 pageSize 改为 limit
            limit: page.page?.pageSize || 20,
          };
          try {
            // 调用API获取数据
            const result = await getElevatorList(params);
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
    <Grid :table-title="$t('page.maintenance.elevatorList')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('电梯')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
