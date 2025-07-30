<script lang="ts" setup>
import type { EmployeeApi } from '#/api/hrm/employee';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenForm } from '#/adapter/form';
import { createEmployee, updateEmployee } from '#/api/hrm/employee';
import { $t } from '#/locales';

import { useSchema } from '../data';

const emit = defineEmits(['success']);

const recordId = ref();

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: useSchema(),
  showDefaultActions: false,
});

function resetForm() {
  formApi.resetForm();
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();

    // 在这里处理日期格式
    if (values.hireDate) {
      values.hireDate = dayjs(values.hireDate).toISOString();
    }
    if (values.leaveDate) {
      values.leaveDate = dayjs(values.leaveDate).toISOString();
    }

    modalApi.lock();

    try {
      if (recordId.value) {
        await updateEmployee(recordId.value, values as EmployeeApi.Employee);
        message.success(
          $t('ui.actionMessage.updateSuccess', [values?.name ?? '']),
        );
      } else {
        await createEmployee(values as EmployeeApi.Employee);
        message.success(
          $t('ui.actionMessage.createSuccess', [values?.name ?? '']),
        );
      }

      emit('success');
      modalApi.close();
    } catch (error: any) {
      console.error('操作失败:', error);
      message.error(
        error?.message ||
          $t('ui.actionMessage.operationFailed', [values?.name ?? '']),
      );
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<EmployeeApi.Employee>();
      formApi.resetForm();
      if (data && data.employeeId) {
        recordId.value = data.employeeId;
        formApi.setValues(data);
      } else {
        recordId.value = undefined;
        formApi.setValues({
          gender: '男',
        });
      }
    }
  },
});

const getTitle = computed(() => {
  return recordId.value
    ? $t('page.hrm.employee.edit')
    : $t('page.hrm.employee.create');
});
</script>

<template>
  <Modal :title="getTitle">
    <Form class="mx-4" />
    <template #prepend-footer>
      <div class="flex-auto">
        <Button type="primary" danger @click="resetForm">
          {{ $t('common.reset') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>
