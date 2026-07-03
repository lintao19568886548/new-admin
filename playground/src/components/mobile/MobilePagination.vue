<script lang="ts" setup>
import { computed } from 'vue';

import { Button } from 'ant-design-vue';

const props = withDefaults(
  defineProps<{
    current: number;
    pageSize: number;
    total: number;
  }>(),
  {
    current: 1,
    pageSize: 10,
    total: 0,
  },
);

const emit = defineEmits<{
  change: [page: number, pageSize: number];
}>();

const totalPages = computed(() => {
  if (props.total <= 0 || props.pageSize <= 0) return 0;
  return Math.ceil(props.total / props.pageSize);
});

const canGoPrevious = computed(() => props.current > 1);
const canGoNext = computed(() => {
  return totalPages.value > 0 && props.current < totalPages.value;
});

function emitChange(page: number) {
  emit('change', page, props.pageSize);
}
</script>

<template>
  <div v-if="total > 0" class="mobile-pagination">
    <Button :disabled="!canGoPrevious" @click="emitChange(current - 1)">
      上一页
    </Button>
    <span class="mobile-pagination__summary">
      {{ current }} / {{ totalPages || 1 }}
      <span class="mobile-pagination__total">共 {{ total }} 条</span>
    </span>
    <Button :disabled="!canGoNext" @click="emitChange(current + 1)">
      下一页
    </Button>
  </div>
</template>

<style scoped>
.mobile-pagination {
  display: grid;
  grid-template-columns: minmax(72px, 1fr) auto minmax(72px, 1fr);
  gap: 8px;
  align-items: center;
  padding: 4px 0 12px;
  margin-top: 10px;
}

.mobile-pagination__summary {
  min-width: 92px;
  font-size: 13px;
  line-height: 1.3;
  color: #4b5563;
  text-align: center;
}

.dark .mobile-pagination__summary {
  color: #d1d5db;
}

.mobile-pagination__total {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: #9ca3af;
}
</style>
