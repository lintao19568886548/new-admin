<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from 'vue';

import { useUserStore } from '@vben/stores';

// 需要先安装 @iconify/vue 依赖
// npm install @iconify/vue
// 或
// yarn add @iconify/vue
import { Icon } from '@iconify/vue';
import {
  Button,
  Card,
  Col,
  message,
  RangePicker,
  Row,
  Statistic,
  Table,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  getAttendanceList,
  getMonthStats,
  getTodayRecord,
  punchIn,
  punchOut,
} from '#/api/hrm/attendance';
import { officeLocation } from '#/config';

// ================================= 类型定义 =================================
interface TodayRecord {
  attendanceId: null | number;
  punchIn: string;
  punchOut: string;
  status: null | number;
  workHours: number;
}

interface MonthStats {
  attendanceDays: number;
  earlyLeaveDays: number;
  lateDays: number;
  overtimeHours: number;
}

interface AttendanceRecord {
  date: string;
  id: number;
  punchIn: string;
  punchOut: string;
  status: number;
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
  [AttendanceStatus.Absent]: { color: 'red', text: '缺勤' },
  [AttendanceStatus.EarlyLeave]: { color: 'orange', text: '早退' },
  [AttendanceStatus.Late]: { color: 'red', text: '迟到' },
  [AttendanceStatus.LateAndEarlyLeave]: { color: 'red', text: '迟到+早退' },
  [AttendanceStatus.Normal]: { color: 'green', text: '正常' },
};

// ================================= 响应式数据 =================================
const currentLocation = ref('');
const latitude = ref(0);
const longitude = ref(0);
const isInRange = ref(false);
const locationLoading = ref(false);
const punchLoading = ref(false);
const tableLoading = ref(false);
const dateRange = ref<[dayjs.Dayjs, dayjs.Dayjs]>([
  dayjs().startOf('month'),
  dayjs().endOf('month'),
]);

// Pinia Store
const userStore = useUserStore();
const userInfo = userStore.userInfo;

// 今日打卡记录
const todayRecord = ref<null | TodayRecord>(null);

// 月度统计
const monthStats = reactive<MonthStats>({
  attendanceDays: 0,
  earlyLeaveDays: 0,
  lateDays: 0,
  overtimeHours: 0,
});

// 考勤记录
const attendanceRecords = ref<AttendanceRecord[]>([]);

// 分页配置
const pagination = reactive({
  current: 1,
  pageSize: 10,
  showQuickJumper: true,
  showSizeChanger: true,
  total: 0,
});

// 表格列配置
const columns = [
  {
    dataIndex: 'date',
    key: 'date',
    title: '日期',
    width: 120,
  },
  {
    dataIndex: 'punchIn',
    key: 'punchIn',
    title: '上班时间',
    width: 120,
  },
  {
    dataIndex: 'punchOut',
    key: 'punchOut',
    title: '下班时间',
    width: 120,
  },
  {
    dataIndex: 'workHours',
    key: 'workHours',
    title: '工作时长',
    width: 100,
  },
  {
    dataIndex: 'status',
    key: 'status',
    title: '状态',
    width: 100,
  },
  {
    key: 'action',
    title: '操作',
    width: 80,
  },
];

// 计算属性
const currentDate = computed(() => dayjs().format('YYYY年MM月DD日'));
const currentWeekDay = computed(() => {
  const weekDays = [
    '星期日',
    '星期一',
    '星期二',
    '星期三',
    '星期四',
    '星期五',
    '星期六',
  ];
  return weekDays[dayjs().day()];
});

// 地图相关
let map: any = null;
const currentMarker = ref<any>(null);
const officeCircle = ref<any>(null);

// 生命周期
onMounted(async () => {
  await initMap();
  getCurrentLocation();
  // 不再在这里直接加载数据，而是通过 watch(username) 触发
  // loadTodayRecord();
  // loadAttendanceRecords();
  // loadMonthStats();
});

onUnmounted(() => {
  if (map) {
    map = null;
  }
});

// 初始化地图
const initMap = async () => {
  await nextTick();
  if (!document.querySelector('#map-container')) return;

  const BMap = (window as any).BMap;
  map = new BMap.Map('map-container');
  const officePoint = new BMap.Point(officeLocation.lng, officeLocation.lat);
  map.centerAndZoom(officePoint, 15);

  officeCircle.value = new BMap.Circle(officePoint, officeLocation.radius, {
    fillColor: '#1890ff',
    fillOpacity: 0.2,
    strokeColor: '#1890ff',
    strokeWeight: 1,
  });
  map.addOverlay(officeCircle.value);
};

// 获取当前位置
const getCurrentLocation = () => {
  locationLoading.value = true;
  currentLocation.value = '获取位置中...';

  const BMap = (window as any).BMap;
  const geolocation = new BMap.Geolocation();
  geolocation.getCurrentPosition(
    (result: any) => {
      try {
        if (geolocation.getStatus() === (window as any).BMAP_STATUS_SUCCESS) {
          latitude.value = result.point.lat;
          longitude.value = result.point.lng;

          const geoc = new BMap.Geocoder();
          geoc.getLocation(result.point, (rs: any) => {
            const addComp = rs.addressComponents;
            currentLocation.value = `${addComp.province}, ${addComp.city}, ${addComp.district}, ${addComp.street}, ${addComp.streetNumber}`;
          });

          console.warn('百度地图定位成功:', result);

          const distance = map.getDistance(
            new BMap.Point(officeLocation.lng, officeLocation.lat),
            result.point,
          );

          console.warn(`与办公室的距离: ${distance.toFixed(2)} 米`);

          isInRange.value = distance <= officeLocation.radius;
          console.warn(`是否在打卡范围内 (isInRange): ${isInRange.value}`);

          updateMapMarkers(result.point);
        } else {
          console.error('百度地图定位失败:', result);
          message.error('获取位置失败，请检查浏览器权限或网络');
          currentLocation.value = '获取位置失败，请检查权限或网络';
        }
      } catch (error: any) {
        console.error('处理定位结果时出错:', error);
        message.error(`处理定位结果时出错: ${error.message}`);
        currentLocation.value = '处理定位结果时出错';
      } finally {
        locationLoading.value = false;
      }
    },
    { enableHighAccuracy: true },
  );
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
  map.setCenter(point);
};

// 刷新位置
const refreshLocation = () => {
  getCurrentLocation();
};

// 居中地图
const centerMap = () => {
  getCurrentLocation();
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
      username: userInfo?.username || '',
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

  punchLoading.value = true;

  try {
    await punchOut(todayRecord.value.attendanceId, {
      latitude: latitude.value,
      longitude: longitude.value,
      punchTime: dayjs().toISOString(),
      username: userInfo?.username || '',
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
  if (!userInfo?.username) return; // 如果没有 username，则不执行
  try {
    const data = await getTodayRecord({ username: userInfo.username });
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

// 加载考勤记录
const loadAttendanceRecords = async () => {
  if (!userInfo?.username) return; // 如果没有 username，则不执行
  tableLoading.value = true;

  try {
    const params = {
      endDate:
        dateRange.value[1]?.format('YYYY-MM-DD') ||
        dayjs().endOf('month').format('YYYY-MM-DD'),
      page: pagination.current,
      pageSize: pagination.pageSize,
      startDate:
        dateRange.value[0]?.format('YYYY-MM-DD') ||
        dayjs().startOf('month').format('YYYY-MM-DD'),
      username: userInfo.username,
    };
    const { total, items } = await getAttendanceList(params);

    attendanceRecords.value = items;
    pagination.total = total;
  } catch (error: any) {
    console.error('加载考勤记录失败:', error);
    message.error(`加载考勤记录失败: ${error.message || '未知错误'}`);
  } finally {
    tableLoading.value = false;
  }
};

// 处理表格变化
const handleTableChange = (pag: any) => {
  pagination.current = pag.current;
  pagination.pageSize = pag.pageSize;
  loadAttendanceRecords();
};

// 查看详情
const viewDetail = (record: any) => {
  message.info(`查看 ${record.date} 的考勤详情`);
};

// 加载月度统计
const loadMonthStats = async () => {
  if (!userInfo?.username) return; // 如果没有 username，则不执行
  try {
    const stats = await getMonthStats({ username: userInfo.username });
    Object.assign(monthStats, stats);
  } catch (error: any) {
    console.error('加载月度统计失败:', error);
    message.error(`加载月度统计失败: ${error.message || '未知错误'}`);
  }
};

// 监听 username 的变化，一旦获取到有效的 username，就加载所有相关数据
watch(
  () => userInfo?.username,
  (newUsername) => {
    if (newUsername) {
      loadTodayRecord();
      loadAttendanceRecords();
      loadMonthStats();
    }
  },
  { immediate: true }, // 立即执行一次，以处理 username 已存在的情况
);
</script>

<template>
  <div class="attendance-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2>考勤打卡</h2>
      <div class="date-info">
        <span>{{ currentDate }}</span>
        <span class="week-day">{{ currentWeekDay }}</span>
      </div>
    </div>

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

      <div class="punch-buttons">
        <Button
          type="primary"
          size="large"
          class="punch-btn punch-in"
          :disabled="!isInRange"
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

    <!-- 地图显示 -->
    <div class="map-section">
      <div class="map-header">
        <h3>打卡位置</h3>
        <Button size="small" @click="centerMap">定位到我</Button>
      </div>
      <div id="map-container" class="map-container"></div>
      <div class="map-legend">
        <!-- <div class="legend-item">
          <div class="legend-color office"></div>
          <span>办公区域</span>
        </div> -->
        <!-- <div class="legend-item">
          <div class="legend-color current"></div>
          <span>当前位置</span>
        </div> -->
      </div>
    </div>

    <!-- 考勤统计 -->
    <div class="statistics-section">
      <h3>本月考勤统计</h3>
      <Row :gutter="16">
        <Col :span="6">
          <Card class="stat-card">
            <Statistic
              title="出勤天数"
              :value="monthStats.attendanceDays"
              suffix="天"
            />
          </Card>
        </Col>
        <Col :span="6">
          <Card class="stat-card">
            <Statistic
              title="迟到次数"
              :value="monthStats.lateDays"
              suffix="次"
            />
          </Card>
        </Col>
        <Col :span="6">
          <Card class="stat-card">
            <Statistic
              title="早退次数"
              :value="monthStats.earlyLeaveDays"
              suffix="次"
            />
          </Card>
        </Col>
        <Col :span="6">
          <Card class="stat-card">
            <Statistic
              title="加班时长"
              :value="monthStats.overtimeHours"
              suffix="小时"
            />
          </Card>
        </Col>
      </Row>
    </div>

    <!-- 考勤记录列表 -->
    <div class="records-section">
      <div class="section-header">
        <h3>考勤记录</h3>
        <RangePicker
          v-model:value="dateRange"
          @change="loadAttendanceRecords"
        />
      </div>

      <Table
        :columns="columns"
        :data-source="attendanceRecords"
        :loading="tableLoading"
        :pagination="pagination"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <Tag :color="getStatusInfo(record.status).color">
              {{ getStatusInfo(record.status).text }}
            </Tag>
          </template>
          <template v-if="column.key === 'action'">
            <Button type="link" size="small" @click="viewDetail(record)">
              详情
            </Button>
          </template>
        </template>
      </Table>
    </div>
  </div>
</template>

<style scoped>
.attendance-page {
  min-height: 100vh;
  padding: 24px;
  background: #f5f5f5;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  margin-bottom: 24px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
}

.page-header h2 {
  margin: 0;
  color: #1890ff;
}

.date-info {
  text-align: right;
}

.date-info span {
  display: block;
  font-size: 16px;
  color: #333;
}

.week-day {
  font-size: 14px !important;
  color: #666 !important;
}

.punch-card-section {
  padding: 24px;
  margin-bottom: 24px;
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

.map-section {
  padding: 24px;
  margin-bottom: 24px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
}

.map-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.map-header h3 {
  margin: 0;
  color: #333;
}

.map-container {
  margin-bottom: 12px;
  overflow: hidden;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
}

.map-legend {
  display: flex;
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
  background: #52c41a;
}

.statistics-section {
  padding: 24px;
  margin-bottom: 24px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
}

.statistics-section h3 {
  margin: 0 0 16px;
  color: #333;
}

.stat-card {
  text-align: center;
}

.records-section {
  padding: 24px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  color: #333;
}

@media (max-width: 768px) {
  .attendance-page {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }

  .punch-buttons {
    flex-direction: column;
    align-items: center;
  }

  .punch-btn {
    width: 100%;
    max-width: 200px;
  }

  .section-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
}
</style>
