<script lang="ts" setup>
import type { RouteRecordStringComponent } from '@vben/types';

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { VbenIcon } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { Card, Col, Empty, Row, Skeleton } from 'ant-design-vue';

import { useMenuStore } from '#/store/menu';

interface NavItem {
  color: string;
  icon: string;
  path: string;
  title: string;
}

interface NavGroup {
  icon: string;
  items: NavItem[];
  title: string;
}

const loading = ref(true);
const router = useRouter();

const colors = ['#42a5f5', '#66bb6a', '#ffa726', '#78909c'];
const navGroups = ref<NavGroup[]>([]);

function collectNavItems(
  menus: RouteRecordStringComponent[],
  result: NavItem[] = [],
) {
  for (const menu of menus) {
    if (menu.meta?.hideInMenu) {
      continue;
    }
    // A menu with children is a sub-group, recurse into it.
    if (menu.children?.length) {
      collectNavItems(menu.children, result);
    } // An item with an icon is a navigable item.
    else if (menu.meta?.icon && menu.meta.isApp) {
      result.push({
        color: '', // Will be assigned later
        icon: menu.meta.icon as string,
        // path is resolved by router, we can use the menu's name for navigation
        path: menu.name as string,
        title: $t(menu.meta.title || 'Unnamed'),
      });
    }
  }
  return result;
}

function buildNavGroups(menus: RouteRecordStringComponent[]): NavGroup[] {
  const groups: NavGroup[] = [];
  let colorCounter = 0;

  for (const menu of menus) {
    if (!menu.meta?.hideInMenu && menu.children?.length) {
      const items = collectNavItems(menu.children);
      if (items.length > 0) {
        groups.push({
          icon: menu.meta?.icon as string,
          title: $t(menu.meta?.title || 'Unnamed'),
          items: items.map((item) => ({
            ...item,
            color: colors[colorCounter++ % colors.length] || '#78909c',
          })),
        });
      }
    }
  }
  return groups;
}

onMounted(() => {
  loading.value = true;
  try {
    const menuStore = useMenuStore();
    navGroups.value = buildNavGroups(menuStore.menus);
  } catch (error) {
    console.error('Failed to load menu items:', error);
  } finally {
    loading.value = false;
  }
});

function handleItemClick(name: string) {
  router.push({ name });
}
</script>

<template>
  <div class="dark:bg-background min-h-full bg-gray-50 p-4">
    <template v-if="loading">
      <Row :gutter="[16, 16]">
        <Col v-for="n in 4" :key="n" :lg="6" :md="6" :sm="12" :xs="12">
          <Card>
            <Skeleton active :paragraph="{ rows: 1 }" avatar />
          </Card>
        </Col>
      </Row>
    </template>
    <template v-else>
      <div v-if="navGroups.length > 0">
        <div
          v-for="group in navGroups"
          :key="group.title"
          class="mb-6 rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800"
        >
          <div
            class="mb-4 flex items-center border-b border-gray-200 pb-3 dark:border-gray-700"
          >
            <VbenIcon :icon="group.icon" class="mr-3 text-2xl text-blue-500" />
            <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-200">
              {{ group.title }}
            </h2>
          </div>
          <Row :gutter="[16, 16]">
            <Col
              v-for="item in group.items"
              :key="item.title"
              :lg="6"
              :md="6"
              :sm="12"
              :xs="12"
            >
              <Card
                class="group h-full cursor-pointer transition-all duration-300 hover:border-blue-500 hover:shadow-md"
                :body-style="{
                  padding: '16px',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                }"
                @click="handleItemClick(item.path)"
              >
                <div class="flex items-center">
                  <VbenIcon
                    :icon="item.icon"
                    :style="{ color: item.color }"
                    class="mr-4 text-3xl transition-transform duration-300 group-hover:scale-110"
                  />
                  <div>
                    <h3
                      class="font-semibold tracking-tight text-gray-700 dark:text-gray-300"
                    >
                      {{ item.title }}
                    </h3>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      </div>
      <div v-else class="flex h-full items-center justify-center pt-20">
        <Empty description="暂无可用的导航应用" />
      </div>
    </template>
  </div>
</template>
