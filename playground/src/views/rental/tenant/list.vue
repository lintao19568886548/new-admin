<script lang="ts" setup>
import type { RentalManagementItem } from './types';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteTenant,
  getTenantList,
  getTenantSmsInfo,
  sendSms,
} from '#/api/rental';
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

// 当前选中的区域
const currentPark = ref();

const parkSelectorRef = ref();

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
            // 直接从formApi获取表单数据
            const formValues = (await gridApi.formApi?.getValues?.()) || {};

            // 清理表单数据，移除空值
            const params: Record<string, any> = {}; // 添加类型声明
            Object.keys(formValues).forEach((key) => {
              if (
                formValues[key] !== undefined &&
                formValues[key] !== null &&
                formValues[key] !== ''
              ) {
                params[key] = formValues[key];
              }
            });

            params.currentPark = currentPark.value
              ? currentPark.value.parkId
              : -1;

            // 添加分页参数
            params.currentPage = page?.currentPage || 1;
            params.pageSize = page?.pageSize || 20;

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
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="refreshGrid" />
    <Grid :table-title="$t('system.rental.tenant.list')">
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
          {{ $t('ui.actionTitle.create', [$t('system.rental.tenant.item')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
