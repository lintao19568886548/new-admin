<script lang="ts" setup>
import type { ElectricityBill } from './data';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { ChevronDown, Plus } from '@vben/icons';

import { Button, Dropdown, Menu, message } from 'ant-design-vue';
import dayjs, { Dayjs } from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Detail from './modules/detail.vue';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [DetailModal, detailModalApi] = useVbenModal({
  cancelText: '关闭',
  connectedComponent: Detail,
  destroyOnClose: true,
  onCancel: () => {
    detailModalApi.close();
  },
});

/**
 * 编辑电费账单
 * @param row
 */
function onEdit(row: ElectricityBill) {
  formModalApi.setData(row).open();
}

/**
 * 创建新电费账单
 */
function onCreate() {
  const newBill: ElectricityBill = {
    companyName: '',
    electricityItems: [],
    id: 0,
    paymentTime: ref<Dayjs>(dayjs()),
    position: '',
    projectName: '',
  };
  formModalApi.setData(newBill).open();
}

/**
 * 删除电费账单
 * @param row
 */
function onDelete(row: ElectricityBill) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.companyName]),
    duration: 0,
    key: 'action_process_msg',
  });

  // 模拟API请求
  setTimeout(() => {
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.companyName]),
      key: 'action_process_msg',
    });
    refreshGrid();
  }, 1000);
}

/**
 * 查看电费账单详情
 * @param row
 */
function onView(row: ElectricityBill) {
  detailModalApi.setData(row).open();
}

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({ code, row }: OnActionClickParams<ElectricityBill>) {
  switch (code) {
    case 'delete': {
      onDelete(row);
      break;
    }
    case 'edit': {
      onEdit(row);
      break;
    }
    case 'view': {
      onView(row);
      break;
    }
  }
}

// 模拟的数据
const electricityBills: ElectricityBill[] = [
  {
    companyName: '示例公司一',
    electricityItems: [
      {
        actualUsage: 500,
        amount: 490,
        currentMonthReading: 5500,
        id: 1,
        key: '1',
        lastMonthReading: 5000,
        monthlyUsage: 500,
        multiplier: 1,
        name: '主楼电费',
        remark: '正常缴费',
        unitPrice: 0.98,
      },
      {
        actualUsage: 300,
        amount: 285,
        currentMonthReading: 3300,
        id: 2,
        key: '2',
        lastMonthReading: 3000,
        monthlyUsage: 300,
        multiplier: 1,
        name: '附楼电费',
        remark: '新增区域',
        unitPrice: 0.95,
      },
    ],
    id: 0,
    paymentTime: ref<Dayjs>(dayjs('2023-05-01')),
    position: '东莞',
    projectName: '项目A',
  },
  {
    companyName: '示例公司二',
    electricityItems: [
      {
        actualUsage: 1000,
        amount: 950,
        currentMonthReading: 2800,
        id: 3,
        key: '1',
        lastMonthReading: 2300,
        monthlyUsage: 500,
        multiplier: 2,
        name: '主楼电费',
        remark: '双倍计费',
        unitPrice: 0.95,
      },
    ],
    id: 0,
    paymentTime: ref<Dayjs>(dayjs('2023-05-02')),
    position: '广州',
    projectName: '项目B',
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    compact: true,
    schema: useGridFormSchema(),
    showCollapseButton: true,
    submitOnChange: true,
    wrapperClass: 'grid-cols-1 lg:grid-cols-3 gap-4',
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: '100%',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async () => {
          // 模拟API请求返回数据
          return {
            page: {
              pageSize: 20,
              total: electricityBills.length,
            },
            items: electricityBills,
          };
        },
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    scrollX: {
      enabled: true,
    },
    scrollY: {
      enabled: true,
    },
    showOverflow: true,
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
  <Page auto-content-height class="electricity-bill-page">
    <FormModal @success="refreshGrid" />
    <DetailModal />
    <Grid table-title="电费账单" class="electricity-bill-grid">
      <template #toolbar-actions>
        <Dropdown>
          <template #overlay>
            <Menu>
              <Menu.Item key="1" @click="() => {}"> 导出Excel </Menu.Item>
              <Menu.Item key="2" @click="() => {}"> 导出PDF </Menu.Item>
              <Menu.Item key="3" @click="() => {}"> 批量操作 </Menu.Item>
            </Menu>
          </template>
          <Button>
            更多操作
            <ChevronDown class="ml-1 size-4" />
          </Button>
        </Dropdown>
      </template>
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', ['电费账单']) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>

<style lang="less" scoped>
:deep(.electricity-bill-page) {
  width: 100%;
  display: flex;
  flex-direction: column;

  // 确保页面内容区域不会溢出
  .vben-page-content {
    overflow: hidden;
    width: 100%;
    height: 100%;
  }
}

// 解决表格溢出问题
:deep(.electricity-bill-grid) {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  // 搜索表单样式
  .vben-form-container {
    margin-bottom: 8px;
    width: 100%;
    overflow: visible;

    // 表单内容容器
    .vben-form-content {
      width: 100%;
      overflow: visible;
    }

    // 让表单内的输入框适应容器宽度
    .ant-input,
    .ant-input-number,
    .ant-picker {
      width: 100%;
    }

    // 处理日期范围选择器的宽度
    .ant-picker-range {
      max-width: 100%;
    }
  }

  .vxe-grid-wrapper {
    flex: 1;
    overflow: hidden;
    width: 100%;
    display: flex;
    flex-direction: column;
  }

  .vxe-grid {
    flex: 1;
    overflow: hidden;
    max-width: 100%;
  }

  .vxe-table--main-wrapper {
    width: 100%;
  }

  // 表格容器
  .vxe-table {
    height: 100%;
  }

  .vxe-table-box {
    overflow: hidden;
  }

  // 表头不滚动，内容可滚动
  .vxe-table--header-wrapper {
    overflow-x: hidden;
  }

  .vxe-table--body-wrapper {
    overflow: auto;
    flex: 1;
  }

  // 改善滚动条样式
  .vxe-table--header-wrapper,
  .vxe-table--body-wrapper {
    &::-webkit-scrollbar {
      height: 8px; // 横向滚动条高度
      width: 8px; // 纵向滚动条宽度
    }
    &::-webkit-scrollbar-thumb {
      background-color: #d9d9d9;
      border-radius: 4px;
    }
    &::-webkit-scrollbar-track {
      background-color: #f1f1f1;
    }
  }

  // 确保分页器不溢出
  .vxe-pager {
    width: 100%;
    overflow-x: auto;
  }
}
</style>
