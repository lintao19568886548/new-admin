import { ref } from 'vue';

import { getNativeRuntimePlatform } from '#/utils/native-runtime';

/**
 * @composable usePlatform
 * @description 获取当前平台信息的 Hook。
 *              此 Hook 在 setup 阶段同步确定平台类型，确保响应式变量立即可用。
 * @returns {object} 包含平台信息的响应式对象。
 * @property {import('vue').Ref<boolean>} isNativePlatform - 一个 ref 对象，指示当前是否为原生平台 (true 是, false 否)。
 * @property {import('vue').Ref<string | null>} platformName - 一个 ref 对象，包含原生平台的名称 (例如 'ios', 'android')；如果不是原生平台，则为 null。
 */
export function usePlatform() {
  const platform = getNativeRuntimePlatform();
  const isNativePlatform = ref(platform !== null);
  const platformName = ref<null | string>(platform);

  return {
    isNativePlatform,
    platformName,
  };
}
