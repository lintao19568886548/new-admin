<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

// 从本地类型定义中导入 ReimbursementItem 类型
import type { ReimbursementItem } from './data';

import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue';

import { useAppConfig } from '@vben/hooks';
import { Search } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';
import { formatDateTime } from '@vben/utils';

import { LoadingOutlined } from '@ant-design/icons-vue';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Image,
  Input,
  InputNumber,
  message,
  Modal,
  Pagination,
  Row,
  Select,
  Spin,
  Tag,
  Upload,
} from 'ant-design-vue';

import { getVisitorParkList } from '#/api/park';
import {
  createReimbursement,
  deleteReimbursement,
  getReimbursementList,
} from '#/api/reimbursement';
import { $t } from '#/locales';

import { STATUS_MAP, useFormRules } from './data'; // Assuming data.ts has the rules

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
// 获取用户存储
const userStore = useUserStore();
const accessStore = useAccessStore();
const currentUsername = computed(() => userStore.userInfo?.username || '');

// 表单相关
const formRef = ref();
const submitting = ref(false);
const parkList = ref<Array<{ parkId: number | string; parkName: string }>>([]); // Added type for parkList
const headers = ref();

// 表单数据
const formState = reactive({
  amount: undefined as number | undefined,
  applicant: '',
  department: undefined as string | undefined, // Retained department from form.vue in case it's needed
  images: [] as any[], // Simplified type for now
  parkId: undefined as number | string | undefined,
  payee: '',
  purpose: '',
  remark: '',
});

// 表单验证规则
const rules = useFormRules();

// 图片上传相关
const previewVisible = ref(false);
const previewSources = ref<string[]>([]);
const previewInitial = ref(0);

// ================================= 申请记录相关 =================================
const isRecordModalVisible = ref(false);
const recordsLoading = ref(false);
const reimbursementList = shallowRef<ReimbursementItem[]>([]);

const recordSearchForm = reactive<{
  dateRange: [Dayjs, Dayjs] | undefined;
  purpose: string;
  status: number | undefined;
}>({
  dateRange: undefined,
  purpose: '',
  status: undefined,
});

const recordPagination = reactive({
  current: 1,
  pageSize: 5, // Smaller page size for mobile
  total: 0,
});

const statusOptions = Object.entries(STATUS_MAP).map(([value, item]) => ({
  label: item.text,
  value: Number(value),
}));

// 获取园区列表
async function fetchParkList() {
  try {
    const result = await getVisitorParkList({ area: 'all' });
    parkList.value = result || [];
  } catch (error) {
    console.error('获取园区列表失败:', error);
    message.error('获取园区列表失败');
  }
}

// 上传前检查
const beforeUpload = (file: File) => {
  const isImage = file.type.startsWith('image/');
  if (!isImage) {
    message.error('只能上传图片文件!');
    return false;
  }

  const fileSize = file.size / 1024 / 1024; // in MB
  const isLt10M = fileSize < 10;
  if (!isLt10M) {
    Modal.error({
      content: `"${file.name}" 文件大小为 ${fileSize.toFixed(
        2,
      )}MB，超过了最大限制 10MB。请压缩后重新上传。`,
      title: '文件过大',
    });
    return false;
  }
  return true;
};

// To store file name during getBase64 conversion
// const tempFileNameForPreview = '';

const handleChange = (info: any) => {
  if (info.file.status === 'uploading') {
    return;
  }
  if (info.file.status === 'done') {
    // 当上传成功后，从服务器响应中提取 imgId 和 url
    const responseData = info.file.response?.data;
    if (responseData && responseData.imgId && responseData.url) {
      info.file.imgId = responseData.imgId;
      info.file.url = responseData.url; // 关键：为文件对象设置URL以供预览
    } else {
      // 如果响应格式不正确，将状态标记为错误并提示
      info.file.status = 'error';
      message.error(
        `文件 ${info.file.name} 上传成功，但服务器响应格式不正确，无法预览。`,
      );
    }
  }
  if (info.file.status === 'error') {
    message.error(`文件 ${info.file.name} 上传失败。`);
  }
  // Update formState.images to ensure it reflects the Upload component's internal list
  formState.images = info.fileList;
};

function getBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.addEventListener('load', () => resolve(reader.result as string));
    reader.addEventListener('error', (event) => reject(event));
  });
}

const setPreviewVisible = (value: boolean) => {
  previewVisible.value = value;
};

const handlePreview = async (file: any) => {
  const index = formState.images.indexOf(file);
  previewInitial.value = index === -1 ? 0 : index;

  const urls = await Promise.all(
    formState.images.map(async (f: any) => {
      if (f.url) {
        return f.url;
      }
      if (f.originFileObj) {
        return await getBase64(f.originFileObj);
      }
      return f.thumbUrl;
    }),
  );
  previewSources.value = urls.filter((url): url is string => !!url);

  if (previewSources.value.length > 0) {
    previewVisible.value = true;
  }
};

// 重置表单
function resetForm() {
  formRef.value?.resetFields();
  formState.images = []; // Explicitly clear images
}

// 提交表单
async function handleSubmit() {
  if (!currentUsername.value) {
    message.error('无法获取当前用户信息，请重新登录或联系管理员。');
    return;
  }
  try {
    await formRef.value.validate();
    submitting.value = true;

    const { applicant, ...dataToSubmit } = formState;

    const submitData = {
      ...dataToSubmit,
      date: new Date().toISOString(), // Keep full ISO string like in list.vue
      images: formState.images
        .filter((file: any) => file.status === 'done' && file.imgId)
        .map((file: any) => ({ imgId: file.imgId })),
      status: 0, // 初始状态：待审核
      username: applicant,
    };

    await createReimbursement(submitData);
    message.success('报销申请提交成功');
    resetForm();
    // Consider navigation or other UX feedback for mobile after submission
  } catch (error: any) {
    console.error('提交报销申请失败:', error);
    // Check if error is a validation error (from formRef.validate())
    if (error && error.errorFields && error.errorFields.length > 0) {
      message.error('请检查表单输入项。');
    } else {
      message.error('提交报销申请失败，请重试');
    }
  } finally {
    submitting.value = false;
  }
}

// ======================= 记录弹窗逻辑 (Adapted from list.vue) =======================
async function fetchReimbursements() {
  recordsLoading.value = true;
  if (!userStore.userInfo?.realName) {
    message.error('无法获取当前用户信息，请检查登录状态。');
    recordsLoading.value = false;
    return;
  }
  try {
    const params: any = {
      pageNo: recordPagination.current,
      pageSize: recordPagination.pageSize,
      purpose: recordSearchForm.purpose || undefined,
      status: recordSearchForm.status,
    };
    if (recordSearchForm.dateRange?.length === 2) {
      params.startDate = recordSearchForm.dateRange[0]
        .startOf('day')
        .toISOString();
      params.endDate = recordSearchForm.dateRange[1].endOf('day').toISOString();
    }
    const res = await getReimbursementList(params);
    reimbursementList.value = res.items || [];
    recordPagination.total = res.total || 0;
  } catch (error) {
    console.error('获取报销列表失败:', error);
    message.error('获取报销列表失败');
  } finally {
    recordsLoading.value = false;
  }
}

function handleSearch() {
  recordPagination.current = 1;
  fetchReimbursements();
}

function handleSearchReset() {
  recordSearchForm.dateRange = undefined;
  recordSearchForm.purpose = '';
  recordSearchForm.status = undefined;
  recordPagination.current = 1;
  fetchReimbursements();
}

function handlePageChange(page: number) {
  recordPagination.current = page;
  fetchReimbursements();
}

function getStatusDisplay(status: number) {
  return (
    STATUS_MAP[status as keyof typeof STATUS_MAP] || {
      color: 'default',
      text: '未知',
    }
  );
}

// 撤销报销申请
async function handleCancelReimbursement(record: ReimbursementItem) {
  Modal.confirm({
    cancelText: '取消',
    centered: true,
    content: `确定要撤销"${record.purpose}"的报销申请吗？`,
    okText: '确认',
    onOk: async () => {
      try {
        await deleteReimbursement(Number(record.id));
        message.success('申请撤销成功');
        await fetchReimbursements();
      } catch (error) {
        console.error('撤销申请失败:', error);
        message.error('撤销申请失败，请重试');
      }
    },
    title: '确认撤销',
  });
}

// 修改报销申请
function handleModifyReimbursement(record: ReimbursementItem) {
  Modal.confirm({
    cancelText: '取消',
    centered: true,
    content: '此操作将删除原记录并重新提交。确定要继续吗？',
    okText: '确认修改',
    onOk: async () => {
      try {
        await deleteReimbursement(Number(record.id));

        formState.amount = Number(record.amount);
        formState.applicant = record.username || '';
        formState.parkId =
          typeof record.parkId === 'string'
            ? Number.parseInt(record.parkId, 10)
            : record.parkId;
        formState.payee = record.payee;
        formState.purpose = record.purpose;
        formState.remark = record.remark || '';
        formState.images = [];

        isRecordModalVisible.value = false;
        message.success('请在表单中修改后重新提交。');
      } catch (error) {
        console.error('修改申请失败:', error);
        message.error('删除原申请失败，请重试');
      }
    },
    title: '确认修改并删除原记录',
  });
}

function showRecordModal() {
  isRecordModalVisible.value = true;
}

watch(isRecordModalVisible, (visible) => {
  if (visible) {
    handleSearchReset();
  }
});

// 组件挂载时初始化
onMounted(() => {
  fetchParkList();
  if (accessStore.accessToken) {
    headers.value = {
      Authorization: `Bearer ${accessStore.accessToken}`,
    };
  } else {
    console.warn('Access token not found. Image upload might fail.');
    // Optionally, redirect to login or show an error
  }
  // If currentUsername is not available immediately, show a message or disable form
  if (!currentUsername.value) {
    message.warn('正在获取用户信息...', 2); // Display for 2 seconds
    // Could add a watch on currentUsername to enable form once available
  }
});
</script>

<template>
  <div class="mobile-reimbursement-form-container">
    <div class="form-wrapper">
      <h2 class="form-title">{{ $t('移动端报销申请') }}</h2>
      <Form
        :ref="(el) => (formRef = el)"
        :model="formState"
        :rules="rules"
        layout="vertical"
        name="reimbursementMobileForm"
        class="reimbursement-form"
        @finish="handleSubmit"
      >
        <Form.Item name="applicant" :label="$t('申请人')">
          <Input
            v-model:value="formState.applicant"
            :placeholder="$t('请输入申请人姓名')"
            :maxlength="50"
            show-count
          />
        </Form.Item>

        <Form.Item name="purpose" :label="$t('用途')">
          <Input
            v-model:value="formState.purpose"
            :placeholder="$t('请输入报销用途')"
            :maxlength="100"
            show-count
          />
        </Form.Item>

        <Form.Item name="amount" :label="$t('金额(元)')">
          <InputNumber
            v-model:value="formState.amount"
            :placeholder="$t('请输入报销金额')"
            :precision="2"
            :min="0"
            class="w-full"
          />
        </Form.Item>

        <Form.Item name="parkId" :label="$t('所属园区')">
          <Select
            v-model:value="formState.parkId"
            :options="parkList"
            :field-names="{ label: 'parkName', value: 'parkId' }"
            :placeholder="$t('请选择所属园区')"
            allow-clear
          />
        </Form.Item>

        <Form.Item name="payee" :label="$t('领款人')">
          <Input
            v-model:value="formState.payee"
            :placeholder="$t('请输入领款人姓名')"
            :maxlength="50"
            show-count
          />
        </Form.Item>

        <Form.Item name="remark" :label="$t('备注')">
          <Input.TextArea
            v-model:value="formState.remark"
            :placeholder="$t('请输入备注信息')"
            :auto-size="{ minRows: 3, maxRows: 5 }"
            :maxlength="200"
            show-count
          />
        </Form.Item>

        <Form.Item name="images" :label="$t('相关图片(最多9张)')">
          <Upload
            v-model:file-list="formState.images"
            :action="`${apiURL}/image/upload`"
            :before-upload="beforeUpload"
            :headers="headers"
            list-type="picture-card"
            @change="handleChange"
            @preview="handlePreview"
          >
            <div v-if="formState.images.length < 9">
              <LoadingOutlined v-if="submitting" />
              <div v-else>
                <div class="text-lg">+</div>
                <div>{{ $t('上传') }}</div>
              </div>
            </div>
          </Upload>
        </Form.Item>

        <div class="form-actions">
          <Button
            :loading="submitting"
            type="primary"
            html-type="submit"
            size="large"
            block
          >
            {{ $t('提交申请') }}
          </Button>
          <Button
            @click="showRecordModal"
            size="large"
            block
            class="mt-4"
            type="default"
          >
            {{ $t('查看申请记录') }}
          </Button>
        </div>
      </Form>
    </div>

    <!-- 
      Image Preview Mechanism:
      We use a hidden PreviewGroup which is controlled programmatically.
      The `handlePreview` function populates `previewSources` and toggles `previewVisible`.
      Ant Design's component handles the modal display internally.
    -->
    <div :style="{ display: 'none' }">
      <Image.PreviewGroup
        :preview="{
          visible: previewVisible,
          onVisibleChange: setPreviewVisible,
          current: previewInitial,
        }"
      >
        <Image v-for="src in previewSources" :key="src" :src="src" />
      </Image.PreviewGroup>
    </div>

    <!-- Application Records Modal -->
    <Modal
      v-model:open="isRecordModalVisible"
      title="申请记录"
      :footer="null"
      wrap-class-name="full-screen-modal"
      :destroy-on-close="true"
    >
      <div class="record-modal-content">
        <!-- Search Filters -->
        <div class="search-filters">
          <Form layout="vertical">
            <Form.Item>
              <Input
                v-model:value="recordSearchForm.purpose"
                placeholder="搜索用途"
                allow-clear
                @press-enter="handleSearch"
              >
                <template #prefix>
                  <Search class="mr-1 h-4 w-4 text-gray-400" />
                </template>
              </Input>
            </Form.Item>
            <Row :gutter="16">
              <Col :span="12">
                <Form.Item>
                  <Select
                    v-model:value="recordSearchForm.status"
                    :options="statusOptions"
                    placeholder="选择状态"
                    allow-clear
                  />
                </Form.Item>
              </Col>
              <Col :span="12">
                <Form.Item>
                  <DatePicker.RangePicker
                    v-model:value="recordSearchForm.dateRange"
                    style="width: 100%"
                  />
                </Form.Item>
              </Col>
            </Row>
            <div class="search-actions">
              <Button type="primary" @click="handleSearch" class="flex-1">
                搜索
              </Button>
              <Button @click="handleSearchReset" class="flex-1">重置</Button>
            </div>
          </Form>
        </div>

        <!-- Records List -->
        <Spin :spinning="recordsLoading" tip="加载中...">
          <div v-if="reimbursementList.length > 0" class="record-list">
            <Card
              v-for="item in reimbursementList"
              :key="item.id"
              class="record-card"
            >
              <div class="card-header">
                <span class="purpose-title">{{ item.purpose }}</span>
                <Tag :color="getStatusDisplay(item.status).color">
                  {{ getStatusDisplay(item.status).text }}
                </Tag>
              </div>
              <div class="card-content">
                <div class="amount-display">
                  <span class="amount">
                    ￥{{ Number(item.amount).toFixed(2) }}
                  </span>
                </div>
                <div class="info-item">
                  <span>申请日期: {{ formatDateTime(item.date) }}</span>
                </div>
                <div v-if="item.auditOpinion" class="info-item">
                  <span>
                    审核意见:
                    <span class="text-red-500">{{ item.auditOpinion }}</span>
                  </span>
                </div>
              </div>
              <template #actions>
                <Button
                  v-if="item.status === 0"
                  type="link"
                  size="small"
                  danger
                  @click="handleCancelReimbursement(item)"
                >
                  撤销
                </Button>
                <Button
                  v-if="item.status === 0 || item.status === 2"
                  type="link"
                  size="small"
                  @click="handleModifyReimbursement(item)"
                >
                  修改
                </Button>
              </template>
            </Card>
            <Pagination
              v-if="recordPagination.total > recordPagination.pageSize"
              v-model:current="recordPagination.current"
              :page-size="recordPagination.pageSize"
              :total="recordPagination.total"
              size="small"
              class="list-pagination"
              @change="handlePageChange"
            />
          </div>
          <Empty
            v-else
            :description="recordsLoading ? '加载中...' : '暂无申请记录'"
          />
        </Spin>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.mobile-reimbursement-form-container {
  box-sizing: border-box;
  padding: 16px;
  background-color: #f5f5f5;
}

.form-wrapper {
  padding: 16px;
  background-color: #fff;
  border-radius: 8px;
}

.form-title {
  margin-bottom: 16px;
  font-size: 18px;
  font-weight: 600;
  text-align: center;
}

.reimbursement-form .ant-form-item {
  margin-bottom: 16px;
}

.w-full {
  width: 100%;
}

.mt-4 {
  margin-top: 16px;
}

.form-actions {
  margin-top: 24px;
}

:deep(.ant-upload-list-picture-card .ant-upload-list-item) {
  width: 80px;
  height: 80px;
}

:deep(.ant-upload-select-picture-card) {
  width: 80px;
  height: 80px;
}

/* Full Screen Modal */
:deep(.full-screen-modal .ant-modal) {
  top: 0;
  width: 100% !important;
  max-width: 100vw;
  height: 100vh;
  padding: 0;
  margin: 0;
}

:deep(.full-screen-modal .ant-modal-content) {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: 0;
}

:deep(.full-screen-modal .ant-modal-header) {
  flex-shrink: 0;
}

:deep(.full-screen-modal .ant-modal-body) {
  flex-grow: 1;
  padding: 12px;
  overflow-y: auto;
  background-color: #f0f2f5;
}

.record-modal-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.search-filters {
  flex-shrink: 0;
  padding: 12px;
  margin-bottom: 12px;
  background-color: #fff;
  border-radius: 8px;
}

.search-filters .ant-form-item {
  margin-bottom: 12px;
}

.search-actions {
  display: flex;
  gap: 8px;
}

.flex-1 {
  flex: 1;
}

.record-list {
  flex-grow: 1;
}

.record-card {
  margin-bottom: 12px;
}

:deep(.record-card .ant-card-body) {
  padding: 12px 16px;
}

.record-card .card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.record-card .purpose-title {
  font-size: 16px;
  font-weight: 500;
}

.record-card .card-content .amount-display {
  margin-bottom: 8px;
}

.record-card .card-content .amount {
  font-size: 18px;
  font-weight: 600;
  color: #fa541c;
}

.record-card .card-content .info-item {
  margin-top: 4px;
  font-size: 13px;
  color: #888;
}

:deep(.record-card .ant-card-actions) {
  padding: 0;
  border-top: 1px solid #f0f0f0;
}

:deep(.record-card .ant-card-actions > li) {
  margin: 4px 0;
  font-size: 14px;
}

.list-pagination {
  padding-bottom: 16px;
  margin-top: 16px;
  text-align: center;
}
</style>
