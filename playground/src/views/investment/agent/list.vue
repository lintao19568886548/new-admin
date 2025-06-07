<script lang="ts" setup>
import type { InvestmentAgent } from './data'; // 导入 InvestmentAgent 接口

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { createApp, h, nextTick, onMounted, onUnmounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import { Button, Image, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteInvestment, getInvestmentList } from '#/api/investment';
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const currentPark = ref();
const parkSelectorRef = ref();

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

/**
 * 编辑租赁项目
 * @param row
 */
function onEdit(row: InvestmentAgent) {
  const rowData = { ...row };
  rowData.meetingTime = String(formatDateTime(rowData.meetingTime));
  formModalApi.setData(rowData).open();
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
async function onDelete(row: InvestmentAgent) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.agentName || '']), // 使用 agentName 或其他合适字段
    duration: 0,
    key: 'action_process_msg',
  });

  const { investmentId } = row;
  if (investmentId) {
    try {
      await deleteInvestment(investmentId);
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.tenantName || '']), // 使用 tenantName
        key: 'action_process_msg',
      });
      refreshGrid();
    } catch (error) {
      console.error('删除投资项目失败:', error); // 修正错误消息
      message.error({
        content: $t('ui.actionMessage.operationFailed', [error]),
        key: 'action_process_msg',
      });
    }
  }
}

/**
 * 查看租赁项目详情
 * @param row
 */
function onView(row: InvestmentAgent) {
  let imgList: string[] = [];
  if (Array.isArray(row.imageUrlList)) {
    imgList = row.imageUrlList;
  } else if (row.imageUrlList) {
    imgList = [row.imageUrlList];
  }

  const previewContainer = document.createElement('div');
  document.body.append(previewContainer);

  const previewApp = createApp({
    setup() {
      const visible = ref(false);

      onUnmounted(() => {
        if (document.body.contains(previewContainer)) {
          previewContainer.remove();
        }
      });

      onMounted(() => {
        nextTick(() => {
          visible.value = true;
        });
      });

      return () =>
        h(
          Image.PreviewGroup,
          {
            preview: {
              onVisibleChange: (v) => {
                visible.value = v;
                if (!v) {
                  setTimeout(() => {
                    previewApp.unmount();
                  }, 200);
                }
              },
              visible: visible.value,
            },
          },
          imgList.map(
            (
              src: string, // 将 any 替换为 string
            ) =>
              h(Image, {
                preview: {},
                src,
                style: { display: 'none' },
              }),
          ),
        );
    },
  });

  previewApp.mount(previewContainer);
}

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({ code, row }: OnActionClickParams<InvestmentAgent>) {
  // 使用 InvestmentAgent
  switch (code) {
    case 'delete': {
      onDelete(row);
      break;
    }
    case 'edit': {
      onEdit(row);
      break;
    }
    case '查看': {
      onView(row);
      break;
    }
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    fieldMappingTime: [['meetingTime', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
  },
  gridOptions: {
    border: true,
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async (page) => {
          const formData = (await gridApi.formApi?.getValues?.()) || {};

          const params = {
            ...formData,
            currentPage: page.page?.currentPage || 1,
            currentPark: currentPark.value ? currentPark.value.parkId : -1,
            pageSize: page.page?.pageSize || 20,
          };
          try {
            const result = await getInvestmentList(params);
            return {
              ...result,
            };
          } catch (error) {
            console.error('获取投资项目列表失败:', error); // 修正错误消息
            message.error('获取投资项目列表失败'); // 修正错误消息
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
      keyField: 'investmentId', // 更新为 investmentId
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
