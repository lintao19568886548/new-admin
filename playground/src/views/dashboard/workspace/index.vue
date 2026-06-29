<script lang="ts" setup>
import type {
  WorkbenchQuickNavItem,
  WorkbenchTodoItem,
  WorkbenchTrendItem,
} from '@vben/common-ui';

import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  WorkbenchHeader,
  WorkbenchQuickNav,
  WorkbenchTodo,
  WorkbenchTrends,
} from '@vben/common-ui';
import { $t } from '@vben/locales';
import { preferences } from '@vben/preferences';
import { useUserStore } from '@vben/stores';
import { openWindow } from '@vben/utils';

import { Pagination } from 'ant-design-vue';
import { v4 as uuidv4 } from 'uuid';

import { getDashboardWorkspaceList } from '#/api/dashboard';

const userStore = useUserStore();

const currentDate = computed(() => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const weekdays = [
    '星期日',
    '星期一',
    '星期二',
    '星期三',
    '星期四',
    '星期五',
    '星期六',
  ];
  const weekday = weekdays[now.getDay()];

  return `${year}年${month}月${day}日 ${weekday}`;
});

const weather = ref({
  condition: '晴',
  temperature: {
    max: 32,
    min: 20,
  },
});

const weatherDescription = computed(() => {
  return `今日${weather.value.condition}，${weather.value.temperature.min}℃ - ${weather.value.temperature.max}℃`;
});

const isMobile = ref(window.innerWidth < 768);

function updateIsMobile() {
  isMobile.value = window.innerWidth < 768;
}

onMounted(() => {
  window.addEventListener('resize', updateIsMobile);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile);
});

const quickNavItems = computed((): WorkbenchQuickNavItem[] => {
  const isMobileView = isMobile.value;
  return [
    {
      color: '#1fdaca',
      icon: 'ion:home-outline',
      title: '首页',
      url: '/workbench',
    },
    {
      color: '#bf0c2c',
      icon: 'mdi:file-document-multiple',
      title: '账单管理',
      url: isMobileView ? '/bill/mobile-list' : '/bill',
    },
    {
      color: '#e18525',
      icon: 'mdi:office-building',
      title: '招商管理',
      url: '/investment/app',
    },
    {
      color: '#3fb27f',
      icon: 'mdi:currency-usd',
      title: '财务管理',
      url: isMobileView ? '/finance/mobile-manage' : '/finance/manage',
    },
    {
      color: '#4daf1bc9',
      icon: 'mdi:home-city-outline',
      title: '园区列表',
      url: '/rental/list',
    },
    {
      color: '#00d8ff',
      icon: 'lucide:bot',
      title: 'AI工具集',
      url: '/tools',
    },
  ];
});

const todoItems = ref<WorkbenchTodoItem[]>([]);

const totalTodoItemsCount = computed(() => todoItems.value.length);

const incompleteTodoItemsCount = computed(() => {
  return todoItems.value.filter((item) => !item.completed).length;
});

const newTodoTitle = ref('');
const newTodoContent = ref('');
const showTodoForm = ref(false);

const loadTodoItems = () => {
  const storedItems = localStorage.getItem('workbenchTodoItems');
  if (storedItems) {
    try {
      const parsedItems = JSON.parse(storedItems);
      todoItems.value = parsedItems.map((item: any) => ({
        completed: item.completed || false,
        content: item.content,
        date: item.date,
        id: item.id || uuidv4(),
        title: item.title,
      }));
    } catch (error) {
      console.error('解析待办事项失败:', error);
      todoItems.value = [];
    }
  }
};

const saveTodoItems = () => {
  localStorage.setItem('workbenchTodoItems', JSON.stringify(todoItems.value));
};

const clearTodoItems = () => {
  todoItems.value = [];
  saveTodoItems();
};

const addTodoItem = () => {
  if (!newTodoTitle.value.trim()) return;

  const now = new Date();
  const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  todoItems.value.unshift({
    completed: false,
    content: newTodoContent.value.trim() || '无详细描述',
    date: formattedDate,
    id: uuidv4(),
    title: newTodoTitle.value.trim(),
  });

  saveTodoItems();

  newTodoTitle.value = '';
  newTodoContent.value = '';
  showTodoForm.value = false;
};

const deleteTodoItem = (id: string) => {
  const index = todoItems.value.findIndex((item) => item.id === id);
  if (index !== -1) {
    todoItems.value.splice(index, 1);
    saveTodoItems();
  }
};

const toggleTodoCompleted = (id: string) => {
  const item = todoItems.value.find((item) => item.id === id);
  if (item) {
    item.completed = !item.completed;
    saveTodoItems();
  }
};

const trendItems = ref<WorkbenchTrendItem[]>([]);
const trendCurrentPage = ref(1);
const trendPageSize = ref(6);
const trendTotalItems = ref(0);
const loading = ref(false);

function getActionText(method: string) {
  switch (method) {
    case 'DELETE': {
      return '删除了';
    }
    case 'POST': {
      return '新增了';
    }
    case 'PUT': {
      return '更新了';
    }
    default: {
      return '操作了';
    }
  }
}

const fetchApiLogs = async (
  page = trendCurrentPage.value,
  size = trendPageSize.value,
) => {
  try {
    loading.value = true;
    const responseData = await getDashboardWorkspaceList({
      currentPage: page,
      pageSize: size,
    });

    let items = responseData.items;
    let total = responseData.total;

    if (
      items === undefined &&
      responseData.data &&
      responseData.data.items !== undefined
    ) {
      console.warn('Accessing items and total from responseData.data');
      items = responseData.data.items;
      total = responseData.data.total;
    }

    if (Array.isArray(items)) {
      trendItems.value = items.map((log: any) => ({
        avatar: userStore.userInfo?.avatar || preferences.app.defaultAvatar,
        content: `在 <a data-url="${log.refererPath || '#'}">
        ${$t(log.moduleNameCN || '未知模块')}</a> ${getActionText(log.method)} ${log.itemName || '未命名项目'}`,
        date: formatDate(new Date(log.requestTime)),
        title: log.username || 'guest',
        url: log.refererPath || '#',
      }));
      trendTotalItems.value = Number(total) || 0;
    } else {
      console.error(
        'Failed to parse items from API response. "items" is not an array:',
        items,
      );
      trendItems.value = [];
      trendTotalItems.value = 0;
    }
  } catch (error) {
    console.error('Failed to fetch API logs:', error);
    trendItems.value = [];
    trendTotalItems.value = 0;
  } finally {
    loading.value = false;
  }
};

const handleTrendPageChange = (newPage: number, newPageSize: number) => {
  trendCurrentPage.value = newPage;
  trendPageSize.value = newPageSize;
  fetchApiLogs(newPage, newPageSize);
};

const formatDate = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60 * 1000) {
    return '刚刚';
  }

  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes}分钟前`;
  }

  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}小时前`;
  }

  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}天前`;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

onMounted(() => {
  fetchApiLogs(trendCurrentPage.value, trendPageSize.value);
  loadTodoItems();
});

const router = useRouter();

function navTo(nav: WorkbenchQuickNavItem) {
  if (nav.url?.startsWith('http')) {
    openWindow(nav.url);
    return;
  }
  if (nav.url?.startsWith('/')) {
    router.push(nav.url).catch((error) => {
      console.error('Navigation failed:', error);
    });
  } else {
    console.warn(`Unknown URL for navigation item: ${nav.title} -> ${nav.url}`);
  }
}
</script>

<template>
  <div class="p-5">
    <WorkbenchHeader
      :avatar="userStore.userInfo?.avatar || preferences.app.defaultAvatar"
      :incomplete-todo-count="incompleteTodoItemsCount"
      :total-todo-count="totalTodoItemsCount"
    >
      <template #title>
        早安, {{ userStore.userInfo?.realName }}, 开始您一天的工作吧！
      </template>
      <template #description>
        {{ currentDate }} {{ weatherDescription }}
      </template>
    </WorkbenchHeader>

    <div class="mt-5 flex flex-col lg:flex-row">
      <div class="mr-4 w-full lg:w-3/5">
        <WorkbenchTrends :items="trendItems" title="最新动态" />
        <div v-if="trendTotalItems > 0" class="mt-4 flex justify-end">
          <Pagination
            v-model:current="trendCurrentPage"
            v-model:page-size="trendPageSize"
            :total="trendTotalItems"
            show-size-changer
            @change="handleTrendPageChange"
          />
        </div>
      </div>
      <div class="w-full lg:w-2/5">
        <WorkbenchQuickNav
          :items="quickNavItems"
          class="mt-5 lg:mt-0"
          title="快捷导航"
          @click="navTo"
        />

        <WorkbenchTodo
          :items="todoItems"
          class="mt-5"
          title="待办清单"
          @clear="clearTodoItems"
          @delete="deleteTodoItem"
          @toggle="toggleTodoCompleted"
        >
          <template #add-button>
            <button
              v-if="!showTodoForm"
              class="bg-primary rounded px-3 py-1 text-xs text-white"
              @click="showTodoForm = true"
            >
              添加待办
            </button>
          </template>

          <template #add-todo>
            <div
              v-if="showTodoForm"
              class="w-full rounded border border-gray-200 p-4"
            >
              <div class="mb-3">
                <input
                  v-model="newTodoTitle"
                  class="w-full rounded border border-gray-300 p-2 text-sm"
                  placeholder="待办标题"
                  type="text"
                />
              </div>
              <div class="mb-3">
                <textarea
                  v-model="newTodoContent"
                  class="w-full rounded border border-gray-300 p-2 text-sm"
                  placeholder="详细描述（可选）"
                  rows="3"
                ></textarea>
              </div>
              <div class="flex justify-end space-x-2">
                <button
                  class="rounded bg-gray-200 px-4 py-2 text-sm text-gray-700"
                  @click="showTodoForm = false"
                >
                  取消
                </button>
                <button
                  :disabled="!newTodoTitle.trim()"
                  class="bg-primary rounded px-4 py-2 text-sm text-white"
                  @click="addTodoItem"
                >
                  保存
                </button>
              </div>
            </div>
          </template>
        </WorkbenchTodo>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 可以添加自定义样式 */
</style>
