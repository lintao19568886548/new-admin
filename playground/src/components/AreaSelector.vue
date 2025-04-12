<script lang="ts" setup>
import { ref } from 'vue';

import { ChevronDown } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { Button, Dropdown, Menu, message } from 'ant-design-vue';

export interface Area {
  key: string;
  value: string;
}

/**
 * 切换区域
 */
// 定义事件
const emit = defineEmits<{
  (e: 'change', area: Area): void;
}>();

const userStore = useUserStore();
const currentArea = ref<Area>();
// 区域列表
const parks =
  userStore.userInfo?.parks.map((park: any) => ({
    key: park,
    value: park,
  })) || [];

if (parks.length > 0) {
  parks.unshift({
    key: 'all',
    value: '全部区域',
  });
}

// 处理区域切换
function switchArea(area: Area) {
  if (area.key === currentArea.value?.key) return;

  // 更新当前选中的区域
  currentArea.value = area;

  // 显示加载提示
  message.loading({
    content: `正在切换到${area.value}...`,
    duration: 0,
    key: 'area_change_msg',
  });

  // 触发 change 事件，将数据更新的责任传递给父组件
  emit('change', area);
}
</script>
<template>
  <Dropdown class="ml-3">
    <template #overlay>
      <Menu>
        <Menu.Item
          v-for="park in parks"
          :key="park.key"
          @click="() => switchArea(park)"
        >
          {{ park.value }}
        </Menu.Item>
      </Menu>
    </template>
    <Button type="primary">
      {{ currentArea?.value || '全部区域' }}
      <ChevronDown class="ml-1 size-4" />
    </Button>
  </Dropdown>
</template>
