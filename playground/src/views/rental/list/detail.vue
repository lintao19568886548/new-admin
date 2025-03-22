<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Descriptions,
  Divider,
  Image,
  Tag,
} from 'ant-design-vue';

const route = useRoute();
const router = useRouter();
const id = ref(route.params.id);

// 返回列表页面
function goBack() {
  router.push('/rental');
}

// 模拟的详情数据
const detail = ref({
  address: '北京市朝阳区建国路88号',
  area: '120平方米',
  contact: '张先生 13800138000',
  createTime: '2021-04-01',
  description:
    '这是一个非常好的租赁项目，位置优越，交通便利，周边配套设施齐全。',
  features: ['交通便利', '配套齐全', '环境优美', '安全可靠'],
  id: id.value,
  imgUrl: '/assets/微信图片_20250320150833.jpg',
  price: '2000元/月',
  tag: '空闲',
  title: '租赁项目详情',
  updateTime: '2021-04-01',
});

// 获取标签颜色
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
    default: {
      return 'default';
    }
  }
}

onMounted(() => {
  // 模拟API请求获取详情数据
  console.warn('获取租赁项目详情,ID:', id.value);
  // 在实际项目中，这里应该调用API获取详情数据
  // getRentalDetail(id.value).then(res => {
  //   detail.value = res.data;
  // });
});
</script>

<template>
  <Page :title="`租赁项目详情 #${id}`">
    <template #extra>
      <Button type="primary" @click="goBack"> 返回列表 </Button>
    </template>

    <Card>
      <div class="flex flex-col md:flex-row">
        <div class="p-4 md:w-1/3">
          <Image
            :src="detail.imgUrl"
            :alt="detail.title"
            class="w-full rounded-lg shadow-md"
          />
        </div>
        <div class="p-4 md:w-2/3">
          <div class="mb-4 flex items-center">
            <h1 class="mr-4 text-2xl font-bold">{{ detail.title }}</h1>
            <Tag
              :color="getTagColor(detail.tag)"
              class="rounded-md px-2 text-base"
            >
              {{ detail.tag }}
            </Tag>
          </div>

          <Descriptions
            bordered
            :column="{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }"
          >
            <Descriptions.Item label="价格">
              {{ detail.price }}
            </Descriptions.Item>
            <Descriptions.Item label="面积">
              {{ detail.area }}
            </Descriptions.Item>
            <Descriptions.Item label="地址">
              {{ detail.address }}
            </Descriptions.Item>
            <Descriptions.Item label="联系方式">
              {{ detail.contact }}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {{ detail.createTime }}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {{ detail.updateTime }}
            </Descriptions.Item>
          </Descriptions>
        </div>
      </div>

      <Divider orientation="left">项目描述</Divider>
      <p class="mb-6 text-base leading-relaxed">{{ detail.description }}</p>

      <Divider orientation="left">项目特点</Divider>
      <div class="mb-6 flex flex-wrap gap-2">
        <Tag
          v-for="feature in detail.features"
          :key="feature"
          color="blue"
          class="px-3 py-1 text-base"
        >
          {{ feature }}
        </Tag>
      </div>
    </Card>

    <Card title="相关推荐" class="mt-5">
      <div class="py-10 text-center text-gray-500">暂无相关推荐</div>
    </Card>
  </Page>
</template>
