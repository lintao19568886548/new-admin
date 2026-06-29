<script lang="ts" setup>
import type {
  ProfileMenuAction,
  ProfileMenuDropdown,
  ProfileMenuEntry,
} from './profile-menu-types';

import { ref } from 'vue';

import { VbenIcon } from '@vben/common-ui';
import { ChevronRight } from '@vben/icons';

import MenuDropdown from './MenuDropdown.vue';

defineProps<{
  items: ProfileMenuEntry[];
}>();

const expandedKey = ref('');

function isDropdown(item: ProfileMenuEntry): item is ProfileMenuDropdown {
  return 'type' in item && item.type === 'dropdown';
}

function toggleDropdown(key: string) {
  // 统一记录当前展开项；新增多个下拉组时也会自动互斥。
  expandedKey.value = expandedKey.value === key ? '' : key;
}

function handleActionClick(item: ProfileMenuAction) {
  void item.handler();
}
</script>

<template>
  <div class="profile-menu">
    <template v-for="item in items" :key="item.key">
      <MenuDropdown
        v-if="isDropdown(item)"
        :expanded="expandedKey === item.key"
        :icon="item.icon"
        :items="item.children"
        :title="item.title"
        @item-click="handleActionClick"
        @toggle="toggleDropdown(item.key)"
      />
      <button
        v-else
        :class="{ 'profile-menu-row--danger': item.danger }"
        class="profile-menu-row"
        type="button"
        @click="handleActionClick(item)"
      >
        <span class="profile-menu-row__main">
          <VbenIcon :icon="item.icon" class="profile-menu-row__icon" />
          <span>{{ item.title }}</span>
        </span>
        <VbenIcon :icon="ChevronRight" class="profile-menu-row__arrow" />
      </button>
    </template>
  </div>
</template>

<style scoped>
.profile-menu {
  overflow: hidden;
  background: #fff;
  border-radius: 12px;
}

.profile-menu-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 56px;
  padding: 0 24px;
  font-size: 16px;
  line-height: 1.4;
  color: #3f3f46;
  text-align: left;
  cursor: pointer;
  background: #fff;
  border: 0;
  border-bottom: 1px solid #f0f0f0;
}

.profile-menu-row:last-child {
  border-bottom: 0;
}

.profile-menu-row:active {
  background: #f8fafc;
}

.profile-menu-row__main {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.profile-menu-row__icon {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  margin-right: 12px;
  font-size: 18px;
}

.profile-menu-row__arrow {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  color: #3f3f46;
}

.profile-menu-row--danger {
  color: #ff4d4f;
}

.profile-menu-row--danger .profile-menu-row__arrow {
  color: #ff4d4f;
}

@media (max-width: 420px) {
  .profile-menu-row {
    min-height: 54px;
    padding: 0 20px;
    font-size: 16px;
  }
}
</style>
