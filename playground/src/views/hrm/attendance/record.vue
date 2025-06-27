<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';

import { useUserStore } from '@vben/stores';

import {
  Button,
  Card,
  Col,
  message,
  RangePicker,
  Row,
  Spin,
  Statistic,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { getAttendanceList, getMonthStats } from '#/api/hrm/attendance';

// ================================= 类型定义 =================================
interface MonthStats {
  attendanceDays: number;
  earlyLeaveDays: number;
  lateDays: number;
  leaveDays: number;
  overtimeHours: number;
  requiredAttendanceDays: number;
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

// ================================= 响应式数据 =================================
const listLoading = ref(false);
const dateRange = ref<[dayjs.Dayjs, dayjs.Dayjs]>([
  dayjs().startOf('month'),
  dayjs().endOf('month'),
]);

// Pinia Store
const userStore = useUserStore();
const userInfo = userStore.userInfo;

// 月度统计
const monthStats = reactive<MonthStats>({
  attendanceDays: 0,
  earlyLeaveDays: 0,
  lateDays: 0,
  leaveDays: 0,
  overtimeHours: 0,
  requiredAttendanceDays: 0,
});

// 考勤记录
const attendanceRecords = ref<AttendanceRecord[]>([]);

// 分页配置
const pagination = reactive({
  current: 1,
  pageSize: 15,
  total: 0,
});

const allDataLoaded = computed(() => {
  return (
    attendanceRecords.value.length >= pagination.total && pagination.total > 0
  );
});

const getStatusInfo = (status: null | number) => {
  if (
    status === null ||
    !Object.prototype.hasOwnProperty.call(attendanceStatusMeta, status)
  ) {
    return attendanceStatusMeta[AttendanceStatus.Absent];
  }
  return attendanceStatusMeta[status as keyof typeof attendanceStatusMeta];
};

const isLate = (status: number) => {
  return (
    status === AttendanceStatus.Late ||
    status === AttendanceStatus.LateAndEarlyLeave
  );
};

const isEarlyLeave = (status: number) => {
  return (
    status === AttendanceStatus.EarlyLeave ||
    status === AttendanceStatus.LateAndEarlyLeave
  );
};

/**
 * 计算给定月份的应出勤天数（排除周日）
 * @param month - dayjs object for the month
 */
const calculateRequiredAttendanceDays = (month: dayjs.Dayjs) => {
  const daysInMonth = month.daysInMonth();
  let requiredDays = 0;
  for (let i = 1; i <= daysInMonth; i++) {
    const currentDate = month.date(i);
    // 0 = Sunday
    if (currentDate.day() !== 0) {
      requiredDays++;
    }
  }
  return requiredDays;
};

const formatWeekday = (dateStr: string) => {
  const weekDays = [
    '星期日',
    '星期一',
    '星期二',
    '星期三',
    '星期四',
    '星期五',
    '星期六',
  ];
  return weekDays[dayjs(dateStr).day()];
};

// 加载考勤记录
const loadAttendanceRecords = async (isLoadMore = false) => {
  if (!userInfo?.realName) return;

  if (!isLoadMore) {
    pagination.current = 1;
    attendanceRecords.value = [];
  }

  listLoading.value = true;

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
      username: userInfo.realName,
    };
    const { total, items } = await getAttendanceList(params);

    attendanceRecords.value = [...attendanceRecords.value, ...items];
    pagination.total = total;
  } catch (error: any) {
    console.error('加载考勤记录失败:', error);
    message.error(`加载考勤记录失败: ${error.message || '未知错误'}`);
  } finally {
    listLoading.value = false;
  }
};

const handleLoadMore = () => {
  pagination.current++;
  loadAttendanceRecords(true);
};

// 加载月度统计
const loadMonthStats = async () => {
  if (!userInfo?.realName) return;
  try {
    const stats = await getMonthStats({ username: userInfo.realName });
    Object.assign(monthStats, stats);
    // 在获取到后端数据后，用本地计算覆盖应出勤天数
    monthStats.requiredAttendanceDays =
      calculateRequiredAttendanceDays(dayjs());
  } catch (error: any) {
    console.error('加载月度统计失败:', error);
    message.error(`加载月度统计失败: ${error.message || '未知错误'}`);
  }
};

// 监听 username 的变化
watch(
  () => userInfo?.realName,
  (newUsername) => {
    if (newUsername) {
      loadAttendanceRecords();
      loadMonthStats();
    }
  },
  { immediate: true },
);

watch(dateRange, (newRange) => {
  loadAttendanceRecords();
  // 当日期范围变化时，重新计算第一个日期的月份的应出勤天数
  if (newRange && newRange[0]) {
    monthStats.requiredAttendanceDays = calculateRequiredAttendanceDays(
      newRange[0],
    );
  }
});
</script>

<template>
  <div class="attendance-record-page">
    <!-- 考勤统计 -->
    <div class="statistics-section">
      <h3>本月考勤统计</h3>
      <Row :gutter="[16, 16]">
        <Col :xs="12" :sm="12" :md="6">
          <Card class="stat-card">
            <Statistic
              title="应出勤天数"
              :value="monthStats.requiredAttendanceDays"
              suffix="天"
            />
          </Card>
        </Col>
        <Col :xs="12" :sm="12" :md="6">
          <Card class="stat-card">
            <Statistic
              title="实出勤天数"
              :value="monthStats.attendanceDays"
              suffix="天"
            />
          </Card>
        </Col>
        <Col v-if="monthStats.leaveDays > 0" :xs="12" :sm="12" :md="6">
          <Card class="stat-card">
            <Statistic
              title="请假天数"
              :value="monthStats.leaveDays"
              suffix="天"
            />
          </Card>
        </Col>
        <Col v-if="monthStats.lateDays > 0" :xs="12" :sm="12" :md="6">
          <Card class="stat-card">
            <Statistic
              title="迟到次数"
              :value="monthStats.lateDays"
              suffix="次"
            />
          </Card>
        </Col>
        <Col v-if="monthStats.earlyLeaveDays > 0" :xs="12" :sm="12" :md="6">
          <Card class="stat-card">
            <Statistic
              title="早退次数"
              :value="monthStats.earlyLeaveDays"
              suffix="次"
            />
          </Card>
        </Col>
        <Col v-if="monthStats.overtimeHours > 0" :xs="12" :sm="12" :md="6">
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
        <RangePicker v-model:value="dateRange" :input-read-only="true" />
      </div>

      <div class="record-list">
        <div
          v-if="listLoading && attendanceRecords.length === 0"
          class="loading-spinner"
        >
          <Spin />
        </div>
        <div
          v-for="record in attendanceRecords"
          :key="record.id"
          class="record-card"
        >
          <div class="card-header">
            <div class="date-info">
              <span class="date">{{ record.date }}</span>
              <span class="weekday">{{ formatWeekday(record.date) }}</span>
            </div>
            <Tag :color="getStatusInfo(record.status).color">
              {{ getStatusInfo(record.status).text }}
            </Tag>
          </div>
          <div class="card-body">
            <div class="punch-item">
              <span class="punch-label">上班</span>
              <span class="punch-time">
                {{ record.punchIn || '--:--:--' }}
              </span>
              <Tag v-if="isLate(record.status)" color="red" :bordered="false">
                迟到
              </Tag>
            </div>
            <div class="punch-item">
              <span class="punch-label">下班</span>
              <span class="punch-time">
                {{ record.punchOut || '--:--:--' }}
              </span>
              <Tag
                v-if="isEarlyLeave(record.status)"
                color="orange"
                :bordered="false"
              >
                早退
              </Tag>
            </div>
          </div>
          <div v-if="record.workHours > 0" class="card-footer">
            <span>工作时长 {{ record.workHours.toFixed(2) }} 小时</span>
          </div>
        </div>
        <div
          v-if="!listLoading && attendanceRecords.length === 0"
          class="empty-state"
        >
          <p>暂无记录</p>
        </div>
        <div class="load-more-container">
          <Button
            v-if="!allDataLoaded && attendanceRecords.length > 0"
            :loading="listLoading"
            block
            @click="handleLoadMore"
          >
            加载更多
          </Button>
          <p v-if="allDataLoaded" class="no-more-data">没有更多了</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.attendance-record-page {
  min-height: 100vh;
  padding: 16px;
  background-color: #f5f5f5;
}

/* Statistics section */
.statistics-section {
  padding: 16px;
  margin-bottom: 16px;
  background: white;
  border-radius: 8px;
}

.statistics-section h3 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
}

.stat-card {
  border: none;
  box-shadow: none;
}

:deep(.ant-statistic-title) {
  font-size: 12px;
  color: #64748b;
}

:deep(.ant-statistic-content) {
  font-size: 20px;
  font-weight: 600;
}

:deep(.stat-card .ant-card-body) {
  padding: 12px;
}

/* Records section */
.records-section {
  padding: 16px;
  background: white;
  border-radius: 8px;
}

.section-header {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

/* Record List */
.record-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Record Card */
.record-card {
  padding: 16px;
  background-color: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  transition: box-shadow 0.3s;
}

.record-card:hover {
  box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.date-info {
  display: flex;
  gap: 8px;
  align-items: center;
}

.date-info .date {
  font-size: 16px;
  font-weight: 600;
}

.date-info .weekday {
  font-size: 14px;
  color: #64748b;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.punch-item {
  display: flex;
  align-items: center;
}

.punch-label {
  width: 40px;
  font-size: 14px;
  color: #64748b;
}

.punch-time {
  flex-grow: 1;
  font-family: 'Courier New', Courier, monospace;
  font-size: 16px;
  font-weight: 600;
}

.card-footer {
  padding-top: 12px;
  margin-top: 12px;
  font-size: 12px;
  color: #64748b;
  text-align: right;
  border-top: 1px solid #f0f0f0;
}

/* Loading and Empty States */
.loading-spinner,
.empty-state {
  padding: 40px 0;
  color: #999;
  text-align: center;
}

.load-more-container {
  margin-top: 16px;
  text-align: center;
}

.no-more-data {
  padding: 16px 0;
  font-size: 12px;
  color: #999;
}
</style>
