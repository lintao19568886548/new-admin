<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui/form';
import type { Recordable } from '@vben/types';

import { computed, markRaw, ref, useTemplateRef } from 'vue';

import { AuthenticationCodeLogin } from '@vben/common-ui/authentication';
import { z } from '@vben/common-ui/form';
import { $t } from '@vben/locales';

import SmsCodePinInput from '#/components/SmsCodePinInput.vue';
import { preloadWhenIdle } from '#/utils/deferred-preload';
import { destroyAntdMessage, showAntdMessage } from '#/utils/lazy-antd-message';

defineOptions({ name: 'CodeLogin' });

const sendCodeLoading = ref(false);
const loginLoading = ref(false);
const CODE_LENGTH = 6;
const loginRef =
  useTemplateRef<InstanceType<typeof AuthenticationCodeLogin>>('loginRef');

preloadWhenIdle(() => import('#/api/core/auth'));
preloadWhenIdle(() => import('#/store/auth'), { delay: 2200 });

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
  await showAntdMessage('loading', {
    content: $t('page.auth.sendingCode'),
    duration: 0,
    key: messageKey,
  });
  try {
    const { sendLoginSmsCodeApi } = await import('#/api/core/auth');
    const response = await sendLoginSmsCodeApi({ phoneNumber });
    await showAntdMessage('success', {
      content: $t('page.auth.codeSentTo', [phoneNumber]),
      duration: 3,
      key: messageKey,
    });

    if (
      import.meta.env.DEV &&
      response?.debugCode &&
      typeof response.debugCode === 'string'
    ) {
      await showAntdMessage('info', {
        content: `${$t('page.auth.debugCodeLabel', '调试验证码')}: ${response.debugCode}`,
        duration: 5,
      });
    }
  } catch (error) {
    await destroyAntdMessage(messageKey);
    await showAntdMessage('error', {
      content: isHttpError(error)
        ? '验证码发送失败，请检查网络后稍后重试'
        : resolveErrorMessage(error),
      duration: 3,
      key: messageKey,
    });
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
      formFieldProps: {
        validateOnBlur: false,
        validateOnChange: false,
        validateOnInput: false,
        validateOnModelUpdate: false,
      },
      label: $t('authentication.mobile'),
      rules: z
        .string()
        .min(1, { message: $t('authentication.mobileTip') })
        .refine((value) => /^\d{11}$/.test(value), {
          message: $t('authentication.mobileErrortip'),
        }),
    },
    {
      component: markRaw(SmsCodePinInput),
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
        loading: sendCodeLoading.value,
        loadingText: $t('page.auth.sendingCode'),
        placeholder: $t('authentication.code'),
      },
      fieldName: 'code',
      label: $t('authentication.code'),
      rules: z.string().length(CODE_LENGTH, {
        message: '',
      }),
    },
  ];
});

const submitLoading = computed(
  () => sendCodeLoading.value || loginLoading.value,
);

/**
 * 异步处理登录操作
 * Asynchronously handle the login process
 * @param values 登录表单数据
 */
async function handleLogin(values: Recordable<any>) {
  loginLoading.value = true;
  try {
    const { useAuthStore } = await import('#/store/auth');
    await useAuthStore().authLoginBySmsCode(values);
  } finally {
    loginLoading.value = false;
  }
}
</script>

<template>
  <AuthenticationCodeLogin
    ref="loginRef"
    :form-schema="formSchema"
    :loading="submitLoading"
    :submit-button-text="$t('page.auth.loginOrRegister')"
    @submit="handleLogin"
  />
</template>
