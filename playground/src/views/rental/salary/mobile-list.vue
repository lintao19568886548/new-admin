<script lang="ts" setup>
import type { SalaryItem } from './types';

import { computed, onMounted, onUnmounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus, Search } from '@vben/icons';

import { DeleteOutlined, EditOutlined } from '@ant-design/icons-vue';
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  List,
  message,
  Popconfirm,
  Row,
  Select,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { deleteSalary, getSalaryList } from '#/api/rental';
import { $t } from '#/locales';

import { formatSalaryAmount, getIssuedOptions } from './data';
import SalaryForm from './modules/form.vue';

const loading = ref(false);
const salaryList = ref<SalaryItem[]>([]);
const pagination = ref({
  currentPage: 1,
  pageSize: 10,
  total: 0,
});
const searchForm = ref<{
  issued?: 'false' | 'true';
  phoneNumber: string;
  tenantName: string;
}>({
  issued: undefined,
  phoneNumber: '',
  tenantName: '',
});

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: SalaryForm,
  destroyOnClose: true,
});

const issuedOptions = getIssuedOptions();

const isLastPage = computed(() => {
  return salaryList.value.length >= pagination.value.total;
});

const isMobile = ref(false);

function updateIsMobile() {
  isMobile.value = window.innerWidth < 768;
}

function formatDate(value?: null | string) {
  return value ? dayjs(value).format('YYYY-MM-DD') : '--';
}

async function fetchList(isLoadMore = false) {
  loading.value = true;
  if (!isLoadMore) {
    pagination.value.currentPage = 1;
  }

  const params: Record<string, any> = {
    currentPage: pagination.value.currentPage,
    issued: searchForm.value.issued ?? undefined,
    pageSize: pagination.value.pageSize,
    phoneNumber: searchForm.value.phoneNumber || undefined,
    tenantName: searchForm.value.tenantName || undefined,
  };

  try {
    const result = await getSalaryList(params);
    const items = (result?.items as SalaryItem[]) || [];
    if (isLoadMore) {
      salaryList.value.push(...items);
    } else {
      salaryList.value = items;
    }
    pagination.value.total = result?.total || 0;
  } catch (error) {
    console.error('获取工资列表失败:', error);
    message.error('获取工资列表失败');
  } finally {
    loading.value = false;
  }
}

function refreshList() {
  fetchList(false);
}

function onSearch() {
  fetchList(false);
}

function onReset() {
  searchForm.value = {
    issued: undefined,
    phoneNumber: '',
    tenantName: '',
  };
  fetchList(false);
}

function onLoadMore() {
  if (loading.value || isLastPage.value) return;
  pagination.value.currentPage += 1;
  fetchList(true);
}

function onCreate() {
  formModalApi.setData(null).open();
}

function onEdit(row: SalaryItem) {
  formModalApi.setData(row).open();
}

function onView(row: SalaryItem) {
  formModalApi.setData({ ...row, readonly: true }).open();
}

async function onDelete(row: SalaryItem) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.tenantName || '']),
    duration: 0,
    key: 'action_process_msg',
  });

  try {
    await deleteSalary(row.salaryId);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.tenantName || '']),
      key: 'action_process_msg',
    });
    refreshList();
  } catch (error) {
    console.error('删除工资记录失败:', error);
    message.error({
      content: $t('ui.actionMessage.deleteFailed', [row.tenantName || '']),
      key: 'action_process_msg',
    });
  }
}

onMounted(() => {
  updateIsMobile();
  window.addEventListener('resize', updateIsMobile);
  fetchList();
});

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile);
});
</script>

<template>
  <Page :class="isMobile ? 'px-3' : ''" auto-content-height>
    <FormModal @success="refreshList" />

    <Form layout="vertical">
      <Row :gutter="[12, 12]">
        <Col :span="24">
          <Form.Item :label="$t('system.rental.salary.contractor')">
            <Input
              v-model:value="searchForm.tenantName"
              :placeholder="$t('ui.placeholder.input')"
              allow-clear
            />
          </Form.Item>
        </Col>
        <Col :span="24">
          <Form.Item :label="$t('system.rental.salary.phone')">
            <Input
              v-model:value="searchForm.phoneNumber"
              :placeholder="$t('ui.placeholder.input')"
              allow-clear
            />
          </Form.Item>
        </Col>
        <Col :span="24">
          <Form.Item :label="$t('system.rental.salary.issued.label')">
            <Select
              v-model:value="searchForm.issued"
              :allow-clear="true"
              :options="issuedOptions"
              :placeholder="$t('ui.placeholder.select')"
            />
          </Form.Item>
        </Col>
        <Col :span="24">
          <div class="flex flex-wrap gap-2">
            <Button type="primary" @click="onSearch">
              <Search class="mr-1" />
              {{ $t('common.search') }}
            </Button>
            <Button @click="onReset">{{ $t('common.reset') }}</Button>
            <Button type="dashed" @click="onCreate">
              <Plus class="mr-1" />
              {{
                $t('ui.actionTitle.create', [$t('system.rental.salary.item')])
              }}
            </Button>
          </div>
        </Col>
      </Row>
    </Form>

    <List
      :data-source="salaryList"
      :loading="loading"
      class="mt-4"
      item-layout="vertical"
      row-key="salaryId"
    >
      <template #renderItem="{ item }">
        <List.Item>
          <Card hoverable>
            <div class="flex items-center justify-between">
              <div class="text-base font-semibold">
                {{ item.tenantName || '--' }}
              </div>
              <Tag :color="item.issued ? 'green' : 'orange'">
                {{
                  item.issued
                    ? $t('system.rental.salary.issued.true')
                    : $t('system.rental.salary.issued.false')
                }}
              </Tag>
            </div>
            <div class="mt-2 text-sm text-gray-600">
              {{ $t('system.rental.salary.phone') }}：{{
                item.phoneNumber || '--'
              }}
            </div>
            <div class="mt-2 text-sm text-gray-600">
              {{ $t('system.rental.salary.amount') }}：
              {{ formatSalaryAmount(item.salaryAmount) }}
            </div>
            <div class="mt-2 text-sm text-gray-600">
              {{ $t('system.rental.salary.issueDate') }}：
              {{ formatDate(item.issueDate) }}
            </div>
            <div v-if="item.remark" class="mt-2 text-sm text-gray-600">
              {{ $t('page.common.remark') }}：{{ item.remark }}
            </div>
            <div class="mt-4 flex justify-end gap-3">
              <Button size="small" type="link" @click="onView(item)">
                {{ $t('common.view') }}
              </Button>
              <Button size="small" type="link" @click="onEdit(item)">
                <EditOutlined class="mr-1" />
                {{ $t('common.edit') }}
              </Button>
              <Popconfirm
                :title="
                  $t('ui.actionConfirm.delete', [
                    $t('system.rental.salary.item'),
                  ])
                "
                @confirm="onDelete(item)"
              >
                <Button danger size="small" type="link">
                  <DeleteOutlined class="mr-1" />
                  {{ $t('common.delete') }}
                </Button>
              </Popconfirm>
            </div>
          </Card>
        </List.Item>
      </template>
      <template #loadMore>
        <div
          v-if="salaryList.length > 0 && !isLastPage"
          class="py-4 text-center"
        >
          <Button :loading="loading" type="text" @click="onLoadMore">
            加载更多
          </Button>
        </div>
      </template>
    </List>

    <Empty
      v-if="!loading && salaryList.length === 0"
      :description="$t('common.noData')"
      class="mt-8"
    />
  </Page>
</template>
