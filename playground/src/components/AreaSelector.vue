<script lang="ts" setup>
import { ref } from 'vue';

import { ChevronDown } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { Button, Dropdown, Menu, message } from 'ant-design-vue';

export interface Area {
  key: string;
  value: string;
}

export interface Park {
  parkId: number;
  parkName: string;
}

// 定义组件属性
const props = withDefaults(
  defineProps<{
    // 默认选中的区域
    defaultArea?: Area;
    // 消息显示时间
    messageDuration?: number;
    // 刷新回调函数
    refreshCallback?: () => void;
    // 是否自动显示成功消息
    showSuccessMessage?: boolean;
  }>(),
  {
    defaultArea: () => ({ key: 'all', value: '全部区域' }),
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
  (e: 'change', area: Area): void;
  (e: 'refresh'): void;
}>();

const userStore = useUserStore();
const currentArea = ref<Area>(props.defaultArea);
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

  // 延迟关闭提示
  setTimeout(() => {
    if (props.showSuccessMessage) {
      message.success({
        content: `已切换到${area.value}`,
        duration: props.messageDuration,
        key: 'area_change_msg',
      });
    }

    // 触发 change 事件
    emit('change', area);

    // 执行刷新回调
    if (props.refreshCallback) {
      props.refreshCallback();
    } else {
      // 触发刷新事件，让父组件决定如何处理
      emit('refresh');
    }
  }, 500);
}

// 暴露当前选中的区域和切换方法
defineExpose({
  currentArea,
  switchArea,
});
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
