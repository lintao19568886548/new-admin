<script setup lang="ts">
import type { UploadFile, UploadProps } from 'ant-design-vue';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Card, message, Upload } from 'ant-design-vue';

const fileList = ref<UploadFile[]>([]);

const handleUpload: UploadProps['beforeUpload'] = (file) => {
  const isPDF = file.type === 'application/pdf';
  if (!isPDF) {
    message.error('只能上传PDF文件！');
    return false;
  }
  const isLt2M = file.size / 1024 / 1024 < 2;
  if (!isLt2M) {
    message.error('文件大小不能超过2MB！');
    return false;
  }
  return true;
};

const handleChange: UploadProps['onChange'] = (info) => {
  if (info.file.status === 'done') {
    message.success(`${info.file.name} 上传成功`);
  } else if (info.file.status === 'error') {
    message.error(`${info.file.name} 上传失败`);
  }
  fileList.value = [...info.fileList];
};
</script>

<template>
  <Page title="票据整理">
    <Card title="文件上传">
      <Upload
        v-model:file-list="fileList"
        :before-upload="handleUpload"
        :multiple="true"
        action="/upload"
        @change="handleChange"
      >
        <Button type="primary">上传文件</Button>
        <template #tip>
          <div class="ant-upload-hint mt-2">
            支持单个或批量上传，仅限PDF文件，单个文件不超过2MB
          </div>
        </template>
      </Upload>
    </Card>

    <Card title="文件列表" class="mt-4" v-if="fileList.length > 0">
      <ul class="list-none">
        <li
          v-for="file in fileList"
          :key="(file as any).uid"
          class="border-b border-[#f0f0f0] py-2 last:border-none"
        >
          {{ (file as any).name }}
        </li>
      </ul>
    </Card>
  </Page>
</template>

<style scoped>
.ant-upload-hint {
  color: rgb(0 0 0 / 45%);
}
</style>
