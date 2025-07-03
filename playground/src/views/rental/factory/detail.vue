<script lang="ts" setup>
import type { FactoryDetail, StatusTag } from './types';

import {
  computed,
  createApp,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import {
  Button,
  Card,
  Carousel,
  Collapse,
  CollapsePanel,
  Descriptions,
  Divider,
  Image,
  message,
  Spin,
  TabPane,
  Tabs,
  Tag,
} from 'ant-design-vue';

import { getFactoryDetail } from '#/api/factory';
import { useParkStore } from '#/store';

const store = useParkStore();

// 辅助函数，用于确定图片URL列表
const determineImageUrls = (
  imageUrlsList?: (null | string)[] | null,
  singleImgUrl?: null | string,
): string[] => {
  if (imageUrlsList && imageUrlsList.length > 0) {
    // 过滤掉可能存在的 null 值，确保返回 string[]
    const validUrls = imageUrlsList.filter((url) => url !== null) as string[];
    if (validUrls.length > 0) {
      return validUrls;
    }
  }
  if (singleImgUrl) {
    return [singleImgUrl];
  }
  return [store.defaultImgUrl];
};

const route = useRoute();
const router = useRouter();
const id = ref(route.params.id);
const loading = ref(false);
const activeFloorKey = ref<string[]>([]);
const activeTabKey = ref('1');

function goBack() {
  router.push({ name: 'RentalFactory' }); // 使用命名路由确保导航正确
}

// 厂房详情数据
const detail = ref<FactoryDetail>({
  address: '',
  buildTime: '',
  contact: '',
  createTime: '',
  description: '',
  elevators: [],
  factoryId: 0,
  factoryName: '',
  firefighting: [],
  floors: [],
  imageUrls: [store.defaultImgUrl],
  imgUrl: store.defaultImgUrl,
  transformers: [],
  updateTime: '',
});

// 获取厂房详情
async function fetchFactoryDetail() {
  loading.value = true;
  try {
    console.warn('获取厂房详情，ID:', id.value);
    const res = await getFactoryDetail(Number(id.value));
    console.warn('获取到的厂房详情数据:', res);
    if (res) {
      // 辅助函数：检查日期字符串是否有效
      const isValidDate = (dateString: null | string | undefined): boolean => {
        if (!dateString) return false;
        return !Number.isNaN(new Date(dateString).getTime());
      };

      // 处理日期格式问题，确保日期字段有效
      const processedData = {
        ...res,
        buildTime: isValidDate(res.buildTime) ? res.buildTime : null,
        createTime: isValidDate(res.createTime) ? res.createTime : null,
        // 处理消防设施中的日期字段
        firefighting: (res.firefighting || []).map(
          (item: { checkTime: null | string | undefined }) => ({
            ...item,
            checkTime: isValidDate(item.checkTime) ? item.checkTime : null,
          }),
        ),
        // 处理厂房楼层中的日期字段
        floors: (res.floors || []).map((floor: any) => ({
          ...floor,
          createTime: isValidDate(floor.createTime) ? floor.createTime : null,
          imageUrls: determineImageUrls(floor.imageUrls, floor.imgUrl),
          imgUrl: floor.imgUrl || store.defaultImgUrl,
          updateTime: isValidDate(floor.updateTime) ? floor.updateTime : null,
        })),
        imageUrls: determineImageUrls(res.imageUrls, res.imgUrl),
        imgUrl: res.imgUrl || store.defaultImgUrl,
        transformers: (res.transformers || []).map(
          (item: { checkTime: null | string | undefined }) => ({
            ...item,
            checkTime: isValidDate(item.checkTime) ? item.checkTime : null,
          }),
        ),
        updateTime: isValidDate(res.updateTime) ? res.updateTime : null,
      };

      detail.value = processedData;

      // 默认展开前3个楼层
      if (detail.value.floors && detail.value.floors.length > 0) {
        activeFloorKey.value = detail.value.floors
          .slice(0, 3)
          .map((floor: any) => String(floor.floorId));
      }
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
  const status = detail.value.floors?.[0]?.status || '未设置';
  return status as StatusTag;
});

// 计算厂房特点列表
const factoryFeatures = computed(() => {
  const featureList = [];
  const totalArea = getFactoryFloorStats().totalArea;
  if (totalArea) featureList.push(`总面积 ${totalArea} m²`);
  if (detail.value.floors?.length)
    featureList.push(`${detail.value.floors.length}个楼层`);
  if (detail.value.elevators?.length)
    featureList.push(`${detail.value.elevators.length}部升降机`);
  return featureList;
});

/**
 * 计算厂房楼层面积统计
 * @returns 楼层面积统计对象
 */
const getFactoryFloorStats = () => {
  if (!detail.value.floors || detail.value.floors.length === 0) {
    return { availableArea: 0, totalArea: 0, usedArea: 0 };
  }

  const totalArea = detail.value.floors.reduce(
    (sum: number, floor: any) => sum + (floor.totalArea || 0),
    0,
  );
  const usedArea = detail.value.floors.reduce(
    (sum: number, floor: any) => sum + (floor.usedArea || 0),
    0,
  );
  const availableArea = totalArea - usedArea;

  return { availableArea, totalArea, usedArea };
};

// 打开图片预览
function openImagePreview(
  imgList: (null | string | undefined)[],
  startIndex: number = 0,
) {
  const validImgList = imgList
    .map((url) => url || store.defaultImgUrl)
    .filter((url) => !!url) as string[];

  if (validImgList.length === 0) {
    message.warn('没有可预览的图片');
    return;
  }

  const initialIndex = Math.max(
    0,
    Math.min(startIndex, validImgList.length - 1),
  );

  const previewContainer = document.createElement('div');
  document.body.append(previewContainer);

  const previewApp = createApp({
    setup() {
      const visible = ref(false);

      onMounted(() => {
        nextTick(() => {
          visible.value = true;
        });
      });

      onUnmounted(() => {
        if (document.body.contains(previewContainer)) {
          previewContainer.remove();
        }
      });

      return () =>
        h(
          Image.PreviewGroup,
          {
            preview: {
              current: initialIndex,
              onVisibleChange: (v: boolean) => {
                visible.value = v;
                if (!v) {
                  setTimeout(() => {
                    previewApp.unmount();
                  }, 200);
                }
              },
              visible: visible.value,
            },
          },
          validImgList.map((src: string) =>
            h(Image, {
              src,
              style: { display: 'none' },
            }),
          ),
        );
    },
  });
  previewApp.mount(previewContainer);
}

const getTagColor = (status: string) => {
  switch (status) {
    case '异常': {
      return 'red';
    }
    case '正常': {
      return 'green';
    }
    case '维护': {
      return 'blue';
    }
    default: {
      return 'default';
    }
  }
};

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
      <!-- 厂房基本信息 -->
      <Card>
        <div class="flex flex-col md:flex-row">
          <div class="p-4 md:w-1/3">
            <!-- 如果有多张图片，使用轮播图展示 -->
            <Carousel
              v-if="detail.imageUrls && detail.imageUrls.length > 1"
              autoplay
              arrows
            >
              <div
                v-for="(url, index) in detail.imageUrls"
                :key="index"
                class="cursor-pointer"
                @click="openImagePreview(detail.imageUrls, index)"
              >
                <Image
                  :src="url || store.defaultImgUrl"
                  :alt="`${detail.factoryName}-图片${index + 1}`"
                  class="w-full rounded-lg shadow-md"
                  :preview="false"
                />
              </div>
            </Carousel>
            <!-- 如果只有一张图片，直接展示 -->
            <Image
              v-else
              :src="detail.imageUrls[0] || store.defaultImgUrl"
              :alt="detail.factoryName"
              class="w-full cursor-pointer rounded-lg shadow-md"
              :preview="false"
              @click="openImagePreview(detail.imageUrls)"
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
              <Descriptions.Item label="总面积">
                {{ getFactoryFloorStats().totalArea }} m²
              </Descriptions.Item>
              <Descriptions.Item label="已用面积">
                {{ getFactoryFloorStats().usedArea }} m²
              </Descriptions.Item>
              <Descriptions.Item label="可租面积">
                {{ getFactoryFloorStats().availableArea }} m²
              </Descriptions.Item>
              <Descriptions.Item label="地址">
                {{ detail.address }}
              </Descriptions.Item>
              <Descriptions.Item label="联系方式">
                {{ detail.contact }}
              </Descriptions.Item>
              <Descriptions.Item label="建设时间">
                {{
                  detail.buildTime ? formatDateTime(detail.buildTime) : '未知'
                }}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {{
                  detail.createTime ? formatDateTime(detail.createTime) : '未知'
                }}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {{
                  detail.updateTime
                    ? formatDateTime(detail.updateTime)
                    : '未更新'
                }}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <div class="mb-4">
              <h3 class="mb-2 text-lg font-semibold">厂房特点</h3>
              <div class="flex flex-wrap gap-2">
                <Tag
                  v-for="feature in factoryFeatures"
                  :key="feature"
                  class="rounded-md px-3 py-1"
                >
                  {{ feature }}
                </Tag>
              </div>
            </div>

            <div v-if="detail.description">
              <h3 class="mb-2 text-lg font-semibold">厂房描述</h3>
              <p class="text-gray-600">{{ detail.description }}</p>
            </div>
          </div>
        </div>
      </Card>

      <!-- 楼层信息 -->
      <Card v-if="detail.floors && detail.floors.length > 0" class="mt-6">
        <template #title>
          <div class="flex items-center">
            <span class="mr-2 text-lg font-semibold">楼层信息</span>
            <Tag class="rounded-md"> 共 {{ detail.floors.length }} 个楼层 </Tag>
          </div>
        </template>

        <Collapse v-model:active-key="activeFloorKey" class="mt-4">
          <CollapsePanel
            v-for="floor in detail.floors"
            :key="String(floor.floorId)"
            :header="`${floor.floorName} - ${floor.totalArea}m² (可用: ${floor.totalArea - floor.usedArea}m²)`"
          >
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <!-- 楼层图片 -->
              <div v-if="floor.imageUrls && floor.imageUrls.length > 0">
                <h4 class="mb-2 font-semibold">楼层图片</h4>
                <div class="grid grid-cols-2 gap-2">
                  <Image
                    v-for="(imgUrl, imgIndex) in floor.imageUrls.slice(0, 4)"
                    :key="imgIndex"
                    :src="imgUrl || store.defaultImgUrl"
                    :alt="`${floor.floorName}-图片${imgIndex + 1}`"
                    class="h-24 w-full cursor-pointer rounded object-cover"
                    :preview="false"
                    @click="openImagePreview(floor.imageUrls, imgIndex)"
                  />
                </div>
                <Button
                  v-if="floor.imageUrls.length > 4"
                  type="link"
                  size="small"
                  class="mt-2 p-0"
                  @click="openImagePreview(floor.imageUrls)"
                >
                  查看全部 {{ floor.imageUrls.length }} 张图片
                </Button>
              </div>

              <!-- 楼层详细信息 -->
              <div>
                <h4 class="mb-2 font-semibold">楼层详情</h4>
                <Descriptions size="small" :column="1" bordered>
                  <Descriptions.Item label="楼层高度">
                    {{ floor.floorHeight }} m
                  </Descriptions.Item>
                  <Descriptions.Item label="总面积">
                    {{ floor.totalArea }} m²
                  </Descriptions.Item>
                  <Descriptions.Item label="已用面积">
                    {{ floor.usedArea }} m²
                  </Descriptions.Item>
                  <Descriptions.Item label="可用面积">
                    {{ floor.totalArea - floor.usedArea }} m²
                  </Descriptions.Item>
                  <Descriptions.Item label="承重">
                    {{ floor.loadBearing }} kg/m²
                  </Descriptions.Item>
                  <Descriptions.Item label="租金">
                    ¥{{ floor.rentPrice }}/m²/月
                  </Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Tag :color="getTagColor(floor.status)">
                      {{ floor.status }}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item v-if="floor.description" label="描述">
                    {{ floor.description }}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            </div>
          </CollapsePanel>
        </Collapse>
      </Card>

      <!-- 设施信息 -->
      <Card
        v-if="
          detail.elevators?.length ||
          detail.firefighting?.length ||
          detail.transformers?.length
        "
        class="mt-6"
      >
        <template #title>
          <span class="text-lg font-semibold">设施信息</span>
        </template>

        <Tabs v-model:active-key="activeTabKey">
          <!-- 升降机信息 -->
          <TabPane
            v-if="detail.elevators && detail.elevators.length > 0"
            key="1"
            tab="升降机"
          >
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card
                v-for="elevator in detail.elevators"
                :key="elevator.elevatorId"
                size="small"
              >
                <template #title>
                  {{ elevator.name || elevator.title }}
                </template>
                <Descriptions size="small" :column="1">
                  <Descriptions.Item label="品牌">
                    {{ elevator.brand }}
                  </Descriptions.Item>
                  <Descriptions.Item label="载重">
                    {{ elevator.loadCapacity }} kg
                  </Descriptions.Item>
                  <Descriptions.Item label="尺寸">
                    {{ elevator.size }}
                  </Descriptions.Item>
                  <Descriptions.Item label="生产日期">
                    {{ elevator.productionDate }}
                  </Descriptions.Item>
                  <Descriptions.Item v-if="elevator.remark" label="备注">
                    {{ elevator.remark }}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </div>
          </TabPane>

          <!-- 消防设施 -->
          <TabPane
            v-if="detail.firefighting && detail.firefighting.length > 0"
            key="2"
            tab="消防设施"
          >
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card
                v-for="fire in detail.firefighting"
                :key="fire.firefightingId"
                size="small"
              >
                <template #title>
                  {{ fire.title }}
                </template>
                <Descriptions size="small" :column="1">
                  <Descriptions.Item label="灭火器">
                    {{ fire.extinguisher }}
                  </Descriptions.Item>
                  <Descriptions.Item label="消防栓">
                    {{ fire.hydrant }}
                  </Descriptions.Item>
                  <Descriptions.Item label="安全出口">
                    {{ fire.fireExit }}
                  </Descriptions.Item>
                  <Descriptions.Item label="检查人">
                    {{ fire.checker }}
                  </Descriptions.Item>
                  <Descriptions.Item label="检查时间">
                    {{
                      fire.checkTime ? formatDateTime(fire.checkTime) : '未检查'
                    }}
                  </Descriptions.Item>
                  <Descriptions.Item v-if="fire.remark" label="备注">
                    {{ fire.remark }}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </div>
          </TabPane>

          <!-- 变压器 -->
          <TabPane
            v-if="detail.transformers && detail.transformers.length > 0"
            key="3"
            tab="变压器"
          >
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card
                v-for="transformer in detail.transformers"
                :key="transformer.transformerId"
                size="small"
              >
                <template #title>
                  {{ transformer.title }}
                </template>
                <Descriptions size="small" :column="1">
                  <Descriptions.Item label="规格">
                    {{ transformer.specifications }}
                  </Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Tag :color="getTagColor(transformer.status)">
                      {{ transformer.status }}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="联系方式">
                    {{ transformer.contact }}
                  </Descriptions.Item>
                  <Descriptions.Item label="检查人">
                    {{ transformer.checker }}
                  </Descriptions.Item>
                  <Descriptions.Item label="检查时间">
                    {{
                      transformer.checkTime
                        ? formatDateTime(transformer.checkTime)
                        : '未检查'
                    }}
                  </Descriptions.Item>
                  <Descriptions.Item v-if="transformer.remark" label="备注">
                    {{ transformer.remark }}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </div>
          </TabPane>
        </Tabs>
      </Card>
    </Spin>
  </Page>
</template>

<style lang="scss" scoped></style>
