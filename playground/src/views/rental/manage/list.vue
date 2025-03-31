<script lang="ts" setup>
import type { RentalManagementItem } from './types';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { Area } from '#/components/AreaSelector.vue';

import { ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

/**
 * 编辑租赁项目
 * @param row
 */
function onEdit(row: RentalManagementItem) {
  formModalApi.setData(row).open();
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
function onDelete(row: RentalManagementItem) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.title]),
    duration: 0,
    key: 'action_process_msg',
  });

  // 模拟API请求
  setTimeout(() => {
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.title]),
      key: 'action_process_msg',
    });
    refreshGrid();
  }, 1000);
}

/**
 * 查看租赁项目详情
 * @param row
 */
function onView(row: RentalManagementItem) {
  // 可以跳转到详情页面
  window.open(`/rental/detail/${row.id}`, '_blank');
}

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({
  code,
  row,
}: OnActionClickParams<RentalManagementItem>) {
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
    refreshGrid();
  }, 500);
}

// 模拟的数据
const rentalItems = [
  {
    address: '双福工业园A区',
    area: '2500m²',
    availableArea: '1500m²',
    contact: '张经理 13800138000',
    createTime: '2023-04-01',
    id: 1,
    price: '100元/m²/月',
    title: '双福工业园A区厂房',
    updateTime: '2023-04-01',
  },
  {
    address: '高新区科技路100号',
    area: '3000m²',
    availableArea: '2000m²',
    contact: '李经理 13900139000',
    createTime: '2023-04-02',
    id: 2,
    price: '120元/m²/月',
    title: '高新区标准厂房',
    updateTime: '2023-04-02',
  },
  {
    address: '临港新区海港路123号',
    area: '4000m²',
    availableArea: '3000m²',
    contact: '王主管 13700137000',
    createTime: '2023-04-03',
    id: 3,
    price: '100元/m²/月',
    title: '临港新区厂房',
    updateTime: '2023-04-03',
  },
  {
    address: '科技园区创新路456号',
    area: '3600m²',
    availableArea: '1200m²',
    contact: '赵总监 13600136000',
    createTime: '2023-04-04',
    id: 4,
    price: '110元/m²/月',
    title: '科技园区厂房',
    updateTime: '2023-04-04',
  },
  {
    address: '经济开发区产业路789号',
    area: '5000m²',
    availableArea: '2000m²',
    contact: '刘经理 13500135000',
    createTime: '2023-04-05',
    id: 5,
    price: '100元/m²/月',
    title: '经济开发区厂房',
    updateTime: '2023-04-05',
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
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
          // 模拟API请求返回数据
          return {
            page: {
              pageSize: 20,
              total: rentalItems.length,
            },
            items: rentalItems,
          };
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
    <Grid :table-title="$t('system.rental.list')">
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
          {{ $t('ui.actionTitle.create', [$t('system.rental.name')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
