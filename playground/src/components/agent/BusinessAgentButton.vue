<script lang="ts" setup>
import { computed } from 'vue';

import { VbenIcon } from '@vben/common-ui';

import { Button, Tooltip } from 'ant-design-vue';

const props = withDefaults(
  defineProps<{
    block?: boolean;
    disabled?: boolean;
    loading?: boolean;
    size?: 'large' | 'middle' | 'small';
    text?: string;
    tooltip?: string;
    type?: 'dashed' | 'default' | 'link' | 'primary' | 'text';
  }>(),
  {
    block: false,
    disabled: false,
    loading: false,
    size: 'middle',
    text: 'AI 助手',
    tooltip: '',
    type: 'default',
  },
);

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const tooltipText = computed(() => props.tooltip || props.text);

function handleClick(event: MouseEvent) {
  if (props.disabled || props.loading) {
    return;
  }
  emit('click', event);
}
</script>

<template>
  <Tooltip :title="tooltipText">
    <span :class="block ? 'block' : 'inline-flex'">
      <Button
        :block="block"
        :disabled="disabled"
        :loading="loading"
        :size="size"
        :type="type"
        @click="handleClick"
      >
        <template #icon>
          <VbenIcon icon="lucide:sparkles" />
        </template>
        <slot>{{ text }}</slot>
      </Button>
    </span>
  </Tooltip>
</template>
