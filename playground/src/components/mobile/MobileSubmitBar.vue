<script lang="ts" setup>
import { Button } from 'ant-design-vue';

withDefaults(
  defineProps<{
    cancelText?: string;
    loading?: boolean;
    submitText?: string;
  }>(),
  {
    cancelText: '取消',
    loading: false,
    submitText: '保存',
  },
);

const emit = defineEmits<{
  cancel: [];
  submit: [];
}>();
</script>

<template>
  <footer class="mobile-submit-bar">
    <Button class="mobile-submit-bar__button" @click="emit('cancel')">
      {{ cancelText }}
    </Button>
    <Button
      type="primary"
      class="mobile-submit-bar__button"
      :loading="loading"
      @click="emit('submit')"
    >
      {{ submitText }}
    </Button>
  </footer>
</template>

<style scoped>
.mobile-submit-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 30;
  display: flex;
  gap: 10px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  background-color: #fff;
  border-top: 1px solid #eef0f3;
}

.dark .mobile-submit-bar {
  background-color: #1f2937;
  border-top-color: #374151;
}

.mobile-submit-bar__button {
  flex: 1;
}
</style>
