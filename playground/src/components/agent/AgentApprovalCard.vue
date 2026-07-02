<script lang="ts" setup>
import type { AgentRiskLevel } from '#/api/agent';

import { computed } from 'vue';

import { VbenIcon } from '@vben/common-ui';

import { Alert, Button, Card, Space, Tag } from 'ant-design-vue';

const props = withDefaults(
  defineProps<{
    approveDisabled?: boolean;
    loading?: boolean;
    reason?: string;
    rejectDisabled?: boolean;
    riskLevel?: AgentRiskLevel;
    title?: string;
  }>(),
  {
    approveDisabled: true,
    loading: false,
    reason: '',
    rejectDisabled: true,
    riskLevel: 'medium',
    title: '审批确认',
  },
);

const emit = defineEmits<{
  approve: [];
  reject: [];
}>();

const riskView = computed(() => {
  const map: Record<AgentRiskLevel, { color: string; text: string }> = {
    high: { color: 'red', text: '高风险' },
    low: { color: 'green', text: '低风险' },
    medium: { color: 'orange', text: '中风险' },
  };
  return map[props.riskLevel];
});
</script>

<template>
  <Card class="agent-approval-card" size="small">
    <template #title>
      <span class="inline-flex items-center gap-2">
        <VbenIcon icon="lucide:shield-alert" />
        {{ title }}
      </span>
    </template>
    <template #extra>
      <Tag :color="riskView.color">{{ riskView.text }}</Tag>
    </template>

    <Alert
      :message="reason || '该操作需要人工审批后才能继续执行。'"
      show-icon
      type="warning"
    />

    <Space class="mt-3">
      <Button
        :disabled="approveDisabled"
        :loading="loading"
        type="primary"
        @click="emit('approve')"
      >
        通过
      </Button>
      <Button
        danger
        :disabled="rejectDisabled"
        :loading="loading"
        @click="emit('reject')"
      >
        拒绝
      </Button>
    </Space>
  </Card>
</template>

<style lang="less" scoped>
.agent-approval-card {
  border-color: var(--ant-color-warning-border);
}
</style>
