<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { AuthPageLayout } from '@vben/layouts';
import { preferences } from '@vben/preferences';

import { $t } from '#/locales';

const route = useRoute();

const appName = computed(() => preferences.app.name);
const logo = computed(() => preferences.logo.source);
const showLayoutCopyright = computed(() => route.name !== 'Login');
</script>

<template>
  <AuthPageLayout
    :app-name="appName"
    :copyright="showLayoutCopyright"
    :logo="logo"
    :page-description="$t('authentication.pageDesc')"
    :page-title="$t('authentication.pageTitle')"
  >
    <!-- 自定义工具栏 -->
    <!-- <template #toolbar></template> -->
  </AuthPageLayout>
</template>
