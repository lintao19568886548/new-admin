<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, ref, useTemplateRef } from 'vue';

import { AuthenticationCodeLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { message } from 'ant-design-vue';

import { sendLoginSmsCodeApi } from '#/api';
import { useAuthStore } from '#/store';

defineOptions({ name: 'CodeLogin' });

const sendCodeLoading = ref(false);
const CODE_LENGTH = 6;
const authStore = useAuthStore();
const loginRef =
  useTemplateRef<InstanceType<typeof AuthenticationCodeLogin>>('loginRef');

function resolveErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as any).message === 'string'
  ) {
    return (error as any).message;
  }
  return $t('page.auth.sendCodeFailed', '操作失败，请稍后重试');
}

function isHttpError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const maybe = error as Record<string, any>;
  return (
    'response' in maybe ||
    'status' in maybe ||
    'config' in maybe ||
    ('isAxiosError' in maybe && maybe.isAxiosError === true)
  );
}

async function sendCodeApi(phoneNumber: string) {
  const messageKey = 'sending-code';
  message.loading({
    content: $t('page.auth.sendingCode'),
    duration: 0,
    key: messageKey,
  });
  try {
    const response = await sendLoginSmsCodeApi({ phoneNumber });
    message.success({
      content: $t('page.auth.codeSentTo', [phoneNumber]),
      duration: 3,
      key: messageKey,
    });

    if (
      import.meta.env.DEV &&
      response?.debugCode &&
      typeof response.debugCode === 'string'
    ) {
      message.info({
        content: `${$t('page.auth.debugCodeLabel', '调试验证码')}: ${response.debugCode}`,
        duration: 5,
      });
    }
  } catch (error) {
    message.destroy(messageKey);
    if (!isHttpError(error)) {
      message.error({
        content: resolveErrorMessage(error),
        duration: 3,
        key: messageKey,
      });
    }
    throw error;
  }
}

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.mobile'),
      },
      fieldName: 'phoneNumber',
      label: $t('authentication.mobile'),
      rules: z
        .string()
        .min(1, { message: $t('authentication.mobileTip') })
        .refine((value) => /^\d{11}$/.test(value), {
          message: $t('authentication.mobileErrortip'),
        }),
    },
    {
      component: 'VbenPinInput',
      componentProps: {
        codeLength: CODE_LENGTH,
        createText: (countdown: number) => {
          return countdown > 0
            ? $t('authentication.sendText', [countdown])
            : $t('authentication.sendCode');
        },
        handleSendCode: async () => {
          sendCodeLoading.value = true;
          const formApi = loginRef.value?.getFormApi();
          if (!formApi) {
            sendCodeLoading.value = false;
            throw new Error('formApi is not ready');
          }
          await formApi.validateField('phoneNumber');
          const isPhoneReady = await formApi.isFieldValid('phoneNumber');
          if (!isPhoneReady) {
            sendCodeLoading.value = false;
            throw new Error('Phone number is not ready');
          }
          const { phoneNumber } = await formApi.getValues();
          try {
            await sendCodeApi(phoneNumber);
          } finally {
            sendCodeLoading.value = false;
          }
        },
        placeholder: $t('authentication.code'),
      },
      fieldName: 'code',
      label: $t('authentication.code'),
      rules: z.string().length(CODE_LENGTH, {
        message: $t('authentication.codeTip', [CODE_LENGTH]),
      }),
    },
  ];
});

const submitLoading = computed(
  () => sendCodeLoading.value || authStore.loginLoading,
);

/**
 * 异步处理登录操作
 * Asynchronously handle the login process
 * @param values 登录表单数据
 */
async function handleLogin(values: Recordable<any>) {
  await authStore.authLoginBySmsCode(values);
}
</script>

<template>
  <AuthenticationCodeLogin
    ref="loginRef"
    :form-schema="formSchema"
    :loading="submitLoading"
    @submit="handleLogin"
  />
</template>
