<script lang="ts" setup>
import type { EmployeeApi } from '#/api/hrm/employee';

import { onMounted, ref, shallowRef } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus, Search } from '@vben/icons';
import { formatDate } from '@vben/utils';

import {
  Button,
  Card,
  Col,
  Empty,
  message,
  Modal,
  Pagination,
  Row,
  Spin,
  Tag,
} from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { deleteEmployee, getEmployeeList } from '#/api/hrm/employee';
import { $t } from '#/locales';

import { useSearchSchema } from './data';
import MobileDetail from './modules/detail.vue';
import MobileForm from './modules/form.vue';

interface QueryParams {
  [key: string]: any;
  currentPage?: number;
  pageSize?: number;
}

const tableLoading = shallowRef(false);
const employeeList = shallowRef<EmployeeApi.Employee[]>([]);
const paginationState = ref({
  currentPage: 1,
  pageSize: 10,
  total: 0,
});

const searchParams = ref<Record<string, any>>({});

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: MobileForm,
  destroyOnClose: true,
});

const [DetailModal, detailModalApi] = useVbenModal({
  connectedComponent: MobileDetail,
  destroyOnClose: true,
});

const messageHandler = {
  error: (msg: string, error?: any) => {
    message.error(msg);
    if (error) console.error(msg, error);
  },
  loading: (msg: string) => message.loading(msg, 0),
  success: (msg: string) => message.success(msg),
};

async function fetchEmployees(params: QueryParams = {}) {
  tableLoading.value = true;
  try {
    const query = {
      ...searchParams.value,
      currentPage: params.currentPage || paginationState.value.currentPage,
      pageSize: params.pageSize || paginationState.value.pageSize,
    };
    const activeQueryParams: Record<string, any> = {};
    for (const key in query) {
      const value = (query as Record<string, any>)[key];
      if (
        (key === 'currentPage' || key === 'pageSize' || value !== null) &&
        value !== undefined &&
        (typeof value !== 'string' || value !== '')
      ) {
        activeQueryParams[key] = value;
      }
    }

    const result = await getEmployeeList(
      activeQueryParams as EmployeeApi.EmployeeQuery,
    );
    employeeList.value = result.items || [];
    paginationState.value.total = result.total || 0;
    paginationState.value.currentPage = activeQueryParams.currentPage;
    paginationState.value.pageSize = activeQueryParams.pageSize;
  } catch (error) {
    messageHandler.error($t('获取员工列表失败'), error);
  } finally {
    tableLoading.value = false;
  }
}

function handleSearch() {
  paginationState.value.currentPage = 1;
  fetchEmployees();
}

function handleResetSearch() {
  searchParams.value = {};
  paginationState.value.currentPage = 1;
  fetchEmployees();
}

function handleAddNew() {
  formModalApi.setData(null).open();
}

function handleEdit(employee: EmployeeApi.Employee) {
  formModalApi.setData(employee).open();
}

function handleView(employee: EmployeeApi.Employee) {
  detailModalApi.setData(employee).open();
}

async function handleDelete(employee: EmployeeApi.Employee) {
  Modal.confirm({
    cancelText: $t('取消'),
    content: $t('确定要删除员工 {name} 吗?', { name: employee.name }),
    okText: $t('删除'),
    okType: 'danger',
    onOk: async () => {
      const hideLoading = messageHandler.loading($t('正在删除...'));
      try {
        await deleteEmployee(employee.employeeId);
        messageHandler.success(
          $t('员工 {name} 删除成功', { name: employee.name }),
        );
        fetchEmployees();
      } catch (error) {
        messageHandler.error($t('删除失败'), error);
      } finally {
        hideLoading();
      }
    },
    title: $t('确认删除'),
  });
}

function onPageChange(page: number, pageSize: number) {
  paginationState.value.currentPage = page;
  paginationState.value.pageSize = pageSize;
  fetchEmployees();
}

onMounted(() => {
  fetchEmployees();
});

const simplifiedSearchSchema = useSearchSchema().filter((s) =>
  ['isResigned', 'name', 'phone'].includes(s.fieldName),
);

const [SearchForm, searchFormApi] = useVbenForm({
  layout: 'vertical',
  schema: simplifiedSearchSchema,
  showDefaultActions: false,
});
</script>

<template>
  <Page class="mobile-hrm-list-container">
    <FormModal @success="fetchEmployees" />
    <DetailModal />

    <div class="search-filters">
      <SearchForm
        @submit="
          (data: Record<string, any>) => {
            searchParams = data;
            handleSearch();
          }
        "
      />
      <Row :gutter="8">
        <Col :span="12">
          <Button
            type="primary"
            @click="
              async () => {
                if (searchFormApi) {
                  searchParams = await searchFormApi.getValues();
                  handleSearch();
                }
              }
            "
            block
          >
            <Search class="mr-1 h-4 w-4" />
            {{ $t('查询') }}
          </Button>
        </Col>
        <Col :span="12">
          <Button
            @click="
              async () => {
                if (searchFormApi) {
                  await searchFormApi.resetForm();
                  searchParams = {};
                  handleResetSearch();
                }
              }
            "
            block
          >
            {{ $t('重置') }}
          </Button>
        </Col>
      </Row>
    </div>

    <Spin :spinning="tableLoading">
      <div v-if="employeeList.length > 0" class="employee-card-list">
        <Card
          v-for="employee in employeeList"
          :key="employee.employeeId"
          class="employee-card"
          :body-style="{ padding: '0' }"
        >
          <div class="card-header">
            <span class="employee-name">{{ employee.name }}</span>
            <Tag v-if="employee.isResigned" color="red">{{ $t('已离职') }}</Tag>
            <Tag v-else color="green">{{ $t('在职') }}</Tag>
          </div>
          <div class="card-content">
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">{{ $t('性别') }}</span>
                <span class="info-value">{{ employee.gender }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">{{ $t('学历') }}</span>
                <span class="info-value">{{ employee.education }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">{{ $t('部门') }}</span>
                <span class="info-value">{{ employee.department }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">{{ $t('手机号') }}</span>
                <span class="info-value">{{ employee.phone }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">{{ $t('上下班时间') }}</span>
                <span class="info-value">
                  {{ formatDate(employee.checkIn, 'HH:mm') }} -
                  {{ formatDate(employee.checkOut, 'HH:mm') }}
                </span>
              </div>
            </div>
          </div>
          <div class="card-actions">
            <Button @click="handleView(employee)">
              {{ $t('查看') }}
            </Button>
            <Button type="primary" ghost @click="handleEdit(employee)">
              {{ $t('编辑') }}
            </Button>
            <Button danger @click="handleDelete(employee)">
              {{ $t('删除') }}
            </Button>
          </div>
        </Card>
      </div>
      <Empty
        v-else
        class="py-10"
        :description="tableLoading ? $t('加载中...') : $t('暂无员工信息')"
      />
    </Spin>

    <div class="fab-container">
      <Button
        type="primary"
        shape="circle"
        size="large"
        class="fab"
        @click="handleAddNew"
      >
        <Plus class="size-6" />
      </Button>
    </div>

    <Pagination
      v-if="paginationState.total > paginationState.pageSize"
      v-model:current="paginationState.currentPage"
      :page-size="paginationState.pageSize"
      :total="paginationState.total"
      @change="onPageChange"
      size="small"
      class="list-pagination"
    />
  </Page>
</template>

<style scoped>
.mobile-hrm-list-container {
  padding: 8px;
  background-color: #f0f2f5;
}

.dark .mobile-hrm-list-container {
  background-color: #1a1a1a;
}

.add-button {
  padding: 10px 0;
  font-size: 1em;
}

.search-filters {
  padding: 12px;
  margin-bottom: 12px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgb(0 0 0 / 8%);
}

.dark .search-filters {
  background-color: #2d2d2d;
}

.search-filters :deep(.ant-form-item) {
  margin-bottom: 10px;
}

.employee-card-list {
  padding-bottom: 8px;
}

.employee-card {
  margin-bottom: 12px;
  overflow: hidden;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.dark .employee-card {
  background-color: #2d2d2d;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.dark .card-header {
  border-bottom-color: #424242;
}

.employee-name {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.dark .employee-name {
  color: #f1f1f1;
}

.card-content {
  padding: 16px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
}

.info-label {
  margin-bottom: 4px;
  font-size: 13px;
  color: #969799;
}

.dark .info-label {
  color: #a0a0a0;
}

.info-value {
  font-size: 14px;
  color: #323233;
}

.dark .info-value {
  color: #f1f1f1;
}

.card-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  padding: 12px 16px;
}

.list-pagination {
  margin-top: 12px;
  text-align: center;
}

.fab-container {
  position: fixed;
  right: 16px;
  bottom: 72px;
  z-index: 10;
}

.fab {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
}
</style>
