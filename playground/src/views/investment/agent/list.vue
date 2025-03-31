<script lang="ts" setup>
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
function onEdit(row: any) {
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
function onDelete(row: any) {
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
function onView(row: any) {
  // 可以跳转到详情页面
  window.open(`/rental/detail/${row.id}`, '_blank');
}

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({ code, row }: OnActionClickParams) {
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
    agentName: '张三',
    id: 1,
    intentArea: '东莞市长安镇',
    intentLevel: '高',
    phone: '13800138000',
    progress: '初步接洽',
    remark: '客户对A区域写字楼很感兴趣',
    tenantName: '东莞科技有限公司',
    transactionTime: '2023-01-15 14:30:00',
  },
  {
    agentName: '李四',
    id: 2,
    intentArea: '广州市天河区',
    intentLevel: '中',
    phone: '13900139000',
    progress: '深入沟通',
    remark: '需要进一步了解租金详情',
    tenantName: '广州贸易有限公司',
    transactionTime: '2023-02-20 10:15:00',
  },
  {
    agentName: '王五',
    id: 3,
    intentArea: '深圳市南山区',
    intentLevel: '高',
    phone: '13700137000',
    progress: '合同准备',
    remark: '已确认租赁意向，准备签约',
    tenantName: '深圳科技创新有限公司',
    transactionTime: '2023-03-05 16:45:00',
  },
  {
    agentName: '赵六',
    id: 4,
    intentArea: '佛山市禅城区',
    intentLevel: '低',
    phone: '13600136000',
    progress: '初步接洽',
    remark: '对价格有顾虑，需要再考虑',
    tenantName: '佛山制造有限公司',
    transactionTime: '2023-04-10 09:30:00',
  },
  {
    agentName: '钱七',
    id: 5,
    intentArea: '珠海市香洲区',
    intentLevel: '中',
    phone: '13500135000',
    progress: '签约完成',
    remark: '已完成签约，准备入驻',
    tenantName: '珠海旅游发展有限公司',
    transactionTime: '2023-05-25 11:20:00',
  },
];

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
    <Grid :table-title="$t('page.agent.list')">
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
          {{ $t('ui.actionTitle.create', [$t('system.rental.tenant.item')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
