<script lang="ts" setup>
import type { ReimbursementItem } from './data';

import { onMounted, reactive, ref, shallowRef } from 'vue';

import { Page } from '@vben/common-ui';
import { Search } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import {
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Spin,
  Table,
  Upload,
} from 'ant-design-vue';

import { getVisitorParkList } from '#/api/park';
import {
  createReimbursement,
  deleteReimbursement,
  getReimbursementList,
} from '#/api/reimbursement';
import { $t } from '#/locales';

import { STATUS_MAP, useColumns, useFormRules } from './data';

// 控制记录弹窗的显示状态
const isRecordModalVisible = ref(false);

// 获取用户存储
const userStore = useUserStore();
const accessStore = useAccessStore();
const currentUsername = userStore.userInfo?.username || '';

// 使用shallowRef优化性能
const reimbursementList = shallowRef<ReimbursementItem[]>([]);
const loading = ref(false);

// 搜索条件
const searchForm = reactive({
  dateRange: null,
  purpose: '',
  status: undefined,
});

// 分页相关状态
const pagination = reactive({
  current: 1,
  pageSize: 10,
  pageSizeOptions: ['10', '20', '50', '100'],
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  total: 0,
});

// 状态选项
const statusOptions = Object.entries(STATUS_MAP).map(([value, item]) => ({
  label: item.text,
  value: Number(value),
}));

// 获取报销列表
async function fetchReimbursements() {
  loading.value = true;
  try {
    const params: any = {
      pageNo: pagination.current,
      pageSize: pagination.pageSize,
    };

    // 所有用户只能查看自己的申请记录
    params.username = currentUsername;

    // 添加其他搜索条件
    if (searchForm.purpose) {
      params.purpose = searchForm.purpose;
    }

    if (searchForm.status !== undefined) {
      params.status = searchForm.status;
    }

    if (searchForm.dateRange && searchForm.dateRange.length === 2) {
      params.startDate = searchForm.dateRange[0];
      params.endDate = searchForm.dateRange[1];
    }

    // 调用 API
    const res = await getReimbursementList(params);
    reimbursementList.value = res.items || [];
    // 更新分页总数
    pagination.total = res.total || 0;
  } catch (error) {
    console.error('获取报销列表失败:', error);
    message.error('获取报销列表失败');
  } finally {
    loading.value = false;
  }
}

// 处理分页变化
function handleTableChange(pag: any) {
  pagination.current = pag.current;
  pagination.pageSize = pag.pageSize;
  fetchReimbursements();
}

// 撤销报销申请
async function handleCancelReimbursement(record: ReimbursementItem) {
  Modal.confirm({
    cancelText: '取消',
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

// 显示记录弹窗
function showRecordModal() {
  isRecordModalVisible.value = true;
  // 重置搜索条件以确保用户看到最新申请
  resetSearch();
}

// 处理搜索
function handleSearch() {
  pagination.current = 1; // 重置为第一页
  fetchReimbursements();
}

// 重置搜索条件
function resetSearch() {
  searchForm.dateRange = null;
  searchForm.purpose = '';
  searchForm.status = undefined;
  pagination.current = 1;
  fetchReimbursements();
}

// 处理弹窗关闭
function handleModalClose() {
  // 重置搜索条件，确保下次打开时是干净的状态
  searchForm.dateRange = null;
  searchForm.purpose = '';
  searchForm.status = undefined;
  pagination.current = 1;
}

// 表单相关
const formRef = ref();
const submitting = ref(false);
const parkList = ref([]);
const headers = ref();

// 表单数据
const formState = reactive({
  amount: undefined,
  department: undefined,
  images: [], // 添加图片列表字段
  parkId: undefined,
  payee: '',
  purpose: '',
  remark: '',
});

// 表单验证规则
const rules = useFormRules();

// 图片上传相关
const previewVisible = ref(false);
const previewImage = ref('');
const previewTitle = ref('');

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

  // 检查文件大小（限制为10MB）
  const fileSize = file.size / 1024 / 1024;
  const isLt10M = fileSize < 10;
  if (!isLt10M) {
    Modal.error({
      content: `"${file.name}" 文件大小为 ${fileSize.toFixed(2)}MB，超过了最大限制 10MB。请压缩后重新上传。`,
      title: '文件过大',
    });
    return false;
  }

  return true;
};

const handleChange = (info: any) => {
  if (info.file.status === 'uploading') {
    return;
  }
  if (info.file.status === 'done') {
    // Get this url from response in real world.
    getBase64(info.file.originFileObj);
  }
  if (info.file.status === 'error') {
    message.error('upload error');
  }
};

// 将文件转换为Base64以便预览
function getBase64(file: File) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', (error) => reject(error));
  });
}

const handlePreview = async (file: any) => {
  if (!file.url && !file.preview) {
    file.preview = (await getBase64(file.originFileObj)) as string;
  }
  previewImage.value = file.url || file.preview;
  previewVisible.value = true;
  previewTitle.value =
    file.name || file.url.slice(Math.max(0, file.url.lastIndexOf('/') + 1));
};

// 重置表单
function resetForm() {
  formRef.value?.resetFields();
}

// 提交表单
async function handleSubmit() {
  try {
    // 表单验证
    await formRef.value.validate();

    submitting.value = true;

    // 构建提交数据，添加当前日期和用户名
    const submitData = {
      ...formState,
      date: new Date().toISOString(),
      // 处理图片数据，通常只需要保存上传成功后的URL
      images: formState.images
        .filter((file: any) => file.status === 'done')
        .map((file: any) => {
          return {
            imgId: file.response?.data?.imgId,
          };
        }),
      status: 0, // 初始状态：待审核
      username: currentUsername, // 添加当前用户名
    };

    // 调用API提交数据
    await createReimbursement(submitData);

    // 提交成功后的处理
    message.success('报销申请提交成功');

    // 重置表单
    resetForm();

    // 自动显示记录弹窗
    showRecordModal();
  } catch (error) {
    console.error('提交报销申请失败:', error);
    message.error('提交报销申请失败，请重试');
  } finally {
    submitting.value = false;
  }
}

// 组件挂载时初始化
onMounted(() => {
  // 获取园区列表
  fetchParkList();
  headers.value = {
    Authorization: `Bearer ${accessStore.accessToken}`,
  };
});
</script>

<template>
  <Page>
    <Card :title="$t('报销申请')" class="mb-4">
      <Form
        :ref="(el) => (formRef = el)"
        :model="formState"
        :rules="rules"
        layout="vertical"
        name="reimbursementForm"
      >
        <Form.Item name="purpose" label="用途">
          <Input
            v-model:value="formState.purpose"
            placeholder="请输入报销用途"
            :maxlength="100"
            show-count
          />
        </Form.Item>

        <Form.Item name="amount" label="金额(元)">
          <InputNumber
            v-model:value="formState.amount"
            placeholder="请输入报销金额"
            :precision="2"
            :min="0"
            style="width: 100%"
          />
        </Form.Item>

        <Form.Item name="payee" label="领款人">
          <Input
            v-model:value="formState.payee"
            placeholder="请输入领款人姓名"
            :maxlength="50"
            show-count
          />
        </Form.Item>

        <Form.Item name="parkId" label="所属园区">
          <Select
            v-model:value="formState.parkId"
            placeholder="请选择所属园区"
            style="width: 100%"
            allow-clear
          >
            <Select.Option
              v-for="park in parkList"
              :key="park.parkId"
              :value="park.parkId"
            >
              {{ park.parkName }}
            </Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="remark" label="备注">
          <Input.TextArea
            v-model:value="formState.remark"
            placeholder="请输入备注信息（选填）"
            :maxlength="200"
            :auto-size="{ minRows: 1, maxRows: 4 }"
            show-count
          />
        </Form.Item>

        <Form.Item name="images" label="相关图片">
          <Upload
            v-model:file-list="formState.images"
            action="/api/image/upload"
            :headers="headers"
            list-type="picture-card"
            :before-upload="beforeUpload"
            @change="handleChange"
            @preview="handlePreview"
          >
            <div v-if="!formState.images || formState.images.length < 5">
              <div>上传</div>
            </div>
          </Upload>
          <Modal
            v-model:visible="previewVisible"
            :title="previewTitle"
            :footer="null"
          >
            <img alt="预览图片" style="width: 100%" :src="previewImage" />
          </Modal>
        </Form.Item>

        <div class="mt-4 flex gap-2">
          <Button @click="resetForm">重置</Button>
          <Button type="primary" @click="handleSubmit" :loading="submitting">
            提交申请
          </Button>
          <Button @click="showRecordModal">申请记录</Button>
        </div>
      </Form>
    </Card>

    <!-- 记录列表弹窗 -->
    <Modal
      v-model:visible="isRecordModalVisible"
      :title="$t('我的报销申请')"
      width="85%"
      :footer="null"
      :destroy-on-close="true"
      @cancel="handleModalClose"
    >
      <!-- 搜索区域 -->
      <div class="mb-4 flex flex-wrap gap-2">
        <DatePicker.RangePicker
          v-model:value="searchForm.dateRange"
          placeholder="选择申请日期范围"
          class="w-64"
        />
        <Input
          v-model:value="searchForm.purpose"
          placeholder="搜索用途"
          class="w-48"
          allow-clear
        />
        <Select
          v-model:value="searchForm.status"
          :options="statusOptions"
          placeholder="选择状态"
          class="w-32"
          allow-clear
        />
        <Button type="primary" @click="handleSearch">
          <Search class="mr-1 h-4 w-4" />
          搜索
        </Button>
        <Button @click="resetSearch">重置</Button>
      </div>

      <Spin :spinning="loading" tip="加载中...">
        <Table
          :columns="useColumns(handleCancelReimbursement)"
          :data-source="reimbursementList"
          row-key="id"
          :pagination="pagination"
          @change="handleTableChange"
          :scroll="{ x: 1200 }"
        >
          <template #emptyText>
            <Empty :description="loading ? '加载中...' : '暂无数据'" />
          </template>
        </Table>
      </Spin>
    </Modal>
  </Page>
</template>

<style scoped>
.ant-btn {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
