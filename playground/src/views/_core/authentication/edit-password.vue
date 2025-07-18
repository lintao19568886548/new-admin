<script setup lang="ts">
import type { VbenFormSchema } from '@vben/common-ui';

import { ref } from 'vue';

import { useVbenForm, VbenButton, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { Modal } from 'ant-design-vue';

import { changePasswordApi } from '#/api';

const props = defineProps({
  open: {
    default: false,
    type: Boolean,
  },
});

const emit = defineEmits(['update:open', 'success']);

// 表单加载状态
const loading = ref(false);

// 表单架构
const formSchema: VbenFormSchema[] = [
  {
    component: 'VbenInputPassword',
    componentProps: {
      placeholder: $t('page.auth.oldPassword'),
    },
    fieldName: 'oldPassword',
    label: $t('page.auth.oldPassword'),
  },
  {
    component: 'VbenInputPassword',
    componentProps: {
      passwordStrength: true,
      placeholder: $t('page.auth.newPassword'),
    },
    fieldName: 'newPassword',
    label: $t('page.auth.newPassword'),
    renderComponentContent() {
      return {
        strengthText: () => $t('page.auth.passwordStrength'),
      };
    },
    rules: z.string().min(6, { message: $t('page.auth.passwordLengthTip') }),
  },
  {
    component: 'VbenInputPassword',
    componentProps: {
      placeholder: $t('page.auth.confirmPassword'),
    },
    dependencies: {
      rules(values: any) {
        const { newPassword } = values;
        return z
          .string({ message: '请输入密码' })
          .refine((val) => val === newPassword, {
            message: $t('page.auth.passwordNotMatch'),
          });
      },
      triggerFields: ['newPassword'], // 修改点：添加 'newPassword'
    },
    fieldName: 'confirmPassword',
    label: $t('page.auth.confirmPassword'),
  },
];

// 使用表单
const [Form, formApi] = useVbenForm({
  commonConfig: {
    hideRequiredMark: false,
  },
  schema: formSchema,
  showDefaultActions: false,
});

// 关闭模态框
function handleCancel() {
  emit('update:open', false);
  // 重置表单
  formApi.resetForm();
}

// 提交表单
async function handleSubmit() {
  try {
    // 首先进行表单校验
    const { errors, valid } = await formApi.validate();
    if (!valid) {
      // VbenForm 通常会自动显示校验错误，这里可以根据需要添加额外的日志
      console.warn('表单校验失败:', errors);
      return;
    }

    loading.value = true;
    const values = await formApi.getValues();

    const response = await changePasswordApi(values);
    if (response) {
      emit('success');
    }
    // 实际项目中，这里会调用后端API来修改密码
    // 例如:
    // const response = await yourHttpApiClient.post('/api/auth/change-password', {
    //   oldPassword: values.oldPassword,
    //   newPassword: values.newPassword,
    // });
    // if (response.success) { ... } else { throw new Error(response.message) }
    // 模拟API调用延迟
    // await new Promise((resolve) => setTimeout(resolve, 1500));
    // 假设API调用成功
    // 实际场景下，如果API调用失败，应该进入catch块
    // message.success($t('page.auth.passwordChangeSuccess'));

    handleCancel(); // 成功后关闭模态框并重置表单
  } catch (error: any) {
    console.error('修改密码操作失败:', error);
    // 向用户显示更友好的错误提示
    // 尝试从错误对象中获取后端返回的错误信息，否则显示通用错误信息
    // const errorMessage =
    //   error?.response?.data?.message || // 假设后端在 response.data.message 中返回错误信息
    //   error?.message ||
    //   $t('page.auth.passwordChangeFailed'); // 通用错误提示
    // message.error(errorMessage);
  } finally {
    loading.value = false; // 确保加载状态总是被重置
  }
}
</script>

<template>
  <Modal
    :open="props.open"
    :title="$t('page.auth.changePassword')"
    :centered="true"
    @update:open="(val) => emit('update:open', val)"
    :after-close="handleCancel"
  >
    <div class="py-4">
      <Form />
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <VbenButton variant="outline" @click="handleCancel">
          {{ $t('common.cancel') }}
        </VbenButton>
        <VbenButton
          :class="{ 'cursor-wait': loading }"
          :loading="loading"
          @click="handleSubmit"
        >
          {{ $t('common.confirm') }}
        </VbenButton>
      </div>
    </template>
  </Modal>
</template>
