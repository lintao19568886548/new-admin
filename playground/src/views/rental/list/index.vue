<script lang="ts" setup>
import type { ParkListItem } from './types';

import { computed, onActivated, onMounted, onUnmounted, ref } from 'vue'; // 导入 onActivated
import { useRouter } from 'vue-router';

import { RentalProject } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import { Button, message, Spin, Tag } from 'ant-design-vue';

import { getParkList } from '#/api/rental'; // 需要创建新的API
import { useParkStore } from '#/store';

const store = useParkStore();

// 园区列表数据
const projectItems = ref<ParkListItem[]>([]);
const loading = ref(false);
const currentPage = ref(1);
const pageSize = ref(9); // 每次加载3行，每行3个，共9个
const hasMore = ref(true);
const total = ref(0);

// 搜索相关状态
const searchParams = ref({
  group: '',
  tag: '',
  title: '',
});

// 获取园区列表数据
async function fetchParkList(isLoadMore = false) {
  if (loading.value) return;

  loading.value = true;
  try {
    const params: Record<string, any> = {
      ...searchParams.value,
      currentPage: currentPage.value,
      pageSize: pageSize.value,
    };

    // 如果搜索title，映射到parkName字段
    if (params.title) {
      params.parkName = params.title;
      params.title = undefined;
    }

    // 如果搜索tag，映射到status字段
    if (params.tag && params.tag !== '全部') {
      params.status = params.tag;
      params.tag = undefined;
    }

    const res = await getParkList(params);
    console.warn('获取到的园区列表数据:', res);

    // 转换后端数据为前端需要的格式
    const items = res.items.map((item: any) => {
      // 直接使用后端返回的imgUrl，如果没有则使用默认图片
      const imgUrl = item.imgUrl || store.defaultImgUrl; // 使用常量

      return {
        address: item.address,
        area: item.area,
        content: item.description || '暂无描述',
        date: item.createTime ? formatDateTime(item.createTime) : 'N/A', // 添加日期检查
        group: item.parkName, // 使用园区名称作为分组
        id: item.parkId,
        imgUrl,
        tag: item.status || '正常', // 直接使用status值，如果为空则显示"正常"
        title: item.parkName,
      };
    });

    total.value = res.total || 0;

    projectItems.value = isLoadMore ? [...projectItems.value, ...items] : items;

    // 判断是否还有更多数据
    hasMore.value = projectItems.value.length < total.value;
  } catch (error) {
    console.error('获取园区列表失败:', error);
    message.error('获取园区列表失败');
  } finally {
    loading.value = false;
  }
}

// 加载更多数据
async function loadMore() {
  if (!hasMore.value || loading.value) return;

  currentPage.value += 1;
  await fetchParkList(true);
}

// 根据搜索条件过滤项目
const filteredItems = computed(() => {
  return projectItems.value.filter((item) => {
    const titleMatch =
      !searchParams.value.title ||
      item.title.toLowerCase().includes(searchParams.value.title.toLowerCase());

    const tagMatch =
      !searchParams.value.tag || item.tag === searchParams.value.tag;

    const groupMatch =
      !searchParams.value.group ||
      item.group.toLowerCase().includes(searchParams.value.group.toLowerCase());
    return titleMatch && tagMatch && groupMatch;
  });
});

// 处理搜索事件
function handleSearch(params: any) {
  try {
    // 如果标签为"全部"，则设置为空字符串，表示不筛选标签
    if (params.tag === '全部') {
      params.tag = '';
    }
    searchParams.value = { ...params };
    currentPage.value = 1; // 重置页码
    fetchParkList(); // 重新加载数据
  } catch (error) {
    console.error('搜索处理出错:', error);
  }
}

const router = useRouter();

// 导航到详情页
function navTo(nav: any) {
  console.warn('导航到详情页，ID:', nav.id);
  router.push(`/rental/detail/${nav.id}`);
}

// 监听滚动事件，实现懒加载
async function handleScroll() {
  const scrollTop =
    document.documentElement.scrollTop || document.body.scrollTop;
  const scrollHeight =
    document.documentElement.scrollHeight || document.body.scrollHeight;
  const clientHeight =
    document.documentElement.clientHeight || window.innerHeight;

  // 当滚动到距离底部200px时，加载更多数据
  if (
    scrollTop + clientHeight >= scrollHeight - 200 &&
    hasMore.value &&
    !loading.value
  ) {
    await loadMore();
  }
}

// 新增：刷新列表数据的函数
const refreshListData = () => {
  currentPage.value = 1; // 重置到第一页
  projectItems.value = []; // 清空现有项目，以便显示加载状态或避免旧数据闪烁
  fetchParkList(); // 获取第一页数据
};

onMounted(() => {
  refreshListData(); // 修改为调用新的刷新函数
  window.addEventListener('scroll', handleScroll);
});

onActivated(() => {
  refreshListData(); // 当组件被激活时，也刷新数据
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});
</script>

<template>
  <div class="ml-4">
    <div class="flex flex-col lg:flex-row">
      <div class="mr-4 w-full">
        <Spin :spinning="loading">
          <RentalProject
            :items="filteredItems"
            title="园区列表"
            @click="navTo"
            @search="handleSearch"
          >
            <!-- 添加调试信息，查看是否有项目数据 -->
            <template #empty v-if="filteredItems.length === 0">
              <div class="py-10 text-center text-gray-500">
                {{ loading ? '加载中...' : '暂无数据' }}
                <div>项目数量: {{ projectItems.length }}</div>
              </div>
            </template>
            <template #tag="item">
              <Tag class="font-sma rounded-md px-2 text-base">
                {{ item.tag }}
              </Tag>
            </template>
          </RentalProject>
        </Spin>

        <!-- 加载更多按钮 -->
        <div v-if="hasMore" class="mt-4 text-center">
          <Button :loading="loading" @click="loadMore">加载更多</Button>
        </div>
        <div
          v-else-if="projectItems.length > 0"
          class="mt-4 text-center text-gray-500"
        >
          已加载全部数据
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
