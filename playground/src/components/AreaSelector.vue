<script lang="ts" setup>
import { ref, watch } from 'vue';

import { ChevronDown } from '@vben/icons';

import { Button, Dropdown, Menu, message } from 'ant-design-vue';

export interface Area {
  key: string;
  name: string;
}

// 定义 props
const props = defineProps<{
  areaList: Area[]; // 区域列表
  defaultArea?: Area; // 默认选中的区域
}>();

/**
 * 切换区域
 */
// 定义事件
const emit = defineEmits<{
  (e: 'change', area: Area): void;
}>();

// 当前选中的区域，优先使用defaultArea，否则使用列表中的第一项
const currentArea = ref(
  props.defaultArea ||
    (props.areaList.length > 0 ? props.areaList[0] : undefined),
);

// 处理区域切换
function switchArea(area: Area) {
  if (area.key === currentArea.value?.key) return;

  // 更新当前选中的区域
  currentArea.value = area;

  // 显示加载提示
  message.loading({
    content: `正在切换到${area.name}...`,
    duration: 0,
    key: 'area_change_msg',
  });

  // 触发 change 事件，将数据更新的责任传递给父组件
  emit('change', area);
}

// 监听 defaultArea 的变化
watch(
  () => props.defaultArea,
  (newArea) => {
    if (
      newArea &&
      (!currentArea.value || newArea.key !== currentArea.value.key)
    ) {
      currentArea.value = newArea;
    }
  },
);

// 暴露方法给父组件
defineExpose({
  getCurrentArea: () => currentArea.value,
  reset: () => {
    if (props.defaultArea) {
      currentArea.value = props.defaultArea;
    } else if (props.areaList.length > 0) {
      currentArea.value = props.areaList[0];
    }
  },
  selectArea: (area: Area) => {
    switchArea(area);
  },
});
</script>
<template>
  <Dropdown class="ml-3">
    <template #overlay>
      <Menu>
        <Menu.Item
          v-for="area in areaList"
          :key="area.key"
          @click="() => switchArea(area)"
        >
          {{ area.name }}
        </Menu.Item>
      </Menu>
    </template>
    <Button type="primary">
      {{ currentArea?.name || '选择区域' }}
      <ChevronDown class="ml-1 size-4" />
    </Button>
  </Dropdown>
</template>
