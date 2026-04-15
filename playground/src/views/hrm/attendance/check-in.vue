<script setup lang="ts">
import type {
  AttendanceConfig,
  AttendanceLeaveScope,
  TodayAttendanceRecord,
} from '#/api/hrm/attendance';

import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useUserStore } from '@vben/stores';

import { Icon } from '@iconify/vue';
import { Button, message, Modal, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  getAttendanceConfig,
  getOfficeLocations,
  getTodayRecord,
  punchIn,
  punchOut,
} from '#/api/hrm/attendance';
import { useLayoutStore } from '#/store/layout';
import { getBaiduMapAk, loadBaiduMapScript } from '#/utils/map';

// ================================= 类型定义 =================================
interface TodayRecord extends TodayAttendanceRecord {
  workHours: number;
}

interface OfficeLocation {
  lat: number;
  lng: number;
  name: string;
  radius: number;
}

// ================================= 考勤状态 =================================
const AttendanceStatus = {
  Absent: 4,
  EarlyLeave: 2,
  Late: 1,
  LateAndEarlyLeave: 3,
  Leave: 5,
  Normal: 0,
} as const;

const attendanceStatusMeta = {
  [AttendanceStatus.Absent]: { color: 'red', text: '缺勤' },
  [AttendanceStatus.EarlyLeave]: { color: 'orange', text: '早退' },
  [AttendanceStatus.Late]: { color: 'red', text: '迟到' },
  [AttendanceStatus.LateAndEarlyLeave]: { color: 'red', text: '迟到+早退' },
  [AttendanceStatus.Leave]: { color: 'blue', text: '请假' },
  [AttendanceStatus.Normal]: { color: 'green', text: '正常' },
};

const leaveScopeMeta: Record<
  Exclude<AttendanceLeaveScope, 'none'>,
  { color: string; text: string }
> = {
  full: { color: 'blue', text: '整天请假' },
  partial: { color: 'cyan', text: '部分请假' },
};

const defaultAttendanceConfig: AttendanceConfig = {
  scheduledCheckIn: '09:00:00',
  scheduledCheckOut: '18:00:00',
  source: 'default',
};

// ================================= 响应式数据 =================================
const currentLocation = ref('');
const latitude = ref(0);
const longitude = ref(0);
const isInRange = ref(false);
const locationLoading = ref(true);
const punchLoading = ref(false);
const mapInitialized = ref(false);

// Pinia Store
const userStore = useUserStore();
const userInfo = userStore.userInfo;

const router = useRouter();
const layoutStore = useLayoutStore();

// 打卡点
const officeLocations = ref<OfficeLocation[]>([]);
const attendanceConfig = ref<AttendanceConfig>(defaultAttendanceConfig);
const isAttendanceConfigLoaded = ref(false);

// 今日打卡记录
const todayRecord = ref<null | TodayRecord>(null);
const isTodayRecordLoaded = ref(false);

// 地图相关
let map: any = null;
const currentMarker = ref<any>(null);
const officeCircles = ref<any[]>([]);
const locateFn = ref<(() => void) | null>(null);
let geolocation: any = null;

// 生命周期
onMounted(async () => {
  layoutStore.setHeaderActions([
    {
      icon: 'mdi:history',
      key: 'history',
      onClick: () => {
        router.push({
          path: '/hrm/attendance/record',
        });
      },
    },
  ]);
  layoutStore.setOnRefresh(() => handleRelocate());
  await initMap();
});

onUnmounted(() => {
  layoutStore.clearHeaderActions();
  layoutStore.setOnRefresh(null);
  if (map) {
    map = null;
    mapInitialized.value = false;
  }
  locateFn.value = null;
  geolocation = null;
});

const getUsername = () => {
  const username = userStore.userInfo?.realName;
  if (!username) {
    throw new Error('未获取到用户信息，请重新登录');
  }
  return username;
};

const confirmModal = (options: {
  content: string;
  okText: string;
  title: string;
}) => {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      centered: true,
      content: options.content,
      okText: options.okText,
      onCancel: () => resolve(false),
      onOk: () => resolve(true),
      title: options.title,
    });
  });
};

const confirmOutsideRange = async () => {
  return confirmModal({
    content: '当前区域非指定打卡区域，是否继续打卡',
    okText: '确认打卡',
    title: '非指定区域',
  });
};

const confirmEarlyLeave = async () => {
  const now = dayjs();
  const endTime = dayjs(
    `${now.format('YYYY-MM-DD')} ${attendanceConfig.value.scheduledCheckOut}`,
  );
  if (!now.isBefore(endTime)) {
    return true;
  }
  return confirmModal({
    content: '当前时间早于规定下班时间，确定要打卡吗？',
    okText: '确认打卡',
    title: '早退确认',
  });
};

const locateOnce = async () => {
  if (!mapInitialized.value || !map || !geolocation) {
    throw new Error('地图未初始化');
  }

  locationLoading.value = true;
  return new Promise<void>((resolve, reject) => {
    geolocation.getCurrentPosition(
      (result: any) => {
        if (geolocation.getStatus() === (window as any).BMAP_STATUS_SUCCESS) {
          updateLocationDetails(result.point);
          locationLoading.value = false;
          resolve();
          return;
        }

        currentLocation.value = '定位失败';
        locationLoading.value = false;
        reject(new Error('定位失败，请检查设备权限或网络连接'));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10_000,
      },
    );
  });
};

const handleRelocate = async () => {
  try {
    await locateOnce();
  } catch (error: any) {
    message.error(error?.message || '定位失败');
  }
};

// 初始化地图
const initMap = async () => {
  mapInitialized.value = false;
  await nextTick();
  if (!document.querySelector('#map-container')) return;
  officeCircles.value = [];
  currentMarker.value = null;
  geolocation = null;
  const container = document.querySelector(
    '#map-container',
  ) as HTMLElement | null;
  if (container) {
    container.innerHTML = '';
  }

  try {
    officeLocations.value = await getOfficeLocations();
  } catch (error) {
    console.error('Failed to fetch office locations:', error);
    message.error('获取办公室位置失败，请刷新重试');
    return;
  }

  try {
    const baiduMapAk = await getBaiduMapAk();
    await loadBaiduMapScript(baiduMapAk);
  } catch (error) {
    console.error('Baidu Map script failed to load:', {
      error,
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
    });
    const errMsg =
      error instanceof Error
        ? error.message
        : '地图脚本加载失败，请检查网络后重试';
    message.error(errMsg);
    locationLoading.value = false;
    return;
  }

  const BMap = (window as any).BMap;
  map = new BMap.Map('map-container');

  const points = officeLocations.value.map(
    (loc) => new BMap.Point(loc.lng, loc.lat),
  );

  officeLocations.value.forEach((loc, index) => {
    const circle = new BMap.Circle(points[index], loc.radius, {
      fillColor: '#1890ff',
      fillOpacity: 0.2,
      strokeColor: '#1890ff',
      strokeWeight: 1,
    });
    map.addOverlay(circle);
    officeCircles.value.push(circle);
  });

  map.setViewport(points);
  mapInitialized.value = true;

  // 这是用于程序化调用的核心定位服务
  geolocation = new BMap.Geolocation();

  // 统一定位逻辑
  const locate = () => {
    void handleRelocate();
  };
  locateFn.value = locate;

  // 创建自定义定位控件
  function CustomLocationControl(this: any) {
    this.defaultAnchor = (window as any).BMAP_ANCHOR_BOTTOM_RIGHT;
    this.defaultOffset = new BMap.Size(20, 20);
  }
  CustomLocationControl.prototype = new (window as any).BMap.Control();
  CustomLocationControl.prototype.initialize = function (mapInstance: any) {
    const controlDiv = document.createElement('div');
    controlDiv.style.width = '38px';
    controlDiv.style.height = '38px';
    controlDiv.style.background = 'white';
    controlDiv.style.borderRadius = '2px';
    controlDiv.style.boxShadow = '0 2px 6px rgba(0,0,0,.15)';
    controlDiv.style.cursor = 'pointer';
    controlDiv.style.display = 'flex';
    controlDiv.style.alignItems = 'center';
    controlDiv.style.justifyContent = 'center';

    // 使用了一个开源的 crosshair 图标
    controlDiv.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>';

    controlDiv.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      locate();
    });

    mapInstance.getContainer().append(controlDiv);
    return controlDiv;
  };

  // 添加自定义控件到地图
  const customLocationCtrl = new (CustomLocationControl as any)();
  map.addControl(customLocationCtrl);

  // 页面加载时执行初次定位
  locate();
};

// 更新位置相关的所有状态
const updateLocationDetails = (point: any) => {
  const BMap = (window as any).BMap;
  if (!BMap) {
    console.error('BMap not available in updateLocationDetails');
    return;
  }
  if (!map) {
    return;
  }
  latitude.value = point.lat;
  longitude.value = point.lng;

  const geoc = new BMap.Geocoder();
  geoc.getLocation(point, (rs: any) => {
    const addComp = rs.addressComponents;
    const addressParts = [
      addComp.province,
      addComp.city,
      addComp.district,
      addComp.street,
      addComp.streetNumber,
    ];

    const uniqueParts: string[] = [];
    for (const part of addressParts) {
      if (part && uniqueParts.at(-1) !== part) {
        uniqueParts.push(part);
      }
    }
    currentLocation.value = uniqueParts.join(',');
  });

  let inRange = false;
  for (const loc of officeLocations.value) {
    const officePoint = new BMap.Point(loc.lng, loc.lat);
    const distance = map.getDistance(officePoint, point);
    if (distance <= loc.radius) {
      inRange = true;
      break;
    }
  }

  isInRange.value = inRange;
  updateMapMarkers(point);
};

// 更新地图标记
const updateMapMarkers = (point: any) => {
  if (currentMarker.value) {
    currentMarker.value.setPosition(point);
  } else {
    const BMap = (window as any).BMap;
    currentMarker.value = new BMap.Marker(point);
    map.addOverlay(currentMarker.value);
  }
  map.centerAndZoom(point, 17);
};

const getPunchPayload = () => ({
  latitude: latitude.value,
  longitude: longitude.value,
  punchTime: dayjs().toISOString(),
  username: getUsername(),
});

// 上班打卡
const handlePunchIn = async () => {
  if (punchLoading.value) return;
  try {
    await locateOnce();
  } catch {}

  if (!isInRange.value) {
    const ok = await confirmOutsideRange();
    if (!ok) return;
  }

  punchLoading.value = true;
  try {
    await punchIn(getPunchPayload());
    await loadTodayRecord();
    message.success('上班打卡成功');
  } catch (error: any) {
    message.error(`打卡失败: ${error?.message || '请重试'}`);
  } finally {
    punchLoading.value = false;
  }
};

// 下班打卡
const handlePunchOut = async () => {
  if (!todayRecord.value?.attendanceId) {
    message.error('无法找到今日打卡记录，无法下班打卡');
    return;
  }

  if (punchLoading.value) return;
  try {
    await locateOnce();
  } catch {}

  if (!isInRange.value) {
    const ok = await confirmOutsideRange();
    if (!ok) return;
  }

  const okEarlyLeave = await confirmEarlyLeave();
  if (!okEarlyLeave) return;

  punchLoading.value = true;
  try {
    await punchOut(todayRecord.value.attendanceId, getPunchPayload());
    await loadTodayRecord();
    message.success('下班打卡成功');
  } catch (error: any) {
    message.error(`打卡失败: ${error?.message || '请重试'}`);
  } finally {
    punchLoading.value = false;
  }
};

const getStatusInfo = (status: null | number) => {
  if (
    status === null ||
    !Object.prototype.hasOwnProperty.call(attendanceStatusMeta, status)
  ) {
    return attendanceStatusMeta[AttendanceStatus.Absent];
  }
  return attendanceStatusMeta[status as keyof typeof attendanceStatusMeta];
};

const getLeaveScopeInfo = (leaveScope: AttendanceLeaveScope) => {
  if (leaveScope === 'none') {
    return null;
  }
  return leaveScopeMeta[leaveScope];
};

const loadAttendanceConfig = async () => {
  try {
    attendanceConfig.value = await getAttendanceConfig();
  } catch (error) {
    console.error('加载考勤配置失败:', error);
    attendanceConfig.value = { ...defaultAttendanceConfig };
  } finally {
    isAttendanceConfigLoaded.value = true;
  }
};

// 加载今日记录
const loadTodayRecord = async () => {
  if (!userInfo?.realName) return; // 如果没有 username，则不执行

  try {
    const data = await getTodayRecord({ username: userInfo.realName });
    if (data) {
      todayRecord.value = {
        ...data,
        punchIn: data.punchIn ? dayjs(data.punchIn).format('HH:mm:ss') : '',
        punchOut: data.punchOut ? dayjs(data.punchOut).format('HH:mm:ss') : '',
        workHours: 0, // 初始化
      };

      if (data.punchIn && data.punchOut) {
        const punchInTime = dayjs(data.punchIn);
        const punchOutTime = dayjs(data.punchOut);
        const workHours = punchOutTime.diff(punchInTime, 'hour', true);
        if (todayRecord.value) {
          todayRecord.value.workHours = Math.round(workHours * 100) / 100;
        }
      }
    } else {
      todayRecord.value = null;
    }
    isTodayRecordLoaded.value = true; // 标记已加载
  } catch (error: any) {
    console.error('加载今日记录失败:', error);
    message.error(`加载今日记录失败: ${error.message || '未知错误'}`);
  }
};

// 监听 username 的变化，一旦获取到有效的 username，就加载所有相关数据
watch(
  () => userInfo?.realName,
  (newUsername, oldUsername) => {
    if (newUsername && newUsername !== oldUsername) {
      isAttendanceConfigLoaded.value = false;
      attendanceConfig.value = { ...defaultAttendanceConfig };
      isTodayRecordLoaded.value = false;
      todayRecord.value = null;
    }
    if (newUsername && !isAttendanceConfigLoaded.value) {
      loadAttendanceConfig();
    }
    if (newUsername && !isTodayRecordLoaded.value) {
      loadTodayRecord();
    }
  },
  { immediate: true }, // 立即执行一次，以处理 username 已存在的情况
);
</script>

<template>
  <div class="box-border h-full bg-[#f5f5f5] p-6">
    <!-- 打卡区域 -->
    <div class="rounded-lg bg-white p-6 shadow-[0_2px_8px_rgb(0_0_0_/_10%)]">
      <div class="mb-6">
        <div
          class="flex items-center rounded-lg border-2 border-[#f0f0f0] p-4 transition-all duration-300"
          :class="isInRange ? 'border-[#52c41a] bg-[#f6ffed]' : ''"
        >
          <Icon icon="mdi:map-marker" class="mr-3 text-2xl text-[#1890ff]" />
          <div class="flex-1">
            <div class="mb-1 text-base font-medium text-[#333]">
              <span v-if="locationLoading">正在定位中...</span>
              <span v-else>{{ currentLocation }}</span>
            </div>
            <div class="text-sm text-[#666]">
              <span v-if="locationLoading">请稍候...</span>
              <span v-else>{{
                isInRange ? '在打卡范围内' : '不在打卡范围内'
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <div
        id="map-container"
        class="mb-6 h-[300px] overflow-hidden rounded-[6px] border border-[#d9d9d9]"
      ></div>

      <div class="mb-6 flex justify-center gap-4">
        <Button
          type="primary"
          size="large"
          class="punch-btn !flex !h-[60px] !flex-1 !items-center !justify-center !gap-2 !rounded-lg !border-none !bg-[linear-gradient(135deg,#52c41a,#73d13d)] !text-base"
          :disabled="Boolean(todayRecord?.punchIn)"
          :loading="punchLoading"
          @click="handlePunchIn"
        >
          <Icon icon="mdi:clock-in" />
          上班打卡
        </Button>
        <Button
          type="primary"
          size="large"
          class="punch-btn !flex !h-[60px] !flex-1 !items-center !justify-center !gap-2 !rounded-lg !border-none !bg-[linear-gradient(135deg,#1890ff,#40a9ff)] !text-base"
          :disabled="
            Boolean(!todayRecord?.attendanceId || todayRecord?.punchOut)
          "
          :loading="punchLoading"
          @click="handlePunchOut"
        >
          <Icon icon="mdi:clock-out" />
          下班打卡
        </Button>
      </div>

      <!-- 今日打卡记录 -->
      <div v-if="todayRecord" class="border-t border-[#f0f0f0] pt-4">
        <div v-if="todayRecord.punchIn" class="mb-2 flex items-center gap-3">
          <span class="min-w-20 font-medium text-[#333]">上班时间:</span>
          <span
            class="font-[Monaco,Menlo,monospace] font-medium text-[#1890ff]"
          >
            {{ todayRecord.punchIn }}
          </span>
          <Tag :color="getStatusInfo(todayRecord.status).color">
            {{ getStatusInfo(todayRecord.status).text }}
          </Tag>
          <Tag
            v-if="getLeaveScopeInfo(todayRecord.leaveScope)"
            :color="getLeaveScopeInfo(todayRecord.leaveScope)?.color"
          >
            {{ getLeaveScopeInfo(todayRecord.leaveScope)?.text }}
          </Tag>
        </div>
        <div v-if="todayRecord.punchOut" class="mb-2 flex items-center gap-3">
          <span class="min-w-20 font-medium text-[#333]">下班时间:</span>
          <span
            class="font-[Monaco,Menlo,monospace] font-medium text-[#1890ff]"
          >
            {{ todayRecord.punchOut }}
          </span>
        </div>
        <div v-if="todayRecord.workHours" class="mb-2 flex items-center gap-3">
          <span class="min-w-20 font-medium text-[#333]">工作时长:</span>
          <span
            class="font-[Monaco,Menlo,monospace] font-medium text-[#1890ff]"
          >
            {{ todayRecord.workHours }}小时
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
