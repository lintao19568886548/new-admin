<script lang="ts" setup>
import type { LeaveApplication } from '#/api/hrm/leaveapplication';

import { computed, ref } from 'vue';

import { useVbenForm, useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';
import { formatDateTime } from '@vben/utils';

import { message } from 'ant-design-vue';

import {
  createLeaveApplication,
  updateLeaveApplication,
} from '#/api/hrm/leaveapplication';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);

const recordId = ref();
const getTitle = computed(() => {
  return recordId.value ? `编辑请假申请` : '新增请假申请';
});

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    try {
      // 验证表单数据
      const { valid } = await formApi.validate();
      if (!valid) return;
      const values = await formApi.getValues();
      modalApi.lock();
      if (values.startDate) {
        values.startDate = new Date(values.startDate).toISOString();
      }
      if (values.endDate) {
        values.endDate = new Date(values.endDate).toISOString();
      }

      const { realName } = useUserStore().userInfo || {};
      if (recordId.value) {
        await updateLeaveApplication(recordId.value, {
          ...values,
          username: realName,
        });
        message.success('请假申请更新成功');
      } else {
        await createLeaveApplication({ ...values, username: realName });
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
      const data = modalApi.getData<LeaveApplication>();
      if (data) {
        recordId.value = data.id;
        if (data.startDate) {
          data.startDate = formatDateTime(data.startDate) as string;
        }
        if (data.endDate) {
          data.endDate = formatDateTime(data.endDate) as string;
        }
        formApi.setValues(data);
      } else {
        recordId.value = undefined;
        formApi.resetForm();
      }
    }
  },
});
</script>

<template>
  <Modal :title="getTitle">
    <Form />
  </Modal>
</template>
