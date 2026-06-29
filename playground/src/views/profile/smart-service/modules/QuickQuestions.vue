<script lang="ts" setup>
import type { QuickQuestion } from '../types';

import { VbenIcon } from '@vben/common-ui';

defineProps<{
  disabled?: boolean;
  questions: QuickQuestion[];
}>();

const emit = defineEmits<{
  (event: 'select', question: QuickQuestion): void;
}>();
</script>

<template>
  <div class="quick-questions">
    <button
      v-for="question in questions"
      :key="question.key"
      :disabled="disabled"
      type="button"
      @click="emit('select', question)"
    >
      <VbenIcon v-if="question.icon" :icon="question.icon" />
      {{ question.text }}
    </button>
  </div>
</template>

<style scoped>
.quick-questions {
  display: flex;
  gap: 8px;
  padding: 0 2px;
  overflow-x: auto;
  scrollbar-width: none;
}

.quick-questions::-webkit-scrollbar {
  display: none;
}

.quick-questions button {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 5px;
  align-items: center;
  justify-content: center;
  min-width: 78px;
  height: 34px;
  padding: 0 13px;
  font-size: 13px;
  font-weight: 600;
  color: #4153d6;
  cursor: pointer;
  background: rgb(255 255 255 / 58%);
  backdrop-filter: blur(16px);
  border: 1px solid rgb(255 255 255 / 66%);
  border-radius: 999px;
  box-shadow: 0 12px 28px rgb(80 93 190 / 12%);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.quick-questions button:active {
  background: rgb(255 255 255 / 72%);
  box-shadow: 0 8px 18px rgb(80 93 190 / 10%);
  transform: translateY(1px) scale(0.98);
}

.quick-questions button:disabled {
  color: #94a3b8;
  cursor: not-allowed;
  background: rgb(255 255 255 / 36%);
  border-color: rgb(255 255 255 / 42%);
}

@media (prefers-color-scheme: dark) {
  .quick-questions button {
    color: #d9e4ff;
    background: rgb(30 41 59 / 58%);
    border-color: rgb(255 255 255 / 12%);
  }

  .quick-questions button:disabled {
    color: #64748b;
    background: rgb(15 23 42 / 50%);
    border-color: rgb(255 255 255 / 8%);
  }
}
</style>
