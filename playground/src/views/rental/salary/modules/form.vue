<script lang="ts" setup>
import type { SalaryItem } from '../types';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenForm } from '#/adapter/form';
import { createSalary, updateSalary } from '#/api/rental';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<SalaryItem>();

const getTitle = computed(() => {
  return formData.value?.salaryId
    ? $t('ui.actionTitle.edit', [$t('system.rental.salary.item')])
    : $t('ui.actionTitle.create', [$t('system.rental.salary.item')]);
});

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: useFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-4',
});

function transformToFormValues(data?: SalaryItem) {
  if (!data) {
    return {
      issued: 'false',
      issueDate: undefined,
      phoneNumber: '',
      remark: '',
      rentalTenantId: undefined,
      salaryAmount: undefined,
      tenantName: '',
    };
  }

  return {
    issued: data.issued ? 'true' : 'false',
    issueDate: data.issueDate
      ? dayjs(data.issueDate).format('YYYY-MM-DD')
      : undefined,
    phoneNumber: data.phoneNumber ?? '',
    remark: data.remark ?? '',
    rentalTenantId: data.rentalTenantId,
    salaryAmount: data.salaryAmount ?? undefined,
    tenantName: data.tenantName ?? '',
  };
}

function resetForm() {
  formApi.resetForm();
  formApi.setValues(transformToFormValues(formData.value));
}

const id = ref<number>();

const [Modal, modalApi] = useVbenModal({
  class: 'w-[90%] md:w-[70%] lg:w-[50%]',
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;

    const values = await formApi.getValues<
      SalaryItem & { phoneNumber?: string; tenantName?: string }
    >();

    const payload: Record<string, any> = {
      remark: values.remark ?? null,
      rentalTenantId: Number(values.rentalTenantId),
    };

    if (values.salaryAmount !== undefined && values.salaryAmount !== null) {
      payload.salaryAmount = Number(values.salaryAmount);
    }

    payload.issued =
      typeof values.issued === 'string'
        ? values.issued === 'true'
        : Boolean(values.issued);

    if (values.issueDate) {
      const issueDate = dayjs(values.issueDate);
      payload.issueDate = issueDate.isValid()
        ? issueDate.toDate().toISOString()
        : null;
    } else {
      payload.issueDate = null;
    }

    const tenantName =
      values.tenantName ||
      formData.value?.tenantName ||
      $t('system.rental.salary.item');

    modalApi.lock();

    try {
      if (id.value) {
        await updateSalary(id.value, payload);
        message.success({
          content: $t('ui.actionMessage.updateSuccess', [tenantName]),
        });
      } else {
        await createSalary(payload);
        message.success({
          content: $t('ui.actionMessage.createSuccess', [tenantName]),
        });
      }
      emit('success');
      modalApi.close();
    } catch (error) {
      console.error('工资记录操作失败:', error);
      message.error({
        content: $t('ui.actionMessage.operationFailed', [tenantName]),
      });
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) return;

    const data = (modalApi.getData<SalaryItem>() || {}) as Record<string, any> &
      SalaryItem;
    formApi.resetForm();

    if (data && data.salaryId) {
      formData.value = {
        ...data,
        issued:
          typeof data.issued === 'string'
            ? data.issued === 'true'
            : Boolean(data.issued),
      };
      id.value = data.salaryId;

      formApi.setValues(transformToFormValues(formData.value));
    } else {
      id.value = undefined;
      formData.value = undefined;
      formApi.setValues(transformToFormValues());
    }
  },
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
