<script lang="ts" setup>
import type { RentalManagementItem } from './types';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
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

// 模拟的数据
const rentalItems = [
  {
    address: '北京市朝阳区建国路888888号',
    contact: '张先生 13800138000',
    createTime: '2021-04-01',
    firestatus: '',
    id: 1,
    price: '2000元/月',
    tag: '空闲',
    title: 'Github',
    updateTime: '2021-04-01',
  },
  {
    address: '上海市徐汇区淮海路100号',
    area: '150平方米',
    contact: '李女士 13900139000',
    createTime: '2021-04-02',
    id: 2,
    price: '3000元/月',
    tag: '维护',
    title: 'Vue',
    updateTime: '2021-04-02',
  },
  {
    address: '广州市天河区体育西路123号',
    area: '100平方米',
    contact: '王先生 13700137000',
    createTime: '2021-04-03',
    id: 3,
    price: '1800元/月',
    tag: '空闲',
    title: 'Html5',
    updateTime: '2021-04-03',
  },
  {
    address: '深圳市南山区科技园456号',
    area: '130平方米',
    contact: '刘女士 13600136000',
    createTime: '2021-04-04',
    id: 4,
    price: '2500元/月',
    tag: '维护',
    title: 'Angular',
    updateTime: '2021-04-04',
  },
  {
    address: '成都市武侯区人民南路789号',
    area: '160平方米',
    contact: '赵先生 13500135000',
    createTime: '2021-04-05',
    id: 5,
    price: '3200元/月',
    tag: '已租',
    title: 'React',
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
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.rental.name')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
