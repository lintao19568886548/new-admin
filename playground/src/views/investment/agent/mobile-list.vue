<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { InvestmentAgent } from './data';

import {
  createApp,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
} from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { Search } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import {
  EnvironmentOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue';
import {
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Form,
  Image,
  Input,
  message,
  Modal,
  Pagination,
  Popover,
  Row,
  Select,
  Space,
  Spin,
  Tag,
} from 'ant-design-vue';

import { deleteInvestment, getInvestmentList } from '#/api/investment';
import { getParkList } from '#/api/park';
import MobileDateRange from '#/components/MobileDateRange.vue';
import { $t } from '#/locales';

import { getTagTypeOptions } from './data';
import AgentForm from './modules/form.vue';

const meetingRange = ref<[Dayjs | undefined, Dayjs | undefined]>([
  undefined,
  undefined,
]);

const searchForm = reactive({
  agentName: '',
  intentLevel: undefined as string | undefined,
  progress: undefined as string | undefined,
  tenantName: '',
});

const parkOptions = ref<{ label: string; value: number }[]>([
  { label: '全部区域', value: -1 },
]);
const selectedParkId = ref<number | undefined>(undefined);
const parkNameMap = ref<Record<number, string>>({});

const loading = ref(false);
const investmentList = ref<InvestmentAgent[]>([]);
const pagination = reactive({ current: 1, pageSize: 10, total: 0 });
const activePopoverKey = ref<null | string>(null);

const tagTypeOptions = getTagTypeOptions();
const intentLevelOptions = tagTypeOptions.map((opt) => ({
  label: opt.label,
  value: opt.value,
}));
const progressOptions = [
  { label: '初步接洽', value: '初步接洽' },
  { label: '深入沟通', value: '深入沟通' },
  { label: '合同准备', value: '合同准备' },
  { label: '签约完成', value: '签约完成' },
];

function getTagColor(value: string) {
  const option = tagTypeOptions.find((opt) => opt.value === value);
  return option ? option.color : 'default';
}

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: AgentForm,
  destroyOnClose: true,
});

function onEdit(row: InvestmentAgent) {
  const rowData = { ...row };
  rowData.meetingTime = String(formatDateTime(rowData.meetingTime));
  formModalApi.setData(rowData).open();
  activePopoverKey.value = null;
}

function onAdd() {
  formModalApi.setData({}).open();
  activePopoverKey.value = null;
}

async function onDelete(row: InvestmentAgent) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.agentName || '']),
    duration: 0,
    key: 'action_process_msg',
  });

  const { investmentId } = row;
  if (investmentId) {
    try {
      await deleteInvestment(investmentId);
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.tenantName || '']),
        key: 'action_process_msg',
      });
      fetchList();
    } catch (error) {
      console.error('删除投资项目失败:', error);
      message.error({
        content: $t('ui.actionMessage.operationFailed', [error]),
        key: 'action_process_msg',
      });
    }
  }
  activePopoverKey.value = null;
}

function onView(row: InvestmentAgent) {
  let imgList: string[] = [];
  if (Array.isArray(row.imageUrlList)) {
    imgList = row.imageUrlList;
  } else if (row.imageUrlList) {
    imgList = [row.imageUrlList];
  }

  if (imgList.length === 0) {
    message.info($t('page.agent.noImages'));
    return;
  }

  const previewContainer = document.createElement('div');
  document.body.append(previewContainer);

  const previewApp = createApp({
    setup() {
      const visible = ref(false);
      onUnmounted(() => {
        if (document.body.contains(previewContainer)) {
          previewContainer.remove();
        }
      });
      onMounted(() => {
        nextTick(() => {
          visible.value = true;
        });
      });
      return () =>
        h(
          Image.PreviewGroup,
          {
            preview: {
              onVisibleChange: (v) => {
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
          imgList.map((src: string) =>
            h(Image, {
              preview: {},
              src,
              style: { display: 'none' },
            }),
          ),
        );
    },
  });
  previewApp.mount(previewContainer);
  activePopoverKey.value = null;
}

async function fetchList() {
  loading.value = true;
  const startDate = meetingRange.value?.[0]?.format('YYYY-MM-DD');
  const endDate = meetingRange.value?.[1]?.format('YYYY-MM-DD');
  const startTime = startDate ? `${startDate} 00:00:00` : undefined;
  const endTime = endDate ? `${endDate} 23:59:59` : undefined;
  const params: any = {
    agentName: searchForm.agentName || undefined,
    currentPage: pagination.current,
    currentPark: selectedParkId.value ?? -1,
    endTime,
    intentLevel: searchForm.intentLevel || undefined,
    pageSize: pagination.pageSize,
    progress: searchForm.progress || undefined,
    startTime,
    tenantName: searchForm.tenantName || undefined,
  };
  try {
    const result = await getInvestmentList(params);
    const items: InvestmentAgent[] = Array.isArray(result?.items)
      ? result.items
      : [];
    investmentList.value = items;
    pagination.total = Number(result?.total ?? items.length);
  } catch (error) {
    console.error('获取投资项目列表失败:', error);
    message.error('获取投资项目列表失败');
    investmentList.value = [];
    pagination.total = 0;
  } finally {
    loading.value = false;
  }
}

function handlePageChange(page: number, pageSize: number) {
  pagination.current = page;
  pagination.pageSize = pageSize;
  fetchList();
}

function handleSearch() {
  pagination.current = 1;
  fetchList();
}

function resetSearch() {
  meetingRange.value = [undefined, undefined];
  searchForm.agentName = '';
  searchForm.tenantName = '';
  searchForm.intentLevel = undefined;
  searchForm.progress = undefined;
  pagination.current = 1;
  fetchList();
}

function onParkChange(value: any) {
  selectedParkId.value = value as number;
  handleSearch();
}

onMounted(() => {
  fetchList();
  getParkList()
    .then((list: any[]) => {
      const options = Array.isArray(list)
        ? list.map((p: any) => ({ label: p.parkName, value: p.parkId }))
        : [];
      parkOptions.value = [{ label: '全部区域', value: -1 }, ...options];
      if (Array.isArray(list)) {
        parkNameMap.value = Object.fromEntries(
          list.map((p: any) => [p.parkId as number, String(p.parkName)]),
        );
      }
    })
    .catch(() => {
      parkOptions.value = [{ label: '全部区域', value: -1 }];
    });
});

const recommendModalVisible = ref(false);
const recommendLoading = ref(false);
const nearbyParks = ref<any[]>([]);
const manualLocationModalVisible = ref(false);
const manualAddress = ref('');

function normalizeTel(t: any): string | undefined {
  if (Array.isArray(t)) {
    const s = t.filter(Boolean).join('、');
    return s.length > 0 ? s : undefined;
  }
  if (typeof t === 'string') {
    const s = t.trim();
    return s.length > 0 ? s : undefined;
  }
  return undefined;
}

function resolveParkName(id?: number, name?: string) {
  const n = (name || '').trim();
  if (n) return n;
  if (typeof id === 'number') {
    return parkNameMap.value[id] || '';
  }
  return '';
}

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
        tel: normalizeTel(poi.tel),
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
</script>

<template>
  <div class="box-border bg-gray-100 p-2 pb-28 dark:bg-neutral-900">
    <FormModal @success="handleSearch" />

    <div class="mb-2 rounded bg-white p-3 shadow-sm dark:bg-neutral-800">
      <Form layout="vertical">
        <Row :gutter="16">
          <Col :span="24">
            <Form.Item label="会谈日期">
              <MobileDateRange v-model:value="meetingRange" />
            </Form.Item>
          </Col>
          <Col :span="24">
            <Form.Item label="区域">
              <Select
                v-model:value="selectedParkId"
                :options="parkOptions"
                placeholder="选择区域"
                allow-clear
                @change="onParkChange"
              />
            </Form.Item>
          </Col>
          <Col :span="12">
            <Form.Item label="中介人">
              <Input
                v-model:value="searchForm.agentName"
                placeholder="请输入中介人"
                allow-clear
              />
            </Form.Item>
          </Col>
          <Col :span="12">
            <Form.Item label="租户名称">
              <Input
                v-model:value="searchForm.tenantName"
                placeholder="请输入租户名称"
                allow-clear
              />
            </Form.Item>
          </Col>
          <Col :span="12">
            <Form.Item label="意向等级">
              <Select
                v-model:value="searchForm.intentLevel"
                :options="intentLevelOptions"
                placeholder="选择等级"
                allow-clear
              />
            </Form.Item>
          </Col>
          <Col :span="12">
            <Form.Item label="跟进进度">
              <Select
                v-model:value="searchForm.progress"
                :options="progressOptions"
                placeholder="选择进度"
                allow-clear
              />
            </Form.Item>
          </Col>
        </Row>
        <div class="mt-2 flex gap-2">
          <Button type="primary" @click="handleSearch" class="flex-1">
            <Search class="mr-1 h-4 w-4" />
            {{ $t('搜索') }}
          </Button>
          <Button @click="resetSearch" class="flex-1">{{ $t('重置') }}</Button>
        </div>
      </Form>
    </div>

    <Spin :spinning="loading" :tip="$t('加载中...')">
      <div v-if="investmentList.length > 0" class="pb-3">
        <Card
          v-for="item in investmentList"
          :key="
            item.investmentId +
            String(item.meetingTime) +
            String(item.updateTime)
          "
          class="mb-3 overflow-hidden rounded-lg bg-white text-sm shadow-sm dark:bg-neutral-800"
          :body-style="{ padding: '0' }"
        >
          <div
            class="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-neutral-700"
          >
            <span
              class="mr-2 break-words text-base font-semibold text-gray-800 dark:text-gray-100"
            >
              {{ item.agentName || item.tenantName }}
            </span>
            <div>
              <Tag :color="getTagColor(item.intentLevel)">
                {{ item.intentLevel }}
              </Tag>
              <Popover
                title="操作"
                trigger="click"
                placement="leftTop"
                :open="activePopoverKey === String(item.investmentId)"
                @open-change="
                  (open: boolean) =>
                    (activePopoverKey = open ? String(item.investmentId) : null)
                "
              >
                <template #content>
                  <div class="flex flex-col gap-1">
                    <Button type="link" size="small" @click="onView(item)">
                      {{ $t('ui.action.view') }}
                    </Button>
                    <Button type="link" size="small" @click="onEdit(item)">
                      {{ $t('ui.action.edit') }}
                    </Button>
                    <Button
                      type="link"
                      size="small"
                      danger
                      @click="onDelete(item)"
                    >
                      {{ $t('ui.action.delete') }}
                    </Button>
                  </div>
                </template>
                <Button type="text" size="small" class="ml-2">
                  <MoreOutlined />
                </Button>
              </Popover>
            </div>
          </div>
          <div class="p-4">
            <div class="mt-3 grid grid-cols-2 gap-3">
              <div class="flex flex-col">
                <span class="text-[13px] text-gray-500 dark:text-gray-400">
                  租户名称
                </span>
                <span class="text-sm text-gray-800 dark:text-gray-100">
                  {{ item.tenantName }}
                </span>
              </div>
              <div class="flex flex-col">
                <span class="text-[13px] text-gray-500 dark:text-gray-400">
                  意向面积
                </span>
                <span class="text-sm text-gray-800 dark:text-gray-100">
                  {{ item.intentArea }} ㎡
                </span>
              </div>
              <div class="flex flex-col">
                <span class="text-[13px] text-gray-500 dark:text-gray-400">
                  进展阶段
                </span>
                <span class="text-sm text-gray-800 dark:text-gray-100">
                  {{ item.progress }}
                </span>
              </div>
              <div class="flex flex-col">
                <span class="text-[13px] text-gray-500 dark:text-gray-400">
                  联系电话
                </span>
                <span class="text-sm text-gray-800 dark:text-gray-100">
                  {{ item.phoneNumber }}
                </span>
              </div>
              <div class="flex flex-col">
                <span class="text-[13px] text-gray-500 dark:text-gray-400">
                  会谈时间
                </span>
                <span class="text-sm text-gray-800 dark:text-gray-100">
                  {{ formatDateTime(item.meetingTime) }}
                </span>
              </div>
              <div
                v-if="resolveParkName(item.parkId, item.parkName)"
                class="flex flex-col"
              >
                <span class="text-[13px] text-gray-500 dark:text-gray-400">
                  所在园区
                </span>
                <span class="text-sm text-gray-800 dark:text-gray-100">
                  {{ resolveParkName(item.parkId, item.parkName) }}
                </span>
              </div>
            </div>
            <p
              v-if="item.remark"
              class="mt-3 rounded bg-gray-50 p-3 text-[13px] leading-relaxed text-gray-600 dark:bg-neutral-900/60 dark:text-gray-300"
            >
              <span class="mr-1 font-semibold">备注：</span>
              <span class="whitespace-pre-wrap break-all">{{
                item.remark
              }}</span>
            </p>
          </div>
        </Card>
        <Pagination
          v-if="pagination.total > 0"
          :current="pagination.current"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          @change="handlePageChange"
          size="small"
          class="mt-3 pb-3 text-center"
        />
      </div>
      <Empty v-else :description="loading ? $t('加载中...') : $t('暂无数据')" />
    </Spin>

    <div
      class="fixed bottom-[calc(1rem+env(safe-area-inset-bottom)+3.25rem)] right-4 z-[1000] flex flex-col gap-3"
    >
      <Button
        type="primary"
        shape="circle"
        size="large"
        @click="onAdd"
        class="!inline-flex !h-14 !w-14 items-center justify-center !p-0 shadow-md transition-transform duration-200 hover:-translate-y-0.5"
      >
        <PlusOutlined class="text-xl" />
      </Button>
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
    </div>

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
  </div>
</template>
