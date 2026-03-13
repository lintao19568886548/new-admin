<script setup lang="ts">
import type { AuthenticationProps } from './types';

import { computed, watch } from 'vue';

import { useVbenModal } from '@vben-core/popup-ui';
import { Slot, VbenAvatar } from '@vben-core/shadcn-ui';

interface Props extends AuthenticationProps {
  avatar?: string;
  zIndex?: number;
}

defineOptions({
  name: 'LoginExpiredModal',
});

const props = withDefaults(defineProps<Props>(), {
  avatar: '',
  zIndex: 0,
});

const open = defineModel<boolean>('open');

const [Modal, modalApi] = useVbenModal();

const POPUP_Z_INDEX_FALLBACK = 2000;
const LOGIN_EXPIRED_MODAL_Z_INDEX_OFFSET = 10;

watch(
  () => open.value,
  (val) => {
    modalApi.setState({ isOpen: val });
  },
);

const getZIndex = computed(() => {
  if (props.zIndex > 0) {
    return props.zIndex;
  }
  return resolvePopupBaseZIndex() + LOGIN_EXPIRED_MODAL_Z_INDEX_OFFSET;
});

function resolvePopupBaseZIndex() {
  if (typeof window === 'undefined') {
    return POPUP_Z_INDEX_FALLBACK;
  }
  const popupZIndex = Number.parseInt(
    window
      .getComputedStyle(document.documentElement)
      .getPropertyValue('--popup-z-index')
      .trim(),
    10,
  );
  return Number.isNaN(popupZIndex) ? POPUP_Z_INDEX_FALLBACK : popupZIndex;
}
</script>

<template>
  <div>
    <Modal
      :closable="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :footer="false"
      :fullscreen-button="false"
      :header="false"
      :z-index="getZIndex"
      class="border-none px-10 py-6 text-center shadow-xl sm:w-[600px] sm:rounded-2xl md:h-[unset]"
    >
      <VbenAvatar :src="avatar" class="mx-auto mb-6 size-20" />
      <Slot
        :show-forget-password="false"
        :show-register="false"
        :show-remember-me="false"
        :sub-title="$t('authentication.loginAgainSubTitle')"
        :title="$t('authentication.loginAgainTitle')"
      >
        <slot> </slot>
      </Slot>
    </Modal>
  </div>
</template>
