<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { SearchOutlined } from '@ant-design/icons-vue';
import {
  Form as AntForm,
  Button,
  Card,
  Drawer,
  Empty,
  Input,
  List,
  message,
  Pagination,
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

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

/**
 * 编辑租赁项目
 * @param row
 */
function onEdit(row) {
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
function onDelete(row) {
  loading.value = true;
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.factoryName]),
    duration: 0,
    key: 'action_process_msg',
  });

  deleteSystemPark(row.parkId)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.factoryName]),
        key: 'action_process_msg',
      });

      // 删除成功后，强制刷新store中的园区列表
      parkStore.fetchParkList(true);

      fetchParkList();
    })
    .catch((error) => {
      console.error('删除租户失败:', error);
      message.error({
        content: $t('ui.actionMessage.deleteFailed', [row.factoryName]),
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
function onView(row) {
  // 可以跳转到详情页面
  router.push(`/rental/detail/${row.parkId}`);
}

/**
 * 获取园区列表数据
 */
async function fetchParkList() {
  loading.value = true;
  try {
    // 准备查询参数
    const params = { ...formData.value };

    // 清理空值
    Object.keys(params).forEach((key) => {
      if (
        params[key] === undefined ||
        params[key] === null ||
        params[key] === ''
      ) {
        delete params[key];
      } else if (key === 'area' && Array.isArray(params[key])) {
        params[key] = params[key].join(',');
      }
    });

    // 添加分页参数
    params.currentPage = pagination.value.current;
    params.pageSize = pagination.value.pageSize;

    // 调用API获取数据
    const result = await getSystemParkList(params);
    parkList.value = result.items || [];
    pagination.value.total = result.page?.total || 0;
  } catch (error) {
    console.error('获取租赁列表失败:', error);
    message.error($t('ui.error.fetchListFailed'));
    parkList.value = [];
    pagination.value.total = 0;
  } finally {
    loading.value = false;
  }
}

/**
 * 处理分页变化
 */
function handlePaginationChange(page, pageSize) {
  pagination.value.current = page;
  pagination.value.pageSize = pageSize;
  fetchParkList();
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
      <List
        :loading="loading"
        :data-source="parkList"
        :pagination="false"
        item-layout="horizontal"
        class="park-list"
      >
        <template #renderEmpty>
          <Empty :description="$t('ui.table.empty')" />
        </template>

        <template #renderItem="{ item }">
          <List.Item>
            <Card class="park-card" :bordered="false">
              <template #title>
                <div class="card-header">
                  <span class="park-name">{{ item.parkName }}</span>
                  <Space>
                    <Button type="link" size="small" @click="onView(item)">
                      {{ $t('ui.action.view') }}
                    </Button>
                    <Button type="link" size="small" @click="onEdit(item)">
                      {{ $t('ui.action.edit') }}
                    </Button>
                    <Popconfirm
                      :title="
                        $t('ui.actionMessage.deleteConfirm', [item.factoryName])
                      "
                      @confirm="onDelete(item)"
                    >
                      <Button type="link" status="danger" size="small">
                        {{ $t('ui.action.delete') }}
                      </Button>
                    </Popconfirm>
                  </Space>
                </div>
              </template>

              <div class="park-info">
                <p>
                  <span class="info-label">{{ $t('page.park.address') }}:</span>
                  {{ item.address }}
                </p>
                <p>
                  <span class="info-label">{{ $t('page.park.area') }}:</span>
                  {{ item.area }}m²
                </p>
                <p>
                  <span class="info-label">{{ $t('page.park.manager') }}:</span>
                  {{ item.manager }}
                </p>
                <p>
                  <span class="info-label">{{ $t('page.park.contact') }}:</span>
                  {{ item.contact }}
                </p>
              </div>
            </Card>
          </List.Item>
        </template>
      </List>

      <div class="pagination-container">
        <Pagination
          v-model:current="pagination.current"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-size-options="['5', '10', '20', '30']"
          size="small"
          show-size-changer
          :show-total="(total) => $t('ui.pagination.total', [total])"
          @change="handlePaginationChange"
        />
      </div>
    </div>

    <!-- 搜索表单抽屉 -->
    <Drawer
      :title="$t('ui.search.title')"
      :visible="searchFormVisible"
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
  border-bottom: 1px solid #f0f0f0;
}

.mobile-title {
  font-size: 18px;
  font-weight: 500;
}

.mobile-content {
  padding: 12px;
}

.park-list {
  margin-bottom: 16px;
}

.park-card {
  width: 100%;
  margin-bottom: 8px;
}

.card-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
}

.park-name {
  font-size: 16px;
  font-weight: 500;
}

.park-info {
  font-size: 14px;
  color: rgb(0 0 0 / 65%);
}

.info-label {
  margin-right: 4px;
  font-weight: 500;
}

.pagination-container {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

.drawer-footer {
  position: absolute;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  width: calc(100% - 32px);
  padding: 16px;
  background: #fff;
  border-top: 1px solid #f0f0f0;
}
</style>
