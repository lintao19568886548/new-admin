<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';

import { computed, ref } from 'vue';

import { useVbenForm, VbenButton, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { message, Modal } from 'ant-design-vue';

import {
  sendPageAccessSmsCodeApi,
  verifyPageAccessSmsCodeApi,
} from '#/api/page-access';

defineOptions({ name: 'SmsVerificationModal' });

const props = defineProps<{
  codeLength?: number;
  phoneNumber?: string;
  title?: string;
}>();

const emit = defineEmits<{
  cancel: [];
  success: [];
}>();

const modalOpen = ref(false);

const sendCodeLoading = ref(false);
const CODE_LENGTH = props.codeLength || 6;

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
    const response = await sendPageAccessSmsCodeApi({ phoneNumber });
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
    return response;
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

const countdown = ref(0);

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        disabled: !!props.phoneNumber,
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
        createText: (countdownValue: number) => {
          return countdownValue > 0
            ? $t('authentication.sendText', [countdownValue])
            : $t('authentication.sendCode');
        },
        handleSendCode: async () => {
          sendCodeLoading.value = true;
          try {
            const formValues = await formApi.getValues();
            const phoneNumber = formValues.phoneNumber;
            if (!phoneNumber || !/^\d{11}$/.test(phoneNumber)) {
              throw new Error($t('authentication.mobileErrortip'));
            }
            await sendCodeApi(phoneNumber);
            countdown.value = 60;
            startCountdown();
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

function startCountdown() {
  if (countdown.value > 0) {
    const timer = setTimeout(() => {
      countdown.value--;
      startCountdown();
    }, 1000);
    timer.unref();
  }
}

const [Form, formApi] = useVbenForm({
  commonConfig: {
    hideLabel: true,
    hideRequiredMark: true,
  },
  schema: formSchema.value,
  showDefaultActions: false,
});

async function handleSubmit() {
  const { valid } = await formApi.validate();
  const values = await formApi.getValues();
  if (!valid) {
    return;
  }

  try {
    await verifyPageAccessSmsCodeApi({
      code: values.code,
      phoneNumber: values.phoneNumber,
    });
    emit('success');
    modalOpen.value = false;
    message.success('验证成功');
  } catch (error: any) {
    message.error(error.message || '验证失败');
    throw error;
  }
}

// 取消验证
function handleCancel() {
  emit('cancel');
  modalOpen.value = false;
}

function open(phoneNumber?: string) {
  if (phoneNumber) {
    formApi.setValues({ phoneNumber });
  }
  modalOpen.value = true;
}

function close() {
  modalOpen.value = false;
}

defineExpose({
  close,
  open,
});
</script>

<template>
  <Modal
    v-model:open="modalOpen"
    :title="title || '安全验证'"
    :centered="true"
    :closable="false"
    :mask-closable="false"
    :keyboard="false"
    wrap-class-name="sms-verification-ant-modal"
  >
    <div class="p-4">
      <Form />
    </div>
    <template #footer>
      <div
        class="flex gap-2 border-t border-gray-200 p-4 dark:border-neutral-700"
      >
        <VbenButton class="flex-1" variant="outline" @click="handleCancel">
          取消
        </VbenButton>
        <VbenButton
          :loading="sendCodeLoading"
          class="flex-1"
          @click="handleSubmit"
        >
          验证并进入
        </VbenButton>
      </div>
    </template>
  </Modal>
</template>

<style>
@media (max-width: 768px) {
  .sms-verification-ant-modal .ant-modal {
    width: 92vw !important;
    max-width: 92vw !important;
  }

  .sms-verification-ant-modal .ant-modal-content {
    display: flex;
    flex-direction: column;
    height: 50vh !important;
  }

  .sms-verification-ant-modal .ant-modal-body {
    flex: 1 1 auto;
    overflow: auto;
  }

  .sms-verification-ant-modal .ant-modal-footer {
    margin-top: 0;
  }
}
</style>
