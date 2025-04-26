<script lang="ts" setup>
import type {
  WorkbenchQuickNavItem,
  WorkbenchTodoItem,
  WorkbenchTrendItem,
} from '@vben/common-ui';

import { computed, onMounted, ref } from 'vue';
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

import { v4 as uuidv4 } from 'uuid'; // 引入 uuid 库，如果项目没有，需要安装 npm install uuid @types/uuid

import { getDashboardWorkspaceList } from '#/api/dashboard';

const userStore = useUserStore();

// 添加日期和天气信息
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

// 这里可以替换为实际的天气API调用
const weather = ref({
  condition: '晴',
  temperature: {
    max: 32,
    min: 20,
  },
});

// 天气描述
const weatherDescription = computed(() => {
  return `今日${weather.value.condition}，${weather.value.temperature.min}℃ - ${weather.value.temperature.max}℃`;
});

// 这是一个示例数据，实际项目中需要根据实际情况进行调整
// url 也可以是内部路由，在 navTo 方法中识别处理，进行内部跳转
// 例如：url: /dashboard/workspace

// 同样，这里的 url 也可以使用以 http 开头的外部链接
const quickNavItems: WorkbenchQuickNavItem[] = [
  {
    color: '#1fdaca',
    icon: 'ion:home-outline',
    title: '首页',
    url: '/',
  },
  {
    color: '#bf0c2c',
    icon: 'mdi:file-document-multiple',
    title: '账单管理',
    url: '/bill',
  },
  {
    color: '#e18525',
    icon: 'mdi:office-building',
    title: '招商管理',
    url: '/investment',
  },
  {
    color: '#3fb27f',
    icon: 'mdi:currency-usd',
    title: '财务管理',
    url: '/finance/manage', // 这里的 URL 是示例，实际项目中需要根据实际情况进行调整
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

// 从本地存储加载的动态待办事项
const todoItems = ref<WorkbenchTodoItem[]>([]);

// 新待办事项表单
const newTodoTitle = ref('');
const newTodoContent = ref('');
const showTodoForm = ref(false);

// 从本地存储加载待办事项
const loadTodoItems = () => {
  const storedItems = localStorage.getItem('workbenchTodoItems');
  if (storedItems) {
    try {
      const parsedItems = JSON.parse(storedItems);
      // 确保每个加载的项都有 id
      todoItems.value = parsedItems.map((item: any) => ({
        ...item,
        id: item.id || uuidv4(), // 如果没有 id，则生成一个新的
      }));
    } catch (error) {
      console.error('解析待办事项失败:', error);
      todoItems.value = []; // 解析失败则清空
    }
  }
};

// 保存待办事项到本地存储
const saveTodoItems = () => {
  localStorage.setItem('workbenchTodoItems', JSON.stringify(todoItems.value));
};

// 清空待办事项
const clearTodoItems = () => {
  todoItems.value = [];
  saveTodoItems();
};

// 添加新待办事项
const addTodoItem = () => {
  if (!newTodoTitle.value.trim()) return;

  const now = new Date();
  const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  todoItems.value.unshift({
    completed: false,
    content: newTodoContent.value.trim() || '无详细描述',
    date: formattedDate,
    id: uuidv4(), // 添加唯一 ID
    opened: false,
    title: newTodoTitle.value.trim(),
  });

  // 保存到本地存储
  saveTodoItems();

  // 重置表单
  newTodoTitle.value = '';
  newTodoContent.value = '';
  showTodoForm.value = false;
};

// 删除待办事项 (按 ID 删除)
const deleteTodoItem = (id: string) => {
  const index = todoItems.value.findIndex((item) => item.id === id);
  if (index !== -1) {
    todoItems.value.splice(index, 1);
    saveTodoItems();
  }
};

// 切换待办事项完成状态 (按 ID 切换)
const toggleTodoCompleted = (id: string) => {
  const item = todoItems.value.find((item) => item.id === id);
  if (item) {
    item.completed = !item.completed;
    saveTodoItems();
  }
};

// 从API获取的动态数据
const trendItems = ref<WorkbenchTrendItem[]>([]);

// 获取API日志数据
const fetchApiLogs = async () => {
  try {
    const res = await getDashboardWorkspaceList({
      currentPage: 1,
      pageSize: 10,
    });

    console.warn('获取到的API日志数据:', res);

    // 修改判断条件，适应实际的数据格式
    if (res && (res.items || (res.data && res.data.items))) {
      // 根据实际数据结构获取items
      const items = res.items || (res.data && res.data.items);

      // 将API日志数据转换为动态列表格式
      trendItems.value = items.map((item: any) => {
        // 根据logId确定头像
        const avatarIndex = (item.logId % 4) + 1;

        // 根据method确定操作类型
        let operation = '';
        switch (item.method) {
          case 'DELETE': {
            operation = '删除';
            break;
          }
          case 'POST': {
            operation = '新增';
            break;
          }
          case 'PUT': {
            operation = '修改';
            break;
          }
          default: {
            operation = '操作';
          }
        }

        // 格式化日期
        const date = formatDate(new Date(item.requestTime));

        // 国际化处理模块名称
        const buttonText = $t(item.moduleNameCN);

        item.itemName = item.itemName || '未命名';

        return {
          avatar: `svg:avatar-${avatarIndex}`,
          content: `在 <a data-url="${item.refererPath}">${buttonText}</a>  ${operation} 了 ${item.itemName} 项目`,
          date,
          title: item.username || '匿名用户',
          url: item.refererPath,
        };
      });

      console.warn('转换后的趋势数据:', trendItems.value);
    } else {
      console.error('API返回数据格式不正确:', res);
    }
  } catch (error) {
    console.error('获取API日志失败:', error);
  }
};

// 格式化日期
const formatDate = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // 小于1分钟
  if (diff < 60 * 1000) {
    return '刚刚';
  }

  // 小于1小时
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes}分钟前`;
  }

  // 小于24小时
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}小时前`;
  }

  // 小于7天
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}天前`;
  }

  // 大于7天，显示具体日期
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 页面加载时获取数据
onMounted(() => {
  fetchApiLogs();
  loadTodoItems(); // 加载时会处理 id
});

const router = useRouter();

// 这是一个示例方法，实际项目中需要根据实际情况进行调整
// This is a sample method, adjust according to the actual project requirements
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
        <WorkbenchTrends :items="trendItems" class="mt-5" title="最新动态" />
      </div>
      <div class="w-full lg:w-2/5">
        <WorkbenchQuickNav
          :items="quickNavItems"
          class="mt-5 lg:mt-0"
          title="快捷导航"
          @click="navTo"
        />

        <!-- 待办事项 - 直接使用 WorkbenchTodo 组件 -->
        <!-- 事件监听器现在接收 id -->
        <WorkbenchTodo
          :items="todoItems"
          class="mt-5"
          title="待办清单"
          @delete="deleteTodoItem"
          @toggle="toggleTodoCompleted"
          @clear="clearTodoItems"
        >
          <template #add-button>
            <button
              v-if="!showTodoForm"
              @click="showTodoForm = true"
              class="bg-primary rounded px-3 py-1 text-xs text-white"
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
                  type="text"
                  placeholder="待办标题"
                  class="w-full rounded border border-gray-300 p-2 text-sm"
                />
              </div>
              <div class="mb-3">
                <textarea
                  v-model="newTodoContent"
                  placeholder="详细描述（可选）"
                  class="w-full rounded border border-gray-300 p-2 text-sm"
                  rows="3"
                ></textarea>
              </div>
              <div class="flex justify-end space-x-2">
                <button
                  @click="showTodoForm = false"
                  class="rounded bg-gray-200 px-4 py-2 text-sm text-gray-700"
                >
                  取消
                </button>
                <button
                  @click="addTodoItem"
                  class="bg-primary rounded px-4 py-2 text-sm text-white"
                  :disabled="!newTodoTitle.trim()"
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
