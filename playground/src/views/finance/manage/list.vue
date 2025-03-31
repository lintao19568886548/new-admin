<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemFinanceApi } from '#/api';
import type { Area } from '#/components/AreaSelector.vue';

import { ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getFinanceList } from '#/api/finance';
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

// 区域列表
const areaList = [
  { key: 'all', name: '全部区域' },
  { key: 'east', name: '东莞' },
  { key: 'central', name: '广州' },
  { key: 'south', name: '深圳' },
  { key: 'north', name: '佛山' },
  { key: 'west', name: '珠海' },
];
// 当前选中的区域
const currentArea = ref(areaList[0]) as any;

const areaSelectorRef = ref();

function handleAreaChange(area: Area) {
  // 更新当前选中的区域
  currentArea.value = area;

  // 延迟关闭提示
  setTimeout(() => {
    message.success({
      content: `已切换到${area.name}`,
      duration: 2,
      key: 'area_change_msg',
    });
    // 刷新表格数据
    onRefresh();
  }, 500);
}

// // 模拟的财务数据
// const financeItems = [
//   {
//     amount: 5000,
//     billCategory: '房租',
//     billName: '5月房租',
//     id: '1',
//     transactionTime: '2023-05-01 10:00:00',
//     transactionType: '支出',
//   },
//   {
//     amount: 320.5,
//     billCategory: '水费',
//     billName: '4月水费',
//     id: '2',
//     transactionTime: '2023-04-25 14:30:00',
//     transactionType: '支出',
//   },
//   {
//     amount: 750.8,
//     billCategory: '电费',
//     billName: '4月电费',
//     id: '3',
//     transactionTime: '2023-04-26 09:15:00',
//     transactionType: '支出',
//   },
//   {
//     amount: 12_000,
//     billCategory: '房租',
//     billName: '厂房租赁收入',
//     id: '4',
//     transactionTime: '2023-05-05 11:20:00',
//     transactionType: '收入',
//   },
//   {
//     amount: 1500,
//     billCategory: '其他费用',
//     billName: '设备维修费',
//     id: '5',
//     transactionTime: '2023-05-10 16:45:00',
//     transactionType: '支出',
//   },
//   {
//     amount: 420.3,
//     billCategory: '燃气费',
//     billName: '燃气费',
//     id: '6',
//     transactionTime: '2023-05-12 10:30:00',
//     transactionType: '支出',
//   },
// ];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    fieldMappingTime: [['transactionTime', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async () => {
          try {
            // 添加错误处理
            const financeList = (await getFinanceList()) || [];

            return {
              page: {
                pageSize: 20,
                total: financeList.length,
              },
              items: financeList,
            };
          } catch (error) {
            console.error('获取财务数据失败:', error);
            return {
              page: {
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
      keyField: 'financeId', // 确保这里与后端返回的字段名一致
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SystemFinanceApi.SystemFinance>,
});

function onActionClick(e: OnActionClickParams<SystemFinanceApi.SystemFinance>) {
  switch (e.code) {
    case 'delete': {
      onDelete(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
  }
}

function onEdit(row: SystemFinanceApi.SystemFinance) {
  formModalApi.setData(row).open();
}

function onDelete(row: SystemFinanceApi.SystemFinance) {
  // const hideLoading = message.loading({
  //   content: $t('ui.actionMessage.deleting', [row.billName]),
  //   duration: 0,
  //   key: 'action_process_msg',
  // });
  // 模拟删除操作
  setTimeout(() => {
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.billName]),
      key: 'action_process_msg',
    });
    onRefresh();
  }, 1000);
}

function onRefresh() {
  gridApi.query();
}

function onCreate() {
  formModalApi.setData({}).open();
}
</script>
<template>
  <Page auto-content-height>
    <FormModal @success="onRefresh" />
    <Grid :table-title="$t('page.finance.list-title')">
      <template #toolbar-actions>
        <!-- 区域选择下拉菜单 -->
        <AreaSelector
          :area-list="areaList"
          :default-area="currentArea"
          @change="handleAreaChange"
          ref="areaSelectorRef"
        />
      </template>
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('page.finance.name')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
