<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { Download } from '@vben/icons';

import { getLatestVersionApi } from '#/api/system/version';
import { normalizeIosStoreUrl } from '#/utils/app-update';

type ClientPlatform = 'android' | 'ios' | 'unknown';

const isWeChat = ref(false);
const clientPlatform = ref<ClientPlatform>('unknown');
const androidUrl = ref('');
const iosUrl = ref('');

const hasDownloadEntry = computed(() => {
  return !!androidUrl.value || !!iosUrl.value;
});

const pageTitle = computed(() => {
  if (clientPlatform.value === 'android') {
    return '准备开始下载...';
  }
  if (clientPlatform.value === 'ios') {
    return '准备前往 App Store...';
  }
  return '选择下载方式';
});

const pageDescription = computed(() => {
  if (clientPlatform.value === 'android' && androidUrl.value) {
    return '如果下载未自动开始，请点击下方按钮重试。';
  }
  if (clientPlatform.value === 'ios' && iosUrl.value) {
    return '如果没有自动跳转，请点击下方按钮前往 App Store。';
  }
  if (hasDownloadEntry.value) {
    return '请选择对应平台继续。';
  }
  return '';
});

function detectClientPlatform(): ClientPlatform {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('android')) {
    return 'android';
  }
  if (/iphone|ipad|ipod/.test(userAgent)) {
    return 'ios';
  }
  return 'unknown';
}

/**
 * Triggers a file download.
 * @param url The URL of the file to download.
 */
function downloadFile(url: string) {
  if (!url) {
    console.error('Download URL is not provided.');
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  // It's safer to not suggest a filename, letting the browser use the one from Content-Disposition header.
  // a.download = url.split('/').pop() || 'download';
  document.body.append(a);
  a.click();
  a.remove();
}

function openExternalUrl(url: string) {
  if (!url) {
    console.error('Open URL is not provided.');
    return;
  }
  window.location.assign(url);
}

function triggerPrimaryAction() {
  if (clientPlatform.value === 'android' && androidUrl.value) {
    downloadFile(androidUrl.value);
    return;
  }
  if (clientPlatform.value === 'ios' && iosUrl.value) {
    openExternalUrl(iosUrl.value);
  }
}

async function fetchDownloadUrl() {
  try {
    const data = await getLatestVersionApi();
    androidUrl.value = data.androidUrl || '';
    iosUrl.value = data.iosUrl ? normalizeIosStoreUrl(data.iosUrl) : '';

    if (!isWeChat.value && clientPlatform.value !== 'unknown') {
      triggerPrimaryAction();
    }
  } catch (error) {
    console.error('Failed to fetch download URL:', error);
    // Optionally, handle the error in the UI
  }
}

onMounted(() => {
  // 1. Check user agent to determine if it's WeChat
  isWeChat.value = /micromessenger/i.test(navigator.userAgent);
  clientPlatform.value = detectClientPlatform();
  fetchDownloadUrl();
});
</script>

<template>
  <div class="flex h-screen w-screen flex-col items-center bg-gray-100 p-5">
    <!-- Case 1: Opened in WeChat -->
    <div v-if="isWeChat" class="h-full w-full bg-white">
      <div class="relative w-full flex-grow">
        <div
          class="absolute right-5 top-5 flex flex-col items-center text-gray-700"
        >
          <!-- <p class="text-sm">点击右上角菜单</p> -->
          <div class="mt-1 h-12 w-12">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="animate-bounce-tr"
            >
              <line x1="7" y1="17" x2="17" y2="7" />
              <polyline points="12 7 17 7 17 12" />
            </svg>
          </div>
        </div>
      </div>
      <div class="text-center">
        <p class="text-lg font-bold">无法在微信内直接下载</p>
        <p class="mt-2 text-base text-gray-600">
          请点击右上角<span class="font-semibold text-blue-500">菜单按钮</span>
        </p>
        <p class="mt-1 text-base text-gray-600">
          然后选择
          <span class="font-semibold text-blue-500">"在浏览器中打开"</span>
        </p>
        <p class="mt-1 text-base text-gray-600">即可继续下载或前往 App Store</p>
      </div>

      <div class="flex-grow"></div>
    </div>

    <!-- Case 2: Opened in an external browser -->
    <div v-else class="m-auto w-full max-w-md">
      <div class="rounded-lg bg-white p-8 text-center shadow-lg">
        <Download class="mx-auto h-16 w-16 text-green-500" />
        <h1 class="mt-4 text-2xl font-bold">{{ pageTitle }}</h1>
        <p v-if="pageDescription" class="mt-2 text-gray-600">
          {{ pageDescription }}
        </p>
        <p v-else class="mt-2 text-red-500">
          下载链接无效，请确认您访问的地址是否正确。
        </p>

        <div v-if="hasDownloadEntry" class="mt-6 space-y-3">
          <button
            v-if="androidUrl"
            class="w-full rounded-md bg-blue-500 px-4 py-3 text-lg font-semibold text-white transition hover:bg-blue-600 active:bg-blue-700"
            @click="downloadFile(androidUrl)"
          >
            下载 Android 安装包
          </button>

          <button
            v-if="iosUrl"
            class="w-full rounded-md bg-slate-900 px-4 py-3 text-lg font-semibold text-white transition hover:bg-slate-800 active:bg-slate-950"
            @click="openExternalUrl(iosUrl)"
          >
            前往 App Store
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* A simple bounce animation for the arrow to the top-right */
@keyframes bounce-tr {
  0%,
  100% {
    transform: translate(25%, -25%);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }

  50% {
    transform: translate(0, 0);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
}

.animate-bounce-tr {
  animation: bounce-tr 1.5s infinite;
}
</style>
