<script lang="ts" setup>
import { Page } from '@vben/common-ui';

import OnboardingStepAlert from '#/components/onboarding/OnboardingStepAlert.vue';

import ParkManagePanel from './modules/manage-panel.vue';
</script>

<template>
  <Page auto-content-height content-class="system-park-page-content">
    <OnboardingStepAlert step-key="factoryInfo" />
    <ParkManagePanel />
  </Page>
</template>

<style lang="less" scoped>
:deep(.system-park-page-content) {
  min-height: 0;
  overflow: hidden !important;
}
</style>
