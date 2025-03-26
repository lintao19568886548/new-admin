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
 * 编辑部门
 * @param row
 */
function onEdit(row: SystemDeptApi.SystemDept) {
  formModalApi.setData(row).open();
}

/**
 * 添加下级部门
 * @param row
 */
function onAppend(row: SystemDeptApi.SystemDept) {
  formModalApi.setData({ pid: row.id }).open();
}

/**
 * 创建新部门
 */
function onCreate() {
  formModalApi.setData(null).open();
}

/**
 * 删除部门
 * @param row
 */
function onDelete(row: SystemDeptApi.SystemDept) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteDept(row.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.name]),
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
    case 'append': {
      onAppend(row);
      break;
    }
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

// 模拟的访客数据
const visitorItems = [
  {
    createTime: '2023-05-01 08:50:00',
    id: '1',
    phoneNumber: '13800138001',
    registerTime: '2023-05-01 09:00:00',
    status: '进入',
    visitorName: '张三',
    visitReason: '业务洽谈',
  },
  {
    createTime: '2023-05-01 10:20:00',
    id: '2',
    phoneNumber: '13900139002',
    registerTime: '2023-05-01 10:30:00',
    status: '离开',
    visitorName: '李四',
    visitReason: '面试',
  },
  {
    createTime: '2023-05-02 13:50:00',
    id: '3',
    phoneNumber: '13700137003',
    registerTime: '2023-05-02 14:00:00',
    status: '进入',
    visitorName: '王五',
    visitReason: '送货',
  },
  {
    createTime: '2023-05-03 11:00:00',
    id: '4',
    phoneNumber: '13600136004',
    registerTime: '2023-05-03 11:15:00',
    status: '进入',
    visitorName: '赵六',
    visitReason: '参观',
  },
  {
    createTime: '2023-05-03 16:20:00',
    id: '5',
    phoneNumber: '13500135005',
    registerTime: '2023-05-03 16:30:00',
    status: '离开',
    visitorName: '钱七',
    visitReason: '维修设备',
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
          return visitorItems;
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
    <Grid table-title="来访信息列表">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('记录')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
