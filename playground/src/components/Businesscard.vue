<script setup lang="ts">
import { ref } from 'vue';

import { GlobalOutlined, MailOutlined } from '@ant-design/icons-vue';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Button, message } from 'ant-design-vue';

interface UserInfo {
  avatar?: string;
  email?: string;
  job?: string;
  phone?: string;
  realName?: string;
  username?: string;
}

interface Props {
  userInfo?: null | UserInfo;
}

const { userInfo } = defineProps<Props>();
const emit = defineEmits(['close']);

const flipped = ref(false);
const cardRef = ref<HTMLElement>();

const CARD_FILE_NAME = `business-card-${Date.now()}.png`;

function toggleFlip() {
  flipped.value = !flipped.value;
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
  const frontW = frontEl.offsetWidth || 420;
  const frontH = frontEl.offsetHeight || 240;
  const backW = backEl.offsetWidth || 420;
  const backH = backEl.offsetHeight || 240;

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
    canvas.toBlob((b) => {
      if (b) {
        const href = URL.createObjectURL(b);
        triggerDownload(href, true);
      } else {
        fallbackDownload();
      }
    }, 'image/png');
  } catch {
    fallbackDownload();
  }
}
</script>

<template>
  <div class="business-card-modal" @click="emit('close')">
    <div
      ref="cardRef"
      class="business-card"
      :class="{ flipped }"
      @click.stop="toggleFlip"
    >
      <!-- 名片正面 -->
      <div class="card-front">
        <div class="header">
          <div class="name-title">
            <h2 class="person-name">{{ userInfo?.realName || '姓名' }}</h2>
            <span class="job-title">{{ userInfo?.job }}</span>
          </div>
          <div class="logo-section">
            <img class="logo-img" src="/assets/favicon.svg" alt="logo" />
            <span class="company-name">瞰维智管</span>
          </div>
        </div>

        <div class="content">
          <div class="contact-info">
            <div class="phone-primary">
              {{ userInfo?.username }}
            </div>
            <div class="company">东莞市宜租网络科技有限公司</div>
            <div class="address">广东省东莞市高埗镇北王路高埗段5号2号楼</div>
          </div>

          <div class="contact-row">
            <!-- <div class="contact-item">
              <PhoneOutlined class="icon" />
              <span>0755-86570035</span>
            </div> -->
            <div class="contact-item">
              <MailOutlined class="icon" />
              <span>yizuwang@yeah.net</span>
            </div>
            <div class="contact-item">
              <GlobalOutlined class="icon" />
              <span>kwzg.yizuw.cn</span>
            </div>
          </div>
        </div>

        <!-- <div class="qr-section">
          <div class="qr-code">
            <div class="qr-placeholder"></div>
            <div class="qr-label">扫码联系</div>
          </div>
        </div> -->

        <div class="divider"></div>
      </div>

      <!-- 名片背面 -->
      <div class="card-back">
        <div class="back-content">
          <div class="logo-section">
            <img class="logo-img white" src="/assets/favicon.svg" alt="logo" />
            <span class="company-name white">瞰维智管</span>
          </div>

          <div class="taglines">
            <div class="tagline">智能物业管理平台 | 智慧公寓管理平台</div>
            <div class="tagline">智慧能源管理云平台 | 远程抄表管理系统</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card-actions">
      <Button type="primary" @click="downloadCard">下载名片</Button>
      <Button @click="emit('close')">关闭</Button>
    </div>
  </div>
</template>

<style scoped>
.business-card-modal {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: rgb(0 0 0 / 50%);
}

.business-card {
  position: relative;
  width: 420px;
  height: 240px;
  margin-bottom: 20px;
  cursor: pointer;
  transition: transform 0.6s;
  transform-style: preserve-3d;
}

.business-card.flipped {
  transform: rotateY(180deg);
}

.card-front,
.card-back {
  position: absolute;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgb(0 0 0 / 10%);
  backface-visibility: hidden;
}

.card-front {
  overflow: hidden;
  color: #333;
  background: white;
}

.card-back {
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  background: linear-gradient(135deg, #52c41a, #73d13d);
  transform: rotateY(180deg);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.name-title {
  display: flex;
  flex: 0 0 auto;
  gap: 10px;
  align-items: baseline;
}

.logo-section {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  align-items: center;
  white-space: nowrap;
}

.logo {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: #52c41a;
  border-radius: 50%;
}

.logo.white {
  background: white;
}

.logo-leaf {
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50% 0;
  transform: rotate(-45deg);
}

.logo.white .logo-leaf {
  background: #52c41a;
}

.logo-img {
  display: inline-block;
  width: 36px;
  height: 36px;
}

.logo-img.white {
  width: 36px;
  height: 36px;
}

.company-name {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  white-space: nowrap;
}

.company-name.white {
  color: white;
}

.content {
  flex: 1;
  padding-right: 120px;
}

.name-section {
  display: flex;
  gap: 10px;
  align-items: baseline;
  margin-bottom: 10px;
}

.person-name {
  flex: 0 1 auto;
  max-width: 220px;
  margin: 0;
  overflow: hidden;
  font-size: 20px;
  font-weight: bold;
  color: #333;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job-title {
  flex: 0 0 auto;
  font-size: 14px;
  color: #666;
  white-space: nowrap;
}

.contact-info {
  margin-bottom: 15px;
}

.phone-primary {
  margin-bottom: 5px;
  font-size: 18px;
  font-weight: bold;
  color: #52c41a;
}

.company {
  margin-bottom: 3px;
  overflow: hidden;
  font-size: 14px;
  font-weight: bold;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.address {
  display: block;
  margin-bottom: 10px;
  overflow: visible;
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}

.contact-row {
  display: flex;
  flex-wrap: nowrap;
  column-gap: 6px;
  align-items: center;
  font-size: 11px;
  color: #666;
  white-space: nowrap;
}

.contact-item {
  display: flex;
  flex: 0 0 auto;
  gap: 3px;
  align-items: center;
  min-width: 0;
}

.contact-row .contact-item:nth-child(2) {
  flex: 0 0 auto;
}

.icon {
  font-size: 12px;
}

.contact-item span:last-child {
  white-space: nowrap;
}

.contact-item:not(:last-child)::after {
  margin-right: 6px;
  margin-left: 6px;
  color: #bfbfbf;
  content: '|';
}

.qr-section {
  position: absolute;
  top: 50%;
  right: 16px;
  transform: translateY(-50%);
}

.qr-code {
  text-align: center;
}

.qr-placeholder {
  width: 72px;
  height: 72px;
  margin-bottom: 5px;
  background: #f0f0f0;
  border: 2px solid #52c41a;
  border-radius: 4px;
}

.qr-label {
  font-size: 10px;
  color: #666;
}

.divider {
  position: absolute;
  right: 20px;
  bottom: 0;
  left: 20px;
  height: 1px;
  background: #e8e8e8;
}

.back-content {
  text-align: center;
}

.taglines {
  margin-top: 20px;
}

.tagline {
  margin-bottom: 8px;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.9;
}

.card-actions {
  display: flex;
  gap: 10px;
}

@media (max-width: 768px) {
  .business-card {
    width: 360px;
    height: 210px;
  }

  .card-front,
  .card-back {
    padding: 15px;
  }

  .person-name {
    font-size: 18px;
  }

  .phone-primary {
    font-size: 16px;
  }

  .contact-row {
    flex-flow: row nowrap;
  }

  .qr-section {
    right: 15px;
  }
}
</style>
