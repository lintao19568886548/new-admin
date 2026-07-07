<script lang="ts" setup>
import type { Recordable } from '@vben/types';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemRoleApi } from '#/api';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteRole, updateRole } from '#/api';
import OnboardingStepAlert from '#/components/onboarding/OnboardingStepAlert.vue';
import { $t } from '#/locales';
import { useRoleStore } from '#/store/modules/role';

import { useColumns, useGridFormSchema } from './data';
import { BatchEdit, FormDrawer } from './modules';

// 组件引用
const formDrawerRef = ref();
const batchEditRef = ref();

// 使用角色store
const roleStore = useRoleStore();

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
        // 使用角色store获取数据
        query: async (_pageInfo: any, formValues) => {
          // 使用store获取角色数据，支持缓存
          const result = await roleStore.fetchRoles();

          // 如果有搜索条件，在前端进行过滤
          if (formValues && Object.keys(formValues).length > 0) {
            return result.filter((role: SystemRoleApi.SystemRole) => {
              // 简单的名称过滤，可根据需要扩展
              if (formValues.name) {
                return role.name
                  ?.toLowerCase()
                  .includes(formValues.name.toLowerCase());
              }
              if (formValues.status !== undefined && formValues.status !== '') {
                return role.status === formValues.status;
              }
              return true;
            });
          }

          return result;
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
      expandAll: true, // 默认展开所有树节点
      // 添加 treeConfig
      parentField: 'parentId', // 假设角色数据有 parentId 字段表示父级ID
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
    const updatedRole = { ...row, status: Boolean(newStatus) };
    await updateRole(row.roleId, { status: Boolean(newStatus) });

    // 更新store中的数据
    roleStore.updateRole(updatedRole);

    return true;
  } catch {
    return false;
  }
}

function onEdit(row: SystemRoleApi.SystemRole) {
  formDrawerRef.value?.setData(row);
  formDrawerRef.value?.open();
}

// 添加 onAppend 函数
function onAppend(row: SystemRoleApi.SystemRole) {
  formDrawerRef.value?.setData({ parentId: row.roleId }); // 设置父级ID
  formDrawerRef.value?.open();
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

      // 从store中删除数据
      roleStore.removeRole(row.roleId);

      onRefresh();
    })
    .catch(() => {
      hideLoading();
    });
}

function onRefresh() {
  // 刷新store中的数据
  roleStore.refreshRoles();
  gridApi.query();
}

function onCreate() {
  formDrawerRef.value?.setData({});
  formDrawerRef.value?.open();
}

/**
 * 打开批量修改对话框
 */
function onBatchEdit() {
  batchEditRef.value?.open();
}
</script>
<template>
  <Page auto-content-height>
    <OnboardingStepAlert step-key="permissions" />
    <FormDrawer ref="formDrawerRef" @success="onRefresh" />
    <BatchEdit ref="batchEditRef" @success="onRefresh" />
    <Grid :table-title="$t('system.role.list')">
      <template #toolbar-tools>
        <div class="flex gap-4">
          <Button type="primary" @click="onCreate">
            <Plus class="size-5" />
            {{ $t('ui.actionTitle.create', [$t('system.role.name')]) }}
          </Button>
          <Button type="default" @click="onBatchEdit">
            <IconifyIcon
              icon="mdi:pencil-box-multiple-outline"
              class="size-5"
            />
            批量修改
          </Button>
        </div>
      </template>
    </Grid>
  </Page>
</template>
