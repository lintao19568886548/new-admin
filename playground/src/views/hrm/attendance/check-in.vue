<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import { useUserStore } from '@vben/stores';

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
// 需要先安装 @iconify/vue 依赖
// npm install @iconify/vue
// 或
// yarn add @iconify/vue
import { Icon } from '@iconify/vue';
import { Button, message, Modal, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';

import { getTodayRecord, punchIn, punchOut } from '#/api/hrm/attendance';
import { BAIDU_MAP_AK, officeLocations } from '#/config';
import { loadBaiduMapScript } from '#/utils/map';

// ================================= 类型定义 =================================
interface TodayRecord {
  attendanceId: null | number;
  punchIn: string;
  punchOut: string;
  status: null | number;
  workHours: number;
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

// 默认下班时间
const standardWorkEndTime = '18:00:00';

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

// 今日打卡记录
const todayRecord = ref<null | TodayRecord>(null);

// 地图相关
let map: any = null;
const currentMarker = ref<any>(null);
const officeCircles = ref<any[]>([]);

// 生命周期
onMounted(async () => {
  await initMap();
  await refreshLocation();
});

onUnmounted(() => {
  if (map) {
    map = null;
    mapInitialized.value = false;
  }
});

// 初始化地图
const initMap = async () => {
  mapInitialized.value = false;
  await nextTick();
  if (!document.querySelector('#map-container')) return;

  try {
    await loadBaiduMapScript(BAIDU_MAP_AK);
  } catch (error) {
    console.error('Baidu Map script failed to load:', error);
    message.error('地图脚本加载失败，请刷新页面重试');
    return;
  }

  const BMap = (window as any).BMap;
  map = new BMap.Map('map-container');

  const points = officeLocations.map((loc) => new BMap.Point(loc.lng, loc.lat));

  officeLocations.forEach((loc, index) => {
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
};

// 更新位置相关的所有状态
const updateLocationDetails = (point: any) => {
  const BMap = (window as any).BMap;
  if (!BMap) {
    console.error('BMap not available in updateLocationDetails');
    return;
  }
  // 更新坐标
  latitude.value = point.lat;
  longitude.value = point.lng;

  // 使用百度地图进行地址解析
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

  // 检查是否在打卡范围内
  let inRange = false;
  for (const loc of officeLocations) {
    const officePoint = new BMap.Point(loc.lng, loc.lat);
    const distance = map.getDistance(officePoint, point);
    console.warn(`与 ${loc.name} 的距离: ${distance.toFixed(2)} 米`);
    if (distance <= loc.radius) {
      inRange = true;
      break;
    }
  }

  isInRange.value = inRange;
  console.warn(`是否在打卡范围内 (isInRange): ${isInRange.value}`);

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

// 刷新位置
const refreshLocation = async () => {
  locationLoading.value = true;
  currentLocation.value = '获取位置中...';
  const BMap = (window as any).BMap;

  try {
    let coordinates;

    if (Capacitor.isNativePlatform()) {
      const permissions = await Geolocation.checkPermissions();
      if (permissions.location !== 'granted') {
        const requestResult = await Geolocation.requestPermissions();
        if (requestResult.location !== 'granted') {
          message.error('位置权限被拒绝');
          locationLoading.value = false;
          return;
        }
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10_000,
      });

      const wgs84Point = new BMap.Point(
        position.coords.longitude,
        position.coords.latitude,
      );
      const convertor = new BMap.Convertor();

      coordinates = await new Promise((resolve) => {
        convertor.translate(
          [wgs84Point],
          1,
          5,
          (result: { points: any[] | string; status: number }) => {
            if (result.status === 0 && result.points.length > 0) {
              resolve({
                lat: result.points[0].lat,
                lng: result.points[0].lng,
              });
            } else {
              resolve({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              });
            }
          },
        );
      });
    } else {
      if (!BMap) {
        message.error('地图API未加载，请刷新页面重试');
        locationLoading.value = false;
        return;
      }
      coordinates = await new Promise((resolve, reject) => {
        const geolocation = new BMap.Geolocation();
        geolocation.getCurrentPosition(
          (result: any) => {
            if (
              geolocation.getStatus() === (window as any).BMAP_STATUS_SUCCESS
            ) {
              resolve({ lat: result.point.lat, lng: result.point.lng });
            } else {
              reject(new Error('百度地图定位失败'));
            }
          },
          { enableHighAccuracy: true },
        );
      });
    }

    const point = new BMap.Point(
      (coordinates as { lat: number; lng: number }).lng,
      (coordinates as { lat: number; lng: number }).lat,
    );
    updateLocationDetails(point);
  } catch (error: any) {
    console.error('获取位置时出错:', error);
    message.error(`获取位置失败: ${error.message || '未知错误'}`);
    currentLocation.value = '获取位置失败';
  } finally {
    locationLoading.value = false;
  }
};

// 上班打卡
const handlePunchIn = async () => {
  console.warn(
    `[打卡调试] handlePunchIn triggered. Current value of isInRange: ${isInRange.value}`,
  );

  if (!isInRange.value) {
    console.warn(
      '[打卡调试] Check failed: isInRange is false. Aborting punch in.',
    );
    message.error('不在打卡范围内，无法打卡');
    return;
  }

  console.warn('[打卡调试] Check passed. Proceeding to send API request.');
  punchLoading.value = true;

  try {
    await punchIn({
      latitude: latitude.value,
      longitude: longitude.value,
      punchTime: dayjs().toISOString(),
      username: userInfo?.realName || '',
    });
    await loadTodayRecord();
    message.success('上班打卡成功');
  } catch (error: any) {
    console.error('[打卡调试] 上班打卡失败:', error);
    message.error(`打卡失败: ${error.message || '请重试'}`);
  } finally {
    punchLoading.value = false;
  }
};

// 下班打卡
const handlePunchOut = async () => {
  console.warn(
    `[打卡调试] handlePunchOut triggered. Current value of isInRange: ${isInRange.value}`,
  );
  if (!isInRange.value) {
    console.warn(
      '[打卡调试] Check failed: isInRange is false. Aborting punch out.',
    );
    message.error('不在打卡范围内，无法打卡');
    return;
  }

  if (!todayRecord.value?.attendanceId) {
    message.error('无法找到今日打卡记录，无法下班打卡');
    return;
  }

  // 封装打卡操作
  const performPunchOut = async () => {
    if (!todayRecord.value?.attendanceId) {
      message.error('无法找到今日打卡记录，无法下班打卡');
      return;
    }
    punchLoading.value = true;
    try {
      await punchOut(todayRecord.value.attendanceId, {
        latitude: latitude.value,
        longitude: longitude.value,
        punchTime: dayjs().toISOString(),
        username: userInfo?.realName || '',
      });
      await loadTodayRecord();
      message.success('下班打卡成功');
    } catch (error: any) {
      console.error('[打卡调试] 下班打卡失败:', error);
      message.error(`打卡失败: ${error.message || '请重试'}`);
    } finally {
      punchLoading.value = false;
    }
  };

  // 检查是否早退
  const now = dayjs();
  const endTime = dayjs(standardWorkEndTime, 'HH:mm:ss');
  const isEarlyLeave = now.isBefore(endTime);

  if (isEarlyLeave) {
    Modal.confirm({
      centered: true,
      content: '当前时间早于规定下班时间，确定要打卡吗？',
      okText: '确认打卡',
      onOk: performPunchOut,
      title: '早退确认',
    });
  } else {
    await performPunchOut();
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
  } catch (error: any) {
    console.error('加载今日记录失败:', error);
    message.error(`加载今日记录失败: ${error.message || '未知错误'}`);
  }
};

// 监听 username 的变化，一旦获取到有效的 username，就加载所有相关数据
watch(
  () => userInfo?.realName,
  (newUsername) => {
    if (newUsername) {
      loadTodayRecord();
    }
  },
  { immediate: true }, // 立即执行一次，以处理 username 已存在的情况
);
</script>

<template>
  <div class="attendance-page">
    <!-- 打卡区域 -->
    <div class="punch-card-section">
      <div class="location-info">
        <div class="location-status" :class="{ 'in-range': isInRange }">
          <Icon icon="mdi:map-marker" class="location-icon" />
          <div class="location-text">
            <div class="location-name">
              {{ currentLocation }}
            </div>
            <div class="location-status-text">
              {{ isInRange ? '在打卡范围内' : '不在打卡范围内' }}
            </div>
          </div>
          <Button
            type="link"
            size="small"
            @click="refreshLocation"
            :loading="locationLoading"
          >
            刷新位置
          </Button>
        </div>
      </div>

      <div id="map-container" class="map-container"></div>

      <div class="punch-buttons">
        <Button
          type="primary"
          size="large"
          class="punch-btn punch-in"
          :disabled="!isInRange || Boolean(todayRecord?.punchIn)"
          :loading="punchLoading"
          @click="handlePunchIn"
        >
          <Icon icon="mdi:clock-in" />
          上班打卡
        </Button>
        <Button
          type="primary"
          size="large"
          class="punch-btn punch-out"
          :disabled="
            Boolean(
              !isInRange || !todayRecord?.attendanceId || todayRecord?.punchOut,
            )
          "
          :loading="punchLoading"
          @click="handlePunchOut"
        >
          <Icon icon="mdi:clock-out" />
          下班打卡
        </Button>
      </div>

      <!-- 今日打卡记录 -->
      <div class="today-record" v-if="todayRecord">
        <div class="record-item" v-if="todayRecord.punchIn">
          <span class="record-label">上班时间:</span>
          <span class="record-time">{{ todayRecord.punchIn }}</span>
          <Tag :color="getStatusInfo(todayRecord.status).color">
            {{ getStatusInfo(todayRecord.status).text }}
          </Tag>
        </div>
        <div class="record-item" v-if="todayRecord.punchOut">
          <span class="record-label">下班时间:</span>
          <span class="record-time">{{ todayRecord.punchOut }}</span>
        </div>
        <div class="record-item" v-if="todayRecord.workHours">
          <span class="record-label">工作时长:</span>
          <span class="record-time">{{ todayRecord.workHours }}小时</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.attendance-page {
  box-sizing: border-box;
  height: 100%;
  padding: 24px;
  background: #f5f5f5;
}

.punch-card-section {
  padding: 24px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
}

.location-info {
  margin-bottom: 24px;
}

.location-status {
  display: flex;
  align-items: center;
  padding: 16px;
  border: 2px solid #f0f0f0;
  border-radius: 8px;
  transition: all 0.3s;
}

.location-status.in-range {
  background: #f6ffed;
  border-color: #52c41a;
}

.location-icon {
  margin-right: 12px;
  font-size: 24px;
  color: #1890ff;
}

.location-text {
  flex: 1;
}

.location-name {
  margin-bottom: 4px;
  font-size: 16px;
  font-weight: 500;
  color: #333;
}

.location-status-text {
  font-size: 14px;
  color: #666;
}

.punch-buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-bottom: 24px;
}

.punch-btn {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 140px;
  height: 60px;
  font-size: 16px;
  border-radius: 8px;
}

.punch-in {
  background: linear-gradient(135deg, #52c41a, #73d13d);
  border: none;
}

.punch-out {
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  border: none;
}

.today-record {
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.record-item {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 8px;
}

.record-label {
  min-width: 80px;
  font-weight: 500;
  color: #333;
}

.record-time {
  font-family: Monaco, Menlo, monospace;
  font-weight: 500;
  color: #1890ff;
}

.map-container {
  height: 300px;
  margin-bottom: 24px;
  overflow: hidden;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
}

.map-legend {
  display: block;
  margin-bottom: 24px;
}

.office-locations-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.legend-item {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  color: #666;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.legend-color.office {
  background: #1890ff;
}

.legend-color.current {
  background: #ff4d4f;
}
</style>
