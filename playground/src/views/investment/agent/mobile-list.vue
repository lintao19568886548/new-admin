<script lang="ts" setup>
import type { InvestmentAgent } from './data';

import {
  computed,
  createApp,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
} from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import { MoreOutlined } from '@ant-design/icons-vue';
import {
  Button,
  Card,
  Flex,
  Image,
  List,
  message,
  Popover,
  Tag,
  TypographyText,
} from 'ant-design-vue';

import { deleteInvestment, getInvestmentList } from '#/api/investment';
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import { getTagTypeOptions } from './data'; // 引入获取标签颜色函数
import Form from './modules/form.vue';

const currentPark = ref();
const parkSelectorRef = ref();
const loading = ref(false);
const investmentList = ref<InvestmentAgent[]>([]);
const pagination = ref({
  currentPage: 1,
  pageSize: 10, // 移动端每页数量可以少一些
  total: 0,
});

const tagTypeOptions = getTagTypeOptions();

const getTagColor = (value: string) => {
  const option = tagTypeOptions.find((opt) => opt.value === value);
  return option ? option.color : 'default';
};

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

function onEdit(row: InvestmentAgent) {
  const rowData = { ...row };
  rowData.meetingTime = String(formatDateTime(rowData.meetingTime));
  formModalApi.setData(rowData).open();
}

function onCreate() {
  formModalApi.setData(null).open();
}

async function onDelete(row: InvestmentAgent) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.agentName || '']),
    duration: 0,
    key: 'action_process_msg',
  });

  const { investmentId } = row;
  if (investmentId) {
    try {
      await deleteInvestment(investmentId);
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.tenantName || '']),
        key: 'action_process_msg',
      });
      fetchList();
    } catch (error) {
      console.error('删除投资项目失败:', error);
      message.error({
        content: $t('ui.actionMessage.operationFailed', [error]),
        key: 'action_process_msg',
      });
    }
  }
}

function onView(row: InvestmentAgent) {
  let imgList: string[] = [];
  if (Array.isArray(row.imageUrlList)) {
    imgList = row.imageUrlList;
  } else if (row.imageUrlList) {
    imgList = [row.imageUrlList];
  }

  if (imgList.length === 0) {
    message.info($t('page.agent.noImages'));
    return;
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
          imgList.map((src: string) =>
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

async function fetchList() {
  loading.value = true;
  const params = {
    currentPage: pagination.value.currentPage,
    currentPark: currentPark.value ? currentPark.value.parkId : -1,
    pageSize: pagination.value.pageSize,
    // 在这里可以添加来自 list.vue 的其他表单筛选参数，如果需要的话
    // 例如: agentName: searchForm.value.agentName, 等
  };
  try {
    const result = await getInvestmentList(params);
    investmentList.value = result.items || [];
    pagination.value.total = result.page?.total || 0;
  } catch (error) {
    console.error('获取投资项目列表失败:', error);
    message.error('获取投资项目列表失败');
    investmentList.value = [];
    pagination.value.total = 0;
  } finally {
    loading.value = false;
  }
}

function handleTableChange(page: number, pageSize: number) {
  pagination.value.currentPage = page;
  pagination.value.pageSize = pageSize;
  fetchList();
}

function refreshList() {
  pagination.value.currentPage = 1;
  fetchList();
}

onMounted(() => {
  fetchList();
});

// 计算属性，用于控制页面主体样式，模拟400x641的比例 (可选)
const pageStyle = computed(() => ({
  // maxWidth: '400px', // 控制最大宽度
  // margin: '0 auto', // 居中
  // border: '1px solid #eee', // 可选边框
  // overflowY: 'auto', // 内容超出时滚动
  // height: '641px' // 固定高度，如果需要模拟精确视口
}));
</script>

<template>
  <Page :style="pageStyle" class="mobile-investment-list-page">
    <FormModal @success="refreshList" />

    <template #header-content>
      <Flex
        justify="space-between"
        align="center"
        class="mb-2 rounded-md bg-white px-3 py-2 shadow-sm"
      >
        <AreaSelector
          :default-park="currentPark"
          :refresh-callback="refreshList"
          @change="
            (park) => {
              currentPark = park;
              refreshList();
            }
          "
          ref="parkSelectorRef"
          size="small"
        />
        <Button type="primary" size="small" @click="onCreate">
          <Plus class="size-4" />
          {{ $t('ui.actionTitle.createSimple') }}
        </Button>
      </Flex>
    </template>

    <div class="p-2">
      <List
        :data-source="investmentList"
        :loading="loading"
        :pagination="{
          current: pagination.currentPage,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: handleTableChange,
          size: 'small',
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
        }"
        item-layout="vertical"
        row-key="investmentId"
      >
        <template #renderItem="{ item }">
          <List.Item>
            <Card :title="item.agentName" size="small" class="mb-2 shadow-md">
              <template #extra>
                <Popover title="操作" trigger="click" placement="leftTop">
                  <template #content>
                    <Flex vertical gap="small">
                      <Button type="link" size="small" @click="onView(item)">
                        {{ $t('ui.action.view') }}
                      </Button>
                      <Button type="link" size="small" @click="onEdit(item)">
                        {{ $t('ui.action.edit') }}
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        danger
                        @click="onDelete(item)"
                      >
                        {{ $t('ui.action.delete') }}
                      </Button>
                    </Flex>
                  </template>
                  <Button type="text" size="small">
                    <MoreOutlined />
                  </Button>
                </Popover>
              </template>

              <Flex vertical gap="small">
                <div>
                  <TypographyText type="secondary">
                    {{ $t('page.tenant.name') }}:
                  </TypographyText>
                  <TypographyText>{{ item.tenantName }}</TypographyText>
                </div>
                <div>
                  <TypographyText type="secondary">
                    {{ $t('page.agent.intentLevel') }}:
                  </TypographyText>
                  <Tag :color="getTagColor(item.intentLevel)">
                    {{ item.intentLevel }}
                  </Tag>
                </div>
                <div>
                  <TypographyText type="secondary">
                    {{ $t('page.agent.intentArea') }}:
                  </TypographyText>
                  <TypographyText>{{ item.intentArea }} ㎡</TypographyText>
                </div>
                <div>
                  <TypographyText type="secondary">
                    {{ $t('page.agent.progress') }}:
                  </TypographyText>
                  <TypographyText>{{ item.progress }}</TypographyText>
                </div>
                <div>
                  <TypographyText type="secondary">
                    {{ $t('page.agent.phone') }}:
                  </TypographyText>
                  <TypographyText>{{ item.phoneNumber }}</TypographyText>
                </div>
                <div>
                  <TypographyText type="secondary">
                    {{ $t('page.common.date') }}:
                  </TypographyText>
                  <TypographyText>
                    {{ formatDateTime(item.meetingTime) }}
                  </TypographyText>
                </div>
                <div v-if="item.parkName">
                  <TypographyText type="secondary">
                    {{ $t('page.common.park') }}:
                  </TypographyText>
                  <TypographyText>{{ item.parkName }}</TypographyText>
                </div>
                <div v-if="item.remark">
                  <TypographyText type="secondary">
                    {{ $t('page.common.remark') }}:
                  </TypographyText>
                  <TypographyText>{{ item.remark }}</TypographyText>
                </div>
              </Flex>
            </Card>
          </List.Item>
        </template>
      </List>
    </div>
  </Page>
</template>

<style lang="less" scoped>
// 可以在这里添加特定于移动端的样式
.mobile-investment-list-page {
  // background-color: #f0f2f5; // 设置页面背景色

  // :deep(.ant-card-head) {
  //   padding: 0 12px;
  //   min-height: 38px;
  // }
  // :deep(.ant-card-body) {
  //   padding: 12px;
  // }
  // :deep(.ant-list-item) {
  //   padding: 8px 0;
  // }
  // :deep(.ant-list-pagination) {
  //   margin-top: 16px;
  //   padding: 0 8px; // 为分页器添加一些内边距
  // }
}
</style>
