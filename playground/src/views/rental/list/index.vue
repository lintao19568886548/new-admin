<script lang="ts" setup>
import type { RentalProjectItem } from '@vben/common-ui';

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { RentalProject } from '@vben/common-ui';

import { Tag } from 'ant-design-vue';

// const userStore = useUserStore();

// 这是一个示例数据，实际项目中需要根据实际情况进行调整
// url 也可以是内部路由，在 navTo 方法中识别处理，进行内部跳转
// 例如：url: /dashboard/workspace
const projectItems: RentalProjectItem[] = [
  {
    color: 'red',
    content: '不要等待机会，而要创造机会。',
    date: '2021-04-01',
    group: '开源组',
    icon: 'carbon:logo-github',
    id: 1,
    imgUrl: '/assets/微信图片_20250320150833.jpg',
    tag: '空闲',
    title: 'Github',
    url: 'https://github.com',
  },
  {
    color: '#3fb27f',
    content: '现在的你决定将来的你。',
    date: '2021-04-01',
    group: '算法组',
    icon: 'ion:logo-vue',
    id: 2,
    imgUrl: '/assets/微信图片_20250320150851.jpg',
    tag: '维护',
    title: 'Vue',
    url: 'https://vuejs.org',
  },
  {
    color: '#e18525',
    content: 'Nothing can be more important than effort.',
    date: '2021-04-01',
    group: '上班摸鱼',
    icon: 'ion:logo-html5',
    id: 3,
    tag: '空闲',
    title: 'Html5',
    url: 'https://developer.mozilla.org/zh-CN/docs/Web/HTML',
  },
  {
    color: '#bf0c2c',
    content: '热情和欲望可以突破一切难关。',
    date: '2021-04-01',
    group: 'UI',
    icon: 'ion:logo-angular',
    id: 4,
    tag: '维护',
    title: 'Angular',
    url: 'https://angular.io',
  },
  {
    color: '#00d8ff',
    content: '健康的身体是实现目标的基石。',
    date: '2021-04-01',
    group: '技术牛',
    icon: 'bx:bxl-react',
    id: 5,
    tag: '已租',
    title: 'React',
    url: 'https://reactjs.org',
  },
  {
    color: '#EBD94E',
    content: '路是走出来的，而不是空想出来的。',
    date: '2021-04-01',
    group: '架构组',
    icon: 'ion:logo-javascript',
    id: 6,
    tag: '已租',
    title: 'Js',
    url: 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript',
  },
];

// 搜索相关状态
const searchParams = ref({
  group: '',
  tag: '',
  title: '',
});

// 根据搜索条件过滤项目
const filteredItems = computed(() => {
  return projectItems.filter((item) => {
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
  } catch (error) {
    console.error('搜索处理出错:', error);
  }
}

const router = useRouter();

// 这是一个示例方法，实际项目中需要根据实际情况进行调整
function navTo(nav: RentalProjectItem) {
  router.push({ name: 'RentalDetail', params: { id: nav.id } });
}

function getTagColor(tag: string) {
  switch (tag) {
    case '已租': {
      return 'red';
    }
    case '空闲': {
      return 'green';
    }
    case '维护': {
      return 'blue';
    }
  }
}
</script>

<template>
  <div class="p-5">
    <div class="mt-5 flex flex-col lg:flex-row">
      <div class="mr-4 w-full">
        <RentalProject
          :items="filteredItems"
          title="项目"
          @click="navTo"
          @search="handleSearch"
        >
          <template #tag="item">
            <Tag
              :color="getTagColor(item.tag)"
              class="font-sma rounded-md px-2 text-base"
            >
              {{ item.tag }}
            </Tag>
          </template>
        </RentalProject>
      </div>
    </div>
  </div>
</template>
