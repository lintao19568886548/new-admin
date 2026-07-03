<script lang="ts" setup>
import { PlusOutlined } from '@ant-design/icons-vue';
import { Button } from 'ant-design-vue';

const emit = defineEmits<{
  click: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div class="mobile-floating-action">
      <Button
        type="primary"
        shape="circle"
        size="large"
        class="mobile-floating-action__button"
        @click="emit('click')"
      >
        <slot>
          <PlusOutlined class="text-xl" />
        </slot>
      </Button>
    </div>
  </Teleport>
</template>

<style scoped>
.mobile-floating-action {
  position: fixed;
  right: 16px;
  bottom: calc(1rem + env(safe-area-inset-bottom) + 3.25rem);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mobile-floating-action__button {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  width: 56px !important;
  height: 56px !important;
  padding: 0 !important;
  box-shadow: 0 2px 8px rgb(0 0 0 / 18%);
}
</style>
