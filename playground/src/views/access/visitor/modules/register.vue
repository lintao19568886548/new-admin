<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Button, Form, Input, message, Select, Textarea } from 'ant-design-vue';
import dayjs from 'dayjs';

import { createVisitor } from '#/api/access/visitor';
import { getParkList } from '#/api/park';

const route = useRoute();

const statusOptions = [
  { label: '进入', value: 0 },
  { label: '离开', value: 1 },
];

const formData = reactive({
  carNum: '',
  parkId: undefined as number | undefined,
  phoneNumber: '',
  remark: '',
  status: 0,
  visitorName: '',
});

const parkOptions = ref<{ label: string; value: number }[]>([]);
const submitting = ref(false);

const submitText = computed(() =>
  submitting.value ? '提交中...' : '提交登记',
);

function getQueryParkId() {
  const raw = Array.isArray(route.query.id)
    ? route.query.id[0]
    : route.query.id;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

async function fetchParkOptions() {
  try {
    const response = await getParkList();
    const parks = Array.isArray(response)
      ? response
      : (response as any)?.items || (response as any)?.data?.items || [];
    parkOptions.value = parks.map((park: any) => ({
      label: park.parkName,
      value: park.parkId,
    }));

    const queryParkId = getQueryParkId();
    if (queryParkId) {
      formData.parkId = queryParkId;
    } else if (parkOptions.value.length === 1) {
      formData.parkId = parkOptions.value[0]?.value;
    }
  } catch (error) {
    console.error('获取园区列表失败:', error);
    message.error('获取园区列表失败');
  }
}

function validateForm() {
  if (!formData.parkId) {
    message.warning('请选择园区');
    return false;
  }
  if (!formData.visitorName.trim()) {
    message.warning('请输入姓名');
    return false;
  }
  if (!/^1[3-9]\d{9}$/.test(formData.phoneNumber.trim())) {
    message.warning('请输入正确的手机号码');
    return false;
  }
  if (!formData.remark.trim()) {
    message.warning('请输入来访原因');
    return false;
  }
  return true;
}

function resetForm() {
  formData.visitorName = '';
  formData.phoneNumber = '';
  formData.carNum = '';
  formData.remark = '';
  formData.status = 0;
}

async function handleSubmit() {
  if (!validateForm()) return;

  submitting.value = true;
  try {
    await createVisitor({
      carNum: formData.carNum.trim(),
      parkId: formData.parkId,
      phoneNumber: formData.phoneNumber.trim(),
      registerTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      remark: formData.remark.trim(),
      status: formData.status,
      visitorName: formData.visitorName.trim(),
    });
    message.success('访客登记成功');
    resetForm();
  } catch (error) {
    console.error('访客登记失败:', error);
    message.error('提交失败，请检查网络连接');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  document.title = '访客登记';
  void fetchParkOptions();
});
</script>

<template>
  <div class="visitor-register-page">
    <section class="register-panel">
      <div class="page-title">访客登记</div>
      <div class="page-subtitle">请填写来访信息，提交后自动记录到访客管理</div>

      <Form layout="vertical" :model="formData" class="register-form">
        <Form.Item label="园区" required>
          <Select
            v-model:value="formData.parkId"
            :options="parkOptions"
            placeholder="请选择园区"
            allow-clear
          />
        </Form.Item>
        <Form.Item label="姓名" required>
          <Input
            v-model:value="formData.visitorName"
            autocomplete="name"
            placeholder="请输入姓名"
            allow-clear
          />
        </Form.Item>
        <Form.Item label="手机号" required>
          <Input
            v-model:value="formData.phoneNumber"
            autocomplete="tel"
            inputmode="numeric"
            :maxlength="11"
            placeholder="请输入手机号"
            allow-clear
          />
        </Form.Item>
        <Form.Item label="车牌号">
          <Input
            v-model:value="formData.carNum"
            placeholder="例：粤A12345"
            allow-clear
          />
        </Form.Item>
        <Form.Item label="访问状态">
          <Select
            v-model:value="formData.status"
            :options="statusOptions"
            placeholder="请选择访问状态"
          />
        </Form.Item>
        <Form.Item label="来访原因" required>
          <Textarea
            v-model:value="formData.remark"
            placeholder="请输入来访原因"
            :rows="4"
            :maxlength="100"
            show-count
          />
        </Form.Item>
      </Form>
    </section>

    <div class="submit-bar">
      <Button class="flex-1" @click="resetForm">重置</Button>
      <Button
        type="primary"
        class="flex-1"
        :loading="submitting"
        @click="handleSubmit"
      >
        {{ submitText }}
      </Button>
    </div>
  </div>
</template>

<style scoped>
.visitor-register-page {
  box-sizing: border-box;
  min-height: 100%;
  padding: 12px;
  padding-bottom: calc(88px + env(safe-area-inset-bottom));
  background-color: #f0f2f5;
}

.dark .visitor-register-page {
  background-color: #1a1a1a;
}

.register-panel {
  padding: 16px 12px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.dark .register-panel {
  background-color: #2d2d2d;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
}

.dark .page-title {
  color: #f9fafb;
}

.page-subtitle {
  margin-top: 4px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #6b7280;
}

.dark .page-subtitle {
  color: #9ca3af;
}

.register-form :deep(.ant-form-item) {
  margin-bottom: 14px;
}

.submit-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 30;
  display: flex;
  gap: 10px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  background-color: #fff;
  border-top: 1px solid #eef0f3;
}

.dark .submit-bar {
  background-color: #1f2937;
  border-top-color: #374151;
}

.flex-1 {
  flex: 1;
}
</style>
