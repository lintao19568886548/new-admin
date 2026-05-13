<script setup lang="ts">
import type {
  AttendanceLeaveScope,
  AttendanceListItem,
  MonthAttendanceStats,
} from '#/api/hrm/attendance';

import { computed, reactive, ref, watch } from 'vue';

import { useUserStore } from '@vben/stores';

import { Button, message, Spin, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';

import { getAttendanceList, getMonthStats } from '#/api/hrm/attendance';
import MobileDateRange from '#/components/MobileDateRange.vue';

// ================================= 类型定义 =================================
interface MonthStats extends MonthAttendanceStats {
  requiredAttendanceDays: number;
}

type AttendanceRecord = AttendanceListItem;

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

const deviceStatusMeta: Record<
  'abnormal' | 'normal',
  { color: string; text: string }
> = {
  abnormal: { color: 'red', text: '设备异常' },
  normal: { color: 'green', text: '考勤设备正常' },
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

const getLeaveScopeInfo = (leaveScope: AttendanceLeaveScope) => {
  if (leaveScope === 'none') {
    return null;
  }
  return leaveScopeMeta[leaveScope];
};

const getDeviceStatusInfo = (
  record?: Pick<AttendanceListItem, 'deviceAbnormalTypes' | 'deviceStatus'>,
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
  abnormalTypes?: AttendanceListItem['deviceAbnormalTypes'],
) => {
  const names = [...new Set(abnormalTypes ?? [])]
    .map((type) => {
      if (type === 'device_changed') {
        return '更换设备打卡';
      }
      if (type === 'same_device_multi_account') {
        return '同设备多账号';
      }
      if (type === 'device_credential_mismatch') {
        return '设备凭证异常';
      }
      return '设备异常';
    })
    .filter(Boolean);
  return names.length > 0 ? names.join('、') : '';
};

const formatToLocalTime = (dateStr: string, timeStr: string) => {
  if (!timeStr || timeStr.includes('--')) {
    return '--:--:--';
  }
  // Assume the server provides a date (e.g., '2023-11-20') and a time (e.g., '11:00:00')
  // in the user's local timezone. We combine them to ensure correct parsing.
  const localDateTime = dayjs(`${dateStr} ${timeStr}`);
  // Return original time string if parsing fails
  return localDateTime.isValid() ? localDateTime.format('HH:mm:ss') : timeStr;
};

const isLate = (status: null | number) => {
  return (
    status === AttendanceStatus.Late ||
    status === AttendanceStatus.LateAndEarlyLeave
  );
};

const isEarlyLeave = (status: null | number) => {
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
  <div class="min-h-screen bg-[#f5f5f5] p-4">
    <div class="mb-4 rounded-lg bg-white p-4">
      <h3 class="mb-4 text-base font-semibold">本月考勤统计</h3>
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <div class="rounded-lg border border-[#f0f0f0] bg-white p-3">
          <div class="text-xs text-[#64748b]">应出勤天数</div>
          <div class="mt-2 flex items-end gap-1">
            <span class="text-2xl font-semibold leading-none text-[#0f172a]">
              {{ monthStats.requiredAttendanceDays }}
            </span>
            <span class="pb-0.5 text-xs text-[#64748b]">天</span>
          </div>
        </div>
        <div class="rounded-lg border border-[#f0f0f0] bg-white p-3">
          <div class="text-xs text-[#64748b]">实出勤天数</div>
          <div class="mt-2 flex items-end gap-1">
            <span class="text-2xl font-semibold leading-none text-[#0f172a]">
              {{ monthStats.attendanceDays }}
            </span>
            <span class="pb-0.5 text-xs text-[#64748b]">天</span>
          </div>
        </div>
        <div
          v-if="monthStats.leaveDays > 0"
          class="rounded-lg border border-[#a5f3fc] bg-[#ecfeff] p-3"
        >
          <div class="text-xs text-[#0f766e]">请假天数</div>
          <div class="mt-2 flex items-end gap-1">
            <span class="text-2xl font-semibold leading-none text-[#164e63]">
              {{ monthStats.leaveDays }}
            </span>
            <span class="pb-0.5 text-xs text-[#0f766e]">天</span>
          </div>
        </div>
        <div
          v-if="monthStats.lateDays > 0"
          class="rounded-lg border border-[#fecdd3] bg-[#fff1f2] p-3"
        >
          <div class="text-xs text-[#be123c]">迟到次数</div>
          <div class="mt-2 flex items-end gap-1">
            <span class="text-2xl font-semibold leading-none text-[#881337]">
              {{ monthStats.lateDays }}
            </span>
            <span class="pb-0.5 text-xs text-[#be123c]">次</span>
          </div>
        </div>
        <div
          v-if="monthStats.earlyLeaveDays > 0"
          class="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3"
        >
          <div class="text-xs text-[#b45309]">早退次数</div>
          <div class="mt-2 flex items-end gap-1">
            <span class="text-2xl font-semibold leading-none text-[#92400e]">
              {{ monthStats.earlyLeaveDays }}
            </span>
            <span class="pb-0.5 text-xs text-[#b45309]">次</span>
          </div>
        </div>
        <div
          v-if="monthStats.overtimeHours > 0"
          class="rounded-lg border border-[#ddd6fe] bg-[#f5f3ff] p-3"
        >
          <div class="text-xs text-[#6d28d9]">加班时长</div>
          <div class="mt-2 flex items-end gap-1">
            <span class="text-2xl font-semibold leading-none text-[#4c1d95]">
              {{ monthStats.overtimeHours }}
            </span>
            <span class="pb-0.5 text-xs text-[#6d28d9]">小时</span>
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-lg bg-white p-4">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h3 class="text-base font-semibold">考勤记录</h3>
        <MobileDateRange
          v-model:value="dateRange"
          class="w-full min-w-0 max-[480px]:gap-[6px] sm:w-auto sm:min-w-[320px] [&_.picker]:min-w-0 max-[480px]:[&_.range-separator]:text-xs"
        />
      </div>

      <div class="flex flex-col gap-3">
        <div
          v-if="listLoading && attendanceRecords.length === 0"
          class="py-10 text-center text-[#999]"
        >
          <Spin />
        </div>
        <div
          v-for="record in attendanceRecords"
          :key="record.id"
          class="rounded-lg border border-[#f0f0f0] bg-white p-4 transition-shadow duration-300 hover:shadow-[0_4px_12px_rgb(0_0_0_/_10%)]"
        >
          <div
            class="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f0f0] pb-3"
          >
            <div class="flex items-center gap-2">
              <span class="text-base font-semibold">{{ record.date }}</span>
              <span class="text-sm text-[#64748b]">
                {{ formatWeekday(record.date) }}
              </span>
            </div>
            <div class="flex flex-wrap gap-2">
              <Tag :color="getStatusInfo(record.status).color">
                {{ getStatusInfo(record.status).text }}
              </Tag>
              <Tag
                v-if="getLeaveScopeInfo(record.leaveScope)"
                :color="getLeaveScopeInfo(record.leaveScope)?.color"
              >
                {{ getLeaveScopeInfo(record.leaveScope)?.text }}
              </Tag>
              <Tag
                class="max-w-full whitespace-normal break-all leading-[1.5]"
                :color="getDeviceStatusInfo(record).color"
              >
                {{ getDeviceStatusInfo(record).text }}
              </Tag>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-3">
              <span class="w-10 text-sm text-[#64748b]">上班</span>
              <span
                class="grow font-['Courier_New',Courier,monospace] text-base font-semibold"
              >
                {{ formatToLocalTime(record.date, record.punchIn) }}
              </span>
              <Tag v-if="isLate(record.status)" color="red" :bordered="false">
                迟到
              </Tag>
            </div>
            <div class="flex items-center gap-3">
              <span class="w-10 text-sm text-[#64748b]">下班</span>
              <span
                class="grow font-['Courier_New',Courier,monospace] text-base font-semibold"
              >
                {{ formatToLocalTime(record.date, record.punchOut) }}
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
          <div
            v-if="record.workHours > 0"
            class="mt-3 border-t border-[#f0f0f0] pt-3 text-right text-xs text-[#64748b]"
          >
            <span>工作时长 {{ record.workHours.toFixed(2) }} 小时</span>
          </div>
        </div>
        <div
          v-if="!listLoading && attendanceRecords.length === 0"
          class="py-10 text-center text-[#999]"
        >
          <p>暂无记录</p>
        </div>
        <div class="mt-4 text-center">
          <Button
            v-if="!allDataLoaded && attendanceRecords.length > 0"
            :loading="listLoading"
            block
            @click="handleLoadMore"
          >
            加载更多
          </Button>
          <p v-if="allDataLoaded" class="py-4 text-xs text-[#999]">
            没有更多了
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
