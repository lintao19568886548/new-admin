<script lang="ts" setup>
import { useRouter } from 'vue-router';

import { Button } from 'ant-design-vue';

// 添加 buttonText 和 beforeNavigate prop
const props = defineProps<{
  beforeNavigate?: () => Promise<void> | void; // 导航前执行的回调
  buttonText?: string; // 按钮文本
  label: string; // 标签文本
  path: string; // 跳转路径
}>();

// defineEmits 用于声明组件会触发哪些事件
// const emit = defineEmits(['navigate']);
const router = useRouter(); // 获取 router 实例

// 修改为 async 函数
async function goToRentalManage() {
  // 在导航前执行回调
  if (props.beforeNavigate) {
    await props.beforeNavigate();
  }
  // 执行路由跳转
  router.push(props.path);
}

// function handleClick() {
//   // 触发 navigate 事件
//   emit('navigate');
// }
</script>

<template>
  <div class="flex items-center">
    <span>{{ label }}</span>
    <Button type="link" size="small" @click="goToRentalManage" class="ml-1">
      <!-- 使用 prop 替换硬编码文本 -->
      {{ buttonText || '管理' }}
      <!-- 修改默认按钮文本为更通用的 '管理' -->
    </Button>
  </div>
</template>
