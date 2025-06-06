// stores/parkStore.js
import { defineStore } from 'pinia';

import { getParkList } from '#/api/park';

export interface Park {
  parkId: number;
  parkName: string;
}

export const useParkStore = defineStore('park', {
  actions: {
    /**
     * 获取园区列表
     * @param forceRefresh 是否强制刷新
     * @param includeAllOption 是否包含"全部区域"选项
     * @returns 园区列表
     */
    async fetchParkList(
      forceRefresh = false,
      includeAllOption = true,
    ): Promise<Park[]> {
      // 如果已有数据且不强制刷新，直接返回
      if (this.parkList.length > 0 && !forceRefresh) {
        return this.parkList;
      }

      try {
        this.loading = true;
        // 获取园区列表
        const parkList = await getParkList();
        // 更新园区列表
        this.setParkList(parkList);

        // 添加"全部区域"选项
        if (
          includeAllOption &&
          this.parkList.length > 0 &&
          !this.parkList.some((park) => park.parkId === -1)
        ) {
          this.parkList.unshift({
            parkId: -1,
            parkName: '全部区域',
          });
        }

        return this.parkList;
      } catch (error) {
        console.error('获取园区列表失败:', error);
        this.error = '获取园区列表失败';
        return [];
      } finally {
        this.loading = false;
      }
    },

    setCurrentPark(park: Park) {
      this.currentPark = park;
      this.parkId = park.parkId;
    },

    setParkList(parkList: Park[]) {
      this.parkList = parkList;
    },
  },
  state: () => ({
    buttonStatus: true,
    currentPark: null as null | Park,
    defaultImgUrl: '/assets/icons8-占位符.gif',
    error: '',
    loading: false,
    parkId: undefined as number | undefined,
    parkList: [] as Park[],
  }),
});
