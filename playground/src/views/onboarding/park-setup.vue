<script lang="ts" setup>
import type { OnboardingStatus, OnboardingStep } from '#/api/onboarding';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { CircleCheckBig, IconifyIcon, RotateCw } from '@vben/icons';

import {
  Button,
  Card,
  Empty,
  message,
  Progress,
  Skeleton,
  Space,
  Steps,
  Tag,
} from 'ant-design-vue';

import { getOnboardingStatusApi } from '#/api/onboarding';
import {
  invalidateOnboardingStatusCache,
  resolveOnboardingStepPath,
} from '#/utils/onboarding';

const router = useRouter();
const loading = ref(false);
const status = ref<null | OnboardingStatus>(null);

const stepIconMap = {
  accounts: 'lucide:users',
  factoryInfo: 'lucide:building-2',
  permissions: 'lucide:shield-check',
};

const currentIndex = computed(() => {
  const steps = status.value?.steps || [];
  const index = steps.findIndex((step) => !step.completed);
  return index === -1 ? steps.length : index;
});

const isCompleted = computed(() => status.value?.status === 'completed');

const completionPercent = computed(() => {
  const progress = status.value?.progress;
  if (!progress?.total) {
    return 0;
  }
  return Math.round((progress.completed / progress.total) * 100);
});

async function loadStatus() {
  loading.value = true;
  try {
    invalidateOnboardingStatusCache();
    status.value = await getOnboardingStatusApi();
  } catch (error) {
    console.error('获取初始化引导状态失败:', error);
    message.error('获取初始化引导状态失败');
  } finally {
    loading.value = false;
  }
}

async function goStep(step: OnboardingStep) {
  await router.push(step.path);
}

async function goCurrentStep() {
  if (!status.value) {
    return;
  }
  await router.push(resolveOnboardingStepPath(status.value));
}

async function goHome() {
  await router.push('/home');
}

onMounted(() => {
  void loadStatus();
});
</script>

<template>
  <Page auto-content-height content-class="onboarding-page-content">
    <div class="onboarding-shell">
      <Skeleton v-if="loading && !status" active />

      <Empty v-else-if="!status" description="暂无初始化状态">
        <Button type="primary" @click="loadStatus">重新加载</Button>
      </Empty>

      <template v-else>
        <section class="onboarding-header">
          <div>
            <h1>园区初始化</h1>
            <p>按顺序完成厂房信息、账号和权限配置，完成后进入日常工作台。</p>
          </div>

          <div class="onboarding-progress">
            <Progress
              type="circle"
              :percent="completionPercent"
              :size="84"
              :stroke-width="8"
            />
          </div>
        </section>

        <Card class="onboarding-card" :bordered="false">
          <Steps
            :current="currentIndex"
            :items="
              status.steps.map((step) => ({
                description: step.completed ? '已完成' : step.description,
                status: step.completed
                  ? 'finish'
                  : step.key === status?.nextStep?.key
                    ? 'process'
                    : 'wait',
                title: step.title,
              }))
            "
          />
        </Card>

        <div class="onboarding-grid">
          <Card
            v-for="step in status.steps"
            :key="step.key"
            class="onboarding-task"
            :bordered="false"
            :class="{ 'is-current': step.key === status.nextStep?.key }"
          >
            <div class="task-main">
              <span class="task-icon">
                <CircleCheckBig v-if="step.completed" class="task-icon-done" />
                <IconifyIcon v-else :icon="stepIconMap[step.key]" />
              </span>
              <div class="task-content">
                <div class="task-title-row">
                  <h2>{{ step.title }}</h2>
                  <Tag :color="step.completed ? 'success' : 'processing'">
                    {{ step.completed ? '已完成' : '待处理' }}
                  </Tag>
                </div>
                <p>{{ step.description }}</p>
              </div>
            </div>

            <Button
              :disabled="step.completed"
              type="primary"
              @click="goStep(step)"
            >
              {{ step.completed ? '已完成' : '去处理' }}
            </Button>
          </Card>
        </div>

        <section class="onboarding-summary">
          <div class="summary-item">
            <strong>{{ status.statistics.parkCount }}</strong>
            <span>园区</span>
          </div>
          <div class="summary-item">
            <strong>{{ status.statistics.factoryCount }}</strong>
            <span>厂房</span>
          </div>
          <div class="summary-item">
            <strong>{{ status.statistics.additionalUserCount }}</strong>
            <span>团队账号</span>
          </div>
          <div class="summary-item">
            <strong>{{ status.statistics.assignedPermissionUserCount }}</strong>
            <span>已授权账号</span>
          </div>
        </section>

        <div class="onboarding-actions">
          <Space wrap>
            <Button :loading="loading" @click="loadStatus">
              <RotateCw class="size-4" />
              刷新状态
            </Button>
            <Button v-if="isCompleted" type="primary" @click="goHome">
              进入首页
            </Button>
            <Button v-else type="primary" @click="goCurrentStep">
              继续当前步骤
            </Button>
          </Space>
        </div>
      </template>
    </div>
  </Page>
</template>

<style lang="less" scoped>
:deep(.onboarding-page-content) {
  min-height: 0;
  overflow: auto;
}

.onboarding-shell {
  width: min(1180px, 100%);
  min-height: 100%;
  padding: 20px;
  margin: 0 auto;
}

.onboarding-header {
  display: flex;
  gap: 24px;
  align-items: center;
  justify-content: space-between;
  padding: 28px 0 22px;

  h1 {
    margin: 0 0 8px;
    font-size: 28px;
    font-weight: 650;
    line-height: 1.2;
  }

  p {
    max-width: 620px;
    margin: 0;
    color: hsl(var(--muted-foreground));
    font-size: 15px;
    line-height: 1.7;
  }
}

.onboarding-card,
.onboarding-task {
  border-radius: 8px;
  background: hsl(var(--card));
  box-shadow: 0 1px 2px rgb(15 23 42 / 6%);
}

.onboarding-grid {
  display: grid;
  gap: 14px;
  margin-top: 16px;
}

.onboarding-task {
  border: 1px solid hsl(var(--border));

  :deep(.ant-card-body) {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
  }
}

.onboarding-task.is-current {
  border-color: #1677ff;
}

.task-main {
  display: flex;
  min-width: 0;
  gap: 14px;
  align-items: flex-start;
}

.task-icon {
  display: inline-flex;
  width: 38px;
  height: 38px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #eef4ff;
  color: #1677ff;

  svg {
    width: 20px;
    height: 20px;
  }
}

.task-icon-done {
  color: #16a34a;
}

.task-content {
  min-width: 0;

  p {
    margin: 6px 0 0;
    color: hsl(var(--muted-foreground));
    line-height: 1.6;
  }
}

.task-title-row {
  display: flex;
  gap: 10px;
  align-items: center;

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 650;
    line-height: 1.4;
  }
}

.onboarding-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.summary-item {
  min-width: 0;
  padding: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--card));

  strong {
    display: block;
    font-size: 24px;
    line-height: 1.2;
  }

  span {
    display: block;
    margin-top: 6px;
    color: hsl(var(--muted-foreground));
  }
}

.onboarding-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

@media (max-width: 768px) {
  .onboarding-shell {
    padding: 14px;
  }

  .onboarding-header {
    align-items: flex-start;
  }

  .onboarding-progress {
    display: none;
  }

  .onboarding-task :deep(.ant-card-body) {
    align-items: stretch;
    flex-direction: column;
  }

  .onboarding-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
