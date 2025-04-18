<script lang="ts" setup>
import type { ParkDetail, StatusTag } from './types';

import { computed, onMounted, ref } from 'vue';
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

import { getParkDetail } from '#/api/rental'; // 需要创建新的API

const route = useRoute();
const router = useRouter();
const id = ref(route.params.id);
const loading = ref(false);
const activeKey = ref(['1']); // 默认展开第一个折叠面板
const activeTabKey = ref('1'); // 添加这行，定义 Tabs 的激活标签页

// 返回列表页面
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
  imageUrls: ['/assets/微信图片_20250320150833.jpg'],
  imgUrl: '/assets/微信图片_20250320150833.jpg',
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
          updateTime: isValidDate(dorm.updateTime) ? dorm.updateTime : null,
        })),
        // 处理厂房中的日期字段
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
          // 处理变压器中的日期字段
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
        imageUrls: res.imageUrls || ['/assets/微信图片_20250320150833.jpg'],
        imgUrl: res.imgUrl || '/assets/微信图片_20250320150833.jpg',
        // 修正语法错误并优化日期验证
        updateTime: isValidDate(res.updateTime) ? res.updateTime : null,
      };

      detail.value = processedData;
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
            >
              <div v-for="(url, index) in detail.imageUrls" :key="index">
                <Image
                  :src="url"
                  :alt="`${detail.parkName}-图片${index + 1}`"
                  class="w-full rounded-lg shadow-md"
                />
              </div>
            </Carousel>
            <!-- 如果只有一张图片，直接展示 -->
            <Image
              v-else
              :src="detail.imgUrl"
              :alt="detail.parkName"
              class="w-full rounded-lg shadow-md"
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
          <Collapse v-model:active-key="activeKey">
            <CollapsePanel
              v-for="factory in detail.factories"
              :key="factory.factoryId"
              :header="factory.factoryName"
            >
              <div class="flex flex-col md:flex-row">
                <div class="p-4 md:w-1/3">
                  <Image
                    :src="factory.imgUrl"
                    :alt="factory.factoryName"
                    class="w-full rounded-lg shadow-md"
                  />
                </div>
                <div class="p-4 md:w-2/3">
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
                            <Image
                              :src="floor.imgUrl"
                              :alt="floor.floorName"
                              class="w-full rounded-lg shadow-md"
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
                      >
                        <div
                          v-for="item in factory.firefighting"
                          :key="item.firefightingId"
                          class="mb-4 border-b pb-4"
                        >
                          <div class="flex flex-col md:flex-row">
                            <div class="p-2 md:w-1/4">
                              <Image
                                :src="item.imgUrl"
                                :alt="item.title"
                                class="w-full rounded-lg shadow-md"
                              />
                            </div>
                            <div class="p-2 md:w-3/4">
                              <h3 class="mb-2 text-lg font-bold">
                                {{ item.title }}
                              </h3>
                              <p><strong>地址:</strong> {{ item.address }}</p>
                              <p>
                                <strong>灭火器:</strong> {{ item.extinguisher }}
                              </p>
                              <p><strong>消防栓:</strong> {{ item.hydrant }}</p>
                              <p>
                                <strong>消防出口:</strong> {{ item.fireExit }}
                              </p>
                              <p><strong>检查人:</strong> {{ item.checker }}</p>
                              <p>
                                <strong>检查时间:</strong>
                                {{ formatDateTime(item.checkTime) }}
                              </p>
                              <p v-if="item.remark">
                                <strong>备注:</strong> {{ item.remark }}
                              </p>
                            </div>
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
                      >
                        <div
                          v-for="item in factory.transformers"
                          :key="item.transformerId"
                          class="mb-4 border-b pb-4"
                        >
                          <div class="flex flex-col md:flex-row">
                            <div class="p-2 md:w-1/4">
                              <Image
                                :src="item.imgUrl"
                                :alt="item.title"
                                class="w-full rounded-lg shadow-md"
                              />
                            </div>
                            <div class="p-2 md:w-3/4">
                              <h3 class="mb-2 text-lg font-bold">
                                {{ item.title }}
                              </h3>
                              <p><strong>地址:</strong> {{ item.address }}</p>
                              <p><strong>联系人:</strong> {{ item.contact }}</p>
                              <p><strong>状态:</strong> {{ item.status }}</p>
                              <p>
                                <strong>规格:</strong> {{ item.specifications }}
                              </p>
                              <p>
                                <strong>检查时间:</strong>
                                {{ formatDateTime(item.checkTime) }}
                              </p>
                              <p v-if="item.remark">
                                <strong>备注:</strong> {{ item.remark }}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div v-else class="py-10 text-center text-gray-500">
                        暂无变压器信息
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
          <div
            v-for="dorm in detail.dormitories"
            :key="dorm.dormitoryId"
            class="mb-4 border-b pb-4"
          >
            <div class="flex flex-col md:flex-row">
              <div class="p-4 md:w-1/3">
                <Image
                  :src="dorm.imgUrl"
                  :alt="`宿舍-${dorm.dormitoryId}`"
                  class="w-full rounded-lg shadow-md"
                />
              </div>
              <div class="p-4 md:w-2/3">
                <Descriptions
                  bordered
                  :column="{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }"
                >
                  <Descriptions.Item label="总层数">
                    {{ dorm.floorCount }} 层
                  </Descriptions.Item>
                  <Descriptions.Item label="一楼层高">
                    {{ dorm.floorHeightFirst || '-' }} 米
                  </Descriptions.Item>
                  <Descriptions.Item label="其他楼层层高">
                    {{ dorm.floorHeightOther || '-' }} 米
                  </Descriptions.Item>
                  <Descriptions.Item label="单间面积">
                    {{ dorm.roomArea || '-' }} m²
                  </Descriptions.Item>
                  <Descriptions.Item label="总房间数">
                    {{ dorm.totalRooms }} 间
                  </Descriptions.Item>
                  <Descriptions.Item label="一楼已用房间">
                    {{ dorm.usedRoomsFirst }} 间
                  </Descriptions.Item>
                  <Descriptions.Item label="其他楼层已用房间">
                    {{ dorm.usedRoomsOther }} 间
                  </Descriptions.Item>
                  <Descriptions.Item label="一楼租金">
                    {{ dorm.rentPriceFirst || '-' }} 元/间/月
                  </Descriptions.Item>
                  <Descriptions.Item label="其他楼层租金">
                    {{ dorm.rentPriceOther || '-' }} 元/间/月
                  </Descriptions.Item>
                </Descriptions>
                <Divider orientation="left">宿舍备注</Divider>
                <p>{{ dorm.remark || '暂无备注' }}</p>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="py-10 text-center text-gray-500">暂无宿舍信息</div>
      </Card>
    </Spin>
  </Page>
</template>
