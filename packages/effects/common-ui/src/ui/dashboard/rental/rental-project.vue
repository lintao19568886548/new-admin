<script setup lang="ts">
import type { RentalProjectItem } from '../typing';

import { ref } from 'vue';

import { Search } from '@vben/icons'; // 导入搜索图标

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@vben-core/shadcn-ui';

interface Props {
  items: RentalProjectItem[];
  title: string;
}

defineOptions({
  name: 'RentalProject',
});

withDefaults(defineProps<Props>(), {
  items: () => [],
});

const emit = defineEmits(['click', 'search']); // 添加search事件

// 搜索表单相关
const showSearchForm = ref(false);
const searchForm = ref({
  title: '',
  tag: '全部',
  group: '',
});

// 切换搜索表单显示状态
function toggleSearchForm() {
  showSearchForm.value = !showSearchForm.value;
}

// 重置搜索表单
function resetSearch() {
  searchForm.value = {
    title: '',
    tag: '全部',
    group: '',
  };
  // 重置后立即触发搜索事件，更新结果
  emit('search', { ...searchForm.value });
  showSearchForm.value = !showSearchForm.value;
}

// 处理搜索事件
function handleSearch() {
  // 确保进行深拷贝，避免引用问题

  // 确保传递的是完整的searchForm对象
  emit('search', { ...searchForm.value });
  showSearchForm.value = !showSearchForm.value;
}
</script>

<template>
  <Card v-if="showSearchForm">
    <!-- 搜索表单 - 移到 CardHeader 上方 -->
    <div class="border-border border-b px-4 py-3">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3" @submit.prevent>
        <div>
          <label class="text-foreground/80 mb-1 block text-sm">标题</label>
          <Input v-model="searchForm.title" placeholder="请输入标题关键词" />
        </div>
        <div>
          <label class="text-foreground/80 mb-1 block text-sm">地区</label>
          <Input v-model="searchForm.group" placeholder="请输入地区" />
        </div>
        <div>
          <label class="text-foreground/80 mb-1 block text-sm">标签</label>
          <Select v-model="searchForm.tag">
            <SelectTrigger class-name="w-[180px]">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="全部">全部</SelectItem>
                <SelectItem value="空闲">空闲</SelectItem>
                <SelectItem value="已租">已租</SelectItem>
                <SelectItem value="维护">维护</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div class="flex items-end justify-end gap-2 md:col-span-3">
          <Button type="primary" @click="handleSearch"> 搜索 </Button>
          <Button type="button" @click="resetSearch">重置</Button>
          <Button type="button" @click="toggleSearchForm">取消</Button>
        </div>
      </div>
    </div>
  </Card>
  <Card class="mt-4">
    <CardHeader class="py-4">
      <div class="flex items-center justify-between">
        <CardTitle class="text-lg"> {{ title }}</CardTitle>
        <!-- 添加搜索按钮 -->
        <div
          class="border-border hover:bg-accent/50 flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-sm transition-colors"
          @click="toggleSearchForm"
        >
          <Search class="text-foreground/70 mr-1.5 size-3.5" />
          <span class="text-foreground/80">筛选</span>
        </div>
      </div>
    </CardHeader>

    <CardContent class="flex flex-wrap p-0">
      <template v-for="(item, index) in items" :key="item.title">
        <div
          @click="$emit('click', item)"
          :class="{
            'border-r-0': index % 3 === 2,
            'border-b-0': index < 3,
            'pb-4': index > 2,
          }"
          class="border-border group w-full cursor-pointer border-r border-t p-4 transition-all hover:shadow-xl md:w-1/2 lg:w-1/3"
        >
          <!-- 现有内容保持不变 -->
          <div class="flex items-center justify-between">
            <span class="ml-4 text-lg font-medium">{{ item.title }}</span>
            <slot name="tag" :tag="item.tag"></slot>
          </div>
          <div
            class="image-foreground mt-3 flex h-40 items-center justify-center overflow-hidden rounded-md"
          >
            <img
              v-if="item.url"
              :src="item.imgUrl"
              class="max-h-full max-w-full object-contain"
              @click="$emit('click', item)"
            />
          </div>
          <div class="text-foreground/80 mt-4 flex h-10">
            {{ item.content }}
          </div>
          <div class="text-foreground/80 flex justify-between">
            <span>{{ item.group }}</span>
            <span>{{ item.date }}</span>
          </div>
        </div>
      </template>
    </CardContent>
  </Card>
</template>
