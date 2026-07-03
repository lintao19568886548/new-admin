<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';

import { Search } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import { FilterOutlined } from '@ant-design/icons-vue';
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Spin,
  Switch,
  Tag,
  Textarea,
} from 'ant-design-vue';

import MobileFloatingAction from '#/components/mobile/MobileFloatingAction.vue';
import MobileFormHeader from '#/components/mobile/MobileFormHeader.vue';
import MobilePage from '#/components/mobile/MobilePage.vue';
import MobilePagination from '#/components/mobile/MobilePagination.vue';
import MobilePanel from '#/components/mobile/MobilePanel.vue';
import MobileSubmitBar from '#/components/mobile/MobileSubmitBar.vue';

type BrandOptionValue = boolean | number | string;
type BrandSelectValue = number | string;

interface BrandOption {
  label: string;
  value: BrandOptionValue;
}

interface BrandRecord {
  [key: string]: any;
  apiEndpoint?: string;
  appKey?: string;
  appSecretRef?: string;
  brandCode?: string;
  brandName?: string;
  enabled?: BrandOptionValue;
  isDefault?: BrandOptionValue;
  protocolType?: string;
  remark?: string;
  updateTime?: string;
}

interface BrandSearchForm {
  brandCode: string;
  brandName: string;
  enabled?: BrandSelectValue;
  isDefault?: BrandSelectValue;
  protocolType: string;
}

interface BrandEditForm {
  apiEndpoint: string;
  appKey: string;
  appSecretRef: string;
  brandCode: string;
  brandName: string;
  enabled: boolean;
  isDefault: boolean;
  protocolType: string;
  remark: string;
}

const props = withDefaults(
  defineProps<{
    actionKey?: string;
    createApi: (data: Record<string, any>) => Promise<any>;
    defaultFormData?: Record<string, any>;
    defaultOptions: BrandOption[];
    deleteApi: (id: number) => Promise<any>;
    enabledOptions: BrandOption[];
    fixedParams?: Record<string, any>;
    itemLabel: string;
    listApi: (params?: Record<string, any>) => Promise<any>;
    rowKey: string;
    updateApi: (id: number, data: Record<string, any>) => Promise<any>;
  }>(),
  {
    actionKey: 'mobile_brand_action',
    defaultFormData: () => ({}),
    fixedParams: () => ({}),
  },
);

const searchForm = reactive<BrandSearchForm>({
  brandCode: '',
  brandName: '',
  enabled: undefined,
  isDefault: undefined,
  protocolType: '',
});

const editForm = reactive<BrandEditForm>({
  apiEndpoint: '',
  appKey: '',
  appSecretRef: '',
  brandCode: '',
  brandName: '',
  enabled: true,
  isDefault: false,
  protocolType: '',
  remark: '',
});

const brandList = ref<BrandRecord[]>([]);
const currentRecord = ref<BrandRecord | null>(null);
const filterExpanded = ref(false);
const initialEditFormSnapshot = ref('');
const loading = ref(false);
const saving = ref(false);
const viewMode = ref<'form' | 'list'>('list');
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const listIsEmpty = computed(
  () => !loading.value && brandList.value.length === 0,
);

const hasAdvancedFilters = computed(() => {
  return (
    searchForm.brandCode.trim().length > 0 ||
    searchForm.protocolType.trim().length > 0 ||
    searchForm.enabled !== undefined ||
    searchForm.isDefault !== undefined
  );
});

const hasUnsavedChanges = computed(() => {
  return (
    viewMode.value === 'form' &&
    initialEditFormSnapshot.value.length > 0 &&
    serializeEditForm() !== initialEditFormSnapshot.value
  );
});

const pageTitle = computed(() => {
  return currentRecord.value
    ? `编辑${props.itemLabel}`
    : `新增${props.itemLabel}`;
});

const enabledSelectOptions = computed(() =>
  toSelectOptions(props.enabledOptions),
);
const defaultSelectOptions = computed(() =>
  toSelectOptions(props.defaultOptions),
);

function normalizeBoolean(value: unknown) {
  return value === true || value === 'true' || Number(value) === 1;
}

function toSelectOptions(options: BrandOption[]) {
  return options.map((option) => ({
    label: option.label,
    value: String(option.value),
  }));
}

function filterParams(params: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
}

function getResponseItems(response: any) {
  if (Array.isArray(response)) {
    return response;
  }
  if (Array.isArray(response?.items)) {
    return response.items;
  }
  if (Array.isArray(response?.data?.items)) {
    return response.data.items;
  }
  return [];
}

function getResponseTotal(response: any, fallback: number) {
  return Number(
    response?.page?.total ??
      response?.total ??
      response?.data?.page?.total ??
      response?.data?.total ??
      fallback,
  );
}

function getRecordId(row: BrandRecord) {
  const id = Number(row?.[props.rowKey]);
  return Number.isFinite(id) ? id : undefined;
}

function getStatusText(
  value: unknown,
  truthyLabel: string,
  falsyLabel: string,
) {
  return normalizeBoolean(value) ? truthyLabel : falsyLabel;
}

function formatTime(value?: string) {
  return value ? formatDateTime(value) : '-';
}

function serializeEditForm() {
  return JSON.stringify({
    apiEndpoint: editForm.apiEndpoint,
    appKey: editForm.appKey,
    appSecretRef: editForm.appSecretRef,
    brandCode: editForm.brandCode,
    brandName: editForm.brandName,
    enabled: editForm.enabled,
    isDefault: editForm.isDefault,
    protocolType: editForm.protocolType,
    remark: editForm.remark,
  });
}

function resetEditForm(row?: BrandRecord) {
  editForm.apiEndpoint = String(row?.apiEndpoint || '');
  editForm.appKey = String(row?.appKey || '');
  editForm.appSecretRef = String(row?.appSecretRef || '');
  editForm.brandCode = String(row?.brandCode || '');
  editForm.brandName = String(row?.brandName || '');
  editForm.enabled =
    row?.enabled === undefined ? true : normalizeBoolean(row.enabled);
  editForm.isDefault =
    row?.isDefault === undefined ? false : normalizeBoolean(row.isDefault);
  editForm.protocolType = String(row?.protocolType || '');
  editForm.remark = String(row?.remark || '');
  initialEditFormSnapshot.value = serializeEditForm();
}

async function fetchList() {
  loading.value = true;
  try {
    const response = await props.listApi({
      ...filterParams(searchForm),
      ...props.fixedParams,
      currentPage: pagination.current,
      pageSize: pagination.pageSize,
    });
    const items = getResponseItems(response);
    brandList.value = items;
    pagination.total = getResponseTotal(response, items.length);
  } catch (error) {
    console.error(`获取${props.itemLabel}列表失败:`, error);
    brandList.value = [];
    pagination.total = 0;
    message.error(`获取${props.itemLabel}列表失败`);
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  pagination.current = 1;
  filterExpanded.value = false;
  void fetchList();
}

function onReset() {
  searchForm.brandCode = '';
  searchForm.brandName = '';
  searchForm.enabled = undefined;
  searchForm.isDefault = undefined;
  searchForm.protocolType = '';
  onSearch();
}

function onPageChange(page: number, pageSize: number) {
  pagination.current = page;
  pagination.pageSize = pageSize;
  void fetchList();
}

function onCreate() {
  currentRecord.value = null;
  resetEditForm();
  viewMode.value = 'form';
}

function onEdit(row: BrandRecord) {
  currentRecord.value = row;
  resetEditForm(row);
  viewMode.value = 'form';
}

function backToList() {
  if (saving.value) return;
  if (hasUnsavedChanges.value) {
    Modal.confirm({
      cancelText: '继续编辑',
      content: '当前表单内容还没有保存，返回后本次修改不会保留。',
      okText: '放弃修改',
      onOk() {
        viewMode.value = 'list';
      },
      title: '确认返回？',
    });
    return;
  }
  viewMode.value = 'list';
}

function validateForm() {
  if (!editForm.brandName.trim()) {
    message.warning('请输入品牌名称');
    return false;
  }
  if (!editForm.brandCode.trim()) {
    message.warning('请输入品牌编码');
    return false;
  }
  return true;
}

async function onSave() {
  if (!validateForm()) return;

  const recordId = currentRecord.value
    ? getRecordId(currentRecord.value)
    : undefined;
  const payload = {
    ...props.defaultFormData,
    ...props.fixedParams,
    apiEndpoint: editForm.apiEndpoint.trim(),
    appKey: editForm.appKey.trim(),
    appSecretRef: editForm.appSecretRef.trim(),
    brandCode: editForm.brandCode.trim().toUpperCase(),
    brandName: editForm.brandName.trim(),
    enabled: editForm.enabled,
    isDefault: editForm.isDefault,
    protocolType: editForm.protocolType.trim(),
    remark: editForm.remark.trim(),
  };

  saving.value = true;
  try {
    if (recordId) {
      await props.updateApi(recordId, payload);
      message.success(`已更新${props.itemLabel}`);
    } else {
      await props.createApi(payload);
      message.success(`已新增${props.itemLabel}`);
      pagination.current = 1;
    }
    viewMode.value = 'list';
    await fetchList();
  } catch (error) {
    console.error(`保存${props.itemLabel}失败:`, error);
    message.error(`保存${props.itemLabel}失败`);
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: BrandRecord) {
  const recordId = getRecordId(row);
  if (!recordId) {
    message.error(`${props.itemLabel}编号无效`);
    return;
  }

  message.loading({
    content: `正在删除 ${row.brandName || props.itemLabel}`,
    duration: 0,
    key: props.actionKey,
  });

  try {
    await props.deleteApi(recordId);
    message.success({
      content: `已删除 ${row.brandName || props.itemLabel}`,
      key: props.actionKey,
    });
    await fetchList();
  } catch (error) {
    console.error(`删除${props.itemLabel}失败:`, error);
    message.error({
      content: `删除${props.itemLabel}失败`,
      key: props.actionKey,
    });
  }
}

onMounted(() => {
  void fetchList();
});
</script>

<template>
  <MobilePage>
    <template v-if="viewMode === 'form'">
      <MobileFormHeader :title="pageTitle" @back="backToList" />

      <MobilePanel>
        <Form layout="vertical" :model="editForm">
          <Form.Item label="品牌名称" required>
            <Input
              v-model:value="editForm.brandName"
              placeholder="请输入品牌名称"
              allow-clear
            />
          </Form.Item>
          <Form.Item label="品牌编码" required>
            <Input
              v-model:value="editForm.brandCode"
              placeholder="请输入品牌编码"
              allow-clear
            />
          </Form.Item>
          <Form.Item label="协议类型">
            <Input
              v-model:value="editForm.protocolType"
              placeholder="请输入协议类型"
              allow-clear
            />
          </Form.Item>
          <Form.Item label="接口地址">
            <Input
              v-model:value="editForm.apiEndpoint"
              placeholder="请输入接口地址"
              allow-clear
            />
          </Form.Item>
          <Row :gutter="12">
            <Col :span="12">
              <Form.Item label="启用状态">
                <div class="switch-row">
                  <span>{{ editForm.enabled ? '启用' : '停用' }}</span>
                  <Switch v-model:checked="editForm.enabled" />
                </div>
              </Form.Item>
            </Col>
            <Col :span="12">
              <Form.Item label="选用状态">
                <div class="switch-row">
                  <span>{{ editForm.isDefault ? '当前选用' : '备选' }}</span>
                  <Switch v-model:checked="editForm.isDefault" />
                </div>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="应用 Key">
            <Input
              v-model:value="editForm.appKey"
              placeholder="请输入应用 Key"
              allow-clear
            />
          </Form.Item>
          <Form.Item label="密钥引用">
            <Input
              v-model:value="editForm.appSecretRef"
              placeholder="请输入密钥引用"
              allow-clear
            />
          </Form.Item>
          <Form.Item label="备注">
            <Textarea
              v-model:value="editForm.remark"
              placeholder="请输入备注"
              :rows="4"
              :maxlength="300"
              show-count
            />
          </Form.Item>
        </Form>
      </MobilePanel>

      <MobileSubmitBar
        :loading="saving"
        @cancel="backToList"
        @submit="onSave"
      />
    </template>

    <template v-else>
      <MobilePanel>
        <Form layout="vertical" :model="searchForm">
          <Row :gutter="8">
            <Col :span="24">
              <Form.Item label="品牌名称">
                <Input
                  v-model:value="searchForm.brandName"
                  allow-clear
                  placeholder="请输入名称"
                />
              </Form.Item>
            </Col>
            <template v-if="filterExpanded">
              <Col :span="12">
                <Form.Item label="品牌编码">
                  <Input
                    v-model:value="searchForm.brandCode"
                    allow-clear
                    placeholder="请输入编码"
                  />
                </Form.Item>
              </Col>
              <Col :span="12">
                <Form.Item label="协议类型">
                  <Input
                    v-model:value="searchForm.protocolType"
                    allow-clear
                    placeholder="请输入协议"
                  />
                </Form.Item>
              </Col>
              <Col :span="12">
                <Form.Item label="启用状态">
                  <Select
                    v-model:value="searchForm.enabled"
                    :options="enabledSelectOptions"
                    allow-clear
                    placeholder="请选择"
                  />
                </Form.Item>
              </Col>
              <Col :span="12">
                <Form.Item label="选用状态">
                  <Select
                    v-model:value="searchForm.isDefault"
                    :options="defaultSelectOptions"
                    allow-clear
                    placeholder="请选择"
                  />
                </Form.Item>
              </Col>
            </template>
          </Row>

          <div class="search-actions">
            <Button
              class="filter-toggle-button"
              @click="filterExpanded = !filterExpanded"
            >
              <FilterOutlined />
              {{
                filterExpanded ? '收起' : hasAdvancedFilters ? '筛选中' : '筛选'
              }}
            </Button>
            <Button type="primary" class="flex-1" @click="onSearch">
              <Search class="mr-1 h-4 w-4" />
              搜索
            </Button>
            <Button class="flex-1" @click="onReset"> 重置 </Button>
          </div>
        </Form>
      </MobilePanel>

      <Spin :spinning="loading" tip="加载中...">
        <div v-if="brandList.length > 0" class="brand-list">
          <Card
            v-for="item in brandList"
            :key="item[rowKey]"
            class="brand-card"
            :body-style="{ padding: '0' }"
          >
            <div class="card-header">
              <span class="brand-name">{{ item.brandName || '-' }}</span>
              <div class="status-tags">
                <Tag :color="normalizeBoolean(item.enabled) ? 'success' : ''">
                  {{ getStatusText(item.enabled, '启用', '停用') }}
                </Tag>
                <Tag
                  :color="normalizeBoolean(item.isDefault) ? 'processing' : ''"
                >
                  {{ getStatusText(item.isDefault, '当前选用', '备选') }}
                </Tag>
              </div>
            </div>

            <div class="card-content">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">品牌编码</span>
                  <span class="info-value">{{ item.brandCode || '-' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">协议类型</span>
                  <span class="info-value">{{ item.protocolType || '-' }}</span>
                </div>
                <div class="info-item col-span-2">
                  <span class="info-label">接口地址</span>
                  <span class="info-value break-all">
                    {{ item.apiEndpoint || '-' }}
                  </span>
                </div>
                <div class="info-item col-span-2">
                  <span class="info-label">更新时间</span>
                  <span class="info-value">
                    {{ formatTime(item.updateTime) }}
                  </span>
                </div>
              </div>

              <div v-if="item.remark" class="remark-info">
                <span class="remark-label">备注:</span>
                <span class="remark-text">{{ item.remark }}</span>
              </div>
            </div>

            <div class="card-actions">
              <Button type="primary" ghost @click="onEdit(item)"> 编辑 </Button>
              <Popconfirm
                title="确认删除这条记录？"
                ok-text="删除"
                cancel-text="取消"
                @confirm="onDelete(item)"
              >
                <Button type="primary" danger ghost>删除</Button>
              </Popconfirm>
            </div>
          </Card>

          <MobilePagination
            :current="pagination.current"
            :page-size="pagination.pageSize"
            :total="pagination.total"
            @change="onPageChange"
          />
        </div>

        <Empty v-if="listIsEmpty" class="py-10" description="暂无数据" />
      </Spin>

      <MobileFloatingAction @click="onCreate" />
    </template>
  </MobilePage>
</template>

<style scoped>
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 32px;
  padding: 0 2px;
}

.search-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.filter-toggle-button {
  min-width: 88px;
}

.filter-toggle-button :deep(.anticon) {
  margin-right: 4px;
}

.flex-1 {
  flex: 1;
}

.brand-list {
  padding-bottom: 8px;
}

.brand-card {
  margin-bottom: 12px;
  overflow: hidden;
  font-size: 14px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.card-header {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.brand-name {
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  word-break: break-word;
  white-space: normal;
}

.dark .brand-name {
  color: #e5e7eb;
}

.status-tags {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
  max-width: 132px;
}

.status-tags :deep(.ant-tag) {
  margin-inline-end: 0;
}

.card-content {
  padding: 16px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.col-span-2 {
  grid-column: span 2 / span 2;
}

.info-label {
  margin-bottom: 2px;
  font-size: 13px;
  color: #969799;
}

.dark .info-label {
  color: #a0a0a0;
}

.info-value {
  min-width: 0;
  font-size: 14px;
  color: #323233;
  word-break: break-word;
}

.dark .info-value {
  color: #e0e0e0;
}

.break-all {
  word-break: break-all;
}

.remark-info {
  padding: 10px 12px;
  margin-top: 12px;
  font-size: 13px;
  line-height: 1.5;
  color: #646566;
  background-color: #f7f8fa;
  border-radius: 6px;
}

.dark .remark-info {
  color: #c0c0c0;
  background-color: #3a3a3a;
}

.remark-label {
  margin-right: 4px;
  font-weight: 600;
}

.remark-text {
  word-break: break-all;
  white-space: pre-wrap;
}

.card-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  width: 100%;
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
}
</style>
