<script lang="ts" setup>
import type { ParkDetail, StatusTag } from './types';

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
  Image, // Image.PreviewGroup is part of Image
  message,
  Spin,
  TabPane,
  Tabs,
  Tag,
} from 'ant-design-vue';

import { getParkDetail } from '#/api/rental';
import { useParkStore } from '#/store';

const store = useParkStore();

// 新增：辅助函数，用于确定图片URL列表
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
  return [store.defaultImgUrl]; // store 在 setup 作用域中可用
};

const route = useRoute();
const router = useRouter();
const id = ref(route.params.id);
const loading = ref(false);
const activeFactoryKey = ref<string[]>([]);
const activeDormitoryKey = ref<string[]>([]);
const activeTabKey = ref('1');

function goBack() {
  router.push({ name: 'RentalList' }); // 使用命名路由确保导航正确
}

// 园区详情数据
const detail = ref<ParkDetail>({
  address: '',
  area: 0,
  createTime: '',
  description: '',
  dormitories: [],
  factories: [],
  imageUrls: [store.defaultImgUrl], // 使用常量
  imgUrl: store.defaultImgUrl, // 使用常量
  parkId: 0,
  parkName: '',
  status: '',
  updateTime: '',
});

// 获取园区详情
async function fetchParkDetail() {
  loading.value = true;
  try {
    console.warn('获取园区详情，ID:', id.value);
    const res = await getParkDetail(Number(id.value));
    console.warn('获取到的园区详情数据:', res);
    if (res) {
      // 辅助函数：检查日期字符串是否有效
      const isValidDate = (dateString: null | string | undefined): boolean => {
        if (!dateString) return false;
        return !Number.isNaN(new Date(dateString).getTime());
      };

      // 处理日期格式问题，确保日期字段有效
      const processedData = {
        ...res,
        // 确保日期字段有效，如果无效则设为null
        createTime: isValidDate(res.createTime) ? res.createTime : null,
        // 处理宿舍中的日期字段
        dormitories: (res.dormitories || []).map((dorm: any) => ({
          ...dorm,
          createTime: isValidDate(dorm.createTime) ? dorm.createTime : null,
          imageUrls: determineImageUrls(dorm.imageUrls, dorm.imgUrl), // 使用辅助函数
          imgUrl: dorm.imgUrl || store.defaultImgUrl, // 单个 imgUrl 仍需处理
          updateTime: isValidDate(dorm.updateTime) ? dorm.updateTime : null,
        })),
        factories: (res.factories || []).map((factory: any) => ({
          ...factory,
          buildTime: isValidDate(factory.buildTime) ? factory.buildTime : null,
          createTime: isValidDate(factory.createTime)
            ? factory.createTime
            : null,
          // 处理消防设施中的日期字段
          firefighting: (factory.firefighting || []).map(
            (item: { checkTime: null | string | undefined }) => ({
              ...item,
              checkTime: isValidDate(item.checkTime) ? item.checkTime : null,
            }),
          ),
          // 处理厂房楼层中的日期字段
          floors: (factory.floors || []).map((floor: any) => ({
            ...floor,
            createTime: isValidDate(floor.createTime) ? floor.createTime : null,
            updateTime: isValidDate(floor.updateTime) ? floor.updateTime : null,
          })),
          imageUrls: determineImageUrls(factory.imageUrls, factory.imgUrl), // 使用辅助函数
          imgUrl: factory.imgUrl || store.defaultImgUrl, // 单个 imgUrl 仍需处理
          transformers: (factory.transformers || []).map(
            (item: { checkTime: null | string | undefined }) => ({
              ...item,
              checkTime: isValidDate(item.checkTime) ? item.checkTime : null,
            }),
          ),
          updateTime: isValidDate(factory.updateTime)
            ? factory.updateTime
            : null,
        })),
        imageUrls: determineImageUrls(res.imageUrls, res.imgUrl), // 对园区主图也使用辅助函数
        imgUrl: res.imgUrl || store.defaultImgUrl, // 单个 imgUrl 仍需处理
        updateTime: isValidDate(res.updateTime) ? res.updateTime : null,
      };

      detail.value = processedData;

      if (detail.value.factories && detail.value.factories.length > 0) {
        activeFactoryKey.value = detail.value.factories
          .slice(0, 3)
          .map((factory: any) => String(factory.factoryId));
      }

      if (detail.value.dormitories && detail.value.dormitories.length > 0) {
        activeDormitoryKey.value = detail.value.dormitories
          .slice(0, 3)
          .map((dorm: any) => String(dorm.dormitoryId));
      }
    }
  } catch (error) {
    console.error('获取园区详情失败:', error);
    message.error('获取园区详情失败');
  } finally {
    loading.value = false;
  }
}

// 计算当前状态标签
const currentTag = computed<StatusTag>(() => {
  // 确保返回的是StatusTag类型
  const status = detail.value.status || '未设置';
  return status as StatusTag;
});

// 计算园区特点列表
const parkFeatures = computed(() => {
  const featureList = [];
  if (detail.value.area) featureList.push(`总面积 ${detail.value.area} m²`);
  if (detail.value.factories?.length)
    featureList.push(`${detail.value.factories.length}个厂房`);
  if (detail.value.dormitories?.length)
    featureList.push(`${detail.value.dormitories.length}个宿舍`);
  return featureList;
});

// NEW: Function to open image preview
function openImagePreview(
  imgList: (null | string | undefined)[],
  startIndex: number = 0,
) {
  const validImgList = imgList
    .map((url) => url || store.defaultImgUrl) // Use default if URL is null/undefined
    .filter((url) => !!url) as string[]; // Filter out any remaining invalid URLs

  if (validImgList.length === 0) {
    message.warn('没有可预览的图片');
    return;
  }

  // Ensure startIndex is within bounds
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
              current: initialIndex, // Set the initial image by index
              onVisibleChange: (v: boolean) => {
                visible.value = v;
                if (!v) {
                  setTimeout(() => {
                    previewApp.unmount();
                  }, 200); // Delay unmount for closing animation
                }
              },
              visible: visible.value,
            },
          },
          validImgList.map((src: string) =>
            h(Image, {
              src,
              style: { display: 'none' }, // Images are part of the group but not displayed individually here
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
  fetchParkDetail();
});
</script>

<template>
  <Page title="园区详情">
    <template #extra>
      <Button type="primary" @click="goBack"> 返回列表 </Button>
    </template>

    <Spin :spinning="loading">
      <!-- 园区基本信息 -->
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
                  :alt="`${detail.parkName}-图片${index + 1}`"
                  class="w-full rounded-lg shadow-md"
                  :preview="false"
                />
              </div>
            </Carousel>
            <!-- 如果只有一张图片，直接展示 (此处的 detail.imgUrl 已由脚本处理，无需修改) -->
            <Image
              v-else
              :src="detail.imageUrls[0] || store.defaultImgUrl"
              :alt="detail.parkName"
              class="w-full cursor-pointer rounded-lg shadow-md"
              :preview="false"
              @click="openImagePreview(detail.imageUrls)"
            />
          </div>
          <div class="p-4 md:w-2/3">
            <div class="mb-4 flex items-center">
              <h1 class="mr-4 text-2xl font-bold">{{ detail.parkName }}</h1>
              <Tag class="rounded-md px-2 text-base">
                {{ currentTag }}
              </Tag>
            </div>

            <Descriptions
              bordered
              :column="{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }"
            >
              <Descriptions.Item label="总面积">
                {{ detail.area }} m²
              </Descriptions.Item>
              <Descriptions.Item label="地址">
                {{ detail.address }}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {{ detail.status || '正常' }}
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
          </div>
        </div>

        <Divider orientation="left">园区描述</Divider>
        <p class="mb-6 text-base leading-relaxed">
          {{ detail.description || '暂无描述' }}
        </p>

        <Divider orientation="left">园区特点</Divider>
        <div class="mb-6 flex flex-wrap gap-2">
          <Tag
            v-for="feature in parkFeatures"
            :key="feature"
            color="blue"
            class="px-3 py-1 text-base"
          >
            {{ feature }}
          </Tag>
        </div>
      </Card>

      <!-- 厂房信息 -->
      <Card title="厂房信息" class="mt-5">
        <div v-if="detail.factories && detail.factories.length > 0">
          <Collapse v-model:active-key="activeFactoryKey">
            <CollapsePanel
              v-for="factory in detail.factories"
              :key="factory.factoryId"
              :header="factory.factoryName"
            >
              <div class="flex flex-col">
                <div class="p-4">
                  <Descriptions
                    bordered
                    :column="{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }"
                  >
                    <Descriptions.Item label="地址">
                      {{ factory.address }}
                    </Descriptions.Item>
                    <Descriptions.Item label="联系方式">
                      {{ factory.contact }}
                    </Descriptions.Item>
                    <Descriptions.Item label="建造时间">
                      {{
                        factory.buildTime
                          ? formatDateTime(factory.buildTime)
                          : '未知'
                      }}
                    </Descriptions.Item>
                    <Descriptions.Item label="状态">
                      {{ factory.status || '正常' }}
                    </Descriptions.Item>
                  </Descriptions>

                  <Divider orientation="left">厂房描述</Divider>
                  <p class="mb-6 text-base leading-relaxed">
                    {{ factory.description || '暂无描述' }}
                  </p>

                  <!-- 厂房楼层信息 -->
                  <Divider orientation="left">楼层信息</Divider>
                  <div v-if="factory.floors && factory.floors.length > 0">
                    <Collapse>
                      <CollapsePanel
                        v-for="floor in factory.floors"
                        :key="floor.floorId"
                        :header="floor.floorName"
                      >
                        <div class="flex flex-col md:flex-row">
                          <div class="p-2 md:w-1/3">
                            <Carousel
                              v-if="
                                floor.imageUrls && floor.imageUrls.length > 1
                              "
                              autoplay
                              arrows
                            >
                              <div
                                v-for="(url, index) in floor.imageUrls"
                                :key="index"
                                class="cursor-pointer"
                                @click="
                                  openImagePreview(floor.imageUrls, index)
                                "
                              >
                                <Image
                                  :src="url || store.defaultImgUrl"
                                  :alt="`${floor.floorName}-图片${index + 1}`"
                                  class="w-full cursor-pointer rounded-lg shadow-md"
                                  :preview="false"
                                />
                              </div>
                            </Carousel>
                            <Image
                              v-else
                              :src="floor.imageUrls[0] || store.defaultImgUrl"
                              :alt="floor.floorName"
                              class="w-full cursor-pointer rounded-lg shadow-md"
                              :preview="false"
                              @click="openImagePreview(floor.imageUrls)"
                            />
                          </div>
                          <div class="p-2 md:w-2/3">
                            <Descriptions
                              bordered
                              :column="{
                                xxl: 2,
                                xl: 2,
                                lg: 2,
                                md: 1,
                                sm: 1,
                                xs: 1,
                              }"
                            >
                              <Descriptions.Item label="层高">
                                {{ floor.floorHeight }} 米
                              </Descriptions.Item>
                              <Descriptions.Item label="承重">
                                {{ floor.loadBearing }} 吨/m²
                              </Descriptions.Item>
                              <Descriptions.Item label="租金">
                                {{ floor.rentPrice }} 元/m²/月
                              </Descriptions.Item>
                              <Descriptions.Item label="总面积">
                                {{ floor.totalArea }} m²
                              </Descriptions.Item>
                              <Descriptions.Item label="已用面积">
                                {{ floor.usedArea }} m²
                              </Descriptions.Item>
                              <Descriptions.Item label="状态">
                                {{ floor.status }}
                              </Descriptions.Item>
                            </Descriptions>
                            <Divider orientation="left">楼层描述</Divider>
                            <p>{{ floor.description || '暂无描述' }}</p>
                          </div>
                        </div>
                      </CollapsePanel>
                    </Collapse>
                  </div>
                  <div v-else class="py-4 text-center text-gray-500">
                    暂无楼层信息
                  </div>

                  <!-- 消防设施和变压器信息 -->
                  <Divider orientation="left">设施信息</Divider>
                  <Tabs v-model:active-key="activeTabKey">
                    <TabPane key="1" tab="消防设施">
                      <div
                        v-if="
                          factory.firefighting &&
                          factory.firefighting.length > 0
                        "
                        class="space-y-4"
                      >
                        <div
                          v-for="item in factory.firefighting"
                          :key="item.firefightingId"
                          class="flex flex-col md:flex-row"
                        >
                          <div class="p-2 md:w-2/3">
                            <h3 class="mb-2 text-lg font-semibold">
                              {{ item.title }}
                            </h3>
                            <Descriptions
                              bordered
                              :column="{
                                xxl: 3,
                                xl: 2,
                                lg: 2,
                                md: 1,
                                sm: 1,
                                xs: 1,
                              }"
                            >
                              <Descriptions.Item label="灭火器">
                                <Tag :color="getTagColor(item.extinguisher)">
                                  {{ item.extinguisher }}
                                </Tag>
                              </Descriptions.Item>
                              <Descriptions.Item label="消防栓">
                                <Tag :color="getTagColor(item.hydrant)">
                                  {{ item.hydrant }}
                                </Tag>
                              </Descriptions.Item>
                              <Descriptions.Item label="消防出口">
                                <Tag :color="getTagColor(item.fireExit)">
                                  {{ item.fireExit }}
                                </Tag>
                              </Descriptions.Item>
                              <Descriptions.Item label="检查人">
                                {{ item.checker }}
                              </Descriptions.Item>
                              <Descriptions.Item label="检查时间">
                                {{ formatDateTime(item.checkTime) }}
                              </Descriptions.Item>
                              <Descriptions.Item
                                v-if="item.remark"
                                label="备注"
                              >
                                {{ item.remark }}
                              </Descriptions.Item>
                            </Descriptions>
                          </div>
                        </div>
                      </div>
                      <div v-else class="py-10 text-center text-gray-500">
                        暂无消防设施信息
                      </div>
                    </TabPane>
                    <TabPane key="2" tab="变压器">
                      <div
                        v-if="
                          factory.transformers &&
                          factory.transformers.length > 0
                        "
                        class="space-y-4"
                      >
                        <div
                          v-for="item in factory.transformers"
                          :key="item.transformerId"
                          class="flex flex-col md:flex-row"
                        >
                          <div class="p-2 md:w-2/3">
                            <h3 class="mb-2 text-lg font-semibold">
                              {{ item.title }}
                            </h3>
                            <Descriptions
                              bordered
                              :column="{
                                xxl: 3,
                                xl: 2,
                                lg: 2,
                                md: 1,
                                sm: 1,
                                xs: 1,
                              }"
                            >
                              <Descriptions.Item label="检查人">
                                {{ item.checker }}
                              </Descriptions.Item>
                              <Descriptions.Item label="状态">
                                <Tag :color="getTagColor(item.status)">
                                  {{ item.status }}
                                </Tag>
                              </Descriptions.Item>
                              <Descriptions.Item label="规格">
                                {{ item.specifications }}
                              </Descriptions.Item>
                              <Descriptions.Item label="检查时间">
                                {{ formatDateTime(item.checkTime) }}
                              </Descriptions.Item>
                              <Descriptions.Item
                                v-if="item.remark"
                                label="备注"
                              >
                                {{ item.remark }}
                              </Descriptions.Item>
                            </Descriptions>
                          </div>
                        </div>
                      </div>
                      <div v-else class="py-10 text-center text-gray-500">
                        暂无变压器信息
                      </div>
                    </TabPane>
                    <TabPane key="3" tab="升降机">
                      <!-- 升降机信息展示 -->
                      <div
                        v-if="factory.elevators && factory.elevators.length > 0"
                        class="space-y-4"
                      >
                        <div
                          v-for="item in factory.elevators"
                          :key="item.elevatorId"
                          class="flex flex-col md:flex-row"
                        >
                          <div class="p-2 md:w-2/3">
                            <h3 class="mb-2 text-lg font-semibold">
                              {{ item.name || '未命名升降机' }}
                              <!-- 使用升降机名称 -->
                            </h3>
                            <Descriptions
                              bordered
                              :column="{
                                xxl: 3,
                                xl: 2,
                                lg: 2,
                                md: 1,
                                sm: 1,
                                xs: 1,
                              }"
                            >
                              <!-- 函数级注释：显示升降机品牌 -->
                              <Descriptions.Item label="品牌">
                                {{ item.brand }}
                              </Descriptions.Item>
                              <!-- 函数级注释：显示升降机面积 -->
                              <Descriptions.Item label="面积(㎡)">
                                {{ item.area }}
                              </Descriptions.Item>
                              <!-- 函数级注释：显示升降机承重 -->
                              <Descriptions.Item label="承重(kg)">
                                {{ item.loadCapacity }}
                              </Descriptions.Item>
                              <!-- 函数级注释：显示检查人 -->
                              <Descriptions.Item label="检查人">
                                {{ item.checker }}
                              </Descriptions.Item>
                              <!-- 函数级注释：显示检查时间，并格式化 -->
                              <Descriptions.Item label="检查时间">
                                {{ formatDateTime(item.checkTime) }}
                              </Descriptions.Item>
                              <!-- 可以根据需要添加其他字段，例如状态 -->
                              <!-- <Descriptions.Item label="状态">
                                <Tag :color="getTagColor(item.status)">
                                  {{ item.status }}
                                </Tag>
                              </Descriptions.Item> -->
                              <!-- 函数级注释：如果存在备注，则显示备注 -->
                              <Descriptions.Item
                                v-if="item.remark"
                                label="备注"
                              >
                                {{ item.remark }}
                              </Descriptions.Item>
                            </Descriptions>
                          </div>
                        </div>
                      </div>
                      <!-- 函数级注释：如果没有升降机信息，显示提示文本 -->
                      <div v-else class="py-10 text-center text-gray-500">
                        暂无升降机信息
                      </div>
                    </TabPane>
                  </Tabs>
                </div>
              </div>
            </CollapsePanel>
          </Collapse>
        </div>
        <div v-else class="py-10 text-center text-gray-500">暂无厂房信息</div>
      </Card>

      <!-- 宿舍信息 -->
      <Card title="宿舍信息" class="mt-5">
        <div v-if="detail.dormitories && detail.dormitories.length > 0">
          <Collapse v-model:active-key="activeDormitoryKey">
            <CollapsePanel
              v-for="dorm in detail.dormitories"
              :key="dorm.dormitoryId"
              :header="dorm.dormitoryName"
            >
              <div class="flex flex-col md:flex-row">
                <div class="p-4 md:w-1/3">
                  <Carousel
                    v-if="dorm.imageUrls && dorm.imageUrls.length > 1"
                    autoplay
                    arrows
                  >
                    <div
                      v-for="(url, index) in dorm.imageUrls"
                      :key="index"
                      class="cursor-pointer"
                      @click="openImagePreview(dorm.imageUrls, index)"
                    >
                      <Image
                        :src="url || store.defaultImgUrl"
                        :alt="`${dorm.dormitoryName}-图片${index + 1}`"
                        class="w-full rounded-lg shadow-md"
                        :preview="false"
                      />
                    </div>
                  </Carousel>
                  <Image
                    v-else
                    :src="dorm.imageUrls[0] || store.defaultImgUrl"
                    :alt="dorm.dormitoryName"
                    class="w-full cursor-pointer rounded-lg shadow-md"
                    :preview="false"
                    @click="openImagePreview(dorm.imageUrls)"
                  />
                </div>

                <!-- 宿舍详细信息 -->
                <div class="p-4 md:w-2/3">
                  <Descriptions
                    bordered
                    :column="{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }"
                  >
                    <Descriptions.Item label="总层数">
                      {{ dorm.floorCount }} 层
                    </Descriptions.Item>
                    <Descriptions.Item label="总房间数">
                      {{ dorm.totalRooms }} 间
                    </Descriptions.Item>
                    <Descriptions.Item label="一楼层高">
                      {{ dorm.floorHeightFirst }} m
                    </Descriptions.Item>
                    <Descriptions.Item label="其他层高">
                      {{ dorm.floorHeightOther }} m
                    </Descriptions.Item>
                    <Descriptions.Item label="一楼已用房间数">
                      {{ dorm.usedRoomsFirst }} 间
                    </Descriptions.Item>
                    <Descriptions.Item label="其他层已用房间数">
                      {{ dorm.usedRoomsOther }} 间
                    </Descriptions.Item>
                    <Descriptions.Item label="一楼租金">
                      {{ dorm.rentPriceFirst }} 元/间/月
                    </Descriptions.Item>
                    <Descriptions.Item label="其他层租金">
                      {{ dorm.rentPriceOther }} 元/间/月
                    </Descriptions.Item>
                    <Descriptions.Item label="单间面积">
                      {{ dorm.roomArea }} m²
                    </Descriptions.Item>
                  </Descriptions>
                  <Divider orientation="left">宿舍备注</Divider>
                  <p class="mb-6 text-base leading-relaxed">
                    {{ dorm.remark || '暂无备注' }}
                  </p>
                </div>
              </div>
            </CollapsePanel>
          </Collapse>
        </div>
        <div v-else class="py-10 text-center text-gray-500">暂无宿舍信息</div>
      </Card>
    </Spin>
  </Page>
</template>

<style lang="scss" scoped></style>
