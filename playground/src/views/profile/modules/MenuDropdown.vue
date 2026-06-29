<script lang="ts" setup>
import type { ProfileMenuAction, ProfileMenuIcon } from './profile-menu-types';

import { computed } from 'vue';

import { VbenIcon } from '@vben/common-ui';
import { ChevronDown, ChevronRight } from '@vben/icons';

const props = defineProps<{
  expanded: boolean;
  icon: ProfileMenuIcon;
  items: ProfileMenuAction[];
  title: string;
}>();

const emit = defineEmits<{
  (event: 'itemClick', item: ProfileMenuAction): void;
  (event: 'toggle'): void;
}>();

const panelStyle = computed(() => ({
  maxHeight: props.expanded ? `${props.items.length * 56 + 16}px` : '0px',
}));

function handleToggle() {
  emit('toggle');
}

function handleItemClick(item: ProfileMenuAction) {
  emit('itemClick', item);
}
</script>

<template>
  <div class="profile-menu-dropdown">
    <button
      :aria-expanded="expanded"
      class="profile-menu-row profile-menu-dropdown__trigger"
      type="button"
      @click="handleToggle"
    >
      <span class="profile-menu-row__main">
        <VbenIcon :icon="icon" class="profile-menu-row__icon" />
        <span>{{ title }}</span>
      </span>
      <VbenIcon
        :icon="ChevronDown"
        class="profile-menu-row__arrow profile-menu-dropdown__arrow"
        :class="{ 'profile-menu-dropdown__arrow--expanded': expanded }"
      />
    </button>

    <div
      class="profile-menu-dropdown__panel"
      :class="{ 'profile-menu-dropdown__panel--expanded': expanded }"
      :style="panelStyle"
    >
      <button
        v-for="item in items"
        :key="item.key"
        :class="{ 'profile-menu-row--danger': item.danger }"
        class="profile-menu-row profile-menu-dropdown__item"
        type="button"
        @click="handleItemClick(item)"
      >
        <span class="profile-menu-row__main">
          <VbenIcon :icon="item.icon" class="profile-menu-row__icon" />
          <span>{{ item.title }}</span>
        </span>
        <VbenIcon :icon="ChevronRight" class="profile-menu-row__arrow" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.profile-menu-dropdown {
  overflow: hidden;
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

.profile-menu-dropdown__trigger {
  font-weight: 500;
}

.profile-menu-dropdown__arrow {
  transition: transform 0.22s ease;
}

.profile-menu-dropdown__arrow--expanded {
  transform: rotate(180deg);
}

.profile-menu-dropdown__panel {
  overflow: hidden;
  visibility: hidden;
  opacity: 0;
  transition:
    max-height 0.26s ease,
    opacity 0.2s ease,
    visibility 0.2s ease;
}

.profile-menu-dropdown__panel--expanded {
  visibility: visible;
  opacity: 1;
}

.profile-menu-dropdown__item {
  min-height: 54px;
  padding-left: 38px;
  background: #fafafa;
}

.profile-menu-dropdown__item:active {
  background: #f3f4f6;
}

@media (max-width: 420px) {
  .profile-menu-row {
    min-height: 54px;
    padding: 0 20px;
    font-size: 16px;
  }

  .profile-menu-dropdown__item {
    padding-left: 34px;
  }
}
</style>
