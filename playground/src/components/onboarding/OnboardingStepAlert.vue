<script lang="ts" setup>
import type { OnboardingStatus } from '#/api/onboarding';

import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Alert, Button, Space } from 'ant-design-vue';

import { getOnboardingStatusApi } from '#/api/onboarding';
import {
  invalidateOnboardingStatusCache,
  ONBOARDING_ENTRY_PATH,
} from '#/utils/onboarding';

const props = defineProps<{
  stepKey: 'accounts' | 'factoryInfo' | 'permissions';
}>();

const route = useRoute();
const router = useRouter();
const status = ref<null | OnboardingStatus>(null);
const loading = ref(false);

const visible = computed(() => route.query.onboarding === '1');
const currentStep = computed(() =>
  status.value?.steps.find((step) => step.key === props.stepKey),
);
const nextStep = computed(() => status.value?.nextStep);
const completed = computed(() => currentStep.value?.completed === true);
const messageText = computed(() => {
  if (!currentStep.value) {
    return '完成当前配置后返回初始化总览刷新状态。';
  }
  if (completed.value) {
    return `${currentStep.value.title}已完成，可以继续下一步。`;
  }
  return currentStep.value.description;
});

async function loadStatus() {
  if (!visible.value) {
    return;
  }
  loading.value = true;
  try {
    invalidateOnboardingStatusCache();
    status.value = await getOnboardingStatusApi();
  } finally {
    loading.value = false;
  }
}

async function goOverview() {
  await router.push(ONBOARDING_ENTRY_PATH);
}

async function goNext() {
  const target = nextStep.value?.path || ONBOARDING_ENTRY_PATH;
  await router.push(target);
}

onMounted(() => {
  void loadStatus();
});
</script>

<template>
  <Alert
    v-if="visible"
    class="onboarding-step-alert"
    :message="messageText"
    show-icon
    :type="completed ? 'success' : 'info'"
  >
    <template #action>
      <Space wrap>
        <Button size="small" :loading="loading" @click="loadStatus">
          刷新状态
        </Button>
        <Button size="small" @click="goOverview">初始化总览</Button>
        <Button
          v-if="completed && nextStep"
          size="small"
          type="primary"
          @click="goNext"
        >
          下一步
        </Button>
      </Space>
    </template>
  </Alert>
</template>

<style lang="less" scoped>
.onboarding-step-alert {
  margin-bottom: 12px;
}
</style>
