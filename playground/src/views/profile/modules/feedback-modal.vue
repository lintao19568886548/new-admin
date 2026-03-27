<script lang="ts" setup>
import { computed, reactive, ref } from 'vue';

import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import { Capacitor } from '@capacitor/core';
import { Form, Input, message, Modal, Select, Upload } from 'ant-design-vue';

import { submitUserFeedbackApi } from '#/api';

type FeedbackCategory = 'bug' | 'experience' | 'feature' | 'other';

interface FeedbackFormState {
  category: FeedbackCategory;
  contact: string;
  content: string;
  images: any[];
}

const props = defineProps({
  open: {
    default: false,
    type: Boolean,
  },
});

const emit = defineEmits(['submitted', 'update:open']);

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
const accessStore = useAccessStore();

const feedbackSubmitting = ref(false);
const feedbackFormRef = ref();
const previewImage = ref('');
const previewTitle = ref('');
const previewVisible = ref(false);

const feedbackTypeOptions: Array<{
  label: string;
  value: FeedbackCategory;
}> = [
  {
    label: '功能建议',
    value: 'feature',
  },
  {
    label: '问题异常',
    value: 'bug',
  },
  {
    label: '体验优化',
    value: 'experience',
  },
  {
    label: '其他反馈',
    value: 'other',
  },
];

const feedbackForm = reactive<FeedbackFormState>({
  category: 'feature',
  contact: '',
  content: '',
  images: [],
});

const feedbackRules: Record<string, any> = {
  category: [
    {
      message: '请选择反馈类型',
      required: true,
      trigger: 'change',
      type: 'string',
    },
  ],
  contact: [
    {
      max: 50,
      message: '联系方式不能超过 50 个字符',
      trigger: 'blur',
      type: 'string',
    },
  ],
  content: [
    {
      message: '请输入反馈内容',
      required: true,
      trigger: 'blur',
      type: 'string',
    },
    {
      max: 500,
      message: '反馈内容需在 10 到 500 个字符之间',
      min: 10,
      trigger: 'blur',
      type: 'string',
    },
  ],
};

const uploadHeaders = computed(() => ({
  Authorization: accessStore.accessToken
    ? `Bearer ${accessStore.accessToken}`
    : '',
}));

function resetFeedbackForm() {
  feedbackForm.category = 'feature';
  feedbackForm.contact = '';
  feedbackForm.content = '';
  feedbackForm.images = [];
  feedbackFormRef.value?.clearValidate?.();
  previewImage.value = '';
  previewTitle.value = '';
  previewVisible.value = false;
}

function handleCancel() {
  if (feedbackSubmitting.value) {
    return;
  }
  emit('update:open', false);
}

function handleAfterClose() {
  resetFeedbackForm();
}

function beforeUpload(file: File) {
  const isImage = file.type.startsWith('image/');
  if (!isImage) {
    message.error('只能上传图片文件');
    return false;
  }

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
}

function handleUploadChange(info: any) {
  if (info.file.status === 'uploading') {
    return;
  }

  if (info.file.status === 'done') {
    const responseData = info.file.response?.data;
    if (responseData?.imgId) {
      info.file.imgId = responseData.imgId;
      info.file.thumbUrl =
        responseData.thumbUrl || responseData.url || info.file.thumbUrl;
      info.file.url =
        responseData.thumbUrl || responseData.url || info.file.url;
    } else {
      info.file.status = 'error';
      message.error(
        `文件 ${info.file.name} 上传成功，但无法获取图片ID，请检查服务器响应。`,
      );
    }
  }

  if (info.file.status === 'error') {
    message.error(`文件 ${info.file.name} 上传失败。`);
  }
}

function getBase64(file: File) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', (error) => reject(error));
  });
}

async function handlePreview(file: any) {
  if (!file.url && !file.preview && file.originFileObj) {
    file.preview = (await getBase64(file.originFileObj)) as string;
  }

  previewImage.value = file.url || file.thumbUrl || file.preview || '';
  previewVisible.value = true;
  previewTitle.value =
    file.name ||
    file.url?.slice(Math.max(0, file.url.lastIndexOf('/') + 1)) ||
    '图片预览';
}

async function handleSubmitFeedback() {
  try {
    await feedbackFormRef.value?.validate();
  } catch {
    return;
  }

  if (feedbackForm.images.some((file) => file.status === 'uploading')) {
    message.warning('图片仍在上传中，请稍后再提交');
    return;
  }
  if (feedbackForm.images.some((file) => file.status === 'error')) {
    message.warning('存在上传失败的图片，请处理后再提交');
    return;
  }

  const images = feedbackForm.images
    .filter((file) => file.status === 'done' && file.imgId)
    .map((file) => ({
      imgId: Number(file.imgId),
    }));

  feedbackSubmitting.value = true;
  try {
    await submitUserFeedbackApi({
      category: feedbackForm.category,
      clientPlatform: Capacitor.getPlatform(),
      contact: feedbackForm.contact.trim(),
      content: feedbackForm.content.trim(),
      images,
    });
    message.success('反馈已提交，感谢您的建议');
    emit('submitted');
    emit('update:open', false);
  } catch (error) {
    console.error('提交意见反馈失败:', error);
    message.error('提交失败，请稍后重试');
  } finally {
    feedbackSubmitting.value = false;
  }
}
</script>

<template>
  <Modal
    :open="props.open"
    title="意见反馈"
    :after-close="handleAfterClose"
    :cancel-button-props="{ disabled: feedbackSubmitting }"
    :closable="!feedbackSubmitting"
    :confirm-loading="feedbackSubmitting"
    :mask-closable="!feedbackSubmitting"
    cancel-text="取消"
    destroy-on-close
    ok-text="提交"
    @cancel="handleCancel"
    @ok="handleSubmitFeedback"
  >
    <Form
      ref="feedbackFormRef"
      :model="feedbackForm"
      :rules="feedbackRules"
      layout="vertical"
    >
      <Form.Item label="反馈类型" name="category">
        <Select
          v-model:value="feedbackForm.category"
          :options="feedbackTypeOptions"
          placeholder="请选择反馈类型"
        />
      </Form.Item>
      <Form.Item label="反馈内容" name="content">
        <Input.TextArea
          v-model:value="feedbackForm.content"
          :auto-size="{ maxRows: 6, minRows: 4 }"
          :maxlength="500"
          placeholder="请描述您遇到的问题、使用场景或建议..."
          show-count
        />
      </Form.Item>
      <Form.Item
        extra="支持 JPG、JPEG、PNG，单张不超过 10MB。"
        label="问题截图"
        name="images"
      >
        <Upload
          v-model:file-list="feedbackForm.images"
          :action="`${apiURL}/image/upload`"
          :headers="uploadHeaders"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          list-type="picture-card"
          multiple
          :before-upload="beforeUpload"
          @change="handleUploadChange"
          @preview="handlePreview"
        >
          <div>
            <div>上传</div>
          </div>
        </Upload>
      </Form.Item>
      <Form.Item label="联系方式" name="contact">
        <Input
          v-model:value="feedbackForm.contact"
          :maxlength="50"
          allow-clear
          placeholder="手机号 / 微信 / 邮箱（选填）"
        />
      </Form.Item>
    </Form>
    <Modal v-model:open="previewVisible" :title="previewTitle" :footer="null">
      <img alt="预览图片" style="width: 100%" :src="previewImage" />
    </Modal>
  </Modal>
</template>
