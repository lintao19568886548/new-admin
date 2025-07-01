<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';

import { Icon } from '@iconify/vue';
import {
  Button,
  Card,
  List,
  message,
  RangePicker,
  Segmented,
  Spin,
  Tag,
  Tooltip,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { exportTrajectoryData, getTrajectoryList } from '#/api/hrm/trajectory';
import { BAIDU_MAP_AK } from '#/config';
import { loadBaiduMapScript } from '#/utils/map';

// ================================= 类型定义 =================================
interface TrajectoryRecord {
  date: string;
  key: number;
  latitude: number;
  longitude: number;
  punchIn: string;
  punchOut: string;
  status: number;
  username: string;
  workHours: number;
}

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

// ================================= 响应式数据 =================================
const loading = ref(true);
const exportLoading = ref(false);
const records = ref<TrajectoryRecord[]>([]);
const dateRange = ref<[dayjs.Dayjs, dayjs.Dayjs]>([
  dayjs().subtract(7, 'days'),
  dayjs(),
]);
const pagination = reactive({
  current: 1,
  pageSize: 12,
  pageSizeOptions: ['12', '24', '48'],
  showSizeChanger: true,
  total: 0,
});

const mapContainer = ref<HTMLDivElement | null>(null);
let map: any = null;
const markers: any[] = [];
const activeView = ref('地图');
const isMobile = ref(false);

const checkIsMobile = () => {
  isMobile.value = window.innerWidth <= 768;
};

// ================================= 方法 =================================
const fetchData = async () => {
  loading.value = true;
  try {
    const params = {
      endDate: dateRange.value[1].format('YYYY-MM-DD'),
      page: pagination.current,
      pageSize: pagination.pageSize,
      startDate: dateRange.value[0].format('YYYY-MM-DD'),
    };
    const { total, items } = await getTrajectoryList(params);
    records.value = items;
    pagination.total = total;
    await nextTick();
    updateMapMarkers();
  } catch (error: any) {
    message.error(`加载数据失败: ${error.message}`);
  } finally {
    loading.value = false;
  }
};

const initMap = async () => {
  try {
    await loadBaiduMapScript(BAIDU_MAP_AK);
  } catch (error) {
    console.error('Baidu Map script failed to load:', error);
    message.error('地图脚本加载失败，请刷新页面重试');
    return;
  }
  if (!mapContainer.value) return;
  const BMap = (window as any).BMap;
  map = new BMap.Map(mapContainer.value);
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
    const point = new BMap.Point(record.longitude, record.latitude);
    points.push(point);
    const marker = new BMap.Marker(point);
    map.addOverlay(marker);
    markers.push(marker);

    const infoContent = `
      <div style="font-size: 12px; line-height: 1.5;">
        <p style="margin: 0;"><b>用户:</b> ${record.username}</p>
        <p style="margin: 0;"><b>时间:</b> ${record.date} ${record.punchIn}</p>
      </div>`;
    const infoWindow = new BMap.InfoWindow(infoContent);
    marker.addEventListener('click', () => {
      map.openInfoWindow(infoWindow, point);
    });
  });

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

const handleExport = async () => {
  exportLoading.value = true;
  try {
    const params = {
      endDate: dateRange.value[1].format('YYYY-MM-DD'),
      startDate: dateRange.value[0].format('YYYY-MM-DD'),
    };
    const dataToExport = await exportTrajectoryData(params);

    if (!dataToExport || dataToExport.length === 0) {
      message.warning('没有可导出的数据');
      return;
    }

    // 转换为CSV
    const headers = [
      '用户名',
      '日期',
      '上班打卡',
      '下班打卡',
      '状态',
      '工时(h)',
      '纬度',
      '经度',
    ];
    const statusMap = {
      0: '正常',
      1: '迟到',
      2: '早退',
      3: '迟到+早退',
    };
    const rows = dataToExport.map(
      (row: {
        date: any;
        latitude: any;
        longitude: any;
        punchIn: any;
        punchOut: any;
        status: number;
        username: any;
        workHours: any;
      }) => [
        row.username,
        row.date,
        row.punchIn,
        row.punchOut,
        statusMap[row.status as keyof typeof statusMap] || '未知',
        row.workHours,
        row.latitude,
        row.longitude,
      ],
    );

    const csvContent = `data:text/csv;charset=utf-8,\uFEFF${[
      headers.join(','),
      ...rows.map((e: any[]) => e.join(',')),
    ].join('\n')}`;

    // 下载CSV文件
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute(
      'download',
      `考勤轨迹_${params.startDate}_${params.endDate}.csv`,
    );
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

const highlightMarker = (record: TrajectoryRecord, highlight: boolean) => {
  const targetMarker = markers.find((m) => {
    const pos = m.getPosition();
    return pos.lng === record.longitude && pos.lat === record.latitude;
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
    <Card :bordered="false">
      <div class="header">
        <div class="header-left">
          <h2 class="header-title">全员考勤轨迹</h2>
          <Button type="primary" :loading="exportLoading" @click="handleExport">
            <template #icon><Icon icon="mdi:export" /></template>
            导出打卡记录
          </Button>
        </div>
        <div class="actions">
          <RangePicker
            v-model:value="dateRange"
            :allow-clear="false"
            @change="handleDateChange"
          />
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
            :pagination="{ ...pagination, onChange: handlePageChange }"
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
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 移动端适配 */
@media (max-width: 768px) {
  .header {
    justify-content: center;
  }

  .main-content {
    flex-direction: column;
    overflow: hidden;
  }

  .map-wrapper {
    flex-shrink: 0;
    height: 45vh;
  }

  .list-wrapper {
    flex-grow: 1;
    height: 100%;
  }
}

.trajectory-page {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100vw;
  height: 85vh;
  padding: 8px;
  overflow: hidden; /* 禁止最外层滚动 */
}

.view-switcher {
  align-items: center;
  margin: 0 4px;
}

.header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.header-title {
  margin: 0;
  font-size: 18px;
}

.main-content {
  display: flex;
  flex: 1;
  gap: 8px;
  min-height: 0; /*  flexbox 布局中的重要技巧 */
}

.map-wrapper {
  flex: 1;
  min-width: 300px;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 2px 8px #00000026;
}

.map-container {
  width: 100%;
  height: 100%;
}

.list-wrapper {
  flex: 1;
  min-width: 300px;
  overflow: hidden auto; /* 禁止水平滚动 */ /* 让列表内部滚动 */
}

.record-list .ant-spin-container {
  padding: 8px;
}

.record-card {
  border-radius: 6px;
  transition:
    box-shadow 0.3s,
    transform 0.3s;
}

.record-card:hover {
  box-shadow: 0 4px 12px #00000026;
  transform: translateY(-4px);
}

.card-title {
  display: flex;
  gap: 8px;
  align-items: center;
  font-weight: 100;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #666;
}

.card-content > div {
  display: flex;
  gap: 6px;
  align-items: center;
}

:deep(.ant-card-actions) {
  display: flex;
  justify-content: space-between;
  padding: 0 12px;
}
</style>
