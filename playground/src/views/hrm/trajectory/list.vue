<script setup lang="ts">
import type { TrajectoryApi } from '#/api/hrm/trajectory';

import { nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';

import { Icon } from '@iconify/vue';
import {
  Button,
  Card,
  Input,
  List,
  message,
  Pagination,
  RangePicker,
  Segmented,
  Select,
  Spin,
  Tag,
  Tooltip,
} from 'ant-design-vue';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';

import { exportTrajectoryData, getTrajectoryList } from '#/api/hrm/trajectory';
import { getParkList } from '#/api/park';
import { getBaiduMapAk, loadBaiduMapScript } from '#/utils/map';

// ================================= 考勤状态 =================================
const AttendanceStatus = {
  Absent: 4,
  EarlyLeave: 2,
  Late: 1,
  LateAndEarlyLeave: 3,
  Normal: 0,
} as const;

const attendanceStatusMeta = {
  [AttendanceStatus.Absent]: { color: 'default', text: '缺勤' },
  [AttendanceStatus.EarlyLeave]: { color: 'orange', text: '早退' },
  [AttendanceStatus.Late]: { color: 'red', text: '迟到' },
  [AttendanceStatus.LateAndEarlyLeave]: { color: 'red', text: '迟到+早退' },
  [AttendanceStatus.Normal]: { color: 'green', text: '正常' },
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

const deviceStatusMeta: Record<
  'abnormal' | 'normal',
  { color: string; text: string }
> = {
  abnormal: { color: 'red', text: '设备异常' },
  normal: { color: 'green', text: '考勤设备正常' },
};

const deviceAbnormalTypeOrder = ['same_device_multi_account', 'device_changed'];

const deviceAbnormalTypeTextMap: Record<string, string> = {
  device_changed: '更换设备打卡',
  same_device_multi_account: '同设备多账号',
};

const getDeviceStatusInfo = (
  record?: Pick<
    TrajectoryApi.TrajectoryRecord,
    'deviceAbnormalTypes' | 'deviceStatus'
  >,
) => {
  if (record?.deviceStatus !== 'abnormal') {
    return deviceStatusMeta.normal;
  }
  const abnormalText = getDeviceAbnormalTypesText(record.deviceAbnormalTypes);
  return {
    color: deviceStatusMeta.abnormal.color,
    text: abnormalText || deviceStatusMeta.abnormal.text,
  };
};

const getDeviceAbnormalTypesText = (
  abnormalTypes?: TrajectoryApi.AttendanceDeviceAbnormalType[],
) => {
  const typeSet = new Set(abnormalTypes ?? []);
  const orderedTypes = [
    ...deviceAbnormalTypeOrder.filter((type) => typeSet.has(type)),
    ...[...typeSet].filter((type) => !deviceAbnormalTypeOrder.includes(type)),
  ];
  const names = orderedTypes
    .map((type) => deviceAbnormalTypeTextMap[type] || '设备异常')
    .filter(Boolean);
  return names.join('、');
};

const locationAddressText = {
  abnormal: '定位异常',
  failed: '地址解析失败',
  invalid: '坐标无效',
  loading: '解析中...',
  unavailable: '地图服务不可用',
} as const;

const isLocationAbnormal = (
  record: Pick<TrajectoryApi.TrajectoryRecord, 'latitude' | 'longitude'>,
) => {
  return Number(record.longitude) === 0 && Number(record.latitude) === 0;
};

const getCoordinateNumber = Number;

const getLongitude = (
  record: Pick<TrajectoryApi.TrajectoryRecord, 'longitude'>,
) => {
  return getCoordinateNumber(record.longitude);
};

const getLatitude = (
  record: Pick<TrajectoryApi.TrajectoryRecord, 'latitude'>,
) => {
  return getCoordinateNumber(record.latitude);
};

const isCoordinateInvalid = (
  record: Pick<TrajectoryApi.TrajectoryRecord, 'latitude' | 'longitude'>,
) => {
  return (
    !Number.isFinite(getLongitude(record)) ||
    !Number.isFinite(getLatitude(record))
  );
};

const getLocationStatusText = (
  record: Pick<TrajectoryApi.TrajectoryRecord, 'latitude' | 'longitude'>,
) => {
  return isLocationAbnormal(record) ? '异常' : '正常';
};

const getLocationAddressCacheKey = (
  record: Pick<TrajectoryApi.TrajectoryRecord, 'latitude' | 'longitude'>,
) => {
  return `${getLongitude(record)},${getLatitude(record)}`;
};

// ================================= 响应式数据 =================================
const loading = ref(true);
const exportLoading = ref(false);
const records = ref<TrajectoryApi.TrajectoryRecord[]>([]);
const locationAddressMap = reactive<Record<string, string>>({});
const createDefaultDateRange = (): [dayjs.Dayjs, dayjs.Dayjs] => [
  dayjs('2020-01-01'),
  dayjs(),
];
const dateRange = ref<[dayjs.Dayjs, dayjs.Dayjs]>(createDefaultDateRange());
const employeeName = ref('');
const selectedParkId = ref<number | undefined>(undefined);
const parkOptions = ref<{ label: string; value: number }[]>([]);
const pagination = reactive({
  current: 1,
  pageSize: 12,
  pageSizeOptions: ['12', '24', '48'],
  showSizeChanger: true,
  total: 0,
});

const mapContainer = ref<HTMLDivElement | null>(null);
let map: any = null;
let geocoder: any = null;
const markers: any[] = [];
const locationAddressPromiseMap = new Map<string, Promise<string>>();
const activeView = ref('地图');
const isMobile = ref(false);

const checkIsMobile = () => {
  isMobile.value = window.innerWidth <= 768;
};

const buildBaseQueryParams = () => {
  const params: Pick<
    TrajectoryApi.TrajectoryExportParams,
    'employeeName' | 'endDate' | 'parkId' | 'startDate'
  > = {
    endDate: dateRange.value[1].format('YYYY-MM-DD'),
    startDate: dateRange.value[0].format('YYYY-MM-DD'),
  };
  const trimmedEmployeeName = employeeName.value.trim();
  if (trimmedEmployeeName) {
    params.employeeName = trimmedEmployeeName;
  }
  if (selectedParkId.value !== undefined) {
    params.parkId = selectedParkId.value;
  }
  return params;
};

// ================================= 方法 =================================
const ensureGeocoder = () => {
  if (geocoder) {
    return geocoder;
  }
  const BMap = (window as any).BMap;
  if (!BMap) {
    return null;
  }
  geocoder = new BMap.Geocoder();
  return geocoder;
};

const formatResolvedAddress = (result: any) => {
  const address = String(result?.address || '').trim();
  if (address) {
    return address;
  }

  const addressComponents = result?.addressComponents;
  if (!addressComponents) {
    return locationAddressText.failed;
  }

  const parts = [
    addressComponents.province,
    addressComponents.city,
    addressComponents.district,
    addressComponents.street,
    addressComponents.streetNumber,
  ].filter(Boolean);

  return parts.join('') || locationAddressText.failed;
};

const resolveLocationAddress = async (
  record: Pick<TrajectoryApi.TrajectoryRecord, 'latitude' | 'longitude'>,
) => {
  if (isLocationAbnormal(record)) {
    return locationAddressText.abnormal;
  }

  if (isCoordinateInvalid(record)) {
    return locationAddressText.invalid;
  }

  const cacheKey = getLocationAddressCacheKey(record);
  const cachedAddress = locationAddressMap[cacheKey];
  if (
    cachedAddress &&
    cachedAddress !== locationAddressText.loading &&
    cachedAddress !== locationAddressText.unavailable
  ) {
    return cachedAddress;
  }

  const pendingPromise = locationAddressPromiseMap.get(cacheKey);
  if (pendingPromise) {
    return pendingPromise;
  }

  const geocoderInstance = ensureGeocoder();
  if (!geocoderInstance) {
    locationAddressMap[cacheKey] = locationAddressText.unavailable;
    return locationAddressText.unavailable;
  }

  locationAddressMap[cacheKey] = locationAddressText.loading;

  const promise = new Promise<string>((resolve) => {
    const BMap = (window as any).BMap;
    let settled = false;
    let timeoutId: null | number = null;

    const finish = (address: string) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      locationAddressMap[cacheKey] = address;
      locationAddressPromiseMap.delete(cacheKey);
      resolve(address);
    };

    try {
      const point = new BMap.Point(getLongitude(record), getLatitude(record));
      geocoderInstance.getLocation(point, (result: any) => {
        finish(formatResolvedAddress(result));
      });
      timeoutId = window.setTimeout(() => {
        finish(locationAddressText.failed);
      }, 4000);
    } catch (error) {
      console.error('Resolve address failed:', error);
      finish(locationAddressText.failed);
    }
  });

  locationAddressPromiseMap.set(cacheKey, promise);

  return promise;
};

const getLocationAddressText = (
  record: Pick<TrajectoryApi.TrajectoryRecord, 'latitude' | 'longitude'>,
) => {
  if (isLocationAbnormal(record)) {
    return locationAddressText.abnormal;
  }

  if (isCoordinateInvalid(record)) {
    return locationAddressText.invalid;
  }

  return (
    locationAddressMap[getLocationAddressCacheKey(record)] ||
    locationAddressText.loading
  );
};

const preloadLocationAddresses = async (
  targetRecords: TrajectoryApi.TrajectoryRecord[],
) => {
  await Promise.allSettled(
    targetRecords.map((record) => resolveLocationAddress(record)),
  );
};

const fetchData = async () => {
  loading.value = true;
  try {
    const params = {
      ...buildBaseQueryParams(),
      page: pagination.current,
      pageSize: pagination.pageSize,
    };
    const { total, items } = await getTrajectoryList(params);
    records.value = items ?? [];
    pagination.total = total ?? 0;
    await nextTick();
    updateMapMarkers();
    void preloadLocationAddresses(records.value);
  } catch (error: any) {
    message.error(`加载数据失败: ${error.message}`);
  } finally {
    loading.value = false;
  }
};

const initMap = async () => {
  try {
    const baiduMapAk = await getBaiduMapAk();
    await loadBaiduMapScript(baiduMapAk);
  } catch (error) {
    console.error('Baidu Map script failed to load:', error);
    const errMsg =
      error instanceof Error
        ? error.message
        : '地图脚本加载失败，请刷新页面重试';
    message.error(errMsg);
    return;
  }
  if (!mapContainer.value) return;
  const BMap = (window as any).BMap;
  map = new BMap.Map(mapContainer.value);
  geocoder = new BMap.Geocoder();
  map.centerAndZoom(new BMap.Point(113.75, 23.09), 12);
  map.enableScrollWheelZoom(true);
};

const updateMapMarkers = () => {
  if (!map) return;
  // 清除旧标记
  markers.forEach((marker) => map.removeOverlay(marker));
  markers.length = 0;

  const BMap = (window as any).BMap;
  const points: any[] = [];
  if (records.value.length === 0) return;

  records.value.forEach((record) => {
    if (isCoordinateInvalid(record) || isLocationAbnormal(record)) {
      return;
    }

    const point = new BMap.Point(getLongitude(record), getLatitude(record));
    points.push(point);
    const marker = new BMap.Marker(point);
    map.addOverlay(marker);
    markers.push(marker);

    const infoContent = `
      <div style="font-size: 12px; line-height: 1.5;">
        <p style="margin: 0;"><b>用户:</b> ${record.username}</p>
        <p style="margin: 0;"><b>时间:</b> ${record.date} ${record.punchIn}</p>
        <p style="margin: 0;"><b>设备:</b> ${getDeviceStatusInfo(record).text}</p>
      </div>`;
    const infoWindow = new BMap.InfoWindow(infoContent);
    marker.addEventListener('click', () => {
      map.openInfoWindow(infoWindow, point);
    });
  });

  if (points.length === 0) {
    return;
  }

  map.setViewport(points, {
    margins: [20, 20, 20, 20], // top, right, bottom, left
  });
};

const handlePageChange = (page: number, pageSize: number) => {
  pagination.current = page;
  pagination.pageSize = pageSize;
  fetchData();
};

const handleDateChange = () => {
  pagination.current = 1;
  fetchData();
};

const handleSearch = () => {
  pagination.current = 1;
  fetchData();
};

const handleResetFilters = () => {
  employeeName.value = '';
  selectedParkId.value = undefined;
  dateRange.value = createDefaultDateRange();
  pagination.current = 1;
  fetchData();
};

const loadParkOptions = async () => {
  try {
    const result = await getParkList();
    const list = Array.isArray(result) ? result : (result?.items ?? []);
    parkOptions.value = list.map((item: any) => ({
      label: String(item.parkName ?? ''),
      value: Number(item.parkId ?? 0),
    }));
  } catch (error: any) {
    console.error('加载园区列表失败:', error.message);
  }
};

const handleExport = async () => {
  exportLoading.value = true;
  try {
    const params = buildBaseQueryParams();

    const trajectoryDataByPark = await exportTrajectoryData(params);

    if (Object.keys(trajectoryDataByPark).length === 0) {
      message.warning('没有可导出的数据');
      return;
    }

    const workbook = new ExcelJS.Workbook();

    for (const [parkName, parkRecords] of Object.entries(
      trajectoryDataByPark,
    )) {
      const worksheet = workbook.addWorksheet(parkName);
      const parkData = [...parkRecords];

      // 按日期排序
      parkData.sort(
        (
          a: TrajectoryApi.TrajectoryRecord,
          b: TrajectoryApi.TrajectoryRecord,
        ) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf(),
      );

      worksheet.columns = [
        { header: '用户名', key: 'username', width: 15 },
        { header: '日期', key: 'date', width: 15 },
        { header: '星期', key: 'weekday', width: 10 },
        { header: '上班打卡', key: 'punchIn', width: 15 },
        { header: '下班打卡', key: 'punchOut', width: 15 },
        { header: '状态', key: 'status', width: 20 },
        { header: '设备状态', key: 'deviceStatusText', width: 18 },
        { header: '工时(h)', key: 'workHours', width: 10 },
        { header: '定位状态', key: 'locationStatus', width: 15 },
        { header: '地址', key: 'address', width: 40 },
        { header: '纬度', key: 'latitude', width: 20 },
        { header: '经度', key: 'longitude', width: 20 },
      ];

      const statusMap = {
        0: '正常',
        1: '迟到',
        2: '早退',
        3: '迟到+早退',
        4: '缺勤',
      };

      const locationAddresses = await Promise.all(
        parkData.map((row: TrajectoryApi.TrajectoryRecord) =>
          resolveLocationAddress(row),
        ),
      );

      const weekdayMap = ['日', '一', '二', '三', '四', '五', '六'];

      const rows = parkData.map(
        (row: TrajectoryApi.TrajectoryRecord, index) => {
          const status =
            statusMap[row.status as keyof typeof statusMap] || '未知';
          const weekday = `星期${weekdayMap[dayjs(row.date).day()]}`;
          return {
            ...row,
            address: locationAddresses[index],
            deviceStatusText: getDeviceStatusInfo(row).text,
            locationStatus: getLocationStatusText(row),
            status,
            weekday,
          };
        },
      );

      worksheet.addRows(rows);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `考勤轨迹_${params.startDate}_${params.endDate}.xlsx`;
    document.body.append(link);
    link.click();
    link.remove();

    message.success('导出成功');
  } catch (error: any) {
    message.error(`导出失败: ${error.message}`);
  } finally {
    exportLoading.value = false;
  }
};

const highlightMarker = (
  record: TrajectoryApi.TrajectoryRecord,
  highlight: boolean,
) => {
  if (isCoordinateInvalid(record) || isLocationAbnormal(record)) {
    return;
  }

  const targetMarker = markers.find((m) => {
    const pos = m.getPosition();
    return pos.lng === getLongitude(record) && pos.lat === getLatitude(record);
  });

  if (targetMarker) {
    targetMarker.setTop(highlight);
    // 可选：添加跳动效果
    if (highlight) {
      targetMarker.setAnimation((window as any).BMAP_ANIMATION_BOUNCE);
    } else {
      targetMarker.setAnimation(null);
    }
  }
};

watch([activeView, isMobile], ([newView, mobile]) => {
  if (mobile && newView === '地图') {
    // 切换到地图视图时，确保地图正确渲染
    nextTick(() => {
      if (map) {
        // 重新获取中心点和缩放级别并设置，可以触发地图刷新
        const center = map.getCenter();
        const zoom = map.getZoom();
        map.centerAndZoom(center, zoom);
      }
    });
  }
});

onMounted(async () => {
  await initMap();
  await loadParkOptions();
  fetchData();
  checkIsMobile();
  window.addEventListener('resize', checkIsMobile);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkIsMobile);
});
</script>

<template>
  <div class="trajectory-page">
    <Card :bordered="false" :body-style="{ padding: '12px' }" class="page-card">
      <div class="header">
        <div class="header-left">
          <h2 class="header-title">全员考勤轨迹</h2>
          <Button type="primary" :loading="exportLoading" @click="handleExport">
            <template #icon><Icon icon="mdi:export" /></template>
            导出打卡记录
          </Button>
        </div>
        <div class="actions">
          <Input
            v-model:value="employeeName"
            allow-clear
            class="filter-input"
            placeholder="输入员工姓名"
            @press-enter="handleSearch"
          />
          <Select
            v-model:value="selectedParkId"
            :options="parkOptions"
            allow-clear
            class="filter-input"
            placeholder="选择园区"
            @change="handleSearch"
          />
          <RangePicker
            v-model:value="dateRange"
            :allow-clear="false"
            @change="handleDateChange"
          />
          <Button class="filter-button" @click="handleSearch">查询</Button>
          <Button class="filter-button" @click="handleResetFilters">
            重置
          </Button>
        </div>
      </div>
    </Card>

    <Segmented
      v-if="isMobile"
      v-model:value="activeView"
      :options="['地图', '列表']"
      block
      class="view-switcher"
    />

    <div class="main-content">
      <div v-show="!isMobile || activeView === '地图'" class="map-wrapper">
        <div ref="mapContainer" class="map-container"></div>
      </div>

      <div v-show="!isMobile || activeView === '列表'" class="list-wrapper">
        <Spin :spinning="loading">
          <List
            class="record-list"
            :grid="{ gutter: 16, xs: 1, sm: 1, md: 1, lg: 2, xl: 2, xxl: 3 }"
            :data-source="records"
            :pagination="false"
          >
            <template #renderItem="{ item }">
              <List.Item
                @mouseenter="highlightMarker(item, true)"
                @mouseleave="highlightMarker(item, false)"
              >
                <Card class="record-card" hoverable>
                  <template #title>
                    <div class="card-title">
                      <Icon icon="mdi:user" />
                      <span>{{ item.username }}</span>
                    </div>
                  </template>
                  <div class="card-content">
                    <div>
                      <Icon icon="mdi:calendar-clock" />
                      <span>{{ item.date }}</span>
                    </div>
                    <div>
                      <Icon icon="mdi:clock-in" />
                      <span>上班: {{ item.punchIn }}</span>
                    </div>
                    <div>
                      <Icon icon="mdi:clock-out" />
                      <span>下班: {{ item.punchOut }}</span>
                    </div>
                    <div>
                      <Icon icon="mdi:crosshairs-gps" />
                      <span>定位状态:</span>
                      <Tag :color="isLocationAbnormal(item) ? 'red' : 'green'">
                        {{ isLocationAbnormal(item) ? '异常' : '正常' }}
                      </Tag>
                    </div>
                    <div class="device-status-row">
                      <Icon icon="mdi:cellphone-check" />
                      <span class="device-status-label">设备状态:</span>
                      <Tag
                        class="device-status-tag"
                        :color="getDeviceStatusInfo(item).color"
                      >
                        {{ getDeviceStatusInfo(item).text }}
                      </Tag>
                    </div>
                    <div class="address-row">
                      <Icon icon="mdi:map-marker-radius" />
                      <span class="address-text">
                        地址: {{ getLocationAddressText(item) }}
                      </span>
                    </div>
                  </div>
                  <template #actions>
                    <Tooltip :title="getStatusInfo(item.status).text">
                      <Tag :color="getStatusInfo(item.status).color">
                        {{ getStatusInfo(item.status).text }}
                      </Tag>
                    </Tooltip>
                    <Tooltip title="工时">
                      <span>
                        <Icon icon="mdi:briefcase-clock" />
                        {{ item.workHours }}h
                      </span>
                    </Tooltip>
                  </template>
                </Card>
              </List.Item>
            </template>
          </List>
        </Spin>
        <Pagination
          v-if="pagination.total > pagination.pageSize"
          v-model:current="pagination.current"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          @change="handlePageChange"
          :simple="false"
          :show-size-changer="!isMobile"
          :size="isMobile ? 'small' : 'default'"
          :responsive="true"
          :show-less-items="true"
          :hide-on-single-page="true"
          class="list-pagination"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 移动端适配 */
@media (max-width: 768px) {
  .header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .header-left {
    justify-content: center;
  }

  .actions {
    justify-content: center;
  }

  .filter-input,
  .filter-button,
  .actions :deep(.ant-picker) {
    width: 100%;
  }

  .main-content {
    flex-direction: column;
    overflow: hidden auto;
  }

  .map-wrapper {
    flex-shrink: 0;
    height: 45vh;
    min-height: 300px;
  }

  .list-wrapper {
    flex-grow: 1;
    height: 100%;
    min-height: 300px;
  }

  .map-wrapper,
  .list-wrapper {
    width: 100%;
    min-width: 0;
  }

  .trajectory-page {
    gap: 8px;
    padding: 12px;
  }

  .header-title {
    font-size: 20px;
    text-align: center;
  }

  .view-switcher {
    width: 100%;
    margin: 0 0 4px;
  }
}

/* 平板适配 */
@media (min-width: 769px) and (max-width: 1024px) {
  .trajectory-page {
    padding: 16px;
  }

  .main-content {
    gap: 12px;
  }

  .map-wrapper {
    flex: 0 0 40%;
  }

  .list-wrapper {
    flex: 0 0 60%;
  }
}

@media (min-width: 1025px) {
  .map-wrapper {
    flex: 0 0 38%;
  }

  .list-wrapper {
    flex: 0 0 62%;
  }

  .list-pagination:deep(.ant-pagination) {
    flex-wrap: wrap;
    justify-content: center;
  }

  .list-pagination:deep(.ant-pagination-options) {
    display: flex;
    justify-content: center;
    order: 3;
    width: 100%;
    margin: 8px 0 0;
  }

  .list-pagination:deep(.ant-pagination-item) {
    min-width: 32px;
    height: 32px;
    line-height: 30px;
    border-radius: 16px;
  }

  .list-pagination:deep(.ant-pagination-item a) {
    padding: 0 8px;
    line-height: 30px;
  }

  .list-pagination:deep(.ant-pagination-prev .ant-pagination-item-link),
  .list-pagination:deep(.ant-pagination-next .ant-pagination-item-link) {
    min-width: 32px;
    height: 32px;
    line-height: 32px;
    border-radius: 16px;
  }
}

.trajectory-page {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  height: 100%;
  padding: 16px;
  overflow: hidden;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.view-switcher {
  align-items: center;
  width: 100%;
  margin: 0 0 8px;
  background: rgb(255 255 255 / 90%);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
}

.header {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
}

.header-left {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.filter-input {
  width: 220px;
}

.header-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  text-shadow: 0 2px 4px rgb(0 0 0 / 10%);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.main-content {
  display: flex;
  flex: 1;
  gap: 16px;
  min-height: 0;
  overflow-x: hidden;
  border-radius: 12px;
}

.map-wrapper {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  background: rgb(255 255 255 / 10%);
  backdrop-filter: blur(10px);
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 16px;
  box-shadow: 0 6px 18px rgb(0 0 0 / 10%);
}

.map-container {
  width: 100%;
  height: 100%;
  border-radius: 16px;
}

.list-wrapper {
  flex: 1;
  min-width: 0;
  overflow: hidden auto;
  overscroll-behavior-x: contain;
  background: rgb(255 255 255 / 95%);
  backdrop-filter: blur(20px);
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 16px;
  box-shadow: 0 6px 18px rgb(0 0 0 / 10%);
}

.record-list {
  height: 100%;
  overflow: hidden auto;
  touch-action: pan-y;
  scrollbar-color: rgb(0 0 0 / 20%) transparent;
  scrollbar-width: thin;
}

.record-list::-webkit-scrollbar {
  width: 6px;
}

.record-list::-webkit-scrollbar-track {
  background: transparent;
}

.record-list::-webkit-scrollbar-thumb {
  background: rgb(0 0 0 / 20%);
  border-radius: 3px;
}

.record-list::-webkit-scrollbar-thumb:hover {
  background: rgb(0 0 0 / 30%);
}

.record-list .ant-spin-nested-loading,
.record-list .ant-spin-container,
.record-list .ant-list {
  box-sizing: border-box;
  width: 100%;
}

.record-list .ant-spin-container {
  padding: 12px;
}

:deep(.ant-list-items) {
  margin: 0;
}

.record-card {
  box-sizing: border-box;
  width: 100%;
  overflow: hidden;
  background: rgb(255 255 255 / 90%);
  backdrop-filter: blur(10px);
  border: 1px solid rgb(255 255 255 / 30%);
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.record-card:hover {
  border-color: rgb(102 126 234 / 30%);
  box-shadow: 0 20px 60px rgb(0 0 0 / 20%);
  transform: translateY(-6px);
}

.card-title {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
}

.card-title .iconify {
  font-size: 18px;
  color: #667eea;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 14px;
  line-height: 1.5;
  color: #5a6c7d;
}

.card-content > div {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px 0;
}

.device-status-row {
  align-items: flex-start !important;
}

.device-status-label {
  flex-shrink: 0;
}

.device-status-tag {
  max-width: calc(100% - 84px);
  min-height: 22px;
  word-break: break-all;
  white-space: normal;
}

.address-row {
  align-items: flex-start !important;
}

.address-text {
  flex: 1;
  word-break: break-all;
}

.card-content .iconify {
  flex-shrink: 0;
  font-size: 16px;
  color: #8b9dc3;
}

:deep(.ant-card-actions) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgb(248 250 252 / 80%);
  border-top: 1px solid rgb(0 0 0 / 6%);
}

:deep(.ant-card-actions > li) {
  padding: 0;
  margin: 0;
}

:deep(.ant-card-actions .ant-tag) {
  padding: 4px 8px;
  margin: 0;
  font-weight: 500;
  border-radius: 6px;
}

/* 加载状态优化 */
:deep(.ant-spin-spinning) {
  background: rgb(255 255 255 / 90%);
  backdrop-filter: blur(4px);
}

/* 分页器样式优化 */
.list-pagination {
  padding-bottom: 10px;
  margin-top: 10px;
  text-align: center;
}

.list-pagination:deep(.ant-pagination) {
  justify-content: center;
}

.list-pagination:deep(.ant-pagination-item) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  background: #fff;
  border: 1px solid transparent;
  border-radius: 13px;
}

.list-pagination:deep(.ant-pagination-item a) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0;
}

.list-pagination:deep(.ant-pagination-item-active) {
  color: #1677ff;
  border-color: #1677ff;
}

.list-pagination:deep(.ant-pagination-item-active a) {
  color: #1677ff;
}

.list-pagination:deep(.ant-pagination-prev .ant-pagination-item-link),
.list-pagination:deep(.ant-pagination-next .ant-pagination-item-link) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  border-radius: 13px;
}

.list-pagination:deep(.ant-pagination-jump-prev),
.list-pagination:deep(.ant-pagination-jump-next) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  border-radius: 13px;
}

.list-pagination:deep(.ant-pagination-jump-prev .ant-pagination-item-link),
.list-pagination:deep(.ant-pagination-jump-next .ant-pagination-item-link),
.list-pagination:deep(.ant-pagination-item-ellipsis) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

/* 按钮样式优化 */
:deep(.ant-btn-primary) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgb(102 126 234 / 40%);
  transition: all 0.3s ease;
}

:deep(.ant-btn-primary:hover) {
  box-shadow: 0 8px 25px rgb(102 126 234 / 60%);
  transform: translateY(-2px);
}

/* 日期选择器样式优化 */
:deep(.ant-picker) {
  background: rgb(255 255 255 / 90%);
  backdrop-filter: blur(10px);
  border: 1px solid rgb(0 0 0 / 10%);
  border-radius: 8px;
}

/* 标签样式优化 */
:deep(.ant-tag) {
  font-weight: 500;
  border: none;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
}
</style>
