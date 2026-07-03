<script lang="ts" setup>
import { ArrowLeft } from '@vben/icons';

import { Button } from 'ant-design-vue';

defineProps<{
  title: string;
}>();

const emit = defineEmits<{
  back: [];
}>();
</script>

<template>
  <header class="mobile-form-header">
    <Button type="text" class="mobile-form-header__back" @click="emit('back')">
      <ArrowLeft class="h-5 w-5" />
    </Button>
    <div class="mobile-form-header__title">{{ title }}</div>
    <span class="mobile-form-header__spacer"></span>
  </header>
</template>

<style scoped>
.mobile-form-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 8px;
  margin: -8px -8px 8px;
  background-color: #fff;
  border-bottom: 1px solid #eef0f3;
}

.dark .mobile-form-header {
  background-color: #1f2937;
  border-bottom-color: #374151;
}

.mobile-form-header__back,
.mobile-form-header__spacer {
  width: 40px;
  height: 40px;
}

.mobile-form-header__title {
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.dark .mobile-form-header__title {
  color: #f9fafb;
}
</style>
