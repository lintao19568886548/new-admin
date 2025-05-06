<script lang="ts" setup>
import { computed, ref } from 'vue';
// useRouter 不再需要在 data.ts 中传递，因为 ParkLabel 内部处理了
// import { useRouter } from 'vue-router';

import { useVbenModal } from '@vben/common-ui';

import { Button } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createInvestment, updateInvestment } from '#/api/investment';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref();
const getTitle = computed(() => {
  return formData.value?.investmentId
    ? $t('ui.actionTitle.edit', [$t('system.rental.tenant.item')])
    : $t('ui.actionTitle.create', [$t('system.rental.tenant.item')]);
});

// const router = useRouter(); // 不再需要在这里定义 router 给 data.ts

// modalApi 在 useVbenModal 解构赋值时获取
const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (valid) {
      modalApi.lock();
      const data = await formApi.getValues();
      const { investmentId } = modalApi.getData();
      try {
        if (data.meetingTime) {
          data.meetingTime = new Date(data.meetingTime).toISOString();
        }

        if (investmentId) {
          data.investmentId = investmentId;
          await updateInvestment(data);
        } else {
          await createInvestment(data);
        }
        modalApi.close();
        emit('success');
      } finally {
        modalApi.lock(false);
      }
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData();

      if (data) {
        formData.value = data;
        formApi.setValues(formData.value);
      } else {
        formData.value = undefined;
        formApi.resetForm();
      }
    }
  },
});

// 定义关闭模态框的函数
function closeModal() {
  modalApi.close();
  // 这里可以返回 Promise 如果 modalApi.close 是异步的，但通常不是
}

// 将 closeModal 传递给 useFormSchema
const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: useFormSchema(closeModal), // 传递 closeModal 函数
  showDefaultActions: false,
  wrapperClass: 'grid-cols-2 gap-4',
});

function resetForm() {
  formApi.resetForm();
  formApi.setValues(formData.value || {});
}

// goToRentalManage 不再需要，导航逻辑移到 ParkLabel
// function goToRentalManage() { ... }
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
