<script lang="ts" setup>
import { ref } from 'vue';

import { ChevronDown } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { Button, Dropdown, Menu, message } from 'ant-design-vue';

export interface Park {
  parkId: number;
  parkName: string;
}

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

const userStore = useUserStore();
const currentPark = ref<Park>(props.defaultPark);
// 区域列表
const parks = userStore.userInfo?.parks || [];

// 检查是否已存在"全部区域"选项，如果不存在才添加
if (parks.length > 0 && !parks.some((park: any) => park.parkId === -1)) {
  parks.unshift({
    parkId: -1,
    parkName: '全部区域',
  });
}

// 处理区域切换
function switchArea(park: Park) {
  if (park.parkName === currentPark.value?.parkName) return;

  // 更新当前选中的区域
  currentPark.value = park;

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
  <Dropdown class="ml-2">
    <template #overlay>
      <Menu>
        <Menu.Item
          v-for="park in parks"
          :key="park.parkName"
          @click="() => switchArea(park)"
        >
          {{ park.parkName }}
        </Menu.Item>
      </Menu>
    </template>
    <Button type="primary">
      {{ currentPark?.parkName || '全部区域' }}
      <ChevronDown class="ml-1 size-4" />
    </Button>
  </Dropdown>
</template>
