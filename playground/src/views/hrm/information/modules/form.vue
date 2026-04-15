<script lang="ts" setup>
import type { EmployeeApi } from '#/api/hrm/employee';

import { computed, h, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useDebounceFn } from '@vueuse/core';
import { Button, message, Spin } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenForm } from '#/adapter/form';
import {
  createEmployee,
  getEmployeeAccountOptions,
  updateEmployee,
} from '#/api/hrm/employee';
import { $t } from '#/locales';

import { useSchema } from '../data';

const emit = defineEmits(['success']);

const currentRecord = ref<EmployeeApi.Employee | null>(null);
const recordId = ref<null | number>(null);
const accountKeyword = ref('');
const accountLoading = ref(false);

const handleAccountSearch = useDebounceFn((value: string) => {
  accountKeyword.value = value;
}, 300);

async function fetchEmployeeAccountOptions(params?: Record<string, any>) {
  accountLoading.value = true;
  try {
    return await getEmployeeAccountOptions(params);
  } finally {
    accountLoading.value = false;
  }
}

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: useSchema({
    userSelectComponentProps: () => ({
      allowClear: true,
      api: fetchEmployeeAccountOptions,
      filterOption: false,
      labelField: 'label',
      onClear: () => {
        accountKeyword.value = '';
      },
      onSearch: handleAccountSearch,
      params: {
        employeeId: recordId.value || undefined,
        keyword: accountKeyword.value || undefined,
      },
      placeholder: '请选择绑定账号',
      showSearch: true,
      valueField: 'value',
    }),
    userSelectRenderContent: () => ({
      notFoundContent: accountLoading.value ? h(Spin) : undefined,
    }),
  }),
  showDefaultActions: false,
});

function resetForm() {
  accountKeyword.value = '';
  formApi.resetForm();
  formApi.setValues(
    currentRecord.value ?? {
      gender: '男',
      isResigned: false,
    },
  );
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
      accountKeyword.value = '';
      formApi.resetForm();
      if (data && data.employeeId) {
        recordId.value = data.employeeId;
        currentRecord.value = data;
        formApi.setValues(data);
      } else {
        recordId.value = null;
        currentRecord.value = null;
        formApi.setValues({
          gender: '男',
          isResigned: false,
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
