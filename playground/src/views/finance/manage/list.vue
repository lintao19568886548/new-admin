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

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteFinance, getFinanceList } from '#/api/finance';
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

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    fieldMappingTime: [['transactionTime', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
    submitOnChange: false, // 修改为false，不再自动提交
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async () => {
          try {
            // 直接从formApi获取表单数据
            const params = (await gridApi.formApi?.getValues?.()) || {};

            // 处理日期范围
            if (params.startTime && params.endTime) {
              params.startTime = `${params.startTime} 00:00:00`;
              params.endTime = `${params.endTime} 23:59:59`;
            }

            // 添加区域参数
            if (currentArea.value && currentArea.value.key !== 'all') {
              params.area = currentArea.value.key;
            }

            console.warn('处理后的查询参数:', params);

            // 添加错误处理
            const financeList = (await getFinanceList(params)) || [];
            console.warn('获取到的财务数据:', financeList);

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
      keyField: 'financeId', // 使用financeId作为主键
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
  Modal.confirm({
    cancelText: $t('common.no'),
    content: $t('ui.actionMessage.deleteConfirm', [row.billName]),
    okText: $t('common.yes'),
    okType: 'danger',
    async onOk() {
      try {
        const hideLoading = message.loading({
          content: $t('ui.actionMessage.deleting', [row.billName]),
          duration: 0,
          key: 'action_process_msg',
        });

        await deleteFinance(row.financeId);

        // 手动关闭加载提示
        hideLoading();

        message.success({
          content: $t('ui.actionMessage.deleteSuccess', [row.billName]),
          key: 'action_process_msg',
        });
        onRefresh();
      } catch (error) {
        console.error('删除失败:', error);
        message.error({
          content: $t('ui.actionMessage.deleteFailed', [row.billName]),
          key: 'action_process_msg',
        });
      }
    },
    title: $t('ui.actionTitle.delete', [row.billName]),
  });
}

function onRefresh() {
  // 直接从formApi获取最新表单数据并传递给query方法
  gridApi.formApi
    .getValues()
    .then((formValues) => {
      gridApi.query({
        form: formValues || {},
      });
    })
    .catch((error) => {
      console.error('获取表单数据失败:', error);
      // 出错时使用空对象查询
      gridApi.query({
        form: {},
      });
    });
}

function onCreate() {
  formModalApi.setData({}).open();
}

// 修改搜索函数，添加参数类型定义
// 修改搜索函数，正确处理搜索事件参数
function onSearch(params: any) {
  console.warn('触发搜索，原始参数:', params);

  // 检查参数格式
  let searchParams = params;

  // 如果params是事件对象，尝试从中提取表单数据
  if (params && params.form) {
    searchParams = params.form;
  } else if (params && params.$event && params.$event.form) {
    searchParams = params.$event.form;
  } else if (params && params.data) {
    // vxe-table可能将表单数据放在data属性中
    searchParams = params.data;
  } else if (!params || typeof params !== 'object') {
    // 如果没有有效参数，则使用空对象
    searchParams = {};
  }

  console.warn('处理后的搜索参数对象:', searchParams);

  // 清理空值参数
  const cleanParams: Record<string, any> = {};
  if (searchParams && typeof searchParams === 'object') {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== null && value !== undefined && value !== '') {
        cleanParams[key] = value;
      }
    }
  }

  console.warn('清理后的搜索参数:', cleanParams);

  // 使用表单数据进行查询
  gridApi.query({
    form: cleanParams,
  });
}
</script>
<template>
  <Page auto-content-height>
    <FormModal @success="onRefresh" />
    <Grid
      :table-title="$t('page.finance.list-title')"
      @search="onSearch"
      @form-submit="onSearch"
    >
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
