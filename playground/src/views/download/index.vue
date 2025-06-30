<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import { Download } from '@vben/icons';

import { getLatestVersionApi } from '#/api/system/version';

const isWeChat = ref(false);
const downloadUrl = ref('');

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

async function fetchDownloadUrl() {
  try {
    const data = await getLatestVersionApi();
    downloadUrl.value = data.url;

    // If not in WeChat and a download URL is available, trigger download automatically
    if (!isWeChat.value && downloadUrl.value) {
      downloadFile(downloadUrl.value);
    }
  } catch (error) {
    console.error('Failed to fetch download URL:', error);
    // Optionally, handle the error in the UI
  }
}

onMounted(() => {
  // 1. Check user agent to determine if it's WeChat
  isWeChat.value = /micromessenger/i.test(navigator.userAgent);
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
        <p class="mt-1 text-base text-gray-600">即可完成下载</p>
      </div>

      <div class="flex-grow"></div>
    </div>

    <!-- Case 2: Opened in an external browser -->
    <div v-else class="m-auto w-full max-w-md">
      <div class="rounded-lg bg-white p-8 text-center shadow-lg">
        <Download class="mx-auto h-16 w-16 text-green-500" />
        <h1 class="mt-4 text-2xl font-bold">准备开始下载...</h1>
        <p v-if="downloadUrl" class="mt-2 text-gray-600">
          如果下载未自动开始，请点击下方的按钮重试。
        </p>
        <p v-else class="mt-2 text-red-500">
          下载链接无效，请确认您访问的地址是否正确。
        </p>

        <button
          v-if="downloadUrl"
          class="mt-6 w-full rounded-md bg-blue-500 px-4 py-3 text-lg font-semibold text-white transition hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50"
          :disabled="!downloadUrl"
          @click="downloadFile(downloadUrl)"
        >
          立即下载
        </button>
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
