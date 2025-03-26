<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemDeptApi } from '#/api/system/dept';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteDept } from '#/api/system/dept';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

/**
 * 编辑记录
 * @param row
 */
function onEdit(row: SystemDeptApi.SystemDept) {
  formModalApi.setData(row).open();
}

/**
 * 创建新记录
 */
function onCreate() {
  formModalApi.setData(null).open();
}

/**
 * 删除记录
 * @param row
 */
function onDelete(row: SystemDeptApi.SystemDept) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.carNumber]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteDept(row.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.carNumber]),
        key: 'action_process_msg',
      });
      refreshGrid();
    })
    .catch(() => {
      hideLoading();
    });
}

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({
  code,
  row,
}: OnActionClickParams<SystemDeptApi.SystemDept>) {
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

// 模拟的车辆数据
const carItems = [
  {
    accessStatus: 1,
    carNumber: '京A12345',
    createTime: '2023-05-01 08:25:00',
    id: '1',
    registerTime: '2023-05-01 08:30:00',
    remark: '公司领导车辆',
  },
  {
    accessStatus: 0,
    carNumber: '京B67890',
    createTime: '2023-05-01 09:10:00',
    id: '2',
    registerTime: '2023-05-01 09:15:00',
    remark: '访客车辆',
  },
  {
    accessStatus: 1,
    carNumber: '京C13579',
    createTime: '2023-05-02 10:40:00',
    id: '3',
    registerTime: '2023-05-02 10:45:00',
    remark: '送货车辆',
  },
  {
    accessStatus: 1,
    carNumber: '京D24680',
    createTime: '2023-05-03 14:15:00',
    id: '4',
    registerTime: '2023-05-03 14:20:00',
    remark: '员工车辆',
  },
  {
    accessStatus: 0,
    carNumber: '京E11223',
    createTime: '2023-05-03 17:25:00',
    id: '5',
    registerTime: '2023-05-03 17:30:00',
    remark: '维修车辆',
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        query: async () => {
          // 使用模拟数据
          return carItems;
        },
      },
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      zoom: true,
    },
    treeConfig: {
      parentField: 'pid',
      rowField: 'id',
      transform: false,
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
