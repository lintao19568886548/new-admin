<script lang="ts" setup>
import type { FactoryDetail, StatusTag } from './types';

import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import {
  Button,
  Card,
  Descriptions,
  Divider,
  Image,
  message,
  Spin,
  Tag,
} from 'ant-design-vue';

import { getListDetail } from '#/api/rental/list';

const route = useRoute();
const router = useRouter();
const id = ref(route.params.id);
const loading = ref(false);

// 返回列表页面
function goBack() {
  router.push({ name: 'RentalList' }); // 使用命名路由确保导航正确
}

// 厂房详情数据
const detail = ref<FactoryDetail>({
  address: '',
  area: 0,
  availableArea: 0,
  buildingNumber: '',
  buildTime: '',
  contact: '',
  createTime: '',
  description: '',
  factoryId: 0,
  factoryName: '',
  floorCount: 0,
  // 使用默认图片
  imgUrl: '/assets/微信图片_20250320150833.jpg',
  rentPrice: 0,
  status: '',
  updateTime: '',
});

// 获取厂房详情
async function fetchFactoryDetail() {
  loading.value = true;
  try {
    console.warn('获取详情，ID:', id.value);
    const res = await getListDetail(Number(id.value));
    console.warn('获取到的详情数据:', res);
    if (res) {
      detail.value = {
        ...res,
        imgUrl: '/assets/微信图片_20250320150833.jpg', // 使用默认图片
      };
    }
  } catch (error) {
    console.error('获取厂房详情失败:', error);
    message.error('获取厂房详情失败');
  } finally {
    loading.value = false;
  }
}

// 计算当前状态标签
const currentTag = computed<StatusTag>(() => {
  return detail.value.status || '未设置'; // 直接使用status值，如果为空则显示"未设置"
});

// 计算特点列表
const features = computed(() => {
  const featureList = [];
  if (detail.value.buildingNumber)
    featureList.push(`${detail.value.buildingNumber}号楼`);
  if (detail.value.floorCount) featureList.push(`${detail.value.floorCount}层`);
  if (detail.value.area) featureList.push(`总面积${detail.value.area}平方米`);
  if (detail.value.availableArea)
    featureList.push(`可用面积${detail.value.availableArea}平方米`);
  return featureList;
});

onMounted(() => {
  fetchFactoryDetail();
});
</script>

<template>
  <Page title="厂房详情">
    <template #extra>
      <Button type="primary" @click="goBack"> 返回列表 </Button>
    </template>

    <Spin :spinning="loading">
      <Card>
        <div class="flex flex-col md:flex-row">
          <div class="p-4 md:w-1/3">
            <Image
              :src="detail.imgUrl"
              :alt="detail.factoryName"
              class="w-full rounded-lg shadow-md"
            />
          </div>
          <div class="p-4 md:w-2/3">
            <div class="mb-4 flex items-center">
              <h1 class="mr-4 text-2xl font-bold">{{ detail.factoryName }}</h1>
              <Tag class="rounded-md px-2 text-base">
                {{ currentTag }}
              </Tag>
            </div>

            <Descriptions
              bordered
              :column="{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }"
            >
              <Descriptions.Item label="租金">
                {{ detail.rentPrice }} 元/平方米/月
              </Descriptions.Item>
              <Descriptions.Item label="总面积">
                {{ detail.area }} 平方米
              </Descriptions.Item>
              <Descriptions.Item label="可用面积">
                {{ detail.availableArea }} 平方米
              </Descriptions.Item>
              <Descriptions.Item label="楼号">
                {{ detail.buildingNumber }}
              </Descriptions.Item>
              <Descriptions.Item label="层数">
                {{ detail.floorCount }}
              </Descriptions.Item>
              <Descriptions.Item label="建造时间">
                {{
                  detail.buildTime ? formatDateTime(detail.buildTime) : '未知'
                }}
              </Descriptions.Item>
              <Descriptions.Item label="地址">
                {{ detail.address }}
              </Descriptions.Item>
              <Descriptions.Item label="联系方式">
                {{ detail.contact }}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {{ formatDateTime(detail.createTime) }}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {{
                  detail.updateTime
                    ? formatDateTime(detail.updateTime)
                    : '未更新'
                }}
              </Descriptions.Item>
            </Descriptions>
          </div>
        </div>

        <Divider orientation="left">项目描述</Divider>
        <p class="mb-6 text-base leading-relaxed">
          {{ detail.description || '暂无描述' }}
        </p>

        <Divider orientation="left">项目特点</Divider>
        <div class="mb-6 flex flex-wrap gap-2">
          <Tag
            v-for="feature in features"
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
    </Spin>
  </Page>
</template>
