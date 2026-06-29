<script lang="ts" setup>
import { nextTick, ref } from 'vue';

import { VbenIcon } from '@vben/common-ui';

import { Button, Input } from 'ant-design-vue';

defineProps<{
  loading?: boolean;
}>();

const emit = defineEmits<{
  (event: 'send', value: string): void;
  (event: 'stop'): void;
  (event: 'voice'): void;
}>();

const inputValue = defineModel<string>('value', { default: '' });
const textareaRef = ref<{
  resizableTextArea?: { textArea?: HTMLTextAreaElement };
}>();

function focus() {
  void nextTick(() => {
    textareaRef.value?.resizableTextArea?.textArea?.focus();
  });
}

function handleSend() {
  const text = inputValue.value.trim();
  if (!text) {
    return;
  }
  emit('send', text);
  focus();
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey) {
    return;
  }
  event.preventDefault();
  handleSend();
}

defineExpose({ focus });
</script>

<template>
  <div class="chat-input">
    <button
      aria-label="语音输入"
      class="chat-input__voice"
      type="button"
      @click="emit('voice')"
    >
      <VbenIcon icon="mdi:microphone-outline" />
    </button>
    <Input.TextArea
      ref="textareaRef"
      v-model:value="inputValue"
      :auto-size="{ minRows: 1, maxRows: 4 }"
      class="chat-input__textarea"
      placeholder="输入消息..."
      @keydown="handleKeydown"
    />
    <Button
      v-if="loading"
      class="chat-input__send chat-input__send--stop"
      @click="emit('stop')"
    >
      停止
    </Button>
    <Button
      v-else
      :disabled="!inputValue.trim()"
      class="chat-input__send"
      type="primary"
      @click="handleSend"
    >
      发送
    </Button>
  </div>
</template>

<style scoped>
.chat-input {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 66px;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 10px;
  background: rgb(255 255 255 / 58%);
  backdrop-filter: blur(20px);
  border: 1px solid rgb(255 255 255 / 58%);
  border-radius: 24px;
  box-shadow: 0 18px 42px rgb(64 77 142 / 14%);
}

.chat-input__voice {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  font-size: 20px;
  color: #5261d8;
  cursor: pointer;
  background: rgb(255 255 255 / 62%);
  border: 1px solid rgb(255 255 255 / 60%);
  border-radius: 50%;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 64%);
}

.chat-input__textarea {
  min-width: 0;
  border-radius: 18px;
}

.chat-input__textarea :deep(textarea) {
  min-height: 40px;
  padding: 9px 13px;
  line-height: 21px;
  color: #223047;
  resize: none;
  background: rgb(255 255 255 / 70%);
  border-color: rgb(255 255 255 / 68%);
  border-radius: 18px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 72%);
}

.chat-input__textarea :deep(textarea::placeholder) {
  color: #8390ab;
}

.chat-input__send {
  height: 40px;
  font-weight: 600;
  border: 0;
  border-radius: 18px;
  box-shadow: 0 12px 24px rgb(83 98 255 / 22%);
}

.chat-input__send--stop {
  color: #ef4444;
  background: rgb(255 255 255 / 62%);
  border: 1px solid rgb(254 202 202 / 70%);
  box-shadow: none;
}

@media (prefers-color-scheme: dark) {
  .chat-input {
    background: rgb(15 23 42 / 62%);
    border-color: rgb(255 255 255 / 10%);
  }

  .chat-input__voice {
    color: #d9e4ff;
    background: rgb(30 41 59 / 72%);
    border-color: rgb(255 255 255 / 12%);
  }

  .chat-input__textarea :deep(textarea) {
    color: #e5e7eb;
    background: rgb(15 23 42 / 70%);
    border-color: rgb(255 255 255 / 12%);
  }
}
</style>
