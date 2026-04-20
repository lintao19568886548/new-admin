<script lang="ts" setup>
import type { StyleValue } from 'vue';

import { computed, nextTick, onBeforeUnmount, ref, useAttrs, watch } from 'vue';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    codeLength?: number;
    createText?: (countdown: number) => string;
    disabled?: boolean;
    handleSendCode?: () => Promise<void>;
    loading?: boolean;
    loadingText?: string;
    maxTime?: number;
    placeholder?: string;
  }>(),
  {
    codeLength: 6,
    createText: undefined,
    disabled: false,
    handleSendCode: undefined,
    loading: false,
    loadingText: '发送中...',
    maxTime: 60,
    placeholder: '',
  },
);

const emit = defineEmits<{
  blur: [];
  change: [string];
  complete: [];
  sendError: [error: unknown];
}>();

const attrs = useAttrs();
const modelValue = defineModel<string>({ default: '' });

const codeInputFocused = ref(false);
const codeInputRef = ref<HTMLInputElement>();
const countdown = ref(0);
const timer = ref<ReturnType<typeof setTimeout>>();

const codeDigits = computed(() =>
  Array.from({ length: props.codeLength }, (_, index) => {
    return modelValue.value[index] || '';
  }),
);

const activeCodeIndex = computed(() => {
  if (!codeInputFocused.value) {
    return -1;
  }
  return Math.min(modelValue.value.length, props.codeLength - 1);
});

const containerClass = computed(() => {
  return attrs.class;
});

const containerStyle = computed(() => {
  return attrs.style as StyleValue | undefined;
});

const inputId = computed(() => {
  return typeof attrs.id === 'string' ? attrs.id : undefined;
});

const inputName = computed(() => {
  return typeof attrs.name === 'string' ? attrs.name : undefined;
});

const sendButtonDisabled = computed(() => {
  return props.disabled || props.loading || countdown.value > 0;
});

const sendButtonText = computed(() => {
  if (props.loading) {
    return props.loadingText;
  }
  return props.createText?.(countdown.value) || '发送验证码';
});

watch(
  () => modelValue.value,
  (value) => {
    const normalized = normalizeCode(value);
    if (normalized !== value) {
      modelValue.value = normalized;
    }
  },
  { immediate: true },
);

function normalizeCode(value: string | undefined) {
  return (value || '').replaceAll(/\D/g, '').slice(0, props.codeLength);
}

function clearTimer() {
  if (timer.value) {
    clearTimeout(timer.value);
    timer.value = undefined;
  }
}

function startCountdown() {
  clearTimer();
  if (countdown.value <= 0) {
    return;
  }

  timer.value = setTimeout(() => {
    countdown.value -= 1;
    startCountdown();
  }, 1000);
}

function focusInput() {
  if (props.disabled) {
    return;
  }
  codeInputRef.value?.focus();
}

function updateCode(value: string) {
  const normalized = normalizeCode(value);
  if (normalized === modelValue.value) {
    return;
  }

  modelValue.value = normalized;
  emit('change', normalized);
  if (normalized.length === props.codeLength) {
    emit('complete');
  }
}

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  updateCode(target.value);
}

function handlePaste(event: ClipboardEvent) {
  event.preventDefault();
  updateCode(event.clipboardData?.getData('text') || '');
}

async function handleSend(event: MouseEvent) {
  event.preventDefault();
  if (!props.handleSendCode || sendButtonDisabled.value) {
    return;
  }

  try {
    await props.handleSendCode();
    countdown.value = props.maxTime;
    startCountdown();
    await nextTick();
    focusInput();
  } catch (error) {
    emit('sendError', error);
  }
}

onBeforeUnmount(() => {
  clearTimer();
});
</script>

<template>
  <div
    class="w-full transition-colors"
    :class="containerClass"
    :style="containerStyle"
  >
    <div class="space-y-3">
      <div
        class="relative min-w-0"
        :class="disabled ? 'pointer-events-none opacity-65' : ''"
        @click="focusInput"
      >
        <input
          :id="inputId"
          ref="codeInputRef"
          :name="inputName"
          :value="modelValue"
          :maxlength="codeLength"
          :placeholder="placeholder"
          autocomplete="one-time-code"
          class="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
          inputmode="numeric"
          @blur="
            () => {
              codeInputFocused = false;
              emit('blur');
            }
          "
          @focus="codeInputFocused = true"
          @input="handleInput"
          @paste="handlePaste"
        />
        <div
          class="grid gap-2"
          :style="{
            gridTemplateColumns: `repeat(${codeLength}, minmax(0, 1fr))`,
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
            <span>{{ digit }}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        class="flex h-[50px] w-full items-center justify-center rounded-[14px] border text-sm font-semibold transition-all duration-150"
        :class="
          sendButtonDisabled
            ? 'cursor-not-allowed border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8] dark:border-[#404040] dark:bg-[rgb(38_38_38_/_96%)] dark:text-[#737373]'
            : 'border-[#d7dee8] bg-white text-[#334155] hover:border-[#94a3b8] hover:bg-[#f8fafc] dark:border-[#404040] dark:bg-[#171717] dark:text-[#e2e8f0] dark:hover:border-[#525252] dark:hover:bg-[#202020]'
        "
        :disabled="sendButtonDisabled"
        @click="handleSend"
      >
        {{ sendButtonText }}
      </button>
    </div>
  </div>
</template>
