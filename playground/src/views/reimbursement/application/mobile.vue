<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';

import { useAccessStore, useUserStore } from '@vben/stores';

import {
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Upload,
} from 'ant-design-vue';

import { getVisitorParkList } from '#/api/park';
import { createReimbursement } from '#/api/reimbursement';
import { $t } from '#/locales';

import { useFormRules } from './data'; // Assuming data.ts has the rules

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
const tempFileNameForPreview = '';

const handleChange = (info: any) => {
  if (info.file.status === 'uploading') {
    return;
  }
  if (info.file.status === 'done') {
    // 当上传成功后，从服务器响应中提取 imgId 并附加到文件对象上
    const responseData = info.file.response?.data;
    if (responseData && responseData.imgId) {
      info.file.imgId = responseData.imgId;
    } else {
      // 如果响应格式不正确或缺少imgId，将状态标记为错误并提示
      info.file.status = 'error';
      message.error(
        `文件 ${info.file.name} 上传成功，但无法获取图片ID，请检查服务器响应。`,
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

const handlePreview = async (file: any) => {
  let previewUrl = file.url; // URL from server after upload
  if (!previewUrl && file.originFileObj) {
    // If no server URL, try to generate from local file
    previewUrl = await getBase64(file.originFileObj);
  } else if (!previewUrl && file.thumbUrl) {
    // Fallback to thumbUrl if available
    previewUrl = file.thumbUrl;
  }

  previewImage.value = previewUrl || ''; // Ensure previewImage is not undefined
  previewVisible.value = true;
  previewTitle.value =
    file.name ||
    tempFileNameForPreview ||
    (previewUrl
      ? previewUrl.slice(Math.max(0, previewUrl.lastIndexOf('/') + 1))
      : '图片预览');
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
            style="width: 100%"
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

        <Form.Item name="parkId" :label="$t('所属园区')">
          <Select
            v-model:value="formState.parkId"
            :placeholder="$t('请选择所属园区')"
            style="width: 100%"
            allow-clear
            :options="
              parkList.map((park) => ({
                label: park.parkName,
                value: park.parkId,
              }))
            "
          />
        </Form.Item>

        <!-- Department field - uncomment if needed and ensure departmentOptions is populated -->
        <!--
        <Form.Item name="department" :label="$t('部门')">
          <Select
            v-model:value="formState.department"
            placeholder="请选择部门"
            style="width: 100%"
            allow-clear
            :options="departmentOptions" // Make sure departmentOptions is defined if used
          />
        </Form.Item>
        -->

        <Form.Item name="remark" :label="$t('备注')">
          <Input.TextArea
            v-model:value="formState.remark"
            :placeholder="$t('请输入备注信息（选填）')"
            :maxlength="200"
            :auto-size="{ minRows: 2, maxRows: 4 }"
            show-count
          />
        </Form.Item>

        <Form.Item name="images" :label="$t('相关图片 (最多5张)')">
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
              <div>{{ $t('上传') }}</div>
            </div>
          </Upload>
          <Modal
            :visible="previewVisible"
            :title="previewTitle"
            :footer="null"
            @cancel="previewVisible = false"
          >
            <img alt="预览图片" style="width: 100%" :src="previewImage" />
          </Modal>
        </Form.Item>

        <div class="form-actions">
          <Button @click="resetForm" block class="reset-button">
            {{ $t('重置') }}
          </Button>
          <Button
            type="primary"
            @click="handleSubmit"
            :loading="submitting"
            block
            class="submit-button"
          >
            {{ $t('提交申请') }}
          </Button>
        </div>
      </Form>
    </div>
  </div>
</template>

<style scoped>
.mobile-reimbursement-form-container {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh; /* Ensure it takes at least full viewport height */
  padding: 16px;
  background-color: #f0f2f5;
}

.form-wrapper {
  width: 100%;
  max-width: 400px; /* Target width */
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
}

.form-title {
  margin-bottom: 20px;
  font-size: 1.5em;
  color: #333;
  text-align: center;
}

.reimbursement-form .ant-form-item {
  margin-bottom: 16px; /* Adjusted spacing for mobile */
}

.reimbursement-form .ant-input-number,
.reimbursement-form .ant-select {
  width: 100%;
}

.form-actions {
  display: flex;
  flex-direction: column; /* Stack buttons vertically */
  gap: 10px; /* Space between buttons */
  margin-top: 24px;
}

.form-actions .ant-btn {
  width: 100%; /* Make buttons full width */
}

/* Ensure picture-card items are responsive */
:deep(.ant-upload-list-picture-card .ant-upload-list-item) {
  width: calc(33.33% - 8px); /* Adjust for 3 items per row with gap */
  height: calc(33.33% - 8px);
  margin: 0 8px 8px 0;
}

:deep(.ant-upload-list-picture-card .ant-upload-select-picture-card) {
  width: calc(33.33% - 8px);
  height: calc(33.33% - 8px);
  margin: 0 8px 8px 0;
}

/* Adjust preview modal for better mobile experience if needed */
:deep(.ant-modal) {
  max-width: 90vw;
}
</style>
