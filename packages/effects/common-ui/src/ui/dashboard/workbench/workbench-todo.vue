<script setup lang="ts">
import type { WorkbenchTodoItem } from '../typing';

import { ref } from 'vue';

// 假设 WorkbenchTodoItem 类型现在隐式或显式地包含 id: string
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  VbenCheckbox,
} from '@vben-core/shadcn-ui';

// 先定义 Props 接口
interface Props {
  items: WorkbenchTodoItem[];
  title: string;
}

defineOptions({
  name: 'WorkbenchTodo',
});

// defineProps 应该在 defineOptions 之前
withDefaults(defineProps<Props>(), {
  items: () => [],
});

// 定义组件可以触发的事件 (修改为传递 id)
const emit = defineEmits<{
  clear: [];
  delete: [id: string]; // 修改为 id
  toggle: [id: string]; // 修改为 id
}>();

const open = ref(false);
const deletingItemId = ref<null | string>(null); // 当前要删除的 item ID

// 处理删除事件 (传递 id)
const handleDelete = (id: string) => {
  deletingItemId.value = null; // 关闭 Popover
  emit('delete', id); // 发射 id
};

// 处理复选框状态变化 (传递 id)
const handleToggle = (id: string) => {
  emit('toggle', id); // 发射 id
};

// 处理清空所有待办事项
const handleClear = (event: Event) => {
  event.stopPropagation(); // 阻止事件冒泡到 CardHeader
  open.value = false; // 关闭 Popover
  emit('clear');
};
</script>

<template>
  <Card>
    <CardHeader class="py-4">
      <div class="flex items-center justify-between">
        <CardTitle class="text-lg">{{ title }}</CardTitle>
        <div class="flex items-center space-x-2">
          <!-- 添加待办按钮插槽 -->
          <slot name="add-button"></slot>

          <Popover v-model:open="open" v-if="items.length > 0">
            <PopoverTrigger>
              <button
                class="rounded bg-gray-200 px-3 py-1 text-xs text-gray-700 hover:text-gray-900"
                title="清空"
              >
                清空
              </button>
            </PopoverTrigger>
            <PopoverContent class="w-auto overflow-hidden p-0">
              <div class="flex flex-col">
                <div class="bg-white px-6 py-4 text-center text-black">
                  <p class="text-sm">确定清空所有待办事项吗?</p>
                </div>
                <div class="flex border-t">
                  <button
                    class="flex-1 border-r py-2 text-sm text-gray-600 hover:bg-[#fafafa]"
                    @click="open = false"
                  >
                    取消
                  </button>

                  <button
                    class="flex-1 bg-blue-500 py-2 text-sm text-white hover:bg-[#278df2]"
                    @click="handleClear($event)"
                  >
                    确定
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </CardHeader>
    <CardContent class="flex flex-wrap p-5 pt-0">
      <!-- 添加待办表单插槽 - 修改为占满宽度 -->
      <div class="mb-4 w-full">
        <slot name="add-todo"></slot>
      </div>

      <ul class="divide-border w-full divide-y" role="list">
        <li
          v-for="item in items"
          :key="item.id"
          :class="{
            'select-none line-through opacity-60': item.completed,
          }"
          class="flex cursor-pointer justify-between gap-x-6 py-5"
        >
          <div class="flex min-w-0 items-center gap-x-4">
            <VbenCheckbox
              :checked="item.completed"
              name="completed"
              @click="handleToggle(item.id)"
            />
            <div class="min-w-0 flex-auto">
              <p class="text-foreground text-sm font-medium leading-6">
                {{ item.title }}
              </p>
              <!-- eslint-disable vue/no-v-html -->
              <p
                class="text-foreground/80 *:text-primary mt-1 truncate text-xs leading-5"
                v-html="item.content"
              ></p>
            </div>
          </div>
          <div class="flex h-full shrink-0 flex-col items-end">
            <!-- 使用 deletingItemId 控制 Popover，并监听 update:open 事件 -->
            <Popover
              :open="deletingItemId === item.id"
              @update:open="
                (value) => {
                  if (!value) deletingItemId = null;
                }
              "
            >
              <PopoverTrigger as-child>
                <!-- 阻止点击事件冒泡到 li, 并设置当前要删除的 ID -->
                <button
                  class="mb-2 text-xs text-red-500 hover:text-red-700"
                  title="删除"
                  @click.stop="deletingItemId = item.id"
                >
                  删除
                </button>
              </PopoverTrigger>
              <PopoverContent class="w-auto overflow-hidden p-0">
                <div class="flex flex-col">
                  <div class="bg-white px-6 py-4 text-center text-black">
                    <p class="text-sm">确定删除 {{ item.title }} 吗?</p>
                  </div>
                  <div class="flex border-t">
                    <!-- 取消按钮：阻止冒泡并清空 deletingItemId -->
                    <button
                      class="flex-1 border-r py-2 text-sm text-gray-600 hover:bg-[#fafafa]"
                      @click.stop="deletingItemId = null"
                    >
                      取消
                    </button>

                    <!-- 确定按钮：调用 handleDelete (内部会清空 deletingItemId) -->
                    <button
                      class="flex-1 bg-blue-500 py-2 text-sm text-white hover:bg-[#278df2]"
                      @click="handleDelete(item.id)"
                    >
                      确定
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <span class="text-foreground/80 text-xs leading-6">
              {{ item.date }}
            </span>
          </div>
        </li>
      </ul>
    </CardContent>
  </Card>
</template>
