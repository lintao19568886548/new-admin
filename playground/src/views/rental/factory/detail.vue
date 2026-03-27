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
import { useRoute } from 'vue-router';

import { formatDateTime } from '@vben/utils';

import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { useHead } from '@vueuse/head';
import {
  Alert,
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
import { useLayoutStore } from '#/store/layout';
import {
  canUseNativeWechatShare,
  isWechatInstalled,
  shareWechatWebpage,
} from '#/utils/native-wechat-share';
import {
  syncWechatRuntimeState,
  useWechatRuntimeState,
  waitForWechatMiniProgramWebView,
} from '#/utils/wechat-jssdk';

const store = useParkStore();
const layoutStore = useLayoutStore();
const DEEP_LINK_ORIGIN =
  import.meta.env.VITE_DEEP_LINK_ORIGIN || 'https://link.yizuw.cn';
const PUBLIC_SHARE_ORIGIN =
  import.meta.env.VITE_PUBLIC_SHARE_ORIGIN ||
  import.meta.env.VITE_GLOB_API_URL?.replace(/\/api\/?$/, '') ||
  'https://yizuw.cn';
const WECHAT_OPEN_APP_ID = import.meta.env.VITE_WECHAT_OPEN_APP_ID || '';
const isNativePlatform = Capacitor.isNativePlatform();
const isNativeAndroid = Capacitor.getPlatform() === 'android';

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
// const router = useRouter();
const id = ref(route.params.id);
const loading = ref(false);
const activeFloorKey = ref<string[]>([]);
const activeTabKey = ref('1');
const isMobileBrowser = ref(false);
const wechatRuntimeState = useWechatRuntimeState();
const isWechat = computed(() => wechatRuntimeState.isWechat);
const isWechatMiniProgram = computed(() => wechatRuntimeState.isMiniProgram);

// function goBack() {
//   router.push({ name: 'RentalFactory' }); // 使用命名路由确保导航正确
// }

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
    const res = await getFactoryDetail(Number(id.value));

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

const currentPageUrl = computed(() => {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.location.href.split('#')[0];
});

const isWechatH5Page = computed(
  () => isWechat.value && !isWechatMiniProgram.value && !isNativePlatform,
);

const isMiniProgramWebViewPage = computed(
  () => isWechatMiniProgram.value && !isNativePlatform,
);

const isExternalMobileBrowserPage = computed(
  () => !isNativePlatform && !isWechat.value && isMobileBrowser.value,
);

const deepLinkTarget = computed(
  () => route.fullPath || `/rental/factory/detail/${String(id.value)}`,
);

const openAppUrl = computed(() => {
  const url = new URL('/ul/open/index.html', DEEP_LINK_ORIGIN);
  url.searchParams.set('target', deepLinkTarget.value);
  url.searchParams.set('webOrigin', PUBLIC_SHARE_ORIGIN);
  return url.toString();
});

const publicShareUrl = computed(() => {
  const url = new URL(deepLinkTarget.value, PUBLIC_SHARE_ORIGIN);
  return url.toString();
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

const shareTitle = computed(() => {
  if (!detail.value.factoryName) {
    return '厂房详情';
  }
  return `${detail.value.factoryName} - 厂房详情`;
});

const shareDescription = computed(() => {
  const stats = getFactoryFloorStats();
  const segments = [detail.value.address];
  if (stats.availableArea > 0) {
    segments.push(`可租 ${stats.availableArea} m²`);
  }
  if (detail.value.contact) {
    segments.push(`联系 ${detail.value.contact}`);
  }
  return segments.filter(Boolean).join('｜') || '查看厂房详情';
});

const shareImage = computed(
  () =>
    detail.value.imageUrls?.[0] || detail.value.imgUrl || store.defaultImgUrl,
);

const shareImagePublicUrl = computed(() => {
  try {
    return new URL(shareImage.value, PUBLIC_SHARE_ORIGIN).toString();
  } catch (error) {
    console.warn('生成分享图片地址失败:', error);
    return '';
  }
});

useHead(
  computed(() => ({
    meta: [
      {
        content: shareDescription.value,
        name: 'description',
      },
      {
        content: shareDescription.value,
        property: 'og:description',
      },
      {
        content: shareImage.value,
        property: 'og:image',
      },
      {
        content: shareTitle.value,
        property: 'og:title',
      },
      {
        content: publicShareUrl.value,
        property: 'og:url',
      },
    ],
    title: shareTitle.value,
  })),
);

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

async function copyCurrentLink() {
  const targetUrl =
    (isNativePlatform ? publicShareUrl.value : currentPageUrl.value) ||
    publicShareUrl.value;
  if (!targetUrl) {
    message.error('当前页面链接不可用');
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(targetUrl);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = targetUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.append(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    message.success('链接已复制');
  } catch (error) {
    console.error('复制链接失败:', error);
    message.error('复制链接失败，请手动复制地址栏链接');
  }
}

function showWeChatBrowserGuide() {
  message.info('请点击右上角菜单，并选择“在浏览器打开”后再尝试打开 App');
}

function openAppFromBrowser() {
  if (isWechatH5Page.value) {
    showWeChatBrowserGuide();
    return;
  }

  window.location.href = openAppUrl.value;
}

async function syncWechatRuntimeEnvironment() {
  isMobileBrowser.value = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  syncWechatRuntimeState();

  if (!isWechat.value || isWechatMiniProgram.value || isNativePlatform) {
    return;
  }

  await waitForWechatMiniProgramWebView();
  syncWechatRuntimeState();
}

function showMiniProgramShareUnavailableMessage() {
  message.info('请点击小程序右上角“···”中的“转发给朋友”。');
}

function showWechatH5ShareMessage() {
  message.info('请点击右上角“···”中的“转发给朋友”。');
}

async function shareFactoryFromNativeApp() {
  if (!isNativeAndroid || !canUseNativeWechatShare() || !WECHAT_OPEN_APP_ID) {
    return false;
  }

  if (!isWechatInstalled(WECHAT_OPEN_APP_ID)) {
    message.warning('未检测到微信，已切换为系统分享');
    return false;
  }

  const nativeWechatResult = await shareWechatWebpage({
    appId: WECHAT_OPEN_APP_ID,
    description: shareDescription.value,
    thumbUrl: shareImagePublicUrl.value,
    title: shareTitle.value,
    url: publicShareUrl.value,
  });

  if (nativeWechatResult.ok) {
    message.success(nativeWechatResult.message || '已拉起微信，请继续完成发送');
    return true;
  }

  if (nativeWechatResult.reason === 'wechat-not-installed') {
    message.warning('未检测到微信，已切换为系统分享');
  } else if (
    !['app-id-missing', 'unavailable'].includes(nativeWechatResult.reason || '')
  ) {
    message.warning(
      nativeWechatResult.message || '原生微信分享不可用，已切换为系统分享',
    );
  }

  return false;
}

async function shareFactoryFromSystemShare() {
  const { value: canShare } = await Share.canShare();
  if (!canShare) {
    message.error('当前设备不支持分享功能');
    return;
  }

  const stats = getFactoryFloorStats();
  const shareText =
    `【厂房推荐】${detail.value.factoryName}\n` +
    `📍 地址：${detail.value.address}\n` +
    `📏 总面积：${stats.totalArea}m²\n` +
    `✅ 可租面积：${stats.availableArea}m²\n` +
    `💰 联系方式：${detail.value.contact}\n` +
    `${detail.value.description ? `📝 ${detail.value.description}` : ''}`;

  await Share.share({
    dialogTitle: '分享厂房信息',
    text: shareText,
    title: `厂房推荐 - ${detail.value.factoryName}`,
    url: publicShareUrl.value,
  });

  message.success('分享成功');
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

async function handleFactoryShareAction() {
  if (isMiniProgramWebViewPage.value) {
    showMiniProgramShareUnavailableMessage();
    return;
  }

  if (isWechatH5Page.value) {
    showWechatH5ShareMessage();
    return;
  }

  if (!isNativePlatform) {
    await copyCurrentLink();
    return;
  }

  if (await shareFactoryFromNativeApp()) {
    return;
  }

  try {
    await shareFactoryFromSystemShare();
  } catch (error) {
    console.error('分享失败:', error);
    message.error('分享失败，请重试');
  }
}

onMounted(() => {
  void (async () => {
    await syncWechatRuntimeEnvironment();
    await fetchFactoryDetail();
  })();

  // 设置头部动作按钮
  layoutStore.setHeaderActions([
    {
      icon: 'mdi:share-variant',
      key: 'share',
      onClick: handleFactoryShareAction,
      text: '分享',
    },
  ]);
});

// 组件卸载时清理头部动作按钮
onUnmounted(() => {
  layoutStore.setHeaderActions([]);
});
</script>

<template>
  <Spin :spinning="loading">
    <Alert v-if="isMiniProgramWebViewPage" class="mb-4" show-icon type="info">
      <template #message>当前在微信小程序内查看</template>
      <template #description>
        <div class="flex flex-col gap-3">
          <p>如需分享，请点击小程序右上角“···”中的“转发给朋友”。</p>
          <p>
            如需跳转 App，请点击下方“复制当前链接”按钮，粘贴到浏览器中打开。
          </p>
          <div class="flex flex-wrap gap-2">
            <Button size="small" @click="copyCurrentLink">复制当前链接</Button>
          </div>
        </div>
      </template>
    </Alert>

    <Alert v-else-if="isWechatH5Page" class="mb-4" show-icon type="warning">
      <template #message>当前在微信内查看</template>
      <template #description>
        <div class="flex flex-col gap-3">
          <p>如需分享，请点击右上角“···”中的“转发给朋友”。</p>
          <p>如需跳转 App，请点击右上角“···”中的“在浏览器中打开”。</p>
          <div class="flex flex-wrap gap-2">
            <Button size="small" @click="copyCurrentLink">复制当前链接</Button>
          </div>
        </div>
      </template>
    </Alert>

    <Alert
      v-else-if="isExternalMobileBrowserPage"
      class="mb-4"
      show-icon
      type="info"
    >
      <template #message>已在系统浏览器中</template>
      <template #description>
        <div class="flex flex-col gap-3">
          <p>如果设备已安装瞰维智管 App，可直接打开并跳转到当前厂房详情。</p>
          <div class="flex flex-wrap gap-2">
            <Button type="primary" @click="openAppFromBrowser">
              打开 App
            </Button>
            <Button @click="copyCurrentLink">复制当前链接</Button>
          </div>
        </div>
      </template>
    </Alert>

    <!-- 厂房基本信息 -->
    <Card>
      <div class="flex flex-col md:flex-row">
        <div class="mb-4 flex items-center">
          <h1 class="mr-4 text-2xl font-bold">{{ detail.factoryName }}</h1>
          <Tag class="rounded-md px-2 text-base">
            {{ currentTag }}
          </Tag>
        </div>
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
              {{ detail.buildTime ? formatDateTime(detail.buildTime) : '未知' }}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {{
                detail.createTime ? formatDateTime(detail.createTime) : '未知'
              }}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {{
                detail.updateTime ? formatDateTime(detail.updateTime) : '未更新'
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
</template>

<style lang="scss" scoped></style>
