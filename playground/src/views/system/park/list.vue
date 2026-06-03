<script lang="ts" setup>
import { Page } from '@vben/common-ui';

import ParkManagePanel from './modules/manage-panel.vue';
</script>

<template>
  <Page auto-content-height content-class="system-park-page-content">
    <ParkManagePanel />
  </Page>
</template>

<style lang="less" scoped>
:deep(.system-park-page-content) {
  min-height: 0;
  overflow: hidden !important;
}
</style>
