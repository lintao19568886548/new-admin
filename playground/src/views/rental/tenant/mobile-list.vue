<script lang="ts" setup>
import type { RentalManagementItem } from './types';

import { computed, h, onMounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

// May not be used directly if using custom formatters from data.ts
import { MoreOutlined } from '@ant-design/icons-vue';
import {
  Button,
  Card,
  Flex,
  List,
  message,
  Popover,
  Tag,
  TypographyText,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { deleteTenant, getTenantList } from '#/api/rental';
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import { getTagTypeOptions } from './data'; // For status tags
import Form from './modules/form.vue';

const currentPark = ref();
const loading = ref(false);
const tenantList = ref<RentalManagementItem[]>([]);
const pagination = ref({
  currentPage: 1,
  pageSize: 10, // Mobile-friendly page size
  total: 0,
});

const tagTypeOptions = getTagTypeOptions();

const getStatusTag = (row: RentalManagementItem) => {
  const isExpired = row.contractEnd
    ? dayjs().isAfter(dayjs(row.contractEnd))
    : false;
  const statusText = isExpired ? '过期' : '生效中';
  const option = tagTypeOptions.find((opt) => opt.value === statusText);
  return h(Tag, { color: option?.color || 'default' }, () => statusText);
};

const formatContractDate = (row: RentalManagementItem) => {
  const start = row.contractStart
    ? dayjs(row.contractStart).format('YYYY.MM.DD')
    : '';
  const end = row.contractEnd
    ? dayjs(row.contractEnd).format('YYYY.MM.DD')
    : '';
  if (!start && !end) return '';
  if (start && !end) return start;
  if (!start && end) return end;
  return `${start} - ${end}`;
};

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

function onEdit(row: RentalManagementItem) {
  formModalApi.setData(row).open();
}

function onCreate() {
  formModalApi.setData(null).open();
}

async function onDelete(row: RentalManagementItem) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.tenantName || '']),
    duration: 0,
    key: 'action_process_msg',
  });

  try {
    await deleteTenant(row.rentalTenantId);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.tenantName || '']),
      key: 'action_process_msg',
    });
    fetchList();
  } catch (error) {
    console.error('删除租户失败:', error);
    message.error({
      content: $t('ui.actionMessage.deleteFailed', [row.tenantName || '']),
      key: 'action_process_msg',
    });
  }
}

function onView(row: RentalManagementItem) {
  // For mobile, viewing is often the same as editing but read-only.
  // The Form component itself should handle the readonly state if passed.
  formModalApi.setData({ ...row, readonly: true }).open();
}

async function fetchList(newParams = {}) {
  loading.value = true;
  const params = {
    currentPage: pagination.value.currentPage,
    currentPark: currentPark.value ? currentPark.value.parkId : -1,
    pageSize: pagination.value.pageSize,
    ...newParams, // Allow for additional filter params if needed in future
  };
  try {
    const result = await getTenantList(params);
    tenantList.value = result.items || [];
    pagination.value.total = result.total || 0;
    pagination.value.currentPage = result.currentPage || 1;
    pagination.value.pageSize = result.pageSize || 10;
  } catch (error) {
    console.error('获取租户列表失败:', error);
    message.error('获取租户列表失败');
    tenantList.value = [];
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

const pageStyle = computed(() => ({
  // maxWidth: '400px',
  // margin: '0 auto',
  // border: '1px solid #eee',
  // overflowY: 'auto',
  // height: '641px' // If strict height simulation is needed
}));
</script>

<template>
  <Page :style="pageStyle" class="mobile-tenant-list-page">
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
          size="small"
        />
        <Button type="primary" size="small" @click="onCreate">
          <Plus class="size-4" />
          {{ $t('ui.actionTitle.createSimple') }}
          <!-- Assuming this key exists -->
        </Button>
      </Flex>
    </template>

    <div class="p-2">
      <List
        :data-source="tenantList"
        :loading="loading"
        :pagination="{
          current: pagination.currentPage,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: handleTableChange,
          size: 'small',
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '30', '50'],
        }"
        item-layout="vertical"
        row-key="rentalTenantId"
      >
        <template #renderItem="{ item }">
          <List.Item>
            <Card :title="item.tenantName" size="small" class="mb-2 shadow-md">
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
                    {{ $t('system.rental.tenant.phone') }}:
                  </TypographyText>
                  <TypographyText>{{ item.phoneNumber }}</TypographyText>
                </div>
                <div>
                  <TypographyText type="secondary">
                    {{ $t('system.rental.tenant.status.label') }}:
                  </TypographyText>
                  <component :is="getStatusTag(item)" />
                </div>
                <div>
                  <TypographyText type="secondary">
                    {{ $t('system.rental.tenant.contractDate') }}:
                  </TypographyText>
                  <TypographyText>
                    {{ formatContractDate(item) }}
                  </TypographyText>
                </div>
                <div v-if="item.area">
                  <TypographyText type="secondary">
                    {{ $t('page.rental.area') }}:
                  </TypographyText>
                  <TypographyText>{{ item.area }}㎡</TypographyText>
                </div>
                <div v-if="item.rent">
                  <TypographyText type="secondary">
                    {{ $t('page.common.rent') }}:
                  </TypographyText>
                  <TypographyText>{{ item.rent }}元/月</TypographyText>
                </div>
                <div v-if="item.address">
                  <TypographyText type="secondary">
                    {{ $t('system.rental.tenant.address') }}:
                  </TypographyText>
                  <TypographyText>{{ item.address }}</TypographyText>
                </div>
                <!-- Add other relevant fields from RentalManagementItem as needed -->
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
.mobile-tenant-list-page {
  // background-color: #f0f2f5;

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
}
</style>
