<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { $t } from '@vben/locales';

import { VbenModal } from '@vben-core/popup-ui';
import { VbenButton } from '@vben-core/shadcn-ui';

type AgreementModalType = 'privacy' | 'required' | 'service';

const props = withDefaults(
  defineProps<{
    agreeAndContinueText?: string;
    agreementRequiredMessage?: string;
    agreementRequiredTitle?: string;
    andText?: string;
    cancelText?: string;
    closeText?: string;
    open: boolean;
    privacyPolicyText?: string;
    serviceAgreementText?: string;
    type: AgreementModalType;
  }>(),
  {
    agreeAndContinueText: '',
    agreementRequiredMessage: '',
    agreementRequiredTitle: '',
    andText: '',
    cancelText: '',
    closeText: '',
    privacyPolicyText: '',
    serviceAgreementText: '',
  },
);

const emit = defineEmits<{
  agree: [];
  openPrivacy: [];
  openService: [];
  'update:open': [boolean];
}>();

const POPUP_Z_INDEX_FALLBACK = 2000;
const AUTH_TIP_MODAL_Z_INDEX_OFFSET = 20;

const contentCache = new Map<Exclude<AgreementModalType, 'required'>, string>();
const agreementContent = ref('');
const contentLoading = ref(false);

const isRequiredModal = computed(() => props.type === 'required');
const authTipModalZIndex = computed(() => {
  if (typeof window === 'undefined') {
    return POPUP_Z_INDEX_FALLBACK + AUTH_TIP_MODAL_Z_INDEX_OFFSET;
  }
  const popupZIndex = Number.parseInt(
    window
      .getComputedStyle(document.documentElement)
      .getPropertyValue('--popup-z-index')
      .trim(),
    10,
  );
  const baseZIndex = Number.isNaN(popupZIndex)
    ? POPUP_Z_INDEX_FALLBACK
    : popupZIndex;
  return baseZIndex + AUTH_TIP_MODAL_Z_INDEX_OFFSET;
});
const modalClass = computed(() =>
  isRequiredModal.value
    ? 'mobile-small-modal mobile-agreement-required-modal'
    : 'mobile-small-modal max-w-4xl',
);
const modalTitle = computed(() => {
  if (props.type === 'privacy') {
    return propText(
      props.privacyPolicyText,
      'authentication.privacyPolicy',
      '隐私协议',
    );
  }
  if (props.type === 'service') {
    return propText(
      props.serviceAgreementText,
      'authentication.serviceAgreement',
      '服务协议',
    );
  }
  return propText(
    props.agreementRequiredTitle,
    'authentication.agreementRequired',
    '温馨提示',
  );
});

function localeText(key: string, fallback: string) {
  const text = $t(key);
  return text && text !== key ? text : fallback;
}

function propText(text: string | undefined, key: string, fallback: string) {
  return text || localeText(key, fallback);
}

function updateOpen(open: boolean) {
  emit('update:open', open);
}

function closeModal() {
  updateOpen(false);
}

async function loadAgreementContent(
  type: Exclude<AgreementModalType, 'required'>,
) {
  const cached = contentCache.get(type);
  if (cached) {
    agreementContent.value = cached;
    return;
  }

  contentLoading.value = true;
  try {
    const module =
      type === 'privacy'
        ? await import('./隐私政策.txt?raw')
        : await import('./服务协议.txt?raw');
    const content = module.default.trim();
    contentCache.set(type, content);
    agreementContent.value = content;
  } catch (error) {
    console.error('加载协议内容失败:', error);
    agreementContent.value = localeText(
      'authentication.agreementLoadFailed',
      '协议内容加载失败，请稍后重试。',
    );
  } finally {
    contentLoading.value = false;
  }
}

watch(
  () => [props.open, props.type] as const,
  ([open, type]) => {
    if (!open || type === 'required') {
      return;
    }
    void loadAgreementContent(type);
  },
  { immediate: true },
);
</script>

<template>
  <VbenModal
    :bordered="true"
    :centered="true"
    :class="modalClass"
    :closable="false"
    content-class="bg-card text-foreground p-4 no-scrollbar"
    header-class="bg-card text-foreground px-5 py-3"
    :mobile-fullscreen="false"
    :open="open"
    :title="modalTitle"
    :z-index="authTipModalZIndex"
    @close="closeModal"
    @update:open="updateOpen"
  >
    <template #footer>
      <div
        v-if="isRequiredModal"
        class="flex w-full flex-wrap justify-center gap-3"
      >
        <VbenButton variant="outline" @click="closeModal">
          {{ propText(cancelText, 'common.cancel', '取消') }}
        </VbenButton>
        <VbenButton type="primary" @click="emit('agree')">
          {{
            propText(
              agreeAndContinueText,
              'authentication.agreeAndContinue',
              '同意并继续',
            )
          }}
        </VbenButton>
      </div>
      <div v-else class="flex w-full justify-end space-x-2">
        <VbenButton @click="closeModal">
          {{ propText(closeText, 'common.close', '关闭') }}
        </VbenButton>
      </div>
    </template>

    <template v-if="isRequiredModal">
      <div class="p-3 text-center">
        <p class="mb-3 text-sm leading-6">
          {{
            propText(
              agreementRequiredMessage,
              'authentication.agreementRequiredMessage',
              '登录前请先阅读并同意',
            )
          }}
        </p>
        <p class="mb-1 text-sm">
          <span
            class="vben-link cursor-pointer font-medium"
            @click.stop.prevent="emit('openService')"
          >
            《{{
              propText(
                serviceAgreementText,
                'authentication.serviceAgreement',
                '服务协议',
              )
            }}》
          </span>
          {{ propText(andText, 'common.and', '和') }}
          <span
            class="vben-link cursor-pointer font-medium"
            @click.stop.prevent="emit('openPrivacy')"
          >
            《{{
              propText(
                privacyPolicyText,
                'authentication.privacyPolicy',
                '隐私协议',
              )
            }}》
          </span>
        </p>
      </div>
    </template>
    <template v-else>
      <div class="max-h-96 p-4">
        <div
          v-if="contentLoading"
          class="text-muted-foreground py-8 text-center text-sm"
        >
          {{ localeText('common.loading', '加载中...') }}
        </div>
        <pre
          v-else
          class="text-foreground whitespace-pre-wrap text-sm leading-relaxed"
        >
          {{ agreementContent }}
        </pre>
      </div>
    </template>
  </VbenModal>
</template>

<style>
@media (max-width: 768px) {
  .mobile-small-modal {
    width: 90vw !important;
    max-width: 400px !important;
    height: auto !important;
    max-height: calc(
      100dvh - env(safe-area-inset-top, 0) - env(safe-area-inset-bottom, 0) -
        24px
    ) !important;
    color: hsl(var(--card-foreground));
    background-color: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius);
    box-shadow: 0 8px 24px rgb(0 0 0 / 8%);
  }

  .mobile-small-modal .ant-modal-content,
  .mobile-small-modal [data-slot='content'] {
    padding: 12px !important;
  }

  .mobile-small-modal .ant-modal-header,
  .mobile-small-modal [data-slot='header'] {
    padding: 12px 16px !important;
    font-size: 16px !important;
  }

  .mobile-small-modal .ant-modal-body,
  .mobile-small-modal [data-slot='body'] {
    padding: 16px !important;
    font-size: 14px !important;
  }

  .mobile-small-modal .ant-modal-footer,
  .mobile-small-modal [data-slot='footer'] {
    padding: 12px 16px !important;
  }

  .mobile-small-modal button {
    min-height: 40px !important;
    padding: 8px 16px !important;
    font-size: 14px !important;
  }

  .mobile-agreement-required-modal {
    width: calc(
      100vw - env(safe-area-inset-left, 0) - env(safe-area-inset-right, 0) -
        40px
    ) !important;
    max-width: 420px !important;
    height: auto !important;
    max-height: calc(
      100dvh - env(safe-area-inset-top, 0) - env(safe-area-inset-bottom, 0) -
        56px
    ) !important;
  }

  .mobile-agreement-required-modal .ant-modal-content,
  .mobile-agreement-required-modal [data-slot='content'] {
    max-height: inherit !important;
    overflow: hidden !important;
  }

  .mobile-agreement-required-modal .ant-modal-body,
  .mobile-agreement-required-modal [data-slot='body'] {
    padding: 12px !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch;
  }

  .mobile-agreement-required-modal .ant-modal-header,
  .mobile-agreement-required-modal [data-slot='header'] {
    padding: 10px 14px !important;
    font-size: 15px !important;
  }

  .mobile-agreement-required-modal .ant-modal-footer,
  .mobile-agreement-required-modal [data-slot='footer'] {
    padding: 10px 12px !important;
  }

  .mobile-agreement-required-modal button {
    min-height: 36px !important;
    padding: 6px 12px !important;
    font-size: 13px !important;
  }
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
</style>
