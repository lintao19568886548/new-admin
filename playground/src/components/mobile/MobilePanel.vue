<script lang="ts" setup>
withDefaults(
  defineProps<{
    tight?: boolean;
  }>(),
  {
    tight: false,
  },
);
</script>

<template>
  <section class="mobile-panel" :class="{ 'mobile-panel--tight': tight }">
    <slot></slot>
  </section>
</template>

<style scoped>
.mobile-panel {
  padding: 12px 8px;
  margin-bottom: 8px;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
}

.mobile-panel--tight {
  padding: 8px;
}

.dark .mobile-panel {
  background-color: #2d2d2d;
}
</style>
