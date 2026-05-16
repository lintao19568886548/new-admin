<script lang="ts" setup>
import type { InvestmentAgent } from '../data'; // 导入 InvestmentAgent 接口

import { computed, shallowRef } from 'vue';
// useRouter 不再需要在 data.ts 中传递，因为 ParkLabel 内部处理了
// import { useRouter } from 'vue-router';

import { useVbenModal } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue'; // 导入 message 用于错误提示

import { useVbenForm } from '#/adapter/form';
import { createInvestment, updateInvestment } from '#/api/investment';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = shallowRef<InvestmentAgent | undefined>(); // 使用 shallowRef 提高性能

const getTitle = computed(() => {
  // 更新国际化键名以匹配投资代理项目上下文
  return formData.value?.investmentId
    ? $t('page.agent.edit', [$t('page.agent.item')]) // 假设存在 page.agent.edit 和 page.agent.item
    : $t('page.agent.create', [$t('page.agent.item')]); // 假设存在 page.agent.create 和 page.agent.item
});

// const router = useRouter(); // 不再需要在这里定义 router 给 data.ts

// modalApi 在 useVbenModal 解构赋值时获取
const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (valid) {
      modalApi.lock();
      const data: Partial<InvestmentAgent> = await formApi.getValues(); // 明确类型
      const originalData: InvestmentAgent | undefined =
        modalApi.getData<InvestmentAgent>();
      const investmentId = originalData?.investmentId; // 从原始数据中获取 ID

      try {
        if (data.meetingTime) {
          data.meetingTime = new Date(data.meetingTime).toISOString();
        }

        if (investmentId) {
          await updateInvestment(investmentId, data); // 假设 updateInvestment 接收 ID 和数据
          message.success(
            $t('ui.actionMessage.updateSuccess', [
              originalData?.agentName || '',
            ]),
          ); // 提示更新成功
        } else {
          await createInvestment(data as InvestmentAgent); // 确保类型匹配
          message.success(
            $t('ui.actionMessage.createSuccess', [data.agentName || '']),
          ); // 提示创建成功
        }
        modalApi.close();
        emit('success');
      } catch (error: any) {
        console.error('操作失败:', error);
        message.error(
          error?.message ||
            $t('ui.actionMessage.operationFailed', [data.agentName || '']),
        );
      } finally {
        modalApi.lock(false);
      }
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<InvestmentAgent>();
      if (data) {
        formData.value = data;
        formApi.setValues(data as any);
      } else {
        formData.value = undefined;
        formApi.resetForm();
      }
    } else {
      // 模态框关闭时重置表单，避免下次打开时显示旧数据
      formApi.resetForm();
      formData.value = undefined; // 清空数据
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
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-4',
});

function resetForm() {
  formApi.resetForm();
  formData.value = undefined;
}

// goToRentalManage 不再需要，导航逻辑移到 ParkLabel
// function goToRentalManage() { ... }

// 删除未使用的 openModal 函数
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
