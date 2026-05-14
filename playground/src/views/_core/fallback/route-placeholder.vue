<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Button, Card, Space, Tag } from 'ant-design-vue';

interface QuickLink {
  label: string;
  to: string;
}

defineOptions({ name: 'RoutePlaceholder' });

const props = withDefaults(
  defineProps<{
    description?: string;
    links?: QuickLink[];
    suggestion?: string;
    tags?: string[];
    title?: string;
  }>(),
  {
    description: '',
    links: () => [],
    suggestion: '',
    tags: () => [],
    title: '',
  },
);

const route = useRoute();

const pageTitle = computed(() => {
  if (props.title.trim().length > 0) {
    return props.title;
  }
  const title = route.meta?.title;
  return typeof title === 'string' && title.trim().length > 0
    ? title
    : String(route.name || route.path);
});

const pageDescription = computed(() => {
  if (props.description.trim().length > 0) {
    return props.description;
  }
  return `当前路由 ${route.path} 已在菜单中配置，但对应页面文件缺失或尚未接入。`;
});
</script>

<template>
  <Page auto-content-height>
    <div class="route-placeholder space-y-4">
      <Alert
        :description="pageDescription"
        :message="`${pageTitle} 页面暂未就绪`"
        show-icon
        type="warning"
      />
      <Card size="small" title="当前路由">
        <Space wrap>
          <Tag color="blue">{{ route.path }}</Tag>
          <Tag v-if="route.name" color="processing">{{ route.name }}</Tag>
          <Tag v-for="tag in tags" :key="tag" color="default">
            {{ tag }}
          </Tag>
        </Space>
      </Card>
      <Card v-if="suggestion || links.length > 0" size="small" title="建议">
        <div
          v-if="suggestion"
          class="mb-3 text-sm text-[var(--ant-color-text)]"
        >
          {{ suggestion }}
        </div>
        <Space v-if="links.length > 0" wrap>
          <Button
            v-for="link in links"
            :key="link.to"
            type="primary"
            @click="$router.push(link.to)"
          >
            {{ link.label }}
          </Button>
        </Space>
      </Card>
    </div>
  </Page>
</template>
