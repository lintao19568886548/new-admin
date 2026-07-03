<script lang="ts" setup>
withDefaults(
  defineProps<{
    bottomInset?: boolean;
  }>(),
  {
    bottomInset: true,
  },
);
</script>

<template>
  <div
    class="mobile-page"
    :class="{ 'mobile-page--bottom-inset': bottomInset }"
  >
    <slot></slot>
  </div>
</template>

<style scoped>
.mobile-page {
  box-sizing: border-box;
  min-height: 100%;
  padding: 8px;
  background-color: #f0f2f5;
}

.mobile-page--bottom-inset {
  padding-bottom: calc(88px + env(safe-area-inset-bottom));
}

.dark .mobile-page {
  background-color: #1a1a1a;
}
</style>
