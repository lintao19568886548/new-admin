<script lang="ts" setup>
import type { FactoryListItem } from './types';

import { computed, onMounted, onUnmounted, ref } from 'vue';

import { RentalProject } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import { Button, message, Spin, Tag } from 'ant-design-vue';

import { getListList } from '#/api/rental';

// 厂房列表数据
const projectItems = ref<FactoryListItem[]>([]);
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

// 获取厂房列表数据
async function fetchFactoryList(isLoadMore = false) {
  if (loading.value) return;

  loading.value = true;
  try {
    const params: Record<string, any> = {
      ...searchParams.value,
      currentPage: currentPage.value,
      pageSize: pageSize.value,
    };

    // 如果搜索title，映射到factoryName字段
    if (params.title) {
      params.factoryName = params.title;
      params.title = undefined;
    }

    // 如果搜索group，映射到contact字段
    if (params.group) {
      params.contact = params.group;
      params.group = undefined;
    }

    const res = await getListList(params);

    // 转换后端数据为前端需要的格式
    const items = res.items.map((item: any) => ({
      // 其他字段不直接展示，但保留用于详情页
      address: item.address,
      area: item.area,
      availableArea: item.availableArea,
      buildingNumber: item.buildingNumber,
      content: item.description || '暂无描述',
      date: formatDateTime(item.createTime),
      floorCount: item.floorCount,
      group: item.contact,
      // 不显示敏感ID，但保留用于导航
      id: item.factoryId,
      imgUrl: '/assets/微信图片_20250320150833.jpg', // 使用默认图片
      rentPrice: item.rentPrice,
      tag: item.status || '未设置', // 直接使用status值，如果为空则显示"未设置"
      title: item.factoryName,
    }));

    total.value = res.total || 0;

    projectItems.value = isLoadMore ? [...projectItems.value, ...items] : items;

    // 判断是否还有更多数据
    hasMore.value = projectItems.value.length < total.value;
  } catch (error) {
    console.error('获取厂房列表失败:', error);
    message.error('获取厂房列表失败');
  } finally {
    loading.value = false;
  }
}

// 加载更多数据
function loadMore() {
  if (!hasMore.value || loading.value) return;

  currentPage.value += 1;
  fetchFactoryList(true);
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
    fetchFactoryList(); // 重新加载数据
  } catch (error) {
    console.error('搜索处理出错:', error);
  }
}

// const router = useRouter();

// 导航到详情页
function navTo(nav: any) {
  console.warn('导航到详情页，ID:', nav.id);
  // 直接使用路由路径导航，避免命名路由可能的问题
  window.location.href = `/rental/list/${nav.id}`;
}

// 监听滚动事件，实现懒加载
function handleScroll() {
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
    loadMore();
  }
}

onMounted(() => {
  fetchFactoryList();
  window.addEventListener('scroll', handleScroll);
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});
</script>

<template>
  <div class="p-5">
    <div class="mt-5 flex flex-col lg:flex-row">
      <div class="mr-4 w-full">
        <Spin :spinning="loading">
          <RentalProject
            :items="filteredItems"
            title="厂房列表"
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
