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
    address: '东莞',
    contact: '张先生 13800138000',
    createTime: '2021-04-01',
    firestatus: '正常',
    id: 1,
    passagewaytag: '正常',
    price: '2000元/月',
    safetychanneltag: '正常',
    tag: '空闲',
    title: '东莞厂房A',
    updateTime: '2021-04-01',
  },
  {
    address: '深圳',
    area: '150平方米',
    contact: '李女士 13900139000',
    createTime: '2021-04-02',
    firestatus: '异常',
    id: 2,
    passagewaytag: '维护',
    price: '3000元/月',
    safetychanneltag: '正常',
    tag: '维护',
    title: '深圳厂房B',
    updateTime: '2021-04-02',
  },
  {
    address: '广州',
    area: '100平方米',
    contact: '王先生 13700137000',
    createTime: '2021-04-03',
    firestatus: '正常',
    id: 3,
    passagewaytag: '正常',
    price: '1800元/月',
    safetychanneltag: '异常',
    tag: '空闲',
    title: '广州厂房C',
    updateTime: '2021-04-03',
  },
  {
    address: '深圳',
    area: '130平方米',
    contact: '刘女士 13600136000',
    createTime: '2021-04-04',
    firestatus: '维护',
    id: 4,
    passagewaytag: '异常',
    price: '2500元/月',
    safetychanneltag: '维护',
    tag: '维护',
    title: '深圳厂房D',
    updateTime: '2021-04-04',
  },
  {
    address: '广州',
    area: '160平方米',
    contact: '赵先生 13500135000',
    createTime: '2021-04-05',
    firestatus: '正常',
    id: 5,
    passagewaytag: '正常',
    price: '3200元/月',
    safetychanneltag: '正常',
    tag: '已租',
    title: '广州厂房E',
    updateTime: '2021-04-05',
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
          {{ $t('ui.actionTitle.create', [$t('维护记录')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
