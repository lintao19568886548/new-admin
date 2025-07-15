import type { Ref } from 'vue';

import { nextTick, ref } from 'vue';

import { message } from 'ant-design-vue';

/**
 * 下拉刷新配置选项
 */
export interface PullToRefreshOptions {
  // 是否启用下拉刷新
  enabled?: boolean;
  // 刷新失败提示文本
  errorMessage?: string;
  // 自定义刷新处理函数
  onRefresh?: () => Promise<void> | void;
  // 是否显示成功消息
  showSuccessMessage?: boolean;
  // 刷新成功提示文本
  successMessage?: string;
}

/**
 * 下拉刷新Hook
 * @param options 配置选项
 * @returns 下拉刷新相关状态和方法
 */
export function usePullToRefresh(options: PullToRefreshOptions = {}) {
  const {
    enabled = true,
    errorMessage = '刷新失败',
    onRefresh,
    showSuccessMessage = true,
    successMessage = '刷新成功',
  } = options;

  // const router = useRouter();
  const isRefreshing = ref(false);
  const refreshCount = ref(0);

  /**
   * 默认刷新处理函数 - 重新加载当前页面数据
   */
  async function defaultRefreshHandler() {
    // 触发页面数据重新加载
    window.location.reload();
  }

  /**
   * 处理下拉刷新事件
   * @param complete 完成回调函数
   */
  async function handleRefresh(complete: () => void) {
    if (isRefreshing.value || !enabled) {
      complete();
      return;
    }

    isRefreshing.value = true;
    refreshCount.value++;

    try {
      // 执行自定义刷新逻辑或默认刷新逻辑
      await (onRefresh ? onRefresh() : defaultRefreshHandler());

      // 显示成功消息
      if (showSuccessMessage) {
        message.success(successMessage);
      }
    } catch (error) {
      console.error('下拉刷新失败:', error);
      message.error(errorMessage);
    } finally {
      isRefreshing.value = false;

      // 确保在下一个tick中调用complete，避免状态更新冲突
      await nextTick();
      complete();
    }
  }

  /**
   * 手动触发刷新
   */
  async function triggerRefresh() {
    return new Promise<void>((resolve) => {
      handleRefresh(() => {
        resolve();
      });
    });
  }

  /**
   * 重置刷新状态
   */
  function resetRefreshState() {
    isRefreshing.value = false;
    refreshCount.value = 0;
  }

  return {
    enabled,
    // 方法
    handleRefresh,
    // 状态
    isRefreshing,

    refreshCount,
    resetRefreshState,
    triggerRefresh,
  };
}

/**
 * 页面级别的下拉刷新Hook
 * 提供更高级的功能，如数据重新获取等
 */
export function usePagePullToRefresh(
  options: {
    // 数据获取函数列表
    dataFetchers?: Array<() => Promise<void> | void>;
  } & PullToRefreshOptions,
) {
  const { dataFetchers = [], ...restOptions } = options;

  /**
   * 页面数据刷新处理函数
   */
  async function pageRefreshHandler() {
    // 并行执行所有数据获取函数
    if (dataFetchers.length > 0) {
      await Promise.all(
        dataFetchers.map((fetcher) =>
          Promise.resolve(fetcher()).catch((error) => {
            console.error('数据获取失败:', error);
            throw error;
          }),
        ),
      );
    }
  }

  return usePullToRefresh({
    ...restOptions,
    onRefresh: pageRefreshHandler,
  });
}

/**
 * 列表页面下拉刷新Hook
 * 专门用于列表页面的刷新逻辑
 */
export function useListPullToRefresh<T = any>(
  options: {
    // 列表获取函数
    fetchList?: () => Promise<T[]>;
    // 列表数据
    listData?: Ref<T[]>;
    // 分页重置回调函数
    onResetPagination?: () => void;
    // 是否重置分页
    resetPagination?: boolean;
  } & PullToRefreshOptions,
) {
  const {
    fetchList,
    onResetPagination,
    resetPagination = true,
    listData,
    ...restOptions
  } = options;

  /**
   * 列表刷新处理函数
   */
  async function listRefreshHandler() {
    // 如果需要重置分页，先执行重置操作
    if (resetPagination && onResetPagination) {
      onResetPagination();
    }

    if (fetchList) {
      const newData = await fetchList();
      if (listData) {
        listData.value = newData;
      }
    }
  }

  return usePullToRefresh({
    ...restOptions,
    onRefresh: listRefreshHandler,
  });
}
