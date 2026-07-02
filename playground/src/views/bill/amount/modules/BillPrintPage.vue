<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Button, message, Modal } from 'ant-design-vue';

import { getAmountBillDetail } from '#/api/bill';
import { shareWechatImage } from '#/utils/native-wechat-share';
import { retryImport } from '#/utils/retry-import';
import { loadWechatPayAppConfig } from '#/utils/wechat-pay-app-config';

// 组件属性定义
const billData = ref();
const route = useRoute();
const query = ref(route.query);
const gestureStageRef = ref<HTMLElement>();
const billContainerRef = ref<HTMLElement>();
const enableGesture = ref(false);
const isCapturingImage = ref(false);
const printing = ref(false);
const sharingImage = ref(false);
const sharePreviewVisible = ref(false);
const sharePreviewUrl = ref('');
const sharePreviewFileName = ref('');
const sharePreviewBlob = ref<Blob>();
const scale = ref(1);
const translateX = ref(0);
const translateY = ref(0);
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const panStartPoint = ref<null | { x: number; y: number }>(null);
const panStartTranslate = ref({ x: 0, y: 0 });
const pinchStartDistance = ref(0);
const pinchStartScale = ref(1);
const pinchStartTranslate = ref({ x: 0, y: 0 });
const pinchAnchor = ref({ x: 0, y: 0 });
let cachedShareImage: null | { blob: Blob; fileName: string } = null;
let preparingShareImage: null | Promise<{ blob: Blob; fileName: string }> =
  null;

const billTransformStyle = computed(() => {
  if (!enableGesture.value || isCapturingImage.value) {
    return {};
  }
  return {
    transform: `translate3d(${translateX.value}px, ${translateY.value}px, 0) scale(${scale.value})`,
    transformOrigin: '0 0',
  };
});

const shareTitle = computed(() => {
  const tenantName =
    billData.value?.tenant?.tenantName || billData.value?.tenantName;
  return tenantName ? `${tenantName}收款通知单` : '收款通知单';
});

const shareButtonText = computed(() =>
  Capacitor.isNativePlatform() ? '分享' : '生成图片',
);

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampTranslate(nextX: number, nextY: number, nextScale = scale.value) {
  const stage = gestureStageRef.value;
  const bill = billContainerRef.value;
  if (!stage || !bill) {
    return { x: nextX, y: nextY };
  }

  const stageWidth = stage.clientWidth;
  const stageHeight = stage.clientHeight;
  const scaledWidth = bill.offsetWidth * nextScale;
  const scaledHeight = bill.offsetHeight * nextScale;

  let x = nextX;
  let y = nextY;

  x =
    scaledWidth <= stageWidth
      ? (stageWidth - scaledWidth) / 2
      : clampValue(x, stageWidth - scaledWidth, 0);

  y =
    scaledHeight <= stageHeight
      ? (stageHeight - scaledHeight) / 2
      : clampValue(y, stageHeight - scaledHeight, 0);

  return { x, y };
}

function getTouchDistance(touches: TouchList) {
  const touchA = touches.item(0);
  const touchB = touches.item(1);
  if (!touchA || !touchB) return 0;
  const dx = touchA.clientX - touchB.clientX;
  const dy = touchA.clientY - touchB.clientY;
  return Math.hypot(dx, dy);
}

function getTouchMidpoint(touches: TouchList) {
  const touchA = touches.item(0);
  const touchB = touches.item(1);
  if (!touchA || !touchB) return { x: 0, y: 0 };
  return {
    x: (touchA.clientX + touchB.clientX) / 2,
    y: (touchA.clientY + touchB.clientY) / 2,
  };
}

function initMobileTransform() {
  if (!enableGesture.value) return;
  const stage = gestureStageRef.value;
  const bill = billContainerRef.value;
  if (!stage || !bill) return;

  const fitScale = stage.clientWidth / bill.offsetWidth;
  scale.value = clampValue(fitScale, MIN_SCALE, 1);
  const initialX = (stage.clientWidth - bill.offsetWidth * scale.value) / 2;
  const clamped = clampTranslate(initialX, 0, scale.value);
  translateX.value = clamped.x;
  translateY.value = clamped.y;
}

function updateGestureMode() {
  enableGesture.value = window.matchMedia('(max-width: 1024px)').matches;
  if (!enableGesture.value) {
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    return;
  }
  nextTick(() => {
    initMobileTransform();
  });
}

function onTouchStart(event: TouchEvent) {
  if (!enableGesture.value) return;

  if (event.touches.length === 2) {
    pinchStartDistance.value = getTouchDistance(event.touches);
    pinchStartScale.value = scale.value;
    pinchStartTranslate.value = {
      x: translateX.value,
      y: translateY.value,
    };
    pinchAnchor.value = getTouchMidpoint(event.touches);
    panStartPoint.value = null;
    return;
  }

  if (event.touches.length === 1) {
    const touch = event.touches.item(0);
    if (!touch) return;
    panStartPoint.value = {
      x: touch.clientX,
      y: touch.clientY,
    };
    panStartTranslate.value = {
      x: translateX.value,
      y: translateY.value,
    };
  }
}

function onTouchMove(event: TouchEvent) {
  if (!enableGesture.value) return;

  if (event.touches.length === 2 && pinchStartDistance.value > 0) {
    const currentDistance = getTouchDistance(event.touches);
    const rawScale =
      pinchStartScale.value * (currentDistance / pinchStartDistance.value);
    const nextScale = clampValue(rawScale, MIN_SCALE, MAX_SCALE);

    const contentX =
      (pinchAnchor.value.x - pinchStartTranslate.value.x) /
      pinchStartScale.value;
    const contentY =
      (pinchAnchor.value.y - pinchStartTranslate.value.y) /
      pinchStartScale.value;

    const nextX = pinchAnchor.value.x - contentX * nextScale;
    const nextY = pinchAnchor.value.y - contentY * nextScale;
    const clamped = clampTranslate(nextX, nextY, nextScale);

    scale.value = nextScale;
    translateX.value = clamped.x;
    translateY.value = clamped.y;
    return;
  }

  if (event.touches.length === 1 && panStartPoint.value) {
    const touch = event.touches.item(0);
    if (!touch) return;
    const deltaX = touch.clientX - panStartPoint.value.x;
    const deltaY = touch.clientY - panStartPoint.value.y;
    const nextX = panStartTranslate.value.x + deltaX;
    const nextY = panStartTranslate.value.y + deltaY;
    const clamped = clampTranslate(nextX, nextY);
    translateX.value = clamped.x;
    translateY.value = clamped.y;
  }
}

function onTouchEnd(event: TouchEvent) {
  if (!enableGesture.value) return;

  if (event.touches.length === 1) {
    const touch = event.touches.item(0);
    if (!touch) return;
    panStartPoint.value = {
      x: touch.clientX,
      y: touch.clientY,
    };
    panStartTranslate.value = {
      x: translateX.value,
      y: translateY.value,
    };
    pinchStartDistance.value = 0;
    return;
  }

  if (event.touches.length === 0) {
    panStartPoint.value = null;
    pinchStartDistance.value = 0;
  }
}

function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('通知单图片生成失败'));
    }, 'image/png');
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('图片数据读取失败'));
    });
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(blob);
  });
}

function buildShareFileName() {
  const billId = route.params.id ? String(route.params.id) : Date.now();
  return `receipt-bill-${billId}.png`;
}

function downloadImage(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function revokeSharePreviewUrl() {
  if (!sharePreviewUrl.value) return;
  URL.revokeObjectURL(sharePreviewUrl.value);
  sharePreviewUrl.value = '';
}

function openSharePreview(blob: Blob, fileName: string) {
  revokeSharePreviewUrl();
  sharePreviewBlob.value = blob;
  sharePreviewFileName.value = fileName;
  sharePreviewUrl.value = URL.createObjectURL(blob);
  sharePreviewVisible.value = true;
}

function closeSharePreview() {
  sharePreviewVisible.value = false;
  revokeSharePreviewUrl();
}

async function captureBillImage() {
  const element = billContainerRef.value;
  if (!element) {
    throw new Error('找不到通知单内容');
  }

  await nextTick();
  await waitForPaint();

  const html2canvasModule = await retryImport(() => import('html2canvas'));
  const html2canvas = html2canvasModule.default;
  return await html2canvas(element, {
    backgroundColor: '#ffffff',
    ignoreElements: (clonedElement: Element) =>
      clonedElement instanceof HTMLElement &&
      clonedElement.classList.contains('print-actions'),
    logging: false,
    onclone: (_document: Document, clonedElement: HTMLElement) => {
      clonedElement.style.transform = 'none';
      clonedElement.style.transformOrigin = '0 0';
      clonedElement.querySelector('.print-actions')?.remove();
    },
    scale: Math.min(window.devicePixelRatio || 2, 3),
    useCORS: true,
    windowHeight: element.scrollHeight,
    windowWidth: element.scrollWidth,
  });
}

async function prepareShareImage() {
  if (cachedShareImage) {
    return cachedShareImage;
  }
  if (preparingShareImage) {
    return await preparingShareImage;
  }

  preparingShareImage = (async () => {
    const canvas = await captureBillImage();
    const blob = await canvasToBlob(canvas);
    cachedShareImage = {
      blob,
      fileName: buildShareFileName(),
    };
    return cachedShareImage;
  })();

  try {
    return await preparingShareImage;
  } finally {
    preparingShareImage = null;
  }
}

function warmupShareImage() {
  window.setTimeout(() => {
    void prepareShareImage().catch((error) => {
      console.warn('预生成通知单图片失败:', error);
    });
  }, 800);
}

async function shareImageToWechatInNativeApp(blob: Blob) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return false;
  }

  const dataUrl = await blobToDataUrl(blob);
  const base64Data = dataUrl.split(',')[1];
  if (!base64Data) {
    throw new Error('通知单图片数据生成失败');
  }

  const config = await loadWechatPayAppConfig();
  const result = await shareWechatImage({
    appId: config.appId,
    base64Data,
    scene: 'session',
  });

  if (result.ok) {
    message.success(result.message || '已拉起微信，请继续完成发送');
    return true;
  }

  if (result.reason === 'wechat-not-installed') {
    message.warning('未检测到微信，已切换为系统分享');
  } else if (!['app-id-missing', 'unavailable'].includes(result.reason || '')) {
    message.warning(result.message || '微信图片分享不可用，已切换为系统分享');
  }

  return false;
}

async function shareImageInNativeApp(blob: Blob, fileName: string) {
  if (await shareImageToWechatInNativeApp(blob)) {
    return true;
  }

  const { value: canShare } = await Share.canShare();
  if (!canShare) {
    message.error('当前设备不支持系统分享');
    openSharePreview(blob, fileName);
    return false;
  }

  const dataUrl = await blobToDataUrl(blob);
  const base64Data = dataUrl.split(',')[1];
  if (!base64Data) {
    throw new Error('通知单图片数据生成失败');
  }

  const filePath = `bill-share/${fileName}`;
  await Filesystem.writeFile({
    data: base64Data,
    directory: Directory.Cache,
    path: filePath,
    recursive: true,
  });

  const { uri } = await Filesystem.getUri({
    directory: Directory.Cache,
    path: filePath,
  });

  await Share.share({
    dialogTitle: '分享收款通知单图片',
    files: [uri],
    text: shareTitle.value,
    title: shareTitle.value,
  });
  message.success('已拉起系统分享，请选择微信或QQ发送');
  return true;
}

async function copyImageToClipboard(blob: Blob) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    return false;
  }

  await navigator.clipboard.write([
    new ClipboardItem({
      [blob.type]: blob,
    }),
  ]);
  return true;
}

async function shareImageInBrowser(blob: Blob, fileName: string) {
  openSharePreview(blob, fileName);

  try {
    if (await copyImageToClipboard(blob)) {
      message.success('通知单图片已复制，可在微信或QQ聊天窗口粘贴发送');
      return;
    }
  } catch (error) {
    console.warn('复制通知单图片失败，改为下载图片:', error);
  }

  downloadImage(blob, fileName);
  openSharePreview(blob, fileName);
  message.warning('当前浏览器不支持直接分享图片，已打开图片预览并尝试下载');
}

function downloadSharePreviewImage() {
  if (!sharePreviewBlob.value) return;
  downloadImage(sharePreviewBlob.value, sharePreviewFileName.value);
}

async function handlePrintBill() {
  if (printing.value) return;

  printing.value = true;
  await nextTick();
  await waitForPaint();

  const resetPrinting = () => {
    printing.value = false;
    window.removeEventListener('afterprint', resetPrinting);
  };

  window.addEventListener('afterprint', resetPrinting, { once: true });
  window.setTimeout(() => {
    window.print();
    window.setTimeout(resetPrinting, 1200);
  }, 80);
}

async function handleShareBillImage() {
  if (sharingImage.value) return;

  sharingImage.value = true;
  let hideLoading: (() => void) | undefined;

  try {
    let shareImage = cachedShareImage;
    if (!shareImage) {
      hideLoading = message.loading({
        content: '正在生成通知单图片...',
        duration: 0,
        key: 'bill-share-image',
      });
      shareImage = await prepareShareImage();
      hideLoading();
      hideLoading = undefined;
    }

    await (Capacitor.isNativePlatform()
      ? shareImageInNativeApp(shareImage.blob, shareImage.fileName)
      : shareImageInBrowser(shareImage.blob, shareImage.fileName));
  } catch (error) {
    console.error('分享通知单图片失败:', error);
    message.error('分享图片失败，请重试');
  } finally {
    hideLoading?.();
    sharingImage.value = false;
  }
}

// 计算费用合计项目
const feeItems = computed(() => {
  if (billData.value?.extraProjectItem) {
    try {
      const parsed = JSON.parse(billData.value.extraProjectItem);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.error('解析 extraProjectItem 失败', error);
    }
  }
  // 回退逻辑
  const items = [
    { itemName: '电费', value: billData.value?.eleFee },
    { itemName: '水费', value: billData.value?.waterFee },
    { itemName: '厂房租金', value: billData.value?.factoryRent },
    { itemName: '基本管理费', value: billData.value?.managementFee },
    { itemName: '服务费', value: billData.value?.serviceFee },
    { itemName: '开票税金', value: billData.value?.invoiceTax },
    { itemName: '滞纳金', value: billData.value?.penaltyFee },
    { itemName: '本月收费金额', value: billData.value?.totalFee },
  ];
  return items;
});

function shouldDisplaySummaryItem(item: { itemName?: string; value?: any }) {
  const isPenalty = String(item.itemName || '').includes('滞纳金');
  if (isPenalty) {
    return Number(item.value) !== 0;
  }
  return true;
}

onMounted(async () => {
  updateGestureMode();
  window.addEventListener('resize', updateGestureMode);

  // 从路径参数中获取 id
  const billId = route.params.id ? Number(route.params.id) : undefined;
  if (billId) {
    billData.value = await getAmountBillDetail(billId);
    await nextTick();
    warmupShareImage();
    setTimeout(() => {
      // window.print();
    }, 800);
  } else {
    console.error('未提供账单ID');
    // 可以添加错误处理逻辑，例如显示错误消息或重定向
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateGestureMode);
  revokeSharePreviewUrl();
});
</script>

<template>
  <div
    ref="gestureStageRef"
    class="bill-print-stage h-screen w-screen touch-none overflow-hidden bg-[#f5f5f5] lg:h-auto lg:w-full lg:touch-auto lg:overflow-visible lg:bg-transparent"
    @touchstart="onTouchStart"
    @touchmove.prevent="onTouchMove"
    @touchend="onTouchEnd"
    @touchcancel="onTouchEnd"
  >
    <div
      ref="billContainerRef"
      class="bill-print-page relative box-border min-h-[297mm] w-[210mm] bg-white px-[10mm] will-change-transform lg:mx-auto lg:will-change-auto"
      :style="billTransformStyle"
    >
      <div
        v-if="!isCapturingImage"
        class="print-actions absolute right-[10mm] top-[8mm] flex items-center gap-2"
      >
        <Button
          size="small"
          type="primary"
          :loading="printing"
          @click="handlePrintBill"
        >
          <template #icon>
            <IconifyIcon icon="lucide:printer" class="size-[13px]" />
          </template>
          打印
        </Button>
        <Button
          size="small"
          :loading="sharingImage"
          @click="handleShareBillImage"
        >
          <template #icon>
            <IconifyIcon icon="lucide:share-2" class="size-[13px]" />
          </template>
          {{ shareButtonText }}
        </Button>
      </div>
      <div class="mb-[5px]">
        <div class="mb-[5px] text-center text-[22px] font-bold">收款通知单</div>
        <div class="mb-[3px] text-left text-[18px] font-bold">
          TO：{{ billData?.tenant?.tenantName || billData?.tenantName }}
        </div>
      </div>

      <div>
        <div class="w-full border border-black">
          <div class="flex">
            <div class="w-32 border-r border-black p-[6px] text-center">
              项目
            </div>
            <div class="flex-1 p-[6px] text-center">
              {{ billData?.projectName }}
            </div>
          </div>
        </div>

        <div class="my-[2px] ml-5 text-sm">电费（度）</div>

        <div class="w-full border border-black">
          <div
            class="flex [&>*:last-child]:border-r-0 [&>*]:flex [&>*]:min-h-10 [&>*]:flex-1 [&>*]:items-center [&>*]:justify-center [&>*]:border-r [&>*]:border-black [&>*]:px-[3px] [&>*]:py-[5px] [&>*]:text-center [&>*]:text-xs [&>*]:leading-[1.2]"
          >
            <div class="!w-32 !flex-none">名称</div>
            <div>上月<br />电表数</div>
            <div>本月<br />抄表数</div>
            <div>本月际<br />度数</div>
            <div>倍数</div>
            <div>本月实<br />际度数</div>
            <div>单价<br />元/度</div>
            <div>电费金额<br />（元）</div>
            <div>备注</div>
          </div>

          <div
            :key="item.eleId"
            v-for="item in billData?.eleBills"
            class="flex border-t border-black [&>*:last-child]:border-r-0 [&>*]:flex-1 [&>*]:border-r [&>*]:border-black [&>*]:p-[5px] [&>*]:text-center [&>*]:text-xs"
          >
            <div class="!w-32 !flex-none">{{ item.meterName }}</div>
            <div>
              {{
                !['合计', '公共'].some((name) => item.meterName.includes(name))
                  ? item.previousReading
                  : ''
              }}
            </div>
            <div>
              {{
                !['合计', '公共'].some((name) => item.meterName.includes(name))
                  ? item.currentReading
                  : ''
              }}
            </div>
            <div>{{ item.meterName !== '合计' ? item.monthlyUsage : '' }}</div>
            <div>
              {{ Number(item.multiplier) === 1 ? '' : item.multiplier }}
            </div>
            <div>{{ item.totalUsage }}</div>
            <div>{{ Number(item.unitPrice) === 0 ? '' : item.unitPrice }}</div>
            <div>{{ item.amount }}</div>
            <div>{{ item.remark }}</div>
          </div>
        </div>

        <div class="my-[2px] ml-5 text-sm">水费（方）</div>

        <div class="w-full border border-black">
          <div
            class="flex [&>*:last-child]:border-r-0 [&>*]:flex [&>*]:min-h-10 [&>*]:flex-1 [&>*]:items-center [&>*]:justify-center [&>*]:border-r [&>*]:border-black [&>*]:px-[3px] [&>*]:py-[5px] [&>*]:text-center [&>*]:text-xs [&>*]:leading-[1.2]"
          >
            <div class="!w-32 !flex-none">名称</div>
            <div>上月<br />水表数</div>
            <div>本月<br />抄表数</div>
            <div>本月<br />用水量</div>
            <div>倍数</div>
            <div>总用量</div>
            <div>单价<br />元/m²</div>
            <div>水费金额<br />（元）</div>
            <div>备注</div>
          </div>

          <div
            :key="item.waterId"
            v-for="item in billData?.waterBills"
            class="flex border-t border-black [&>*:last-child]:border-r-0 [&>*]:flex-1 [&>*]:border-r [&>*]:border-black [&>*]:p-[5px] [&>*]:text-center [&>*]:text-xs"
          >
            <div class="!w-32 !flex-none">{{ item.meterName }}</div>
            <div>
              {{
                !['合计', '公共', '公摊'].some((name) =>
                  item.meterName.includes(name),
                )
                  ? item.previousReading
                  : ''
              }}
            </div>
            <div>
              {{
                !['合计', '公共', '公摊'].some((name) =>
                  item.meterName.includes(name),
                )
                  ? item.currentReading
                  : ''
              }}
            </div>
            <div>{{ item.meterName !== '合计' ? item.monthlyUsage : '' }}</div>
            <div></div>
            <div>{{ item.totalUsage }}</div>
            <div>{{ Number(item.unitPrice) === 0 ? '' : item.unitPrice }}</div>
            <div>{{ item.amount }}</div>
            <div>{{ item.remark }}</div>
          </div>
        </div>

        <div class="my-[2px] ml-5 text-sm">项目合计</div>

        <div class="mb-[10px] w-full border border-black">
          <template :key="item.itemName" v-for="(item, index) in feeItems">
            <div
              class="flex border-black"
              :class="index === 0 ? 'border-t-0' : 'border-t'"
              v-if="shouldDisplaySummaryItem(item)"
            >
              <div
                class="w-[200px] border-r border-black py-[5px] pl-5 text-center text-xs"
              >
                {{ item.itemName }}
              </div>
              <div class="flex-1 p-[5px] text-center text-xs">
                {{ item.value }}
              </div>
            </div>
          </template>
        </div>

        <div class="mt-[3px] flex justify-end text-[13px] leading-[1.5]">
          <span>制单日期：</span>
          <span>{{ query.billingDate }}</span>
        </div>
      </div>
    </div>
  </div>
  <Modal
    v-model:open="sharePreviewVisible"
    title="分享收款通知单图片"
    width="720px"
    :footer="null"
    @cancel="closeSharePreview"
  >
    <div class="space-y-3">
      <div class="text-sm text-gray-600">
        当前浏览器如果不能直接拉起微信/QQ，可以下载图片后发送，或右键复制图片。
      </div>
      <div class="max-h-[70vh] overflow-auto bg-gray-100 p-3">
        <img
          v-if="sharePreviewUrl"
          :src="sharePreviewUrl"
          alt="收款通知单图片"
          class="mx-auto block max-w-full bg-white shadow-sm"
        />
      </div>
      <div class="flex justify-end gap-2">
        <Button @click="closeSharePreview">关闭</Button>
        <Button type="primary" @click="downloadSharePreviewImage">
          下载图片
        </Button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
@page {
  size: a4 portrait;
  margin: 0;
}

@media print {
  :global(html),
  :global(body),
  :global(#app) {
    width: 210mm;
    min-width: 210mm;
    padding: 0 !important;
    margin: 0 !important;
    background: #fff !important;
  }

  .bill-print-stage {
    width: 210mm !important;
    height: auto !important;
    min-height: 297mm !important;
    overflow: visible !important;
    background: #fff !important;
  }

  .bill-print-page {
    width: 210mm !important;
    min-height: 297mm !important;
    padding: 10mm !important;
    margin: 0 !important;
    transform: none !important;
  }

  .print-actions {
    display: none !important;
  }
}
</style>
