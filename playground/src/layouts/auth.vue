<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { AuthPageLayout } from '@vben/layouts';
import { preferences } from '@vben/preferences';

import { usePlatform } from '#/hooks/usePlatform';
import { $t } from '#/locales';

const route = useRoute();
const { isNativePlatform } = usePlatform();

const appName = computed(() => preferences.app.name);
const logo = computed(() => preferences.logo.source);
const showLayoutCopyright = computed(() => {
  const isSmallScreen = window.innerWidth < 768;
  const routeName = route.name;

  if (routeName === 'Login') {
    return false;
  }

  if (routeName === 'CodeLogin' && (isNativePlatform.value || isSmallScreen)) {
    return false;
  }

  return true;
});
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
