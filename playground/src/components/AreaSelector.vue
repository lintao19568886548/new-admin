<script lang="ts" setup>
import type { Park } from '#/store/park'; // 导入类型

import { onMounted, ref } from 'vue';

import { ChevronDown } from '@vben/icons';

import { Button, Dropdown, Menu, message } from 'ant-design-vue';

import { useParkStore } from '#/store/park';

// 定义组件属性
const props = withDefaults(
  defineProps<{
    // 默认选中的区域
    defaultPark?: Park;
    // 消息显示时间
    messageDuration?: number;
    // 刷新回调函数
    refreshCallback?: () => void;
    // 是否自动显示成功消息
    showSuccessMessage?: boolean;
  }>(),
  {
    defaultPark: () => ({ parkId: 0, parkName: '全部区域' }),
    messageDuration: 2,
    refreshCallback: () => {},
    showSuccessMessage: true,
  },
);

/**
 * 切换区域
 */
// 定义事件
const emit = defineEmits<{
  (e: 'change', park: Park): void;
  (e: 'refresh'): void;
}>();

const currentPark = ref<Park>(props.defaultPark);
// 获取园区状态管理
const parkStore = useParkStore();

onMounted(async () => {
  // 使用store的方法获取园区列表（包含全部区域选项）
  await parkStore.fetchParkList();
});

// 处理区域切换
function switchArea(park: Park) {
  if (park.parkName === currentPark.value?.parkName) return;

  // 更新当前选中的区域
  currentPark.value = park;
  // 更新全局状态中的当前园区
  parkStore.setCurrentPark(park);

  // 显示加载提示
  message.loading({
    content: `正在切换到${park.parkName}...`,
    duration: 0,
    key: 'park_change_msg',
  });

  // 触发 change 事件
  emit('change', park);

  // 执行刷新回调
  if (props.refreshCallback) {
    props.refreshCallback();
    if (props.showSuccessMessage) {
      message.success({
        content: `已切换到${park.parkName}`,
        duration: props.messageDuration,
        key: 'park_change_msg',
      });
    }
  } else {
    // 触发刷新事件，让父组件决定如何处理
    emit('refresh');
  }
}

// 暴露当前选中的区域和切换方法
defineExpose({
  currentPark,
  switchArea,
});
</script>
<template>
  <Dropdown class="ml-1">
    <template #overlay>
      <Menu>
        <Menu.Item
          v-for="park in parkStore.parkList"
          :key="park.parkName"
          @click="() => switchArea(park)"
        >
          {{ park.parkName }}
        </Menu.Item>
      </Menu>
    </template>
    <Button type="primary" :loading="parkStore.loading">
      {{ currentPark?.parkName || '全部区域' }}
      <ChevronDown class="ml-1 size-4" />
    </Button>
  </Dropdown>
</template>
