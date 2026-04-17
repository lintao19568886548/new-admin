<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';

import { $t } from '@vben/locales';
import { useUserStore } from '@vben/stores';

import { MobileOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';

import {
  sendPageAccessSmsCodeApi,
  verifyPageAccessSmsCodeApi,
} from '#/api/page-access';

defineOptions({ name: 'SmsVerificationModal' });

const props = defineProps<{
  codeLength?: number;
  title?: string;
}>();

const emit = defineEmits<{
  cancel: [];
  success: [];
}>();

const modalOpen = ref(false);

const sendCodeLoading = ref(false);
const submitLoading = ref(false);
const verificationCode = ref('');
const codeInputFocused = ref(false);
const codeErrorMessage = ref('');
const codeInputRef = ref<HTMLInputElement>();
const countdownTimer = ref<number>();
const CODE_LENGTH = Math.max(1, props.codeLength || 6);
const PHONE_REGEXP = /^\d{11}$/;
const ACCOUNT_PHONE_ERROR_MESSAGE =
  '当前登录账号未绑定有效手机号，请联系管理员';
const activePhoneNumber = ref('');
const userStore = useUserStore();

function normalizePhoneNumber(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

const currentUserPhoneNumber = computed(() => {
  const username = normalizePhoneNumber(userStore.userInfo?.username);
  if (PHONE_REGEXP.test(username)) {
    return username;
  }

  const phoneNumber = normalizePhoneNumber(userStore.userInfo?.phone);
  if (PHONE_REGEXP.test(phoneNumber)) {
    return phoneNumber;
  }

  return '';
});

const canSendCode = computed(() => PHONE_REGEXP.test(activePhoneNumber.value));
const codeDigits = computed(() =>
  Array.from({ length: CODE_LENGTH }, (_, index) => {
    return verificationCode.value[index] || '';
  }),
);
const activeCodeIndex = computed(() => {
  if (!codeInputFocused.value) {
    return -1;
  }
  return Math.min(verificationCode.value.length, CODE_LENGTH - 1);
});
const sendCodeText = computed(() => {
  if (sendCodeLoading.value) {
    return $t('page.auth.sendingCode');
  }
  return countdown.value > 0
    ? $t('authentication.sendText', [countdown.value])
    : $t('authentication.sendCode');
});
const sendCodeDisabled = computed(() => {
  return !canSendCode.value || sendCodeLoading.value || countdown.value > 0;
});

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
    const response = await sendPageAccessSmsCodeApi();
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

function clearCountdownTimer() {
  if (countdownTimer.value !== undefined) {
    window.clearTimeout(countdownTimer.value);
    countdownTimer.value = undefined;
  }
}

function startCountdown() {
  clearCountdownTimer();
  if (countdown.value <= 0) {
    return;
  }

  countdownTimer.value = window.setTimeout(() => {
    countdown.value -= 1;
    startCountdown();
  }, 1000);
}

function updateVerificationCode(value: string) {
  verificationCode.value = value.replaceAll(/\D/g, '').slice(0, CODE_LENGTH);
  codeErrorMessage.value = '';
}

function focusCodeInput() {
  if (!canSendCode.value) {
    return;
  }
  codeInputRef.value?.focus();
}

function handleCodeInput(event: Event) {
  const target = event.target as HTMLInputElement;
  updateVerificationCode(target.value);
}

function handleCodePaste(event: ClipboardEvent) {
  event.preventDefault();
  updateVerificationCode(event.clipboardData?.getData('text') || '');
}

async function handleSendCodeClick() {
  if (sendCodeDisabled.value) {
    return;
  }

  sendCodeLoading.value = true;
  try {
    const targetPhoneNumber = normalizePhoneNumber(activePhoneNumber.value);
    if (!targetPhoneNumber || !PHONE_REGEXP.test(targetPhoneNumber)) {
      throw new Error(ACCOUNT_PHONE_ERROR_MESSAGE);
    }
    await sendCodeApi(targetPhoneNumber);
    countdown.value = 60;
    startCountdown();
    await nextTick();
    focusCodeInput();
  } finally {
    sendCodeLoading.value = false;
  }
}

function syncFormState() {
  activePhoneNumber.value = currentUserPhoneNumber.value;
  verificationCode.value = '';
  codeInputFocused.value = false;
  codeErrorMessage.value = '';
  countdown.value = 0;
  submitLoading.value = false;
  sendCodeLoading.value = false;
  clearCountdownTimer();
}

async function handleSubmit() {
  if (!canSendCode.value) {
    message.error(ACCOUNT_PHONE_ERROR_MESSAGE);
    return;
  }
  if (verificationCode.value.length !== CODE_LENGTH) {
    codeErrorMessage.value = $t('authentication.codeTip', [CODE_LENGTH]);
    focusCodeInput();
    return;
  }

  submitLoading.value = true;
  try {
    await verifyPageAccessSmsCodeApi({
      code: verificationCode.value,
    });
    emit('success');
    close();
    message.success('验证成功');
  } catch (error) {
    const messageContent = resolveErrorMessage(error);
    codeErrorMessage.value = messageContent;
  } finally {
    submitLoading.value = false;
  }
}

// 取消验证
function handleCancel() {
  emit('cancel');
  close();
}

function open() {
  syncFormState();
  modalOpen.value = true;
  nextTick(() => {
    focusCodeInput();
  });
}

function close() {
  modalOpen.value = false;
  syncFormState();
}

defineExpose({
  close,
  open,
});

onBeforeUnmount(() => {
  clearCountdownTimer();
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
    <div class="pt-[2px]">
      <div
        class="mx-1 mb-3.5 rounded-[18px] border px-4 py-[13px] [background:rgb(248_250_252_/_96%)] dark:border-[#404040] dark:[background:rgb(38_38_38_/_96%)]"
        :class="
          activePhoneNumber
            ? 'border-[#e2e8f0]'
            : 'border-[#fecaca] [background:rgb(254_242_242_/_96%)] dark:border-[#7f1d1d] dark:[background:rgb(69_10_10_/_40%)]'
        "
      >
        <span
          class="block text-xs leading-none text-[#64748b] dark:text-[#cbd5e1]"
        >
          当前验证手机号
        </span>
        <div
          class="mt-2.5 inline-flex items-center gap-2 text-base font-semibold leading-[1.2] text-[#0f172a] dark:text-[#f8fafc]"
        >
          <MobileOutlined />
          <span>{{ activePhoneNumber || '未绑定手机号' }}</span>
        </div>
      </div>
      <div class="px-1 pb-2">
        <div
          class="mb-3 flex items-center gap-2 px-1 text-xs leading-[1.5] text-[#64748b] dark:text-[#cbd5e1]"
          :class="activePhoneNumber ? '' : 'text-[#b91c1c] dark:text-[#fca5a5]'"
        ></div>
        <div
          class="rounded-[18px] border border-[#e2e8f0] bg-white px-4 pb-2 pt-[14px] dark:border-[#404040] dark:[background:rgb(23_23_23_/_92%)]"
        >
          <div
            class="mb-3 text-sm font-semibold leading-[1.4] text-[#0f172a] dark:text-[#f8fafc]"
          >
            验证码
          </div>
          <div class="space-y-3">
            <div
              class="relative min-w-0"
              :class="activePhoneNumber ? '' : 'pointer-events-none opacity-65'"
              @click="focusCodeInput"
            >
              <input
                ref="codeInputRef"
                :value="verificationCode"
                :maxlength="CODE_LENGTH"
                autocomplete="one-time-code"
                class="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
                inputmode="numeric"
                @blur="codeInputFocused = false"
                @focus="codeInputFocused = true"
                @input="handleCodeInput"
                @keydown.enter.prevent="handleSubmit"
                @paste="handleCodePaste"
              />
              <div
                class="grid gap-2"
                :style="{
                  gridTemplateColumns: `repeat(${CODE_LENGTH}, minmax(0, 1fr))`,
                }"
              >
                <div
                  v-for="(digit, index) in codeDigits"
                  :key="index"
                  class="flex h-[54px] items-center justify-center rounded-[14px] border text-[20px] font-semibold tabular-nums transition-all duration-150"
                  :class="
                    index === activeCodeIndex
                      ? 'border-[#3b82f6] bg-[#eff6ff] text-[#0f172a] shadow-[0_0_0_3px_rgb(59_130_246_/_14%)] dark:border-[#60a5fa] dark:bg-[rgb(30_41_59_/_90%)] dark:text-[#f8fafc] dark:shadow-[0_0_0_3px_rgb(96_165_250_/_18%)]'
                      : digit
                        ? 'border-[#bfdbfe] bg-[#f8fbff] text-[#0f172a] dark:border-[#334155] dark:bg-[rgb(23_23_23_/_92%)] dark:text-[#f8fafc]'
                        : 'border-[#d7dee8] bg-[#f8fafc] text-[#0f172a] dark:border-[#404040] dark:bg-[rgb(38_38_38_/_96%)] dark:text-[#f8fafc]'
                  "
                >
                  <span>{{ digit || '' }}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              class="flex h-[50px] w-full items-center justify-center rounded-[14px] border text-sm font-semibold transition-all duration-150"
              :class="
                sendCodeDisabled
                  ? 'cursor-not-allowed border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8] dark:border-[#404040] dark:bg-[rgb(38_38_38_/_96%)] dark:text-[#737373]'
                  : 'border-[#d7dee8] bg-white text-[#334155] hover:border-[#94a3b8] hover:bg-[#f8fafc] dark:border-[#404040] dark:bg-[#171717] dark:text-[#e2e8f0] dark:hover:border-[#525252] dark:hover:bg-[#202020]'
              "
              :disabled="sendCodeDisabled"
              @click="handleSendCodeClick"
            >
              {{ sendCodeText }}
            </button>
            <div
              class="min-h-5 px-1 text-xs leading-5"
              :class="
                codeErrorMessage
                  ? 'text-[#dc2626] dark:text-[#fca5a5]'
                  : 'text-[#64748b] dark:text-[#94a3b8]'
              "
            >
              {{ codeErrorMessage || `请输入收到的${CODE_LENGTH}位短信验证码` }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <div
        class="flex gap-3 border-t border-[#e2e8f0] bg-[linear-gradient(180deg,#fff_0%,#f8fafc_100%)] px-6 pb-[22px] pt-[18px] max-md:p-4"
      >
        <button
          type="button"
          class="flex-1 rounded-[14px] border border-[#d0d7e2] bg-white px-4 py-3 text-sm font-medium text-[#0f172a] transition-all hover:border-[#94a3b8] hover:bg-[#f8fafc] dark:border-[#404040] dark:bg-[#171717] dark:text-[#f8fafc] dark:hover:border-[#525252] dark:hover:bg-[#202020]"
          @click="handleCancel"
        >
          取消
        </button>
        <button
          type="button"
          class="flex-1 rounded-[14px] px-4 py-3 text-sm font-semibold text-white transition-all"
          :class="
            !canSendCode || submitLoading
              ? 'cursor-not-allowed bg-[#cbd5e1] dark:bg-[#3f3f46]'
              : 'bg-[linear-gradient(135deg,#2563eb_0%,#1d4ed8_100%)] shadow-[0_10px_20px_rgb(37_99_235_/_16%)] hover:bg-[linear-gradient(135deg,#1d4ed8_0%,#1e40af_100%)]'
          "
          :disabled="!canSendCode || submitLoading"
          @click="handleSubmit"
        >
          {{ submitLoading ? '验证中...' : '确认' }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
:deep(.sms-verification-ant-modal .ant-modal-content) {
  @apply overflow-hidden rounded-[24px] p-0 shadow-[0_24px_60px_rgb(15_23_42_/_16%)];
}

:deep(.sms-verification-ant-modal .ant-modal-header) {
  @apply border-b-0 bg-white px-6 pb-0 pt-5;
}

.dark :deep(.sms-verification-ant-modal .ant-modal-header) {
  @apply bg-[#171717];
}

:deep(.sms-verification-ant-modal .ant-modal-title) {
  @apply text-lg font-semibold;
}

:deep(.sms-verification-ant-modal .ant-modal-body) {
  @apply px-5 pb-0 pt-3;
}

:deep(.sms-verification-ant-modal .ant-modal-footer) {
  @apply mt-0 border-t-0 p-0;
}

@media (max-width: 768px) {
  :deep(.sms-verification-ant-modal .ant-modal) {
    @apply !w-[92vw] !max-w-[92vw];
  }

  :deep(.sms-verification-ant-modal .ant-modal-content) {
    display: flex;
    flex-direction: column;
    max-height: 78vh;
  }

  :deep(.sms-verification-ant-modal .ant-modal-body) {
    @apply flex-1 overflow-auto px-4;
  }
}
</style>
