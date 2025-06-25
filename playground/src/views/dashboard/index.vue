<script lang="ts" setup>
import type { RouteRecordStringComponent } from '@vben/types';

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { VbenIcon } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { Card, Col, Row } from 'ant-design-vue';

import { getAllMenusApi } from '#/api/core/menu';

interface NavItem {
  color: string;
  icon: string;
  path: string;
  title: string;
}

const router = useRouter();

const colors = ['#42a5f5', '#66bb6a', '#ffa726', '#78909c'];
const navItems = ref<NavItem[]>([]);

function getNavItems(
  menus: RouteRecordStringComponent[],
  result: NavItem[] = [],
) {
  for (const menu of menus) {
    if (menu.meta?.icon && !menu.meta.hideInMenu && menu.meta.isApp) {
      result.push({
        color: '', // Color will be assigned later
        icon: menu.meta?.icon as string,
        path: menu.path,
        title: $t(menu.meta?.title || 'Unnamed'),
      });
    }
    if (menu.children?.length) {
      getNavItems(menu.children, result);
    }
  }
  return result;
}

onMounted(async () => {
  try {
    const menus = await getAllMenusApi();
    const flatItems = getNavItems(menus);
    navItems.value = flatItems.map((item, index) => ({
      ...item,
      color: colors[index % colors.length] || '#78909c',
    }));
  } catch (error) {
    console.error('Failed to load menu items:', error);
  }
});

function handleItemClick(path: string) {
  router.push(path);
}
</script>

<template>
  <div class="p-4">
    <div class="mb-4 rounded-lg bg-white p-6 shadow-sm">
      <h1 class="text-2xl font-bold">导航页</h1>
      <p class="text-muted-foreground mt-2">
        这里是您的导航/仪表盘页面，点击下方卡片进入不同功能。
      </p>
    </div>
    <Row :gutter="[16, 16]">
      <Col
        v-for="item in navItems"
        :key="item.title"
        :lg="6"
        :md="12"
        :sm="12"
        :xs="12"
      >
        <Card
          class="cursor-pointer transition-transform hover:-translate-y-1"
          @click="handleItemClick(item.path)"
        >
          <div class="flex items-center">
            <VbenIcon
              :icon="item.icon"
              :style="{ color: item.color }"
              class="mr-4 text-4xl"
            />
            <div>
              <h3 class="font-semibold tracking-tight">{{ item.title }}</h3>
              <!-- <p class="text-muted-foreground text-sm">
                点击进入{{ item.title }}
              </p> -->
            </div>
          </div>
        </Card>
      </Col>
    </Row>
  </div>
</template>
