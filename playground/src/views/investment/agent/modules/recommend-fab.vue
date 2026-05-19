<script lang="ts">
import { defineComponent, ref } from 'vue';

import { EnvironmentOutlined } from '@ant-design/icons-vue';
import { Button, Drawer, Input, message, Modal, Space } from 'ant-design-vue';

interface UseSmartRecommendOptions {
  onSelect?: (park: NearbyFactoryRecord) => void;
  telFallback?: string;
}

interface NearbyFactoryRecord {
  address?: string;
  distance?: string;
  id: string;
  location?: string;
  name: string;
  tel?: string;
  type?: string;
  typecode?: string;
}

function normalizeTel(t: any, telFallback?: string): string | undefined {
  if (Array.isArray(t)) {
    const s = t.filter(Boolean).join('、');
    return s.length > 0 ? s : telFallback;
  }
  if (typeof t === 'string') {
    const s = t.trim();
    return s.length > 0 ? s : telFallback;
  }
  return telFallback;
}

export function useSmartRecommend(options: UseSmartRecommendOptions = {}) {
  const recommendModalVisible = ref(false);
  const recommendLoading = ref(false);
  const nearbyParks = ref<NearbyFactoryRecord[]>([]);
  const manualLocationModalVisible = ref(false);
  const manualAddress = ref('');

  async function searchNearbyParks(longitude: number, latitude: number) {
    const key = import.meta.env.VITE_AMAP_KEY;
    if (!key || key === 'YOUR_AMAP_KEY_HERE') {
      throw new Error('请先配置高德地图API Key');
    }
    const url = `https://restapi.amap.com/v3/place/around?key=${key}&location=${longitude},${latitude}&keywords=工厂&types=170300&radius=20000&offset=50&page=1&extensions=all`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === '1' && data.pois) {
        return data.pois.map((poi: any) => ({
          address: poi.address,
          distance: poi.distance,
          id: poi.id,
          location: poi.location,
          name: poi.name,
          tel: normalizeTel(poi.tel, options.telFallback),
          type: poi.type,
          typecode: poi.typecode,
        }));
      }
      return [];
    } catch (error) {
      console.error('搜索附近工厂失败:', error);
      throw error;
    }
  }

  function closeRecommendModal() {
    recommendModalVisible.value = false;
    nearbyParks.value = [];
  }

  function closeManualLocationModal() {
    manualLocationModalVisible.value = false;
    manualAddress.value = '';
  }

  function selectPark(park: NearbyFactoryRecord) {
    options.onSelect?.(park);
    message.success(`已选择工厂: ${park.name}`);
    closeRecommendModal();
  }

  async function searchByManualAddress() {
    if (!manualAddress.value.trim()) {
      message.warning('请输入地址');
      return;
    }

    recommendLoading.value = true;

    try {
      const key = import.meta.env.VITE_AMAP_KEY;
      if (!key) {
        throw new Error('请先配置高德地图API Key');
      }

      const geocodeUrl = `https://restapi.amap.com/v3/geocode/geo?key=${key}&address=${encodeURIComponent(manualAddress.value)}`;
      const geocodeResponse = await fetch(geocodeUrl);
      const geocodeData = await geocodeResponse.json();

      if (
        geocodeData.status !== '1' ||
        !geocodeData.geocodes ||
        geocodeData.geocodes.length === 0
      ) {
        throw new Error('无法识别该地址，请输入更详细的地址信息');
      }

      const location = geocodeData.geocodes[0].location;
      const [longitude, latitude] = location.split(',').map(Number);

      message.loading({
        content: '正在搜索附近工厂...',
        duration: 0,
        key: 'manual_search_loading',
      });

      const parks = await searchNearbyParks(longitude, latitude);

      message.destroy('manual_search_loading');

      if (parks.length === 0) {
        message.info('该地址附近暂无工厂信息');
        return;
      }

      nearbyParks.value = parks;
      manualLocationModalVisible.value = false;
      recommendModalVisible.value = true;
      manualAddress.value = '';

      message.success(`找到 ${parks.length} 个附近工厂`);
    } catch (error: any) {
      message.destroy('manual_search_loading');
      console.error('手动搜索失败:', error);
      message.error(error.message || '搜索失败，请重试');
    } finally {
      recommendLoading.value = false;
    }
  }

  async function onSmartRecommend() {
    try {
      recommendLoading.value = true;
      message.loading({
        content: '正在获取您的位置信息...',
        duration: 0,
        key: 'location_loading',
      });

      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;

      message.loading({
        content: '正在搜索附近工厂...',
        duration: 0,
        key: 'location_loading',
      });

      const parks = await searchNearbyParks(longitude, latitude);
      message.destroy('location_loading');
      if (parks.length === 0) {
        message.info('附近暂无工厂信息');
        return;
      }
      nearbyParks.value = parks;
      recommendModalVisible.value = true;
      message.success(`找到 ${parks.length} 个附近工厂`);
    } catch (error: any) {
      message.destroy('location_loading');
      console.error('智能推荐失败:', error);
      let errorMessage = '智能推荐失败';
      let suggestion = '';
      switch (error.code) {
        case 1: {
          errorMessage = '位置权限被拒绝';
          suggestion = '请在浏览器设置中允许访问位置信息，然后刷新页面重试';
          break;
        }
        case 2: {
          errorMessage = '无法获取位置信息';
          suggestion = '请检查设备的定位服务是否开启，或尝试使用其他网络';
          break;
        }
        case 3: {
          errorMessage = '定位超时';
          suggestion = '网络较慢或GPS信号弱，请稍后重试或移动到信号较好的位置';
          break;
        }
        default: {
          if (error.message?.includes('请先配置高德地图API Key')) {
            errorMessage = 'API配置错误';
            suggestion = '请联系管理员配置高德地图API Key';
          } else {
            suggestion = '请检查网络连接或稍后重试';
          }
        }
      }
      message.error({ content: `${errorMessage}：${suggestion}`, duration: 6 });
      if (error.code === 1 || error.code === 2 || error.code === 3) {
        setTimeout(() => {
          Modal.confirm({
            cancelText: '取消',
            content: '是否手动输入地址进行搜索？',
            okText: '手动输入',
            onOk: () => {
              manualLocationModalVisible.value = true;
            },
            title: '定位失败',
          });
        }, 1000);
      }
    } finally {
      recommendLoading.value = false;
    }
  }

  function getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('浏览器不支持地理位置服务'));
        return;
      }
      const options = {
        enableHighAccuracy: true,
        maximumAge: 300_000,
        timeout: 15_000,
      };
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        (error) => reject(error),
        options,
      );
    });
  }

  return {
    closeManualLocationModal,
    closeRecommendModal,
    manualAddress,
    manualLocationModalVisible,
    nearbyParks,
    onSmartRecommend,
    recommendLoading,
    recommendModalVisible,
    searchByManualAddress,
    selectPark,
  };
}

export default defineComponent({
  components: {
    Button,
    Drawer,
    EnvironmentOutlined,
    Input,
    Space,
  },
  emits: ['select'],
  setup(_, { emit }) {
    return useSmartRecommend({
      onSelect: (park) => {
        emit('select', park);
      },
    });
  },
});
</script>

<template>
  <Button
    type="primary"
    shape="circle"
    size="large"
    :loading="recommendLoading"
    @click="onSmartRecommend"
    class="!inline-flex !h-14 !w-14 items-center justify-center !p-0 shadow-md transition-transform duration-200 hover:-translate-y-0.5"
    title="定位并推荐附近工厂"
  >
    <div class="flex h-full w-full flex-col items-center justify-center">
      <EnvironmentOutlined class="text-[18px]" />
      <span class="mt-0.5 text-[11px] leading-none">招商推荐</span>
    </div>
  </Button>

  <Drawer
    v-model:open="recommendModalVisible"
    title="附近工厂推荐"
    placement="bottom"
    height="80%"
    :closable="true"
    @close="closeRecommendModal"
  >
    <div class="mb-2 text-gray-600">
      <p>基于您的当前位置，为您推荐以下附近的工厂：</p>
    </div>
    <div class="flex flex-col gap-3">
      <div
        v-for="park in nearbyParks"
        :key="park.id"
        class="rounded-lg bg-white p-3 shadow-sm dark:bg-neutral-800"
      >
        <div
          class="flex items-center justify-between text-sm font-semibold text-gray-800 dark:text-gray-100"
        >
          <span class="mr-2 break-words">{{ park.name }}</span>
          <span
            class="shrink-0 text-xs font-normal text-gray-500 dark:text-gray-400"
          >
            {{ park.distance }} 米
          </span>
        </div>
        <div class="mt-1.5 text-[13px] text-gray-600 dark:text-gray-300">
          <div class="break-words">{{ park.address }}</div>
          <div class="break-words" v-if="park.tel">{{ park.tel }}</div>
        </div>
        <div class="mt-2 flex justify-end">
          <Button size="small" type="primary" @click="selectPark(park)">
            选择
          </Button>
        </div>
      </div>
      <div v-if="nearbyParks.length === 0" class="py-8 text-center">
        <p class="text-gray-500">暂无附近工厂信息</p>
      </div>
    </div>
    <div
      class="sticky bottom-0 border-t border-gray-100 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <Button block @click="closeRecommendModal">关闭</Button>
    </div>
  </Drawer>

  <Drawer
    v-model:open="manualLocationModalVisible"
    title="手动输入地址"
    placement="bottom"
    height="auto"
    :closable="true"
    @close="closeManualLocationModal"
  >
    <div class="py-2">
      <div class="mb-2 text-gray-600">
        <p>请输入您要搜索的地址，系统将为您推荐附近的工厂：</p>
      </div>
      <div class="mb-2">
        <Input
          v-model:value="manualAddress"
          placeholder="请输入详细地址，如：北京市朝阳区建国路"
          size="large"
          @press-enter="searchByManualAddress"
        >
          <template #prefix>
            <EnvironmentOutlined class="text-gray-400" />
          </template>
        </Input>
      </div>
      <div class="text-sm text-gray-500">
        <p>提示：地址越详细，搜索结果越准确</p>
      </div>
    </div>
    <div
      class="sticky bottom-0 border-t border-gray-100 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <Space class="w-full">
        <Button block @click="closeManualLocationModal">取消</Button>
        <Button
          block
          type="primary"
          :loading="recommendLoading"
          @click="searchByManualAddress"
        >
          搜索附近工厂
        </Button>
      </Space>
    </div>
  </Drawer>
</template>
