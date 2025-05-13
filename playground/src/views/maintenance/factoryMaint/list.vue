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
import { deleteFactoryMaint, getFactoryMaintList } from '#/api/maintenance';
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

  if (editData.startTime) {
    editData.startTime = formatDateTime(editData.startTime) as string;
  }
  if (editData.endTime) {
    editData.endTime = formatDateTime(editData.endTime) as string;
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
    content: $t('ui.actionMessage.deleting', [row.maintenanceItem]),
    duration: 0,
    key: 'action_process_msg',
  });

  const { factoryMaintenanceId } = row;
  if (factoryMaintenanceId) {
    try {
      // 使用 try-catch 替代 then-catch 链
      await deleteFactoryMaint(factoryMaintenanceId);
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.maintenanceItem]),
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
    fieldMappingTime: [['maintenancePeriod', ['startTime', 'endTime']]], // Updated fieldMappingTime
    schema: useGridFormSchema(), // useGridFormSchema 现在不依赖外部 options
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

          // startTime and endTime will be populated by fieldMappingTime from maintenancePeriod
          // Ensure your API client (getFactoryMaintList) handles these parameters.

          // 构建查询参数，包含分页信息
          const params = {
            ...formDataForQuery,
            currentPage: page.page?.currentPage || 1,
            currentPark: currentPark.value ? currentPark.value.parkId : -1,
            pageSize: page.page?.pageSize || 20,
          };
          try {
            // 调用API获取数据
            const result = await getFactoryMaintList(params);
            // 返回格式化后的数据
            return {
              ...result,
            };
          } catch (error) {
            console.error('获取厂房维护列表失败:', error);
            message.error('获取厂房维护列表失败');
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
    <Grid :table-title="$t('page.maintenance.factoryMaintenanceList')">
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
