import type { Ref } from 'vue';

import type SmsVerificationModal from '#/components/SmsVerificationModal.vue';

import { ref } from 'vue';

import { message } from 'ant-design-vue';

interface UseSmsActionVerificationOptions {
  modalRef?: Ref<InstanceType<typeof SmsVerificationModal> | undefined>;
  storageKey: string;
  uninitializedMessage?: string;
  validDurationMs?: number;
}

function isActionVerificationEnabled() {
  const env = import.meta.env as Record<string, string | undefined>;
  const raw = String(env.VITE_BILL_DELETE_SMS_VERIFY ?? 'true')
    .trim()
    .toLowerCase();

  return !['0', 'false', 'no', 'off'].includes(raw);
}

export function useSmsActionVerification(
  options: UseSmsActionVerificationOptions,
) {
  const modalRef =
    options.modalRef ?? ref<InstanceType<typeof SmsVerificationModal>>();
  let pendingResolver: ((value: boolean) => void) | null = null;
  let pendingPromise: null | Promise<boolean> = null;

  const validDurationMs = options.validDurationMs ?? 5 * 60 * 1000;

  function resolvePending(value: boolean) {
    pendingResolver?.(value);
    pendingResolver = null;
    pendingPromise = null;
  }

  function markVerified() {
    sessionStorage.setItem(options.storageKey, String(Date.now()));
  }

  function hasValidVerification() {
    if (validDurationMs <= 0) {
      sessionStorage.removeItem(options.storageKey);
      return false;
    }

    const verifiedAt = Number(sessionStorage.getItem(options.storageKey) || 0);
    const isValid =
      Number.isFinite(verifiedAt) &&
      verifiedAt > 0 &&
      Date.now() - verifiedAt < validDurationMs;

    if (!isValid) {
      sessionStorage.removeItem(options.storageKey);
    }

    return isValid;
  }

  async function ensureVerified() {
    if (!isActionVerificationEnabled()) {
      return true;
    }

    if (hasValidVerification()) {
      return true;
    }

    if (pendingPromise) {
      return pendingPromise;
    }

    if (!modalRef.value) {
      message.error(options.uninitializedMessage || '安全验证组件未初始化');
      return false;
    }

    pendingPromise = new Promise<boolean>((resolve) => {
      pendingResolver = resolve;
      modalRef.value?.open();
    });

    return pendingPromise;
  }

  function handleVerificationSuccess() {
    markVerified();
    resolvePending(true);
  }

  function handleVerificationCancel() {
    resolvePending(false);
  }

  return {
    ensureVerified,
    handleVerificationCancel,
    handleVerificationSuccess,
    modalRef,
  };
}
