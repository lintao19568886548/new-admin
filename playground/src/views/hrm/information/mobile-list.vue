<script lang="ts" setup>
import type { EmployeeApi } from '#/api/hrm/employee';

import { onMounted, ref, shallowRef } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus, Search } from '@vben/icons';
import { formatDateTime } from '@vben/utils'; // For date formatting

import { Button, Empty, message, Pagination, Spin, Tag } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form'; // For search form adapter
import { deleteEmployee, getEmployeeList } from '#/api/hrm/employee';
import { $t } from '#/locales';

import { useSearchSchema } from './data'; // Reusing search schema from data.ts
import MobileForm from './modules/mobile-form.vue'; // Import the new mobile form

// Define QueryParams if not already globally available or in a shared types file
interface QueryParams {
  [key: string]: any;
  currentPage?: number;
  pageSize?: number;
}

const tableLoading = shallowRef(false);
const employeeList = shallowRef<EmployeeApi.Employee[]>([]);
const paginationState = ref({
  currentPage: 1,
  pageSize: 10, // Default page size for mobile
  total: 0,
});

// Search form data (can be simplified for mobile)
const searchParams = ref<Partial<EmployeeApi.EmployeeSearchQueries>>({}); // Adjust type as per your API

// Modal for New/Edit Employee
const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: MobileForm, // Use the new mobile form component
  destroyOnClose: true,
});

const messageHandler = {
  error: (msg: string, error?: any) => {
    message.error(msg);
    if (error) console.error(msg, error);
  },
  loading: (msg: string) => message.loading(msg, 0), // duration 0 for manual close
  success: (msg: string) => message.success(msg),
};

async function fetchEmployees(params: QueryParams = {}) {
  tableLoading.value = true;
  try {
    const query = {
      ...searchParams.value, // include search form values
      currentPage: params.currentPage || paginationState.value.currentPage,
      pageSize: params.pageSize || paginationState.value.pageSize,
    };
    // Filter out empty/null search params before sending to API
    const activeQueryParams: Record<string, any> = {};
    for (const key in query) {
      if (
        query[key] !== null &&
        query[key] !== undefined &&
        query[key] !== ''
      ) {
        activeQueryParams[key] = query[key];
      }
    }

    const result = await getEmployeeList(
      activeQueryParams as EmployeeApi.EmployeeSearchQueries,
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
  paginationState.value.currentPage = 1; // Reset to first page for new search
  fetchEmployees();
}

function handleResetSearch() {
  searchParams.value = {}; // Clear search form
  paginationState.value.currentPage = 1;
  fetchEmployees();
}

function handleAddNew() {
  formModalApi.setData(null).open();
}

function handleEdit(employee: EmployeeApi.Employee) {
  formModalApi.setData(employee).open();
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
        fetchEmployees(); // Refresh list
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

// Simplified search schema for mobile - reuse or adapt from data.ts as needed
const simplifiedSearchSchema = useSearchSchema().filter((s) =>
  ['isDeleted', 'name', 'phone'].includes(s.fieldName),
);
const [SearchForm] = useVbenForm({
  layout: 'vertical', // Vertical layout for mobile
  schema: simplifiedSearchSchema,
  showDefaultActions: false, // We'll use custom buttons
  // handleSubmit and handleReset are handled by our custom functions above
});
</script>

<template>
  <Page auto-content-height class="mobile-hrm-list-container">
    <FormModal @success="fetchEmployees" />

    <div class="page-controls">
      <Button type="primary" @click="handleAddNew" block class="add-button">
        <Plus class="size-5" />
        {{ $t('新建员工') }}
      </Button>
    </div>

    <details class="search-details">
      <summary class="search-summary">
        {{ $t('筛选与搜索') }} <Search class="inline-icon" />
      </summary>
      <div class="search-form-container">
        <SearchForm
          @submit="
            (data) => {
              searchParams = data;
              handleSearch();
            }
          "
        />
        <div class="search-actions-buttons">
          <Button
            type="primary"
            @click="
              () => {
                const sf = SearchForm.getApi();
                if (sf) {
                  searchParams = sf.getFieldsValue();
                  handleSearch();
                }
              }
            "
            block
          >
            {{ $t('查询') }}
          </Button>
          <Button
            @click="
              () => {
                const sf = SearchForm.getApi();
                if (sf) {
                  sf.resetFields();
                  searchParams = {};
                  handleResetSearch();
                }
              }
            "
            block
          >
            {{ $t('重置') }}
          </Button>
        </div>
      </div>
    </details>

    <Spin :spinning="tableLoading">
      <div v-if="employeeList.length > 0" class="employee-card-list">
        <div
          v-for="employee in employeeList"
          :key="employee.employeeId"
          class="employee-card"
        >
          <div class="card-title">
            {{ employee.name }}
            <Tag v-if="employee.isDeleted" color="red">{{ $t('已离职') }}</Tag>
          </div>
          <div class="card-content">
            <p v-if="employee.department">
              <strong>{{ $t('部门') }}:</strong> {{ employee.department }}
            </p>
            <p v-if="employee.phone">
              <strong>{{ $t('手机') }}:</strong> {{ employee.phone }}
            </p>
            <p v-if="employee.hireDate">
              <strong>{{ $t('入职日期') }}:</strong>
              {{ formatDateTime(employee.hireDate) }}
            </p>
            <p v-if="employee.isDeleted && employee.leaveDate">
              <strong>{{ $t('离职日期') }}:</strong>
              {{ formatDateTime(employee.leaveDate) }}
            </p>
          </div>
          <div class="card-actions">
            <Button size="small" @click="handleEdit(employee)">
              {{ $t('编辑') }}
            </Button>
            <Button
              size="small"
              type="link"
              danger
              @click="handleDelete(employee)"
              v-if="!employee.isDeleted"
            >
              {{ $t('删除') }}
            </Button>
          </div>
        </div>
      </div>
      <Empty
        v-else
        :description="tableLoading ? $t('加载中...') : $t('暂无员工信息')"
      />
    </Spin>

    <Pagination
      v-if="paginationState.total > 0"
      :current="paginationState.currentPage"
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

.page-controls {
  margin-bottom: 12px;
}

.add-button {
  padding: 10px 0;
  font-size: 1em;
}

.search-details {
  padding: 0;
  margin-bottom: 12px;
  background-color: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}

.search-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  font-weight: bold;
  cursor: pointer;
}

.search-summary .inline-icon {
  width: 1em;
  height: 1em;
}

.search-form-container {
  padding: 12px;
  border-top: 1px solid #e8e8e8;
}

.search-actions-buttons {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.search-actions-buttons .ant-btn {
  flex-grow: 1;
}

.employee-card-list {
  padding-bottom: 8px;
}

.employee-card {
  padding: 12px;
  margin-bottom: 8px;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
}

.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 1.1em;
  font-weight: bold;
}

.card-content p {
  margin-bottom: 4px;
  font-size: 0.9em;
  line-height: 1.5;
  color: #555;
}

.card-content p strong {
  color: #333;
}

.card-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 10px;
  text-align: right;
}

.list-pagination {
  margin-top: 12px;
  text-align: center;
}
</style>
