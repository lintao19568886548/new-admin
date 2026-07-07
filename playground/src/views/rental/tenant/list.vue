<script lang="ts" setup>
import type { RentalManagementItem } from './types';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { MessageOutlined } from '@ant-design/icons-vue';
import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  clearTenants,
  deleteTenant,
  getTenantList,
  getTenantSmsInfo,
  sendBulkSms,
  sendSms,
} from '#/api/rental';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const route = useRoute();
const userStore = useUserStore();
const isSuperUser = computed(() => userStore.userRoles.includes('Super'));

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

// 表格API引用
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    fieldMappingTime: [['contractDate', ['contractStart', 'contractEnd']]],
    schema: useGridFormSchema(),
    submitOnChange: false, // 修改这里：改为false，不再自动提交
  },
  gridOptions: {
    border: true,
    columns: useColumns(onActionClick),
    footerAlign: 'center',
    footerMethod({
      columns,
      data,
    }: {
      columns: any[];
      data: RentalManagementItem[];
    }) {
      // 返回一个合计行
      return [
        columns.map((column) => {
          // 根据列的字段名称进行不同的合计计算
          if (column.field === 'tenantName') {
            return '合计';
          }

          // 如果有需要计算合计的数值列，可以在这里添加
          // 例如：计算某个数值列的合计
          if (column.field === 'area') {
            const sum = data.reduce((sum, row: RentalManagementItem) => {
              return sum + (Number(row.area) || 0);
            }, 0);
            return `${sum}㎡`;
          }

          if (column.field === 'rent') {
            const sum = data.reduce((sum, row: RentalManagementItem) => {
              return sum + (Number(row.rent) || 0);
            }, 0);
            return `${sum}元`;
          }
          // 其他列不显示合计
          return '';
        }),
      ];
    },
    footerRowStyle: {
      color: 'black',
      fontSize: '15px',
    },
    height: 'auto',
    keepSource: true,
    // 添加分页配置
    pagerConfig: {
      enabled: true,
      pageSize: 20,
      pageSizes: [10, 20, 30, 50, 100],
    },
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          try {
            const params = await buildTenantQueryParams({
              currentPage: page?.currentPage || 1,
              pageSize: page?.pageSize || 20,
            });

            console.warn('处理后的查询参数:', params);

            // 调用API获取数据
            const result = await getTenantList(params);

            // 返回格式化后的数据
            return {
              currentPage: result.currentPage || 1,
              pageSize: result.pageSize || 20,
              total: result.total || 0,
              items: result.items || [],
            };
          } catch (error) {
            console.error('获取租户列表失败:', error);
            message.error('获取租户列表失败');
            return {
              currentPage: 1,
              pageSize: 20,
              total: 0,
              items: [],
            };
          }
        },
      },
    },
    rowConfig: {
      keyField: 'rentalTenantId',
    },
    showFooter: true,
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<RentalManagementItem>,
});

function getRouteTenantFilters() {
  const query = route.query;
  const values: Record<string, any> = {
    contractDate: undefined,
    parkId: undefined,
    status: undefined,
  };
  const parkId = Number(query.parkId);
  const status = String(query.status || '');
  const contractStart = String(query.contractStart || '');
  const contractEnd = String(query.contractEnd || '');

  if (Number.isInteger(parkId) && parkId > 0) {
    values.parkId = parkId;
  }
  if (status === 'active' || status === 'expired') {
    values.status = status;
  }
  if (contractStart && contractEnd) {
    values.contractDate = [contractStart, contractEnd];
  }

  return values;
}

async function buildTenantQueryParams(
  pagination: { currentPage?: number; pageSize?: number } = {},
) {
  const formValues = (await gridApi.formApi?.getValues?.()) || {};
  const params: Record<string, any> = {};

  Object.keys(formValues).forEach((key) => {
    if (
      formValues[key] !== undefined &&
      formValues[key] !== null &&
      formValues[key] !== ''
    ) {
      params[key] = formValues[key];
    }
  });

  if (Array.isArray(params.contractDate)) {
    params.contractDate = params.contractDate.join(',');
  }
  if (params.contractStart && params.contractEnd) {
    params.contractDate = `${params.contractStart},${params.contractEnd}`;
    delete params.contractStart;
    delete params.contractEnd;
  }
  if (
    route.query.contractView === 'attention' ||
    route.query.contractView === 'expiring'
  ) {
    params.contractView = route.query.contractView;
  }
  if (route.query.date) {
    params.date = String(route.query.date);
  }

  params.currentPark = formValues.parkId ?? -1;

  if (pagination.currentPage) {
    params.currentPage = pagination.currentPage;
  }
  if (pagination.pageSize) {
    params.pageSize = pagination.pageSize;
  }

  return params;
}

async function applyRouteTenantFilters() {
  const values = getRouteTenantFilters();
  const hasRouteFilter = Object.values(values).some(
    (value) => value !== undefined,
  );
  if (!hasRouteFilter && Object.keys(route.query).length === 0) {
    return;
  }
  await gridApi.formApi?.setValues?.(values);
}

onMounted(async () => {
  await applyRouteTenantFilters();
  gridApi.query();
});

watch(
  () => route.query,
  async () => {
    await applyRouteTenantFilters();
    gridApi.query();
  },
);

/**
 * 处理表格操作按钮点击
 */
function onActionClick(e: OnActionClickParams<RentalManagementItem>) {
  switch (e.code) {
    case 'delete': {
      onDelete(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
    case 'sms': {
      onSendSms(e.row);
      break;
    }
    case 'view': {
      onView(e.row);
      break;
    }
  }
}

/**
 * 编辑租户
 */
function onEdit(row: RentalManagementItem) {
  formModalApi.setData(row).open();
}

/**
 * 创建新租户
 */
function onCreate() {
  formModalApi.setData(null).open();
}

/**
 * 删除租户
 */
function onDelete(row: RentalManagementItem) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.tenantName]),
    duration: 0,
    key: 'action_process_msg',
  });

  deleteTenant(row.rentalTenantId)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.tenantName]),
        key: 'action_process_msg',
      });
      refreshGrid();
    })
    .catch((error) => {
      console.error('删除租户失败:', error);
      message.error({
        content: $t('ui.actionMessage.deleteFailed', [row.tenantName]),
        key: 'action_process_msg',
      });
    });
}

async function onClearTenants() {
  if (!isSuperUser.value) {
    message.warning('只有超级管理员可以清空合同');
    return;
  }

  const params = await buildTenantQueryParams();
  Modal.confirm({
    cancelText: '取消',
    content:
      '删除后合同数据将被清空，不能恢复。确认删除当前筛选条件下的合同吗？',
    okButtonProps: {
      danger: true,
    },
    okText: '确认删除',
    onOk: async () => {
      message.loading({
        content: '正在清空合同列表...',
        duration: 0,
        key: 'clear_tenant_msg',
      });

      try {
        const result = await clearTenants(params);
        const clearedCount = Number(result?.clearedCount ?? 0);
        message.success({
          content: `已清空 ${clearedCount} 条合同`,
          key: 'clear_tenant_msg',
        });
        refreshGrid();
      } catch (error) {
        console.error('清空合同失败:', error);
        message.error({
          content: '清空合同失败',
          key: 'clear_tenant_msg',
        });
        throw error;
      }
    },
    title: '确认删除合同数据',
    width: 520,
  });
}

/**
 * 查看租户详情
 */
function onView(row: RentalManagementItem) {
  formModalApi.setData({ ...row, readonly: true }).open();
}

/**
 * 发送短信
 */
async function onSendSms(row: RentalManagementItem) {
  try {
    // 添加确认对话框
    Modal.confirm({
      content: `您确定要向租户 [${row.tenantName}] 发送短信吗？`,
      onCancel() {
        message.info('已取消发送短信');
      },
      onOk: async () => {
        message.loading({
          content: '正在获取租户信息...',
          duration: 0,
          key: 'sms_process_msg',
        });

        // 获取租户短信信息
        const smsInfo = await getTenantSmsInfo(row.rentalTenantId);

        message.loading({
          content: '正在发送短信...',
          duration: 0,
          key: 'sms_process_msg',
        });

        // 发送短信
        await sendSms({
          contractEndDate: smsInfo.contractEndDate,
          increaseDate: smsInfo.increaseDate,
          phoneNumber: smsInfo.phoneNumber,
          rentalTenantId: row.rentalTenantId, // 将rentalTenantId改为id以匹配API接口定义
          tenantName: smsInfo.tenantName,
        });

        message.success({
          content: `短信已成功发送给 ${row.tenantName}`,
          key: 'sms_process_msg',
        });

        // 刷新表格数据以显示最新的发送时间
        refreshGrid();
      },
      title: '发送短信确认',
    });
  } catch (error) {
    console.error('发送短信失败:', error);
    message.error({
      content: `发送短信失败: ${(error as Error).message || '未知错误'}`,
      key: 'sms_process_msg',
    });
  }
}

/**
 * 刷新表格数据
 */
function refreshGrid() {
  gridApi.query();
}

/**
 * 批量发送短信
 */
async function onBulkSendSms() {
  try {
    // 添加确认对话框
    Modal.confirm({
      content: `
        
          系统将自动筛选符合以下条件的租户发送短信：
          合同状态为生效中,合同截止日期少于90天或下次递增时间少于30天,您确定要继续吗？
        
      `,
      onCancel() {
        message.info('已取消发送');
      },
      onOk: async () => {
        message.loading({
          content: '正在筛选符合条件的租户并发送短信...',
          duration: 0,
          key: 'bulk_sms_process_msg',
        });

        try {
          // 调用批量发送短信的API
          const result = await sendBulkSms();
          const summary = result?.data ?? result ?? {};
          const total = Number(summary.total ?? 0);
          const success = Number(summary.success ?? 0);
          const failed = Number(summary.failed ?? 0);
          const errors = Array.isArray(summary.errors) ? summary.errors : [];

          // 显示详细的发送结果
          if (total === 0) {
            message.info({
              content: '没有符合条件的租户需要发送短信',
              key: 'bulk_sms_process_msg',
            });
          } else {
            message.success({
              content: `批量发送完成！共筛选 ${total} 个租户，成功发送 ${success} 条，失败 ${failed} 条`,
              duration: 6,
              key: 'bulk_sms_process_msg',
            });

            // 如果有失败的，显示详细信息
            if (failed > 0 && errors.length > 0) {
              console.warn('发送失败的租户:', errors);
              Modal.warning({
                content: `有 ${failed} 条短信发送失败，请查看控制台了解详情`,
                title: '部分短信发送失败',
              });
            }
          }

          // 刷新表格数据以显示可能更新的状态
          refreshGrid();
        } catch (apiError) {
          console.error('批量发送短信API调用失败:', apiError);
          message.error({
            content: `批量发送短信失败: ${(apiError as Error).message || '未知错误'}`,
            key: 'bulk_sms_process_msg',
          });
        }
      },
      title: '批量发送短信确认',
      width: 500,
    });
  } catch (error) {
    console.error('批量发送短信失败:', error);
    message.error({
      content: `批量发送短信失败: ${(error as Error).message || '未知错误'}`,
      key: 'bulk_sms_process_msg',
    });
  }
}
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="refreshGrid" />
    <Grid :table-title="$t('system.rental.tenant.list')">
      <template #toolbar-tools>
        <Button v-if="isSuperUser" danger class="mr-2" @click="onClearTenants">
          一键清空
        </Button>
        <Button class="mr-2" type="primary" @click="onBulkSendSms">
          <MessageOutlined class="mr-1" />
          一键发送短信
        </Button>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.rental.tenant.item')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
