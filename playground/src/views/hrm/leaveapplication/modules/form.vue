<script lang="ts" setup>
import type { Rule } from 'ant-design-vue/es/form';

import type { LeaveApplication, Park } from '#/api/hrm/leaveapplication';

import { computed, onMounted, reactive, ref, watchEffect } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import {
  Form as AForm,
  DatePicker,
  Input,
  message,
  Select,
} from 'ant-design-vue';

import {
  createLeaveApplication,
  getParkList,
  updateLeaveApplication,
} from '#/api/hrm/leaveapplication';

const emit = defineEmits(['success']);
const formData = ref<LeaveApplication>();
const getTitle = computed(() => {
  return formData.value?.id
    ? `编辑请假申请: ${formData.value.user}`
    : '新增请假申请';
});

const formState = reactive({
  endDate: '',
  park: '',
  parkId: undefined as number | undefined,
  reason: '',
  startDate: '',
  user: '',
  username: '',
});

const aFormRef = ref();
const rules: Record<string, Rule[]> = {
  endDate: [{ message: '请选择结束时间', required: true, trigger: 'change' }],
  parkId: [{ message: '请选择所在园区', required: true, trigger: 'change' }],
  reason: [{ message: '请输入请假原因', required: true, trigger: 'blur' }],
  startDate: [{ message: '请选择开始时间', required: true, trigger: 'change' }],
  user: [
    { message: '请输入申请人姓名', required: true, trigger: 'blur' },
    { max: 20, message: '姓名长度在 2-20 个字符之间', min: 2, trigger: 'blur' },
  ],
};

const parkOptions = ref<Park[]>([]);

async function fetchParks() {
  try {
    parkOptions.value = await getParkList();
  } catch {
    message.error('获取园区列表失败');
  }
}

function resetForm() {
  Object.assign(formState, {
    endDate: '',
    park: '',
    parkId: undefined,
    reason: '',
    startDate: '',
    user: '',
    username: '',
  });
  aFormRef.value?.resetFields();
}

watchEffect(() => {
  if (formData.value) {
    Object.assign(formState, {
      endDate: formData.value.endDate || '',
      park: formData.value.park || '',
      parkId: formData.value.parkId,
      reason: formData.value.reason || '',
      startDate: formData.value.startDate || '',
      user: formData.value.user || '',
      username: formData.value.username || '',
    });
  }
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    try {
      await aFormRef.value.validateFields();
      modalApi.lock();

      // 根据parkId获取park名称
      const selectedPark = parkOptions.value.find(
        (p) => p.parkId === formState.parkId,
      );
      const submitData = {
        ...formState,
        park: selectedPark?.parkName || '',
        username: formState.user, // 将user字段复制到username
      };

      if (formData.value?.id) {
        await updateLeaveApplication(formData.value.id, submitData);
        message.success('请假申请更新成功');
      } else {
        await createLeaveApplication(submitData);
        message.success('请假申请创建成功');
      }

      modalApi.close();
      emit('success');
    } catch (error: any) {
      console.error('表单验证或提交失败:', error);
      message.error(error.message || '提交失败');
    } finally {
      modalApi.lock(false);
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      fetchParks();
      const data = modalApi.getData<LeaveApplication>();
      if (data) {
        formData.value = data;
      } else {
        formData.value = undefined;
        resetForm();
      }
    }
  },
});

onMounted(() => {
  console.warn('请假申请表单组件已挂载');
});
</script>

<template>
  <Modal :title="getTitle">
    <AForm
      ref="aFormRef"
      :model="formState"
      :rules="rules"
      layout="vertical"
      class="mx-4"
    >
      <AForm.Item name="user" label="申请人" required>
        <Input v-model:value="formState.user" placeholder="请输入申请人姓名" />
      </AForm.Item>

      <AForm.Item name="parkId" label="所在园区" required>
        <Select
          v-model:value="formState.parkId"
          :options="
            parkOptions.map((p) => ({ label: p.parkName, value: p.parkId }))
          "
          placeholder="请选择所在园区"
        />
      </AForm.Item>

      <AForm.Item name="startDate" label="开始时间" required>
        <DatePicker
          v-model:value="formState.startDate"
          show-time
          class="w-full"
          placeholder="请选择开始时间"
          value-format="YYYY-MM-DD HH:mm:ss"
        />
      </AForm.Item>

      <AForm.Item name="endDate" label="结束时间" required>
        <DatePicker
          v-model:value="formState.endDate"
          show-time
          class="w-full"
          placeholder="请选择结束时间"
          value-format="YYYY-MM-DD HH:mm:ss"
        />
      </AForm.Item>

      <AForm.Item name="reason" label="请假原因" required>
        <Input.TextArea
          v-model:value="formState.reason"
          :rows="4"
          placeholder="请输入请假原因"
        />
      </AForm.Item>
    </AForm>
  </Modal>
</template>
