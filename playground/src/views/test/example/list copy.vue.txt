<script lang="ts" setup>
import type { FinanceItem } from './types';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteFinance, getFinanceList } from '#/api/finance';
import AreaSelector from '#/components/AreaSelector.vue';
import { usePlatform } from '#/hooks/usePlatform';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

// 在 setup 作用域定义 isNativePlatform，并直接通过 Capacitor.isNativePlatform() 初始化 // 这行将被移除
// 这样可以确保在 useVbenVxeGrid 读取配置之前，isNativePlatform 的值是准确的 // 这行将被移除
// const isNativePlatform = ref(Capacitor.isNativePlatform()); // 移除此行

// 使用 usePlatform Hook 获取平台信息
const { isNativePlatform } = usePlatform(); // 新增此行

/**
 * @function onMounted
 * @description 组件挂载后执行的生命周期钩子函数。
 *              主要用于执行一些需要在 DOM 挂载后进行的操作，例如日志记录。
 *              平台的判断已通过 usePlatform Hook 在 setup 顶层完成。
 */
// onMounted(() => {
//   // 平台信息已在 setup 阶段通过 usePlatform Hook 初始化，此处主要用于调试日志
//   console.warn(
//     '当前平台是否为原生 (onMounted, value from usePlatform):',
//     isNativePlatform.value,
//   ); // 用于调试输出

//   // 可选: 获取具体平台名称 (例如 'ios', 'android')
//   if (isNativePlatform.value) {
//     // const platformName = Capacitor.getPlatform(); // 此行不再需要，platformName 已从 usePlatform 获取
//     console.warn('原生平台名称 (from usePlatform):', platformName.value); // 用于调试输出
//   }
// });

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

// 当前选中的区域
const currentPark = ref();
const parkSelectorRef = ref();

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
    // 添加分页配置
    pagerConfig: {
      enabled: true,
      pageSize: 20,
      pageSizes: [10, 20, 30, 50, 100],
    },
    proxyConfig: {
      ajax: {
        query: async (page) => {
          try {
            // 直接从formApi获取表单数据
            const params = (await gridApi.formApi?.getValues?.()) || {};

            // 处理日期范围
            if (params.startTime && params.endTime) {
              params.startTime = `${params.startTime} 00:00:00`;
              params.endTime = `${params.endTime} 23:59:59`;
            }

            // 处理金额查询
            if (params.amount !== undefined && params.amount !== null) {
              const amountStr = String(params.amount);
              if (
                amountStr.includes('>') ||
                amountStr.includes('<') ||
                amountStr.includes('-')
              ) {
                params.amount = amountStr;
              }
            }

            // 添加区域参数
            params.currentPark = currentPark.value
              ? currentPark.value.parkId
              : -1;

            // 添加分页参数
            const currentPage = page.page?.currentPage || 1;
            const pageSize = page.page?.pageSize || 20;

            params.currentPage = currentPage;
            params.pageSize = pageSize;

            console.warn('处理后的查询参数:', params);

            // 参数序列化处理（从finance.ts移过来）
            const cleanParams = {};
            Object.entries(params).forEach(([key, value]) => {
              if (value !== null && value !== undefined && value !== '') {
                (cleanParams as Record<string, any>)[key] = value;
              }
            });

            // 调用API获取数据
            const response = await getFinanceList(cleanParams);

            // 确保返回的数据格式一致（从finance.ts移过来）
            // 使用三元表达式替代if-else语句
            const result =
              response && !response.items
                ? {
                    currentPage: params.currentPage || 1,
                    pageSize: params.pageSize || 20,
                    total: Array.isArray(response) ? response.length : 0,
                    items: Array.isArray(response) ? response : [],
                  }
                : response;

            // 返回格式化后的数据，包含分页信息
            return {
              ...result,
            };
          } catch (error) {
            console.error('获取财务数据失败:', error);
            message.error('获取账单列表失败');
            return {
              page: {
                currentPage: 1,
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
    // 添加滚动配置
    scrollX: {
      enabled: true,
    },
    scrollY: {
      enabled: true,
    },
    showOverflow: true,
    toolbarConfig: {
      custom: true,
      // 根据平台动态配置 refresh 和 zoom 按钮
      // 如果不是原生平台 (即网页端)，则启用刷新按钮，并指定其行为代码为 'query'
      // 如果是原生平台，则禁用刷新按钮 (设置为 false)
      refresh: true, // .value ? false : { code: 'query' },
      search: !isNativePlatform.value,
      // 如果不是原生平台 (即网页端)，则启用缩放按钮
      // 如果是原生平台，则禁用缩放按钮 (设置为 false)
      zoom: !isNativePlatform.value,
    },
  } as VxeTableGridOptions<FinanceItem>,
});

function onActionClick(e: OnActionClickParams<FinanceItem>) {
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

function onEdit(row: FinanceItem) {
  // 复制行数据以避免修改原始数据
  const editData = { ...row };

  if (editData.transactionTime) {
    editData.transactionTime = formatDateTime(
      editData.transactionTime,
    ) as string;
  }

  formModalApi.setData(editData).open();
}

function onDelete(row: FinanceItem) {
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
      console.warn('刷新表格数据');
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
          :default-area="currentPark"
          :refresh-callback="onRefresh"
          @change="(area) => (currentPark = area)"
          ref="parkSelectorRef"
        />
      </template>
      <template #toolbar-tools>
        <!-- 网页端按钮样式 -->
        <Button v-if="!isNativePlatform" type="primary" @click="onCreate">
          <Plus class="mr-1 size-5" />
          <!-- 稍微调整图标和文字间距 -->
          {{ $t('ui.actionTitle.create', [$t('page.finance.name')]) }}
        </Button>
        <!-- 原生移动端按钮样式 (圆形) -->
        <Button v-else type="primary" shape="circle" @click="onCreate">
          <Plus class="size-5" />
        </Button>
      </template>
    </Grid>
  </Page>
</template>
