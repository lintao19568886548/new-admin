<!-- eslint-disable jsdoc/check-param-names -->
<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import {
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  PhoneOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons-vue';
import {
  Form as AntForm,
  Button,
  Card,
  Drawer,
  Empty,
  Input,
  List,
  message,
  Popconfirm,
  Space,
} from 'ant-design-vue';

import { deleteSystemPark, getSystemParkList } from '#/api/system/park';
import MultiSelect from '#/components/MultiSelect.vue';
import { $t } from '#/locales';
import { useParkStore } from '#/store';

import Form from './modules/form.vue';

const router = useRouter();
const parkStore = useParkStore();
const formRef = ref();
const searchFormVisible = ref(false);
const loading = ref(false);
const parkList = ref([]);
const pagination = ref({
  current: 1,
  pageSize: 10,
  total: 0,
});

// 搜索表单数据
const formData = ref({
  address: '',
  area: ['equal', undefined, undefined],
  parkName: '',
});

const isLastPage = computed(
  () => parkList.value.length >= pagination.value.total,
);

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
function onDelete(row: { parkId: number; parkName: unknown }) {
  loading.value = true;
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.parkName]),
    duration: 0,
    key: 'action_process_msg',
  });

  deleteSystemPark(row.parkId)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.parkName]),
        key: 'action_process_msg',
      });

      // 删除成功后，强制刷新store中的园区列表
      parkStore.fetchParkList(true);

      fetchParkList();
    })
    .catch((error) => {
      console.error('删除租户失败:', error);
      message.error({
        content: $t('ui.actionMessage.deleteFailed', [row.parkName]),
        key: 'action_process_msg',
      });
    })
    .finally(() => {
      loading.value = false;
    });
}

/**
 * 查看租赁项目详情
 * @param row
 */
function onView(row: { parkId: any }) {
  // 可以跳转到详情页面
  router.push(`/rental/detail/${row.parkId}`);
}

/**
 * 获取园区列表数据
 */
async function fetchParkList(isLoadMore = false) {
  loading.value = true;
  try {
    // 准备查询参数
    const initialParams = { ...formData.value };
    const apiParams: Record<string, any> = {}; // Use a record for the final API params

    // 清理空值 and transform for API
    Object.keys(initialParams).forEach((key) => {
      const currentKey = key as keyof typeof initialParams;
      const value = initialParams[currentKey];

      // Only include non-empty values
      if (value !== undefined && value !== null && value !== '') {
        // eslint-disable-next-line unicorn/prefer-ternary
        if (currentKey === 'area' && Array.isArray(value)) {
          // Join the array into a comma-separated string for the API
          apiParams[currentKey] = value.join(',');
        } else {
          // Assign other valid values directly
          apiParams[currentKey] = value;
        }
      }
    });

    // 添加分页参数
    apiParams.currentPage = pagination.value.current;
    apiParams.pageSize = pagination.value.pageSize;

    // 调用API获取数据
    const result = await getSystemParkList(apiParams); // Pass the correctly typed object
    const newItems = (result.items ?? []) as typeof parkList.value;
    if (isLoadMore) {
      // 由于 parkList.value 的类型推断为 never[]，需要断言类型
      (parkList.value as any[]).push(...newItems);
    } else {
      parkList.value = newItems;
    }
    // 兼容后端返回结构，优先 result.total，其次 result.page?.total
    pagination.value.total = result.total ?? result.page?.total ?? 0;
  } catch (error) {
    console.error('获取租赁列表失败:', error);
    if (isLoadMore) {
      message.error('加载更多失败');
    } else {
      message.error($t('ui.error.fetchListFailed'));
      parkList.value = [];
      pagination.value.total = 0;
    }
  } finally {
    loading.value = false;
  }
}

/**
 * 加载更多数据
 */
function handleLoadMore() {
  if (isLastPage.value) {
    return;
  }
  pagination.value.current++;
  fetchParkList(true);
}

/**
 * 提交搜索表单
 */
function onSubmitSearch() {
  pagination.value.current = 1;
  fetchParkList();
  searchFormVisible.value = false;
}

/**
 * 重置搜索表单
 */
function onResetSearch() {
  formData.value = {
    address: '',
    area: ['equal', undefined, undefined],
    parkName: '',
  };
  pagination.value.current = 1;
  fetchParkList();
  searchFormVisible.value = false;
}

/**
 * 表单操作成功回调
 */
function onFormSuccess() {
  fetchParkList();
}

// 初始化时获取数据
onMounted(() => {
  fetchParkList();
});
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="onFormSuccess" />

    <div class="mobile-header">
      <div class="mobile-title">{{ $t('page.park.list') }}</div>
      <div class="mobile-actions">
        <Button type="primary" shape="circle" @click="searchFormVisible = true">
          <template #icon><SearchOutlined /></template>
        </Button>
        <Button type="primary" @click="onCreate" style="margin-left: 8px">
          <template #icon><Plus /></template>
          {{ $t('ui.actionTitle.create', [$t('page.park.item')]) }}
        </Button>
      </div>
    </div>

    <div class="mobile-content">
      <!-- Conditionally render Empty component if parkList is empty -->
      <Empty
        v-if="!parkList || parkList.length === 0"
        description="暂无数据，请尝试更换筛选条件"
        image="https://gw.alipayobjects.com/mdn/miniapp_social/afts/img/A*pevERLJC9v0AAAAAAAAAAABjAQAAAQ/original"
        class="mt-10"
      />
      <!-- Render List only if parkList has data -->
      <List
        v-else
        :loading="loading"
        :data-source="parkList"
        :pagination="false"
        item-layout="horizontal"
        class="park-list"
      >
        <!-- Removed <template #empty> here -->
        <template #renderItem="{ item }">
          <List.Item>
            <Card class="park-card" :bordered="false">
              <template #title>
                <div class="card-header">
                  <span class="park-name">{{ item.parkName }}</span>
                  <Space>
                    <Button
                      type="text"
                      shape="circle"
                      @click="onView(item)"
                      :aria-label="$t('ui.action.view')"
                    >
                      <template #icon><EyeOutlined /></template>
                    </Button>
                    <Button
                      type="text"
                      shape="circle"
                      @click="onEdit(item)"
                      :aria-label="$t('ui.action.edit')"
                    >
                      <template #icon><EditOutlined /></template>
                    </Button>
                    <Popconfirm
                      :title="
                        $t('ui.actionMessage.deleteConfirm', [item.parkName])
                      "
                      @confirm="onDelete(item)"
                    >
                      <Button
                        type="text"
                        shape="circle"
                        status="danger"
                        :aria-label="$t('ui.action.delete')"
                      >
                        <template #icon><DeleteOutlined /></template>
                      </Button>
                    </Popconfirm>
                  </Space>
                </div>
              </template>

              <div class="park-info">
                <div class="info-item">
                  <EnvironmentOutlined class="info-icon" />
                  <span>{{ item.address || '暂无地址' }}</span>
                </div>
                <div class="info-item">
                  <UserOutlined class="info-icon" />
                  <span>{{ item.manager || '暂无负责人' }}</span>
                </div>
                <div class="info-item">
                  <PhoneOutlined class="info-icon" />
                  <span>{{ item.contact || '暂无联系方式' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-icon-text">面积</span>
                  <span>{{ item.area || 'N/A' }} m²</span>
                </div>
              </div>
            </Card>
          </List.Item>
        </template>
      </List>

      <div class="load-more-container" v-if="parkList.length > 0">
        <Button
          @click="handleLoadMore"
          :loading="loading"
          :disabled="isLastPage"
          block
        >
          {{ isLastPage ? '没有更多了' : '加载更多' }}
        </Button>
      </div>
    </div>

    <!-- 搜索表单抽屉 -->
    <Drawer
      :title="$t('ui.search.title')"
      v-model:open="searchFormVisible"
      placement="right"
      @close="searchFormVisible = false"
      width="300px"
    >
      <AntForm layout="vertical" ref="formRef">
        <AntForm.Item :label="$t('page.park.name')">
          <Input v-model:value="formData.parkName" />
        </AntForm.Item>
        <AntForm.Item :label="$t('page.park.address')">
          <Input v-model:value="formData.address" />
        </AntForm.Item>
        <AntForm.Item :label="$t('page.park.area')">
          <MultiSelect v-model:value="formData.area" unit="m²" />
        </AntForm.Item>

        <div class="drawer-footer">
          <Space>
            <Button @click="onResetSearch">
              {{ $t('ui.button.reset') }}
            </Button>
            <Button type="primary" @click="onSubmitSearch">
              {{ $t('ui.button.search') }}
            </Button>
          </Space>
        </div>
      </AntForm>
    </Drawer>
  </Page>
</template>

<style scoped>
.mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.mobile-title {
  font-size: 18px;
  font-weight: 600;
}

.mobile-content {
  padding: 8px;
}

.park-list {
  /* margin-bottom: 16px; */
}

:deep(.ant-list-item) {
  padding: 8px 0 !important;
  border: none !important;
}

.park-card {
  width: 100%;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 9%);
}

:deep(.ant-card-head) {
  min-height: auto;
  padding: 10px 16px;
  font-size: 16px;
}

:deep(.ant-card-body) {
  padding: 12px 16px;
}

.card-header {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
}

.park-name {
  overflow: hidden;
  font-size: 16px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.park-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  font-size: 14px;
  color: #555;
}

.info-item {
  display: flex;
  gap: 8px;
  align-items: center;
  overflow: hidden;
}

.info-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-icon {
  font-size: 16px;
  color: #888;
}

.info-icon-text {
  display: inline-block;
  width: 16px;
  height: 16px;
  font-size: 12px;
  line-height: 16px;
  color: #888;
  text-align: center;
}

.load-more-container {
  padding: 16px 0;
}

.drawer-footer {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 100%;
  padding: 10px 16px;
  text-align: right;
  background: #fff;
  border-top: 1px solid #f0f0f0;
}
</style>
