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
    content: '位于工业园区核心地带，交通便利，配套设施完善，适合轻工业生产。',
    date: '2021-04-01',
    group: '张经理',
    icon: 'carbon:logo-github',
    id: 1,
    imgUrl: '/assets/微信图片_20250320150833.jpg',
    tag: '空闲',
    title: '双福工业园A区厂房',
    url: 'https://github.com',
  },
  {
    color: '#3fb27f',
    content: '独立厂房，配有5吨行车，水电齐全，适合机械加工企业入驻。',
    date: '2021-04-01',
    group: '李经理',
    icon: 'ion:logo-vue',
    id: 2,
    imgUrl: '/assets/微信图片_20250320150851.jpg',
    tag: '维护',
    title: '高新区标准厂房',
    url: 'https://vuejs.org',
  },
  {
    color: '#e18525',
    content: '全新钢结构厂房，层高8米，地面承重3吨，适合仓储物流。',
    date: '2021-04-01',
    group: '王主管',
    icon: 'ion:logo-html5',
    id: 3,
    tag: '空闲',
    title: '临港新区厂房',
    url: 'https://developer.mozilla.org/zh-CN/docs/Web/HTML',
  },
  {
    color: '#bf0c2c',
    content: '独栋三层厂房，每层1200平方米，配有货梯，适合电子产品生产。',
    date: '2021-04-01',
    group: '赵总监',
    icon: 'ion:logo-angular',
    id: 4,
    tag: '维护',
    title: '科技园区厂房',
    url: 'https://angular.io',
  },
  {
    color: '#00d8ff',
    content: '临近高速出口，交通便利，配有宿舍区，适合大型制造企业。',
    date: '2021-04-01',
    group: '刘经理',
    icon: 'bx:bxl-react',
    id: 5,
    tag: '已租',
    title: '经济开发区厂房',
    url: 'https://reactjs.org',
  },
  {
    color: '#EBD94E',
    content: '环保工业园区，配套污水处理设施，适合化工、印染等企业。',
    date: '2021-04-01',
    group: '孙主任',
    icon: 'ion:logo-javascript',
    id: 6,
    tag: '已租',
    title: '环保产业园厂房',
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
