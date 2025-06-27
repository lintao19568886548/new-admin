import type { RouteRecordStringComponent } from '@vben/types';

import { ref } from 'vue';

import { defineStore } from 'pinia';

export const useMenuStore = defineStore('menu-store', () => {
  const menus = ref<RouteRecordStringComponent[]>([]);

  function setMenus(newMenus: RouteRecordStringComponent[]) {
    menus.value = newMenus;
  }

  return {
    menus,
    setMenus,
  };
});
