<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { LeaveApplication, Park } from '#/api/hrm/leaveapplication';

import { ref, shallowRef } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { Tag as ATag, Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteLeaveApplication,
  getLeaveApplicationList,
  updateLeaveApplication,
} from '#/api/hrm/leaveapplication';

import { useColumns, useSearchSchema } from './data';
import AuditModal from './modules/audit-modal.vue';
import Form from './modules/form.vue';

// interface QueryParams {
//   [key: string]: any;
//   currentPage?: number;
//   pageSize?: number;
// }

const tableLoading = shallowRef(false);
const parkOptions = ref<Park[]>([]);
const userStore = useUserStore();
const codes = userStore.userInfo?.codes || [];

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [AuditModalCom, auditModalApi] = useVbenModal({
  connectedComponent: AuditModal,
});

const messageHandler = {
  error: (error: any, customMessage?: string) => {
    const errorMsg = error?.message || '未知错误';
    message.error({
      content: customMessage ? `${customMessage}: ${errorMsg}` : errorMsg,
      key: 'action_process_msg',
    });
    console.error(customMessage || '操作失败', error);
  },
  loading: (content: string) => {
    return message.loading({
      content,
      duration: 0,
      key: 'action_process_msg',
    });
  },
  success: (content: string) => {
    message.success({
      content,
      key: 'action_process_msg',
    });
  },
};

const actions = {
  approve: (row: LeaveApplication) => {
    Modal.confirm({
      content: `确定要批准 ${row.username} 的请假申请吗？`,
      onOk: async () => {
        const hideLoading = messageHandler.loading(`正在批准申请`);
        try {
          await updateLeaveApplication(row.id, {
            auditUser: userStore.userInfo?.realname,
            status: 1,
          });
          messageHandler.success(`成功批准申请`);
          refreshGrid();
        } catch (error) {
          messageHandler.error(error, '批准申请失败');
        } finally {
          hideLoading();
        }
      },
      title: '确认审批',
    });
  },
  create: () => {
    formModalApi.setData(null).open();
  },
  delete: (row: LeaveApplication) => {
    const hideLoading = messageHandler.loading(`正在删除申请`);
    deleteLeaveApplication(row.id)
      .then(() => {
        messageHandler.success(`成功删除申请`);
        refreshGrid();
      })
      .catch((error) => {
        messageHandler.error(error, '删除申请失败');
      })
      .finally(() => {
        hideLoading();
      });
  },
  edit: (row: LeaveApplication) => {
    formModalApi.setData(row).open();
  },
  reject: (row: LeaveApplication) => {
    Modal.confirm({
      content: `确定要驳回 ${row.username} 的请假申请吗？`,
      onOk: async () => {
        const hideLoading = messageHandler.loading(`正在驳回申请`);
        try {
          await updateLeaveApplication(row.id, {
            auditUser: userStore.userInfo?.realname,
            status: 2,
          });
          messageHandler.success(`成功驳回申请`);
          refreshGrid();
        } catch (error) {
          messageHandler.error(error, '驳回申请失败');
        } finally {
          hideLoading();
        }
      },
      title: '确认驳回',
    });
  },
};

function onActionClick({ code, row }: OnActionClickParams<LeaveApplication>) {
  switch (code) {
    case 'approve': {
      actions.approve(row);
      break;
    }
    case 'audit': {
      auditModalApi.setData(row).open();
      break;
    }
    case 'delete': {
      actions.delete(row);
      break;
    }
    case 'edit': {
      actions.edit(row);
      break;
    }
    case 'reject': {
      actions.reject(row);
      break;
    }
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useSearchSchema(parkOptions),
  },
  gridOptions: {
    border: true,
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      pageSize: 20,
    },
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          try {
            tableLoading.value = true;
            const queryParams = (await gridApi.formApi?.getValues()) || {};

            const result = await getLeaveApplicationList({
              ...queryParams,
              currentPage: page.currentPage,
              pageSize: page.pageSize,
            });

            // The backend for list now returns parks, so we can populate the dropdown
            if (result.parks) {
              parkOptions.value = result.parks;
            }

            return {
              total: result.total,
              items: result.items,
            };
          } catch (error) {
            console.error(error);
            message.error('获取列表失败');
            return { total: 0, items: [] };
          } finally {
            tableLoading.value = false;
          }
        },
      },
      props: {
        result: 'items',
        total: 'total',
      },
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      search: true, // Enable search toolbar
      zoom: true,
    },
  } as VxeTableGridOptions,
});

function getStatusInfo(status: number) {
  const statusMap: Record<number, { color: string; text: string }> = {
    0: { color: 'warning', text: '待审核' },
    1: { color: 'success', text: '已通过' },
    2: { color: 'error', text: '未通过' },
  };
  return statusMap[status] || { color: 'default', text: `未知状态(${status})` };
}

function refreshGrid() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="refreshGrid" />
    <AuditModalCom @success="refreshGrid" />
    <Grid table-title="请假申请列表" :loading="tableLoading">
      <template #operation_cell="{ row }">
        <div class="flex items-center justify-center">
          <Button
            v-if="codes.includes('LEAVE_AUDIT')"
            type="link"
            @click="onActionClick({ code: 'audit', row })"
          >
            审批
          </Button>
          <Button
            v-if="row.status === 0"
            type="link"
            @click="onActionClick({ code: 'edit', row })"
          >
            修改
          </Button>
          <Button
            v-if="row.status !== 1"
            type="link"
            danger
            @click="onActionClick({ code: 'delete', row })"
          >
            删除
          </Button>
        </div>
      </template>
      <template #status_cell="{ row }">
        <ATag :color="getStatusInfo(row.status).color">
          {{ getStatusInfo(row.status).text }}
        </ATag>
      </template>
      <template #toolbar-tools>
        <Button type="primary" @click="actions.create">
          <Plus class="size-5" />
          新建申请
        </Button>
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
/* 请假申请列表页面样式 */
</style>
