<script setup lang="ts">
import type { BusinessCardPremiumProduct } from '#/utils/business-card-premium';

import { computed, onMounted, ref } from 'vue';

import {
  CloseOutlined,
  DownloadOutlined,
  GlobalOutlined,
  MailOutlined,
} from '@ant-design/icons-vue';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { message } from 'ant-design-vue';

import {
  getBusinessCardPremiumAppAccountToken,
  getBusinessCardPremiumEntitlement,
  getBusinessCardPremiumProduct,
  isBusinessCardPremiumBillingSupported,
  isBusinessCardPremiumPurchaseSupported,
  purchaseBusinessCardPremium,
  restoreBusinessCardPremium,
} from '#/utils/business-card-premium';

interface UserInfo {
  avatar?: string;
  email?: string;
  job?: string;
  phone?: string;
  realName?: string;
  userId?: string;
  username?: string;
}

interface Props {
  userInfo?: null | UserInfo;
}

interface CardTemplate {
  description: string;
  id: string;
  label: string;
  premium: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits(['close']);

const BUSINESS_CARD_TEMPLATES: CardTemplate[] = [
  {
    description: '清爽基础版，适合日常展示',
    id: 'classic',
    label: '标准绿',
    premium: false,
  },
  {
    description: '浅雾白底，观感更轻更柔和',
    id: 'mist',
    label: '晨雾白',
    premium: false,
  },
  {
    description: '深色商务风，更适合正式场景',
    id: 'midnight',
    label: '夜幕蓝',
    premium: true,
  },
  {
    description: '暖金质感，更偏品牌展示',
    id: 'ivory',
    label: '象牙金',
    premium: true,
  },
  {
    description: '青绿渐变，更适合移动端分享',
    id: 'aurora',
    label: '流光绿',
    premium: true,
  },
];

const FREE_TEMPLATE_IDS = BUSINESS_CARD_TEMPLATES.filter(
  (template) => !template.premium,
).map((template) => template.id);

const cardRef = ref<HTMLElement>();
const flipped = ref(false);
const upgradeSheetVisible = ref(false);
const selectedTemplateId = ref(FREE_TEMPLATE_IDS[0] || 'classic');
const pendingPremiumTemplateId = ref<null | string>(null);

const premiumProduct = ref<BusinessCardPremiumProduct | null>(null);
const premiumUnlocked = ref(false);
const billingSupported = ref(false);
const storeLoading = ref(false);
const purchaseLoading = ref(false);
const restoreLoading = ref(false);
const productLoadFailed = ref(false);

const CARD_FILE_NAME = `business-card-${Date.now()}.png`;
const purchaseSupported = isBusinessCardPremiumPurchaseSupported();
const premiumTemplateCount = BUSINESS_CARD_TEMPLATES.filter(
  (template) => template.premium,
).length;

const userInfo = computed(() => props.userInfo);
const appAccountToken = computed(() => {
  const identity = userInfo.value?.userId || userInfo.value?.username;
  return getBusinessCardPremiumAppAccountToken(identity);
});
const previewTemplateId = computed(
  () => pendingPremiumTemplateId.value || selectedTemplateId.value,
);
const availableTemplates = computed(() => BUSINESS_CARD_TEMPLATES);
const selectedTemplate = computed(() => {
  return (
    BUSINESS_CARD_TEMPLATES.find(
      (template) => template.id === previewTemplateId.value,
    ) || availableTemplates.value[0]
  );
});
const pendingPremiumTemplate = computed(() => {
  return (
    BUSINESS_CARD_TEMPLATES.find(
      (template) => template.id === pendingPremiumTemplateId.value,
    ) || null
  );
});
const previewHintText = computed(() => {
  if (selectedTemplate.value?.premium && !premiumUnlocked.value) {
    return '当前为专业模板预览，升级后才能正式使用';
  }

  return flipped.value ? '轻触名片切回正面' : '轻触名片查看背面';
});
const templatePanelCaption = computed(() => {
  if (premiumUnlocked.value) {
    return '专业版已开通，当前可切换全部模板。';
  }

  if (purchaseSupported) {
    return '全部模板均可预览，iOS 端升级后可正式使用高级模板。';
  }

  return '全部模板均可预览，专业模板需在 iOS 端购买后使用。';
});
const premiumDisplayTitle = computed(() => {
  if (premiumProduct.value?.title) {
    return premiumProduct.value.title;
  }

  return '个人名片专业版（永久）';
});
const premiumDisplayDescription = computed(() => {
  if (pendingPremiumTemplate.value) {
    return `升级后即可使用“${pendingPremiumTemplate.value.label}”等 ${premiumTemplateCount} 套高级模板，导出与保存继续免费。`;
  }

  if (premiumProduct.value?.description) {
    return premiumProduct.value.description;
  }

  return `一次购买，永久解锁 ${premiumTemplateCount} 套高级模板，导出与保存继续免费。`;
});
const premiumDisplayPrice = computed(
  () => premiumProduct.value?.priceString || '',
);
const purchaseHint = computed(() => {
  if (premiumUnlocked.value) {
    return '专业版已开通，当前设备可直接使用全部模板。';
  }

  if (!billingSupported.value && purchaseSupported) {
    return '当前设备暂不支持应用内购买。';
  }

  if (productLoadFailed.value) {
    return '商品信息暂未加载完成，请稍后重试。';
  }

  return '商品标题与价格以 App Store 返回的数据为准。';
});
const upgradeCaption = computed(() => {
  if (premiumDisplayPrice.value) {
    return `一次购买 ${premiumDisplayPrice.value}，永久解锁 ${premiumTemplateCount} 套高级模板`;
  }

  return `一次购买，永久解锁 ${premiumTemplateCount} 套高级模板`;
});
const purchaseButtonText = computed(() => {
  if (purchaseLoading.value) {
    return '购买中...';
  }

  if (premiumDisplayPrice.value) {
    return `立即购买 ${premiumDisplayPrice.value}`;
  }

  return '立即购买';
});
const restoreButtonText = computed(() => {
  return restoreLoading.value ? '恢复中...' : '恢复购买';
});
const purchaseButtonDisabled = computed(() => {
  return (
    purchaseLoading.value ||
    restoreLoading.value ||
    !billingSupported.value ||
    !premiumProduct.value
  );
});
const restoreButtonDisabled = computed(() => {
  return restoreLoading.value || purchaseLoading.value || storeLoading.value;
});
const previewingLockedPremiumTemplate = computed(() => {
  return !!selectedTemplate.value?.premium && !premiumUnlocked.value;
});

function toggleFlip() {
  flipped.value = !flipped.value;
}

function openUpgradeSheet() {
  if (!purchaseSupported || premiumUnlocked.value) {
    return;
  }

  upgradeSheetVisible.value = true;
  void syncPremiumState(true);
}

function closeUpgradeSheet() {
  upgradeSheetVisible.value = false;
}

function getPurchaseErrorState(error: unknown) {
  let text = JSON.stringify(error);

  if (error instanceof Error) {
    text = error.message;
  } else if (typeof error === 'string') {
    text = error;
  }

  if (/cancel/i.test(text) || /user.*cancel/i.test(text)) {
    return 'cancelled';
  }

  return 'failed';
}

async function syncPremiumState(showError = false) {
  if (!purchaseSupported) {
    return;
  }

  storeLoading.value = true;

  try {
    billingSupported.value = await isBusinessCardPremiumBillingSupported();
    if (!billingSupported.value) {
      return;
    }

    try {
      premiumProduct.value = await getBusinessCardPremiumProduct();
      productLoadFailed.value = false;
    } catch (error) {
      console.error('读取名片专业版商品信息失败:', error);
      premiumProduct.value = null;
      productLoadFailed.value = true;

      if (showError) {
        message.error('未获取到商品信息，请稍后重试');
      }
    }

    const { unlocked } = await getBusinessCardPremiumEntitlement(
      appAccountToken.value,
    );
    premiumUnlocked.value = unlocked;

    if (premiumUnlocked.value) {
      upgradeSheetVisible.value = false;
      if (pendingPremiumTemplateId.value) {
        selectedTemplateId.value = pendingPremiumTemplateId.value;
        pendingPremiumTemplateId.value = null;
      }
    }
  } catch (error) {
    console.error('同步名片专业版状态失败:', error);
    if (showError) {
      message.error('读取购买状态失败，请稍后重试');
    }
  } finally {
    storeLoading.value = false;
  }
}

function handleTemplateSelect(templateId: string) {
  const template = BUSINESS_CARD_TEMPLATES.find(
    (item) => item.id === templateId,
  );
  if (!template) {
    return;
  }

  if (template.premium && !premiumUnlocked.value) {
    pendingPremiumTemplateId.value = template.id;
    if (purchaseSupported) {
      message.info(`正在预览“${template.label}”，升级后即可正式使用`);
    } else {
      message.info(`正在预览“${template.label}”，正式使用需在 iOS 端解锁`);
    }
    return;
  }

  selectedTemplateId.value = template.id;
  pendingPremiumTemplateId.value = null;
}

async function handlePurchasePremium() {
  if (!purchaseSupported) {
    return;
  }

  if (!billingSupported.value || !premiumProduct.value) {
    await syncPremiumState(true);
  }

  if (!billingSupported.value || !premiumProduct.value) {
    return;
  }

  const currentProduct = premiumProduct.value;

  purchaseLoading.value = true;

  try {
    const transaction = await purchaseBusinessCardPremium(
      appAccountToken.value,
    );
    console.warn('名片专业版购买成功:', transaction.transactionId);

    premiumUnlocked.value = true;
    upgradeSheetVisible.value = false;

    const nextTemplateId =
      pendingPremiumTemplateId.value ||
      BUSINESS_CARD_TEMPLATES.find((template) => template.premium)?.id;

    if (nextTemplateId) {
      selectedTemplateId.value = nextTemplateId;
      pendingPremiumTemplateId.value = null;
    }

    message.success(`已开通 ${currentProduct.title}`);
  } catch (error) {
    console.error('名片专业版购买失败:', error);
    const state = getPurchaseErrorState(error);

    if (state === 'cancelled') {
      message.info('已取消购买');
    } else {
      message.error('购买失败，请稍后重试');
    }
  } finally {
    purchaseLoading.value = false;
    await syncPremiumState();
  }
}

async function handleRestorePremium() {
  if (!purchaseSupported) {
    return;
  }

  restoreLoading.value = true;

  try {
    const result = await restoreBusinessCardPremium(appAccountToken.value);
    premiumUnlocked.value = result.unlocked;

    if (result.unlocked) {
      upgradeSheetVisible.value = false;
      if (pendingPremiumTemplateId.value) {
        selectedTemplateId.value = pendingPremiumTemplateId.value;
        pendingPremiumTemplateId.value = null;
      }
      message.success('已恢复专业版权益');
    } else {
      message.warning('未找到可恢复的专业版购买记录');
    }
  } catch (error) {
    console.error('恢复名片专业版失败:', error);
    message.error('恢复购买失败，请稍后重试');
  } finally {
    restoreLoading.value = false;
    await syncPremiumState();
  }
}

async function saveCardToDevice(dataUrl: string) {
  if (!Capacitor.isNativePlatform()) return false;
  const base64Data = dataUrl.split(',')[1];
  if (!base64Data) return false;

  try {
    await Filesystem.requestPermissions();
  } catch (error) {
    console.warn('申请文件权限失败:', error);
  }

  const directories: Directory[] = [
    Directory.Documents,
    ...(Capacitor.getPlatform() === 'android'
      ? [Directory.ExternalStorage]
      : []),
    Directory.Data,
  ];

  for (const directory of directories) {
    try {
      await Filesystem.writeFile({
        data: base64Data,
        directory,
        path: CARD_FILE_NAME,
        recursive: true,
      });
      const { uri } = await Filesystem.getUri({
        directory,
        path: CARD_FILE_NAME,
      });
      message.success({
        content: '名片已保存至相册\n请打开相册查看',
        duration: 5,
        style: { whiteSpace: 'pre-line' },
      });
      console.warn('名片文件路径:', uri);
      return true;
    } catch (error) {
      console.warn(`保存到目录 ${directory} 失败:`, error);
    }
  }

  message.warning('保存到本地失败，尝试使用浏览器下载');
  return false;
}

async function downloadCard() {
  if (previewingLockedPremiumTemplate.value) {
    if (purchaseSupported) {
      openUpgradeSheet();
      message.info('当前正在预览专业模板，升级后才能下载使用');
    } else {
      message.info('当前端仅支持预览专业模板，正式使用请在 iOS 端解锁');
    }
    return;
  }

  const el =
    cardRef.value || (document.querySelector('.business-card') as HTMLElement);
  if (!el) return;

  const inlineClone = (src: Element): HTMLElement => {
    const dest = src.cloneNode(true) as HTMLElement;
    const apply = (s: Element, d: Element) => {
      const style = window.getComputedStyle(s);
      const cssText = [...style]
        .map((prop) => `${prop}:${style.getPropertyValue(prop)};`)
        .join('');
      (d as HTMLElement).setAttribute('style', cssText);
      const sc = [...s.children] as Element[];
      const dc = [...d.children] as Element[];
      const len = Math.min(sc.length, dc.length);
      for (let i = 0; i < len; i++) {
        const sChild = sc[i];
        const dChild = dc[i];
        if (!sChild || !dChild) continue;
        apply(sChild, dChild);
      }
    };
    apply(src, dest);
    (dest as HTMLElement).style.transform = 'none';
    (dest as HTMLElement).style.backfaceVisibility = 'visible';
    return dest;
  };

  const frontEl = el.querySelector('.card-front') as HTMLElement | null;
  const backEl = el.querySelector('.card-back') as HTMLElement | null;
  if (!frontEl || !backEl) return;
  const frontW = frontEl.offsetWidth || 360;
  const frontH = frontEl.offsetHeight || 205;
  const backW = backEl.offsetWidth || 360;
  const backH = backEl.offsetHeight || 205;

  const frontClone = inlineClone(frontEl);
  const backClone = inlineClone(backEl);
  (frontClone as HTMLElement).style.position = 'relative';
  (frontClone as HTMLElement).style.left = '0';
  (frontClone as HTMLElement).style.top = '0';
  (frontClone as HTMLElement).style.width = `${frontW}px`;
  (frontClone as HTMLElement).style.height = `${frontH}px`;

  (backClone as HTMLElement).style.position = 'relative';
  (backClone as HTMLElement).style.left = '0';
  (backClone as HTMLElement).style.top = '0';
  (backClone as HTMLElement).style.display = 'flex';
  (backClone as HTMLElement).style.alignItems = 'center';
  (backClone as HTMLElement).style.justifyContent = 'center';
  (backClone as HTMLElement).style.transform = 'none';
  (backClone as HTMLElement).style.backfaceVisibility = 'visible';
  (backClone as HTMLElement).style.width = `${backW}px`;
  (backClone as HTMLElement).style.height = `${backH}px`;

  const outWidth = Math.max(frontW, backW);
  const outHeight = frontH + backH;
  const stack = document.createElement('div');
  stack.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  stack.style.width = `${outWidth}px`;
  stack.style.height = `${outHeight}px`;
  stack.style.display = 'block';
  stack.style.position = 'relative';
  stack.append(frontClone);
  stack.append(backClone);

  const inlineImages = async (root: HTMLElement) => {
    const imgs = [...root.querySelectorAll('img')] as HTMLImageElement[];
    await Promise.all(
      imgs.map(async (img) => {
        const src = img.getAttribute('src') || '';
        if (!src || src.startsWith('data:')) return;
        try {
          const res = await fetch(src, { cache: 'force-cache' });
          const blob = await res.blob();
          await new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.addEventListener('load', () => {
              img.setAttribute('src', String(reader.result));
              resolve();
            });
            reader.readAsDataURL(blob);
          });
        } catch {}
      }),
    );
  };

  await inlineImages(stack);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', String(outWidth));
  svg.setAttribute('height', String(outHeight));
  svg.setAttribute('viewBox', `0 0 ${outWidth} ${outHeight}`);
  const fo = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'foreignObject',
  );
  fo.setAttribute('x', '0');
  fo.setAttribute('y', '0');
  fo.setAttribute('width', String(outWidth));
  fo.setAttribute('height', String(outHeight));
  fo.append(stack);
  svg.append(fo);

  const svgString = new XMLSerializer().serializeToString(svg);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve) => {
    img.addEventListener('load', () => resolve());
    img.src = url;
  });

  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(outWidth * ratio);
  canvas.height = Math.floor(outHeight * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(ratio, ratio);
  ctx.drawImage(img, 0, 0);

  let dataUrl: null | string = null;
  try {
    dataUrl = canvas.toDataURL('image/png');
  } catch (error) {
    console.warn('生成图片数据失败:', error);
  }

  if (dataUrl) {
    const saved = await saveCardToDevice(dataUrl);
    if (saved) return;
  }

  const triggerDownload = (href: string, needRevoke = false) => {
    const link = document.createElement('a');
    link.href = href;
    link.download = CARD_FILE_NAME;
    document.body.append(link);
    link.click();
    link.remove();
    if (needRevoke) {
      setTimeout(() => URL.revokeObjectURL(href), 100);
    }
  };

  const fallbackDownload = () => {
    if (!dataUrl) {
      console.warn('导出失败：画布被污染');
      return;
    }
    triggerDownload(dataUrl);
  };

  try {
    canvas.toBlob((blob) => {
      if (blob) {
        const href = URL.createObjectURL(blob);
        triggerDownload(href, true);
      } else {
        fallbackDownload();
      }
    }, 'image/png');
  } catch {
    fallbackDownload();
  }
}

onMounted(() => {
  if (purchaseSupported) {
    void syncPremiumState();
  }
});
</script>

<template>
  <div class="business-card-modal" @click="emit('close')">
    <div class="card-shell" @click.stop>
      <div
        class="modal-stage"
        :class="{ 'modal-stage--sheet-open': upgradeSheetVisible }"
      >
        <div class="preview-block">
          <div
            class="preview-toolbar"
            :class="{ 'preview-toolbar--muted': upgradeSheetVisible }"
          >
            <button
              class="preview-toolbar__button"
              type="button"
              @click.stop="downloadCard"
            >
              <DownloadOutlined />
            </button>
            <button
              class="preview-toolbar__button"
              type="button"
              @click.stop="emit('close')"
            >
              <CloseOutlined />
            </button>
          </div>

          <div
            ref="cardRef"
            class="business-card"
            :class="[`template-${selectedTemplate?.id}`, { flipped }]"
            @click.stop="toggleFlip"
          >
            <div class="card-front">
              <div class="header">
                <div class="name-title">
                  <h2 class="person-name">
                    {{ userInfo?.realName || '姓名' }}
                  </h2>
                  <span class="job-title">{{
                    userInfo?.job || '岗位信息'
                  }}</span>
                </div>
                <div class="logo-section">
                  <img class="logo-img" src="/assets/favicon.svg" alt="logo" />
                  <span class="company-name">瞰维智管</span>
                </div>
              </div>

              <div class="content">
                <div class="contact-info">
                  <div class="phone-primary">
                    {{
                      userInfo?.username || userInfo?.phone || '未设置联系方式'
                    }}
                  </div>
                  <div class="company">东莞市宜租网络科技有限公司</div>
                  <div class="address">
                    广东省东莞市高埗镇北王路高埗段5号2号楼
                  </div>
                </div>

                <div class="contact-row">
                  <div class="contact-item">
                    <MailOutlined class="icon" />
                    <span>{{ userInfo?.email || 'yizuwang@yeah.net' }}</span>
                  </div>
                  <div class="contact-item">
                    <GlobalOutlined class="icon" />
                    <span>kwzg.yizuw.cn</span>
                  </div>
                </div>
              </div>

              <div class="divider"></div>
            </div>

            <div class="card-back">
              <div class="back-content">
                <div class="logo-section">
                  <img
                    class="logo-img white"
                    src="/assets/favicon.svg"
                    alt="logo"
                  />
                  <span class="company-name white">瞰维智管</span>
                </div>

                <div class="taglines">
                  <div class="tagline">智能物业管理平台 | 智慧公寓管理平台</div>
                  <div class="tagline">智慧能源管理平台 | 远程抄表管理系统</div>
                </div>
              </div>
            </div>
          </div>
          <p class="preview-block__hint">{{ previewHintText }}</p>
        </div>

        <section class="template-panel">
          <div class="template-panel__header">
            <div>
              <h3>样式模板</h3>
              <p>{{ templatePanelCaption }}</p>
            </div>
            <span v-if="premiumUnlocked" class="status-badge">
              专业版已开通
            </span>
          </div>

          <div class="template-grid">
            <button
              v-for="template in availableTemplates"
              :key="template.id"
              class="template-chip"
              :class="{
                'is-active': selectedTemplate?.id === template.id,
                'is-locked': template.premium && !premiumUnlocked,
              }"
              type="button"
              @click="handleTemplateSelect(template.id)"
            >
              <span class="template-chip__top">
                <span class="template-chip__label">{{ template.label }}</span>
                <span
                  class="template-chip__meta"
                  :class="{ premium: template.premium }"
                >
                  {{
                    template.premium
                      ? premiumUnlocked
                        ? '已解锁'
                        : '专业'
                      : '免费'
                  }}
                </span>
              </span>
              <span class="template-chip__desc">{{
                template.description
              }}</span>
            </button>
          </div>
        </section>

        <div
          v-if="purchaseSupported && !premiumUnlocked"
          class="upgrade-trigger"
        >
          <button
            class="apple-button apple-button--dark"
            type="button"
            @click="openUpgradeSheet"
          >
            升级专业版
          </button>
          <p class="upgrade-trigger__caption">{{ upgradeCaption }}</p>
        </div>

        <div
          v-else-if="purchaseSupported && premiumUnlocked"
          class="upgrade-status"
        >
          <span class="upgrade-status__pill">当前设备已启用专业模板</span>
        </div>
      </div>

      <div
        v-if="purchaseSupported && !premiumUnlocked"
        class="sheet-scrim"
        :class="{ 'sheet-scrim--visible': upgradeSheetVisible }"
        @click="closeUpgradeSheet"
      ></div>

      <section
        v-if="purchaseSupported && !premiumUnlocked"
        class="purchase-sheet"
        :class="{ 'purchase-sheet--visible': upgradeSheetVisible }"
        @click.stop
      >
        <div class="purchase-sheet__handle"></div>
        <div class="purchase-sheet__header">
          <div>
            <span class="purchase-sheet__eyebrow">App Store 内购</span>
            <h3>{{ premiumDisplayTitle }}</h3>
            <p>{{ premiumDisplayDescription }}</p>
          </div>
          <button
            class="purchase-sheet__dismiss"
            type="button"
            @click="closeUpgradeSheet"
          >
            收起
          </button>
        </div>

        <div class="purchase-sheet__hero">
          <div class="purchase-sheet__price">
            <span class="purchase-sheet__price-value">
              {{ premiumDisplayPrice || '价格加载中' }}
            </span>
            <span class="purchase-sheet__price-caption">
              一次购买，永久有效
            </span>
          </div>
          <div class="purchase-sheet__badge">
            高级模板 {{ premiumTemplateCount }} 套
          </div>
        </div>

        <div class="purchase-sheet__benefits">
          <span>高级模板永久解锁</span>
          <span>支持恢复购买</span>
          <span>导出与保存继续免费</span>
        </div>

        <div class="purchase-sheet__actions">
          <button
            class="apple-button apple-button--dark"
            :disabled="purchaseButtonDisabled"
            type="button"
            @click="handlePurchasePremium"
          >
            {{ purchaseButtonText }}
          </button>
          <button
            class="apple-button apple-button--secondary"
            :disabled="restoreButtonDisabled"
            type="button"
            @click="handleRestorePremium"
          >
            {{ restoreButtonText }}
          </button>
        </div>

        <p class="purchase-sheet__hint">{{ purchaseHint }}</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.business-card-modal {
  --modal-top-gap: max(calc(env(safe-area-inset-top) + 28px), 72px);
  --modal-bottom-gap: max(calc(env(safe-area-inset-bottom) + 18px), 22px);

  position: fixed;
  inset: 0;
  z-index: 5200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--modal-top-gap) 18px var(--modal-bottom-gap);
  overflow: hidden;
  background:
    radial-gradient(circle at top, rgb(255 255 255 / 18%), transparent 42%),
    linear-gradient(180deg, rgb(15 23 42 / 40%), rgb(15 23 42 / 58%));
  backdrop-filter: blur(18px) saturate(1.05);
}

.card-shell {
  position: relative;
  width: min(100%, 396px);
  max-height: calc(100dvh - var(--modal-top-gap) - var(--modal-bottom-gap));
}

.modal-stage {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  padding: 18px 16px;
  overflow: hidden;
  background: linear-gradient(
    180deg,
    rgb(255 255 255 / 84%),
    rgb(247 250 252 / 90%)
  );
  backdrop-filter: blur(28px) saturate(1.15);
  border: 1px solid rgb(255 255 255 / 58%);
  border-radius: 32px;
  box-shadow:
    0 28px 70px rgb(15 23 42 / 18%),
    inset 0 1px 0 rgb(255 255 255 / 72%);
  transition:
    transform 520ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 260ms ease,
    filter 320ms ease;
  animation: stage-enter 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.modal-stage--sheet-open {
  filter: saturate(0.92);
  opacity: 0.88;
  transform: translateY(-10px) scale(0.978);
}

.preview-block {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  padding-top: 10px;
}

.preview-toolbar {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 3;
  display: flex;
  gap: 8px;
  transition:
    opacity 260ms ease,
    transform 380ms cubic-bezier(0.22, 1, 0.36, 1);
}

.preview-toolbar--muted {
  pointer-events: none;
  opacity: 0;
  transform: translateY(-10px) scale(0.96);
}

.preview-toolbar__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  color: #0f172a;
  cursor: pointer;
  background: rgb(255 255 255 / 72%);
  backdrop-filter: blur(22px) saturate(1.08);
  border: 1px solid rgb(255 255 255 / 78%);
  border-radius: 999px;
  box-shadow:
    0 12px 30px rgb(15 23 42 / 12%),
    inset 0 1px 0 rgb(255 255 255 / 88%);
  transition:
    transform 220ms ease,
    box-shadow 220ms ease,
    background 220ms ease;
}

.preview-toolbar__button:active {
  transform: scale(0.96);
}

.preview-block__hint {
  margin: 0;
  font-size: 12px;
  color: #64748b;
  letter-spacing: 0.02em;
}

.business-card {
  position: relative;
  width: min(100%, 348px);
  aspect-ratio: 1.76;
  margin-top: 8px;
  cursor: pointer;
  transition: transform 560ms cubic-bezier(0.22, 1, 0.36, 1);
  transform-style: preserve-3d;
}

.business-card.flipped {
  transform: rotateY(180deg);
}

.card-front,
.card-back {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  padding: 18px;
  overflow: hidden;
  border-radius: 28px;
  box-shadow:
    0 18px 40px rgb(15 23 42 / 10%),
    inset 0 1px 0 rgb(255 255 255 / 24%);
  backface-visibility: hidden;
}

.card-front {
  color: #0f172a;
  background: white;
}

.card-back {
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  background: linear-gradient(135deg, #0f766e, #34d399);
  transform: rotateY(180deg);
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.name-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.logo-section {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
}

.logo-img {
  width: 34px;
  height: 34px;
}

.company-name {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 0.02em;
}

.company-name.white {
  color: white;
}

.content {
  padding-right: 96px;
}

.person-name {
  margin: 0;
  overflow: hidden;
  font-size: 20px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job-title {
  font-size: 13px;
  color: #475569;
}

.contact-info {
  margin-bottom: 14px;
}

.phone-primary {
  margin-bottom: 6px;
  font-size: 18px;
  font-weight: 700;
  color: #16a34a;
}

.company {
  margin-bottom: 4px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.address {
  font-size: 11px;
  line-height: 1.45;
  color: #64748b;
}

.contact-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  align-items: center;
  font-size: 11px;
  color: #64748b;
}

.contact-item {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  min-width: 0;
}

.icon {
  font-size: 12px;
}

.divider {
  position: absolute;
  right: 18px;
  bottom: 0;
  left: 18px;
  height: 1px;
  background: rgb(148 163 184 / 18%);
}

.back-content {
  text-align: center;
}

.taglines {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 18px;
}

.tagline {
  font-size: 11px;
  line-height: 1.3;
  letter-spacing: 0.02em;
  opacity: 0.92;
}

.template-panel {
  padding: 14px;
  background: rgb(255 255 255 / 62%);
  border: 1px solid rgb(255 255 255 / 56%);
  border-radius: 24px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 76%),
    0 16px 30px rgb(15 23 42 / 5%);
}

.template-panel__header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.template-panel__header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.template-panel__header p {
  margin: 5px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: #166534;
  background: rgb(220 252 231 / 90%);
  border-radius: 999px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.template-chip {
  padding: 12px;
  text-align: left;
  cursor: pointer;
  background: linear-gradient(
    180deg,
    rgb(255 255 255 / 90%),
    rgb(248 250 252 / 96%)
  );
  border: 1px solid rgb(226 232 240 / 86%);
  border-radius: 20px;
  transition:
    transform 220ms ease,
    box-shadow 220ms ease,
    border-color 220ms ease;
}

.template-chip:active {
  transform: scale(0.985);
}

.template-chip.is-active {
  border-color: rgb(15 118 110 / 42%);
  box-shadow: 0 14px 30px rgb(15 118 110 / 14%);
}

.template-chip.is-locked {
  background: linear-gradient(
    180deg,
    rgb(255 248 235 / 96%),
    rgb(255 243 222 / 96%)
  );
  border-color: rgb(245 158 11 / 26%);
}

.template-chip__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 7px;
}

.template-chip__label {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.template-chip__meta {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  font-size: 10px;
  font-weight: 700;
  color: #166534;
  background: rgb(220 252 231 / 90%);
  border-radius: 999px;
}

.template-chip__meta.premium {
  color: #9a3412;
  background: rgb(255 237 213 / 92%);
}

.template-chip__desc {
  display: block;
  font-size: 11px;
  line-height: 1.45;
  color: #64748b;
}

.upgrade-trigger,
.upgrade-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.upgrade-trigger {
  gap: 10px;
}

.upgrade-trigger__caption,
.purchase-sheet__hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
  text-align: center;
}

.upgrade-status__pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 18px;
  font-size: 13px;
  font-weight: 700;
  color: #166534;
  background: rgb(220 252 231 / 72%);
  border: 1px solid rgb(134 239 172 / 68%);
  border-radius: 999px;
}

.purchase-sheet__actions .apple-button {
  flex: 1;
}

.apple-button {
  min-height: 50px;
  padding: 0 18px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  border: none;
  border-radius: 999px;
  transition:
    transform 220ms ease,
    box-shadow 220ms ease,
    opacity 220ms ease,
    background 220ms ease;
}

.apple-button:active {
  transform: scale(0.985);
}

.apple-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
  transform: none;
}

.apple-button--primary {
  color: white;
  background: linear-gradient(180deg, #17a34a, #15803d);
  box-shadow: 0 14px 30px rgb(22 163 74 / 22%);
}

.apple-button--secondary {
  color: #0f172a;
  background: linear-gradient(
    180deg,
    rgb(255 255 255 / 96%),
    rgb(241 245 249 / 94%)
  );
  box-shadow:
    0 10px 22px rgb(15 23 42 / 8%),
    inset 0 1px 0 rgb(255 255 255 / 78%);
}

.apple-button--dark {
  color: white;
  background:
    radial-gradient(circle at top, rgb(255 255 255 / 18%), transparent 34%),
    linear-gradient(180deg, #111827, #020617);
  box-shadow: 0 22px 38px rgb(15 23 42 / 24%);
}

.sheet-scrim {
  position: absolute;
  inset: 4px;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgb(255 255 255 / 6%),
    rgb(15 23 42 / 22%)
  );
  backdrop-filter: blur(14px);
  border-radius: 28px;
  opacity: 0;
  transition: opacity 280ms ease;
}

.sheet-scrim--visible {
  pointer-events: auto;
  opacity: 1;
}

.purchase-sheet {
  position: absolute;
  right: 8px;
  bottom: 8px;
  left: 8px;
  padding: 14px 14px 16px;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgb(255 255 255 / 96%),
    rgb(248 250 252 / 98%)
  );
  backdrop-filter: blur(30px) saturate(1.08);
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 28px;
  box-shadow:
    0 26px 60px rgb(15 23 42 / 24%),
    inset 0 1px 0 rgb(255 255 255 / 82%);
  opacity: 0;
  transition:
    transform 560ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 260ms ease;
  transform: translateY(calc(100% + 40px));
  will-change: transform, opacity;
}

.purchase-sheet--visible {
  pointer-events: auto;
  opacity: 1;
  transform: translateY(0);
}

.purchase-sheet__handle {
  width: 42px;
  height: 5px;
  margin: 0 auto 12px;
  background: rgb(148 163 184 / 42%);
  border-radius: 999px;
}

.purchase-sheet__header {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.purchase-sheet__header h3 {
  margin: 2px 0 0;
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.purchase-sheet__header p {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.55;
  color: #64748b;
}

.purchase-sheet__eyebrow {
  font-size: 11px;
  font-weight: 700;
  color: #0f766e;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.purchase-sheet__dismiss {
  flex-shrink: 0;
  min-height: 34px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  background: rgb(241 245 249 / 86%);
  border: none;
  border-radius: 999px;
}

.purchase-sheet__hero {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 14px;
  margin-bottom: 12px;
  background:
    radial-gradient(
      circle at top left,
      rgb(255 255 255 / 78%),
      transparent 42%
    ),
    linear-gradient(135deg, rgb(241 245 249 / 92%), rgb(226 232 240 / 92%));
  border-radius: 22px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 82%),
    0 10px 24px rgb(148 163 184 / 14%);
}

.purchase-sheet__price {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.purchase-sheet__price-value {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.purchase-sheet__price-caption {
  font-size: 12px;
  color: #64748b;
}

.purchase-sheet__badge {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
  background: rgb(255 255 255 / 84%);
  border-radius: 999px;
}

.purchase-sheet__benefits {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.purchase-sheet__benefits span {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  font-size: 12px;
  color: #334155;
  background: rgb(248 250 252 / 92%);
  border-radius: 999px;
}

.purchase-sheet__actions {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.business-card.template-classic .card-front {
  background:
    radial-gradient(
      circle at top left,
      rgb(187 247 208 / 44%),
      transparent 38%
    ),
    linear-gradient(135deg, #fff, #f6fff8 56%, #e5f7ea);
}

.business-card.template-classic .card-back {
  background: linear-gradient(135deg, #0f766e, #22c55e 58%, #86efac);
}

.business-card.template-mist .card-front {
  background:
    radial-gradient(
      circle at top right,
      rgb(191 219 254 / 34%),
      transparent 34%
    ),
    linear-gradient(135deg, #fffefc, #f8fafc 54%, #eef2f7);
}

.business-card.template-mist .card-back {
  background: linear-gradient(135deg, #475569, #64748b 58%, #cbd5e1);
}

.business-card.template-mist .phone-primary {
  color: #2563eb;
}

.business-card.template-midnight .card-front {
  color: white;
  background:
    radial-gradient(
      circle at top right,
      rgb(96 165 250 / 36%),
      transparent 40%
    ),
    linear-gradient(135deg, #0f172a, #1e293b 56%, #334155);
}

.business-card.template-midnight .card-back {
  background: linear-gradient(135deg, #020617, #172554 54%, #2563eb);
}

.business-card.template-midnight .company-name,
.business-card.template-midnight .person-name,
.business-card.template-midnight .company-name.white {
  color: white;
}

.business-card.template-midnight .job-title,
.business-card.template-midnight .address,
.business-card.template-midnight .contact-row {
  color: rgb(226 232 240 / 88%);
}

.business-card.template-midnight .divider {
  background: rgb(255 255 255 / 14%);
}

.business-card.template-midnight .phone-primary {
  color: #fde68a;
}

.business-card.template-ivory .card-front {
  background:
    radial-gradient(circle at top left, rgb(251 191 36 / 24%), transparent 36%),
    linear-gradient(135deg, #fffaf1, #faeed6 56%, #f0ddba);
}

.business-card.template-ivory .card-back {
  background: linear-gradient(135deg, #7c2d12, #b45309 56%, #f59e0b);
}

.business-card.template-ivory .company-name,
.business-card.template-ivory .person-name {
  color: #5b3714;
}

.business-card.template-ivory .job-title,
.business-card.template-ivory .address,
.business-card.template-ivory .contact-row {
  color: #7c5b33;
}

.business-card.template-ivory .phone-primary {
  color: #b45309;
}

.business-card.template-aurora .card-front {
  background:
    radial-gradient(circle at 86% 16%, rgb(45 212 191 / 32%), transparent 32%),
    linear-gradient(135deg, #effdf7, #d6faea 54%, #b8f4d7);
}

.business-card.template-aurora .card-back {
  background: linear-gradient(135deg, #065f46, #0f766e 56%, #34d399);
}

.business-card.template-aurora .company-name,
.business-card.template-aurora .person-name {
  color: #115e59;
}

.business-card.template-aurora .job-title,
.business-card.template-aurora .address,
.business-card.template-aurora .contact-row {
  color: #0f766e;
}

.business-card.template-aurora .phone-primary {
  color: #047857;
}

@keyframes stage-enter {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 390px) {
  .business-card-modal {
    --modal-top-gap: max(calc(env(safe-area-inset-top) + 20px), 56px);
    --modal-bottom-gap: max(calc(env(safe-area-inset-bottom) + 12px), 16px);

    padding: var(--modal-top-gap) 12px var(--modal-bottom-gap);
  }

  .modal-stage {
    gap: 10px;
    padding: 14px;
    border-radius: 28px;
  }

  .card-front,
  .card-back {
    padding: 16px;
    border-radius: 24px;
  }

  .person-name {
    font-size: 18px;
  }

  .preview-toolbar__button {
    width: 36px;
    height: 36px;
  }

  .phone-primary {
    font-size: 16px;
  }

  .content {
    padding-right: 82px;
  }

  .template-chip {
    padding: 11px;
    border-radius: 18px;
  }

  .purchase-sheet {
    right: 8px;
    bottom: 8px;
    left: 8px;
    padding: 12px 12px 14px;
    border-radius: 24px;
  }

  .purchase-sheet__header {
    gap: 10px;
  }

  .purchase-sheet__header h3 {
    font-size: 18px;
  }
}

@media (max-height: 760px) {
  .modal-stage {
    gap: 10px;
    padding: 14px;
  }

  .business-card {
    width: min(100%, 322px);
  }

  .preview-block__hint,
  .template-panel__header p,
  .upgrade-trigger__caption,
  .purchase-sheet__hint {
    font-size: 11px;
  }

  .template-chip {
    padding: 10px;
  }

  .purchase-sheet__hero {
    padding: 12px;
  }

  .purchase-sheet__price-value {
    font-size: 22px;
  }
}
</style>
