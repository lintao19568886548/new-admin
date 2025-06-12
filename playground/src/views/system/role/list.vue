<script lang="ts" setup>
import type { Recordable } from '@vben/types';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemRoleApi } from '#/api';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteRole, getRoleList, updateRole } from '#/api';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    fieldMappingTime: [['createTime', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useColumns(onActionClick, onStatusChange),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: false, // 禁用分页
    },
    proxyConfig: {
      ajax: {
        // 使用 _pageInfo 代替 {} 并添加类型注解
        query: async (_pageInfo: any, formValues) => {
          // 移除 page 参数
          const result = await getRoleList({
            // 不传递分页参数，期望API返回所有数据或按需修改API
            ...formValues,
          });
          // 检查返回结果是否为带 items 的对象格式，如果是则返回 items，否则直接返回结果
          // VxeTable 需要数组格式的数据
          return result &&
            typeof result === 'object' &&
            Array.isArray((result as any).items)
            ? (result as any).items
            : result; // 假设直接返回数组
        },
      },
    },
    rowConfig: {
      keyField: 'roleId', // 使用 roleId 作为 key
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
    treeConfig: {
      // 添加 treeConfig
      parentField: 'parentid', // 假设角色数据有 parentid 字段表示父级ID
      rowField: 'roleId', // 使用 roleId 作为行ID
      transform: false, // 后端返回树状结构时设为true，扁平结构设为false
    },
  } as VxeTableGridOptions<SystemRoleApi.SystemRole>,
});

// 修改参数类型为 OnActionClickParams<Recordable<any>> 并添加类型断言
function onActionClick(e: OnActionClickParams<Recordable<any>>) {
  const row = e.row as SystemRoleApi.SystemRole;
  switch (e.code) {
    case 'append': {
      // 添加 Append 操作
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

/**
 * 将Antd的Modal.confirm封装为promise，方便在异步函数中调用。
 * @param content 提示内容
 * @param title 提示标题
 */
function confirm(content: string, title: string) {
  return new Promise((reslove, reject) => {
    Modal.confirm({
      content,
      onCancel() {
        reject(new Error('已取消'));
      },
      onOk() {
        reslove(true);
      },
      title,
    });
  });
}

/**
 * 状态开关即将改变
 * @param newStatus 期望改变的状态值
 * @param row 行数据
 * @returns 返回false则中止改变，返回其他值（undefined、true）则允许改变
 */
async function onStatusChange(
  newStatus: number,
  row: SystemRoleApi.SystemRole,
) {
  const status: Recordable<string> = {
    0: '禁用',
    1: '启用',
  };
  try {
    await confirm(
      `你要将${row.name}的状态切换为 【${status[newStatus.toString()]}】 吗？`,
      `切换状态`,
    );
    // 将 newStatus 转换为 boolean
    await updateRole(row.roleId, { status: Boolean(newStatus) });
    return true;
  } catch {
    return false;
  }
}

function onEdit(row: SystemRoleApi.SystemRole) {
  formDrawerApi.setData(row).open();
}

// 添加 onAppend 函数
function onAppend(row: SystemRoleApi.SystemRole) {
  formDrawerApi.setData({ parentid: row.roleId }).open(); // 设置父级ID
}

function onDelete(row: SystemRoleApi.SystemRole) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteRole(row.roleId)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.name]),
        key: 'action_process_msg',
      });
      onRefresh();
    })
    .catch(() => {
      hideLoading();
    });
}

function onRefresh() {
  gridApi.query();
}

function onCreate() {
  formDrawerApi.setData({}).open();
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid :table-title="$t('system.role.list')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.role.name')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
