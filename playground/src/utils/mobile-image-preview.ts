import type PhotoSwipe from 'photoswipe';
import type { SlideData } from 'photoswipe';

import { Media } from '@capacitor-community/media';
import { Capacitor } from '@capacitor/core';
import { FileTransfer } from '@capacitor/file-transfer';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { message } from 'ant-design-vue';

import 'photoswipe/style.css';

const APP_ALBUM_NAME = '瞰维智管';
const DEFAULT_IMAGE_HEIGHT = 1200;
const DEFAULT_IMAGE_WIDTH = 1600;
const MESSAGE_STYLE_ID = 'mobile-image-preview-message-z-index-style';
const MESSAGE_Z_INDEX = 200_001;
const PSWP_THEME_STYLE_ID = 'mobile-image-preview-pswp-theme-style';
const PSWP_MAIN_CLASS = 'pswp-audit';
const ION_BACK_BUTTON_PRIORITY = 1_000_000;

let cachedAlbumIdentifier: null | string = null;
let photoSwipeModulePromise: null | Promise<
  (typeof import('photoswipe'))['default']
> = null;

const imageSizeCache = new Map<
  string,
  Promise<{ height: number; width: number }>
>();

function isValidImageSource(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function detectImageMimeTypeFromBase64(base64Data: string) {
  const normalized = base64Data.trim();
  if (normalized.startsWith('iVBORw0KGgo')) {
    return 'image/png';
  }
  if (normalized.startsWith('/9j/')) {
    return 'image/jpeg';
  }
  if (normalized.startsWith('R0lGOD')) {
    return 'image/gif';
  }
  if (normalized.startsWith('UklGR')) {
    return 'image/webp';
  }
  if (normalized.startsWith('Qk')) {
    return 'image/bmp';
  }
  return 'image/jpeg';
}

function isAndroidNativePlatform() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function ensureMessageOnTopLayer() {
  if (typeof document === 'undefined') {
    return;
  }
  if (document.querySelector(`#${MESSAGE_STYLE_ID}`)) {
    return;
  }

  const styleElement = document.createElement('style');
  styleElement.id = MESSAGE_STYLE_ID;
  styleElement.textContent = `.ant-message{z-index:${MESSAGE_Z_INDEX}!important;}`;
  document.head.append(styleElement);

  message.config({
    getContainer: () => document.body,
  });
}

function ensurePhotoSwipeThemeStyle() {
  if (typeof document === 'undefined') {
    return;
  }
  const styleContent = `
.${PSWP_MAIN_CLASS} {
  --pswp-icon-color: #fff;
  --pswp-icon-color-secondary: #fff;
  --pswp-icon-stroke-color: transparent;
  --pswp-icon-stroke-width: 0;
}
.${PSWP_MAIN_CLASS} .pswp__top-bar {
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0) 100%);
  height: 60px;
  padding: 0 4px;
}
.${PSWP_MAIN_CLASS} .pswp__button {
  background: transparent;
  width: 44px;
  height: 44px;
  margin: 4px;
  opacity: 0.85;
  display: flex;
  align-items: center;
  justify-content: center;
}
.${PSWP_MAIN_CLASS} .pswp__button:active {
  opacity: 1;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 50%;
}
.${PSWP_MAIN_CLASS} .pswp__icn {
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3));
  width: 24px;
  height: 24px;
}
.${PSWP_MAIN_CLASS} .pswp__button:not(.pswp__button--arrow) .pswp__icn {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
.${PSWP_MAIN_CLASS} .pswp__button--zoom-toggle .pswp__icn {
  top: 40% !important;
  left: 45% !important;
  transform: translate(-50%, -50%) !important;
}
`;
  const existingStyle = document.querySelector<HTMLStyleElement>(
    `#${PSWP_THEME_STYLE_ID}`,
  );
  if (existingStyle) {
    existingStyle.textContent = styleContent;
    return;
  }

  const styleElement = document.createElement('style');
  styleElement.id = PSWP_THEME_STYLE_ID;
  styleElement.textContent = styleContent;
  document.head.append(styleElement);
}

function loadPhotoSwipe() {
  if (!photoSwipeModulePromise) {
    photoSwipeModulePromise = import('photoswipe').then(
      (module) => module.default,
    );
  }
  return photoSwipeModulePromise;
}

function loadImageSize(
  url: string,
): Promise<{ height: number; width: number }> {
  const cached = imageSizeCache.get(url);
  if (cached) {
    return cached;
  }

  const sizePromise = new Promise<{ height: number; width: number }>(
    (resolve) => {
      const image = new window.Image();

      image.addEventListener('load', () => {
        resolve({
          height: image.naturalHeight || DEFAULT_IMAGE_HEIGHT,
          width: image.naturalWidth || DEFAULT_IMAGE_WIDTH,
        });
      });

      image.addEventListener('error', () => {
        resolve({
          height: DEFAULT_IMAGE_HEIGHT,
          width: DEFAULT_IMAGE_WIDTH,
        });
      });

      image.src = url;
    },
  );

  imageSizeCache.set(url, sizePromise);
  return sizePromise;
}

async function getOrCreateAlbumIdentifier() {
  if (cachedAlbumIdentifier) {
    return cachedAlbumIdentifier;
  }

  const { albums } = await Media.getAlbums();
  let matchedAlbum = albums.find((album) => album.name === APP_ALBUM_NAME);

  if (!matchedAlbum) {
    await Media.createAlbum({ name: APP_ALBUM_NAME });
    const { albums: refreshedAlbums } = await Media.getAlbums();
    matchedAlbum = refreshedAlbums.find(
      (album) => album.name === APP_ALBUM_NAME,
    );
  }

  if (!matchedAlbum?.identifier) {
    throw new Error('无法获取相册标识');
  }

  cachedAlbumIdentifier = matchedAlbum.identifier;
  return matchedAlbum.identifier;
}

function getCurrentSlideImage(pswp: { currSlide?: { data?: SlideData } }) {
  const currentImage = pswp.currSlide?.data?.src;
  return typeof currentImage === 'string' ? currentImage : '';
}

function getCurrentSlideKey(pswp: PhotoSwipe) {
  const currentImage = getCurrentSlideImage(pswp);
  if (currentImage) {
    return currentImage;
  }
  return `index-${pswp.currIndex}`;
}

function applyRotationToCurrentSlide(
  pswp: PhotoSwipe,
  slideRotationMap: Map<string, number>,
) {
  const imageElement = pswp.currSlide?.content.element;
  if (!(imageElement instanceof HTMLElement)) {
    return;
  }

  const slideKey = getCurrentSlideKey(pswp);
  const rotation = slideRotationMap.get(slideKey) ?? 0;
  const rotationValue = `${rotation}deg`;

  imageElement.style.transformOrigin = 'center center';
  imageElement.style.backfaceVisibility = 'hidden';
  imageElement.style.transition = 'rotate 180ms ease';
  imageElement.style.willChange = 'rotate';
  imageElement.style.setProperty('rotate', rotationValue);
}

function rotateCurrentSlide(
  pswp: PhotoSwipe,
  slideRotationMap: Map<string, number>,
) {
  const slideKey = getCurrentSlideKey(pswp);
  const currentRotation = slideRotationMap.get(slideKey) ?? 0;
  const nextRotation = currentRotation - 90;
  slideRotationMap.set(slideKey, nextRotation);
  applyRotationToCurrentSlide(pswp, slideRotationMap);
}

function toggleCurrentSlideZoom(pswp: PhotoSwipe) {
  const currentSlide = pswp.currSlide;
  if (!currentSlide) {
    return;
  }

  const fitZoom = currentSlide.zoomLevels.fit;
  const secondaryZoom = Math.min(fitZoom * 1.5, currentSlide.zoomLevels.max);
  const isZoomedIn = currentSlide.currZoomLevel > fitZoom * 1.02;
  const targetZoom = isZoomedIn ? fitZoom : secondaryZoom;

  pswp.zoomTo(targetZoom, pswp.getViewportCenterPoint(), 0);
}

async function createSlideData(images: string[]) {
  const resolvedImageEntries = images
    .map((image, sourceIndex) => ({
      image,
      sourceIndex,
    }))
    .filter((entry): entry is { image: string; sourceIndex: number } =>
      isValidImageSource(entry.image),
    );

  const resolvedImages = resolvedImageEntries.map((entry) => entry.image);
  const sourceIndexes = resolvedImageEntries.map((entry) => entry.sourceIndex);

  const slideData = await Promise.all(
    resolvedImages.map(async (image) => {
      const size = await loadImageSize(image);
      return {
        height: size.height,
        msrc: image,
        src: image,
        width: size.width,
      };
    }),
  );

  return {
    images: resolvedImages,
    slideData,
    sourceIndexes,
  };
}

function renderImageToDataUrl(
  source: CanvasImageSource,
  width: number,
  height: number,
  outputType: string,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width || DEFAULT_IMAGE_WIDTH;
  canvas.height = height || DEFAULT_IMAGE_HEIGHT;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('画布上下文不可用');
  }

  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (outputType === 'image/jpeg') {
    return canvas.toDataURL(outputType, 0.95);
  }
  return canvas.toDataURL(outputType);
}

async function decodeBlobToDataUrl(blob: Blob) {
  let outputType = 'image/jpeg';
  switch (blob.type) {
    case 'image/gif': {
      outputType = 'image/png';
      break;
    }
    case 'image/png': {
      outputType = 'image/png';
      break;
    }
    case 'image/webp': {
      outputType = 'image/webp';
      break;
    }
    default: {
      break;
    }
  }

  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    try {
      return renderImageToDataUrl(
        bitmap,
        bitmap.width,
        bitmap.height,
        outputType,
      );
    } finally {
      bitmap.close();
    }
  }

  return new Promise<string>((resolve, reject) => {
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(blob);

    image.addEventListener('load', () => {
      try {
        const dataUrl = renderImageToDataUrl(
          image,
          image.naturalWidth,
          image.naturalHeight,
          outputType,
        );
        resolve(dataUrl);
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    });

    image.addEventListener('error', () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('图片解码失败'));
    });

    image.src = objectUrl;
  });
}

async function downloadImageAsBase64(imageUrl: string) {
  const fileName = `preview-save-${Date.now()}`;
  const { uri } = await Filesystem.getUri({
    directory: Directory.Cache,
    path: fileName,
  });
  const fullPath = uri.replace('file://', '');

  try {
    await FileTransfer.downloadFile({
      path: fullPath,
      url: imageUrl,
    });

    const fileData = await Filesystem.readFile({
      directory: Directory.Cache,
      path: fileName,
    });

    if (typeof fileData.data !== 'string') {
      throw new TypeError('读取图片缓存失败');
    }
    return {
      base64Data: fileData.data,
      mimeType: detectImageMimeTypeFromBase64(fileData.data),
    };
  } finally {
    try {
      await Filesystem.deleteFile({
        directory: Directory.Cache,
        path: fileName,
      });
    } catch (error) {
      console.warn('清理缓存临时文件失败:', error);
    }
  }
}

async function normalizeImagePathForSaving(imageUrl: string) {
  try {
    const { base64Data, mimeType } = await downloadImageAsBase64(imageUrl);
    const dataUrlResponse = await fetch(
      `data:${mimeType};base64,${base64Data}`,
    );
    const imageBlob = await dataUrlResponse.blob();
    return await decodeBlobToDataUrl(imageBlob);
  } catch (error) {
    console.error('图片重编码失败:', error);
    throw error;
  }
}

export async function saveImageToSystemAlbum(imageUrl: string) {
  ensureMessageOnTopLayer();

  if (!isAndroidNativePlatform()) {
    message.warning('仅安卓端支持保存到系统相册');
    return false;
  }

  if (!imageUrl) {
    message.error('图片地址无效');
    return false;
  }

  const messageKey = `save-photo-${Date.now()}`;

  message.open({
    content: '正在保存到系统相册...',
    duration: 0,
    key: messageKey,
    type: 'loading',
  });

  try {
    const albumIdentifier = await getOrCreateAlbumIdentifier();
    const normalizedImagePath = await normalizeImagePathForSaving(imageUrl);

    await Media.savePhoto({
      albumIdentifier,
      fileName: `reimbursement-${Date.now()}`,
      path: normalizedImagePath,
    });

    message.success({
      content: '图片已保存到系统相册',
      duration: 2,
      key: messageKey,
    });
    return true;
  } catch (error) {
    console.error('保存图片失败:', error);
    message.error({
      content: '保存失败，请检查网络与系统权限后重试',
      duration: 3,
      key: messageKey,
    });
    return false;
  }
}

export async function openMobileImagePreview(images: string[], startIndex = 0) {
  ensureMessageOnTopLayer();
  ensurePhotoSwipeThemeStyle();

  const {
    images: imageList,
    slideData,
    sourceIndexes,
  } = await createSlideData(images);
  if (imageList.length === 0) {
    message.warning('暂无可预览图片');
    return;
  }

  const PhotoSwipe = await loadPhotoSwipe();
  let mappedIndex = sourceIndexes.indexOf(startIndex);
  if (mappedIndex < 0) {
    mappedIndex = sourceIndexes.findIndex((index) => index > startIndex);
  }
  if (mappedIndex < 0) {
    mappedIndex = imageList.length - 1;
  }
  const normalizedIndex = Math.min(
    Math.max(mappedIndex, 0),
    imageList.length - 1,
  );

  const pswp = new PhotoSwipe({
    bgOpacity: 0.5,
    close: true,
    counter: true,
    dataSource: slideData,
    index: normalizedIndex,
    initialZoomLevel: 'fit',
    mainClass: PSWP_MAIN_CLASS,
    maxZoomLevel: 4,
    secondaryZoomLevel: 2,
    showHideAnimationType: 'fade',
    wheelToZoom: true,
    zoom: false,
  });
  const slideRotationMap = new Map<string, number>();

  pswp.on('afterInit', () => {
    applyRotationToCurrentSlide(pswp, slideRotationMap);
  });
  pswp.on('change', () => {
    applyRotationToCurrentSlide(pswp, slideRotationMap);
  });
  pswp.on('loadComplete', ({ slide }) => {
    if (slide === pswp.currSlide) {
      applyRotationToCurrentSlide(pswp, slideRotationMap);
    }
  });

  if (isAndroidNativePlatform()) {
    try {
      let hasClosedByBack = false;
      let hasInjectedPreviewHistory = false;

      window.history.pushState({ __preview: Date.now() }, document.title);
      hasInjectedPreviewHistory = true;

      const closePreviewByBack = () => {
        if (hasClosedByBack) {
          return;
        }
        hasClosedByBack = true;
        pswp.close();
        if (hasInjectedPreviewHistory) {
          hasInjectedPreviewHistory = false;
          window.history.back();
        }
      };

      const popstateListener = () => {
        if (hasClosedByBack) {
          return;
        }
        hasClosedByBack = true;
        hasInjectedPreviewHistory = false;
        pswp.close();
      };

      window.addEventListener('popstate', popstateListener);

      const ionBackButtonListener = ((event: Event) => {
        const ionBackEvent = event as CustomEvent<{
          register: (
            priority: number,
            handler: (processNextHandler?: () => void) => void,
          ) => void;
        }>;
        if (typeof ionBackEvent.detail?.register === 'function') {
          ionBackEvent.detail.register(ION_BACK_BUTTON_PRIORITY, () => {
            closePreviewByBack();
          });
          return;
        }
        closePreviewByBack();
      }) as EventListener;

      document.addEventListener('ionBackButton', ionBackButtonListener);

      pswp.on('destroy', () => {
        document.removeEventListener('ionBackButton', ionBackButtonListener);
        window.removeEventListener('popstate', popstateListener);
        if (hasInjectedPreviewHistory) {
          hasInjectedPreviewHistory = false;
          window.history.back();
        }
      });
    } catch (error) {
      message.error(`返回监听注册失败: ${String(error)}`);
    }
  }

  pswp.on('uiRegister', () => {
    pswp.ui?.registerElement({
      appendTo: 'bar',
      ariaLabel: '切换缩放',
      className: 'pswp__button--zoom-toggle',
      html: {
        inner:
          '<path id="pswp__icn-zoom-toggle" d="M17.426 19.926a6 6 0 1 1 1.5-1.5L23 22.5 21.5 24z"/><path fill="currentColor" class="pswp__zoom-icn-bar-h" d="M11 16v-2h6v2z"/><path fill="currentColor" class="pswp__zoom-icn-bar-v" d="M13 12h2v6h-2z"/>',
        isCustomSVG: true,
        outlineID: 'pswp__icn-zoom-toggle',
        size: 24,
      },
      isButton: true,
      name: 'zoom-toggle',
      onClick: (_event, _element, instance) => {
        toggleCurrentSlideZoom(instance);
      },
      order: 7,
      title: '切换缩放',
    });

    pswp.ui?.registerElement({
      appendTo: 'bar',
      ariaLabel: '旋转图片',
      className: 'pswp__button--rotate-image',
      html: {
        inner:
          '<path id="pswp__icn-rotate" d="M16 8V4l-6 6 6 6v-4c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H8c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z"/>',
        isCustomSVG: true,
        outlineID: 'pswp__icn-rotate',
        size: 32,
      },
      isButton: true,
      name: 'rotate-image',
      onClick: (_event, _element, instance) => {
        rotateCurrentSlide(instance, slideRotationMap);
      },
      order: 8,
      title: '旋转图片',
    });

    if (isAndroidNativePlatform()) {
      pswp.ui?.registerElement({
        appendTo: 'bar',
        ariaLabel: '保存到系统相册',
        className: 'pswp__button--download',
        html: {
          inner:
            '<path id="pswp__icn-download" d="M16 18l-6-6h4V4h4v8h4l-6 6zM6 22h20v2H6z"/>',
          isCustomSVG: true,
          outlineID: 'pswp__icn-download',
          size: 32,
        },
        isButton: true,
        name: 'download-image',
        onClick: async (_event, _element, instance) => {
          const imageUrl = getCurrentSlideImage(instance);
          if (!imageUrl) {
            message.error('当前图片地址无效');
            return;
          }
          await saveImageToSystemAlbum(imageUrl);
        },
        order: 9,
        title: '保存到系统相册',
      });
    }
  });

  pswp.init();
}
