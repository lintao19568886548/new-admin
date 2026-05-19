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

import { BulbOutlined, EnvironmentOutlined } from '@ant-design/icons-vue';
import { Button, Input, message, Modal, Space, Table } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteInvestment,
  getInvestmentList,
  getInvestmentParkList,
} from '#/api/investment';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import { useSmartRecommend } from './modules/recommend-fab.vue';

const parkNameMap = ref<Record<number, string>>({});
const {
  closeManualLocationModal,
  closeRecommendModal,
  manualAddress,
  manualLocationModalVisible,
  nearbyParks,
  onSmartRecommend,
  recommendLoading,
  recommendModalVisible,
  searchByManualAddress,
} = useSmartRecommend({
  telFallback: '暂无电话',
});

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
          'div',
          {
            preview: {
              onVisibleChange: (v: boolean) => {
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
              h(Image as any, {
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
    align: 'center',
    border: true,
    columns: useColumns(onActionClick),
    headerAlign: 'center',
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async (page) => {
          const formData = (await gridApi.formApi?.getValues?.()) || {};

          const params = {
            ...formData,
            currentPage: page.page?.currentPage || 1,
            currentPark: formData.parkId ?? -1,
            pageSize: page.page?.pageSize || 20,
          };
          try {
            const result = await getInvestmentList(params);
            const items = Array.isArray(result?.items) ? result.items : [];
            const normalizedItems = items.map((item: any) => {
              const n = String(item?.parkName || '').trim();
              if (n) return item;
              const id = item?.parkId;
              if (typeof id === 'number') {
                return { ...item, parkName: parkNameMap.value[id] };
              }
              return item;
            });
            return {
              ...result,
              items: normalizedItems,
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

onMounted(() => {
  getInvestmentParkList()
    .then((list: any[]) => {
      if (!Array.isArray(list)) return;
      parkNameMap.value = Object.fromEntries(
        list.map((p: any) => [Number(p.parkId), String(p.parkName)]),
      );
      refreshGrid();
    })
    .catch(() => {
      parkNameMap.value = {};
    });
});

/**
 * 推荐表格列配置
 */
const recommendColumns = [
  {
    dataIndex: 'name',
    key: 'name',
    title: '工厂名称',
    width: 200,
  },
  {
    dataIndex: 'address',
    ellipsis: true,
    key: 'address',
    title: '地址',
  },
  {
    customRender: ({ text }: { text: string }) => `${text}m`,
    dataIndex: 'distance',
    key: 'distance',
    title: '距离',
    width: 100,
  },
  {
    dataIndex: 'tel',
    key: 'tel',
    title: '联系电话',
    width: 120,
  },
  {
    customRender: ({ record }: { record: any }) => {
      return h(Space, {}, [
        h(
          Button,
          {
            onClick: () => {
              // 可以在这里添加选择工厂的逻辑
              message.success(`已选择工厂: ${record.name}`);
              closeRecommendModal();
            },
            size: 'small',
            type: 'link',
          },
          '选择',
        ),
      ]);
    },
    key: 'action',
    title: '操作',
    width: 100,
  },
];
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="refreshGrid" />
    <Grid :table-title="$t('page.agent.list')">
      <template #toolbar-tools>
        <Space>
          <Button
            type="default"
            :loading="recommendLoading"
            @click="onSmartRecommend"
          >
            <BulbOutlined class="size-4" />
            智能推荐
          </Button>
          <Button type="primary" @click="onCreate">
            <Plus class="size-5" />
            {{ $t('ui.actionTitle.create', [$t('system.rental.tenant.item')]) }}
          </Button>
        </Space>
      </template>
    </Grid>

    <!-- 智能推荐弹窗 -->
    <Modal
      v-model:open="recommendModalVisible"
      title="附近工厂推荐"
      width="800px"
      :footer="null"
      @cancel="closeRecommendModal"
    >
      <div class="mb-4 text-gray-600">
        <p>基于您的当前位置，为您推荐以下附近的工厂：</p>
      </div>

      <Table
        bordered
        class="agent-recommend-table"
        :columns="recommendColumns"
        :data-source="nearbyParks"
        :pagination="false"
        :scroll="{ y: 400 }"
        row-key="id"
        size="small"
      >
        <template #emptyText>
          <div class="py-8 text-center">
            <p class="text-gray-500">暂无附近工厂信息</p>
          </div>
        </template>
      </Table>

      <div class="mt-4 text-right">
        <Button @click="closeRecommendModal"> 关闭 </Button>
      </div>
    </Modal>

    <!-- 手动输入地址弹窗 -->
    <Modal
      v-model:open="manualLocationModalVisible"
      title="手动输入地址"
      width="500px"
      @cancel="closeManualLocationModal"
    >
      <div class="py-4">
        <div class="mb-4 text-gray-600">
          <p>请输入您要搜索的地址，系统将为您推荐附近的工厂：</p>
        </div>

        <div class="mb-4">
          <Input
            v-model:value="manualAddress"
            placeholder="请输入详细地址，如：北京市朝阳区建国路"
            size="large"
            @press-enter="searchByManualAddress"
          >
            <template #prefix>
              <EnvironmentOutlined class="text-gray-400" />
            </template>
          </Input>
        </div>

        <div class="text-sm text-gray-500">
          <p>提示：地址越详细，搜索结果越准确</p>
        </div>
      </div>

      <template #footer>
        <Space>
          <Button @click="closeManualLocationModal">取消</Button>
          <Button
            type="primary"
            :loading="recommendLoading"
            @click="searchByManualAddress"
          >
            搜索附近工厂
          </Button>
        </Space>
      </template>
    </Modal>
  </Page>
</template>

<style scoped>
.agent-recommend-table :deep(.ant-table-thead > tr > th) {
  font-size: 14px;
  font-weight: 600;
  color: var(--ant-color-text);
  text-align: center;
  vertical-align: middle;
}

.agent-recommend-table :deep(.ant-table-tbody > tr > td) {
  font-size: 14px;
  line-height: 22px;
  color: var(--ant-color-text);
  text-align: center;
  vertical-align: middle;
}
</style>
