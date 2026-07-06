<script setup lang="ts">
import type {
  AttendanceLeaveScope,
  AttendanceListItem,
  MonthAttendanceStats,
} from '#/api/hrm/attendance';

import { computed, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useUserStore } from '@vben/stores';

import { Button, message, Spin, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  confirmAttendanceAbnormal,
  getAttendanceList,
  getMonthStats,
} from '#/api/hrm/attendance';
import MobileDateRange from '#/components/MobileDateRange.vue';
import { getAttendanceRecordPriorityInfo } from '#/utils/workbench-todo-priority';

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
const route = useRoute();
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
const handlingRecordIds = ref<number[]>([]);
const showOnlyAbnormal = computed(
  () => String(route.query.attendanceStatus || '') === 'abnormal',
);
const routeUsername = computed(() => {
  const value = route.query.username;
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }
  return String(value || '').trim();
});
const isTeamAbnormalView = computed(
  () => showOnlyAbnormal.value && !routeUsername.value,
);
const targetUsername = computed(
  () =>
    routeUsername.value ||
    (showOnlyAbnormal.value ? '' : userInfo?.realName || ''),
);
const visibleAttendanceRecords = computed(() =>
  showOnlyAbnormal.value
    ? attendanceRecords.value
        .filter(
          (record) => isLate(record.status) || isEarlyLeave(record.status),
        )
        .sort(compareAttendanceRisk)
    : attendanceRecords.value,
);

// 分页配置
const pagination = reactive({
  current: 1,
  pageSize: 15,
  total: 0,
});

const attendanceListTitle = computed(() => {
  if (!showOnlyAbnormal.value) {
    return '考勤记录';
  }
  return routeUsername.value
    ? `${routeUsername.value}考勤异常`
    : '全员考勤异常';
});

const attendanceListDescription = computed(() => {
  if (!showOnlyAbnormal.value) {
    return '';
  }
  if (isTeamAbnormalView.value) {
    return `当前按 ${pagination.total} 人汇总，确认处理后将从列表移除`;
  }
  return `当前待处理 ${pagination.total} 条，确认处理后将从列表移除`;
});

const allDataLoaded = computed(() => {
  return (
    attendanceRecords.value.length >= pagination.total && pagination.total > 0
  );
});

const isHandlingRecord = (record: AttendanceRecord) =>
  getAttendanceRecordIds(record).some((id) =>
    handlingRecordIds.value.includes(id),
  );

const getAttendanceRecordIds = (record: AttendanceRecord) => {
  if (Array.isArray(record.attendanceIds) && record.attendanceIds.length > 0) {
    return record.attendanceIds;
  }
  return [record.attendanceId];
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

const getAttendanceTodoPriorityInfo = (status: null | number) =>
  getAttendanceRecordPriorityInfo(getStatusInfo(status).text);

const getAttendanceAbnormalSummaryText = (record: AttendanceRecord) => {
  const abnormalCount = Number(record.abnormalCount || 0);
  const lateCount = Number(record.lateCount || 0);
  const earlyLeaveCount = Number(record.earlyLeaveCount || 0);
  if (abnormalCount <= 0) {
    return '';
  }

  const details = [
    lateCount > 0 ? `迟到${lateCount}次` : '',
    earlyLeaveCount > 0 ? `早退${earlyLeaveCount}次` : '',
  ]
    .filter(Boolean)
    .join('、');
  return `本期累计异常${abnormalCount}次${details ? `（${details}）` : ''}`;
};

const getAttendanceRecordDetails = (record: AttendanceRecord) => {
  if (Array.isArray(record.records) && record.records.length > 0) {
    return record.records;
  }
  return [record];
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

const getAttendanceRiskScore = (status: null | number) => {
  if (status === AttendanceStatus.LateAndEarlyLeave) {
    return 30;
  }
  if (status === AttendanceStatus.Late) {
    return 20;
  }
  if (status === AttendanceStatus.EarlyLeave) {
    return 10;
  }
  return 0;
};

const compareAttendanceRisk = (
  first: AttendanceRecord,
  second: AttendanceRecord,
) => {
  const riskDiff =
    getAttendanceRiskScore(second.status) -
    getAttendanceRiskScore(first.status);
  if (riskDiff !== 0) {
    return riskDiff;
  }
  return dayjs(second.date).valueOf() - dayjs(first.date).valueOf();
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
  if (!targetUsername.value && !isTeamAbnormalView.value) return;

  if (!isLoadMore) {
    pagination.current = 1;
    attendanceRecords.value = [];
  }

  listLoading.value = true;

  try {
    const params = {
      attendanceStatus: showOnlyAbnormal.value ? 'abnormal' : undefined,
      endDate:
        dateRange.value[1]?.format('YYYY-MM-DD') ||
        dayjs().endOf('month').format('YYYY-MM-DD'),
      groupByUser: isTeamAbnormalView.value ? '1' : undefined,
      page: pagination.current,
      pageSize: pagination.pageSize,
      startDate:
        dateRange.value[0]?.format('YYYY-MM-DD') ||
        dayjs().startOf('month').format('YYYY-MM-DD'),
      username: targetUsername.value || undefined,
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
  if (listLoading.value || allDataLoaded.value) return;
  pagination.current++;
  loadAttendanceRecords(true);
};

const handleConfirmAbnormal = async (record: AttendanceRecord) => {
  if (isHandlingRecord(record)) return;
  const attendanceIds = getAttendanceRecordIds(record);
  handlingRecordIds.value = [...handlingRecordIds.value, ...attendanceIds];
  try {
    const [result] = await Promise.all(
      attendanceIds.map((attendanceId) =>
        confirmAttendanceAbnormal(attendanceId),
      ),
    );
    attendanceRecords.value = attendanceRecords.value.filter(
      (item) =>
        !getAttendanceRecordIds(item).some((attendanceId) =>
          attendanceIds.includes(attendanceId),
        ),
    );
    pagination.total = Math.max(
      pagination.total - (record.isGroup ? 1 : attendanceIds.length),
      0,
    );
    message.success(result?.message || '已确认处理');
  } catch (error: any) {
    console.error('确认处理考勤异常失败:', error);
    message.error(`确认处理失败: ${error.message || '未知错误'}`);
  } finally {
    handlingRecordIds.value = handlingRecordIds.value.filter(
      (id) => !attendanceIds.includes(id),
    );
  }
};

const resetMonthStats = () => {
  Object.assign(monthStats, {
    attendanceDays: 0,
    earlyLeaveDays: 0,
    lateDays: 0,
    leaveDays: 0,
    overtimeHours: 0,
    requiredAttendanceDays: calculateRequiredAttendanceDays(dayjs()),
  });
};

// 加载月度统计
const loadMonthStats = async () => {
  if (showOnlyAbnormal.value) {
    resetMonthStats();
    return;
  }
  if (!targetUsername.value) return;
  try {
    const stats = await getMonthStats({ username: targetUsername.value });
    Object.assign(monthStats, stats);
    // 在获取到后端数据后，用本地计算覆盖应出勤天数
    monthStats.requiredAttendanceDays =
      calculateRequiredAttendanceDays(dayjs());
  } catch (error: any) {
    console.error('加载月度统计失败:', error);
    message.error(`加载月度统计失败: ${error.message || '未知错误'}`);
  }
};

// 监听 username 和异常视图的变化
watch(
  [targetUsername, showOnlyAbnormal],
  () => {
    loadAttendanceRecords();
    loadMonthStats();
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
    <div v-if="!showOnlyAbnormal" class="mb-4 rounded-lg bg-white p-4">
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
        <div>
          <h3 class="text-base font-semibold">
            {{ attendanceListTitle }}
          </h3>
          <p v-if="showOnlyAbnormal" class="mt-1 text-xs text-[#64748b]">
            {{ attendanceListDescription }}
          </p>
        </div>
        <MobileDateRange
          v-model:value="dateRange"
          class="w-full min-w-0 max-[480px]:gap-[6px] sm:w-auto sm:min-w-[320px] [&_.picker]:min-w-0 max-[480px]:[&_.range-separator]:text-xs"
        />
      </div>

      <div class="flex flex-col gap-3">
        <div
          v-if="listLoading && visibleAttendanceRecords.length === 0"
          class="py-10 text-center text-[#999]"
        >
          <Spin />
        </div>
        <div
          v-for="record in visibleAttendanceRecords"
          :key="record.id"
          class="rounded-lg border border-[#f0f0f0] bg-white p-4 transition-shadow duration-300 hover:shadow-[0_4px_12px_rgb(0_0_0_/_10%)]"
        >
          <div
            class="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f0f0] pb-3"
          >
            <div class="flex items-center gap-2">
              <span
                v-if="showOnlyAbnormal"
                class="text-base font-semibold text-[#0f172a]"
              >
                {{ record.username || '未命名员工' }}
              </span>
              <span v-if="record.isGroup" class="text-sm text-[#64748b]">
                最近异常 {{ record.date }}
              </span>
              <span v-else class="text-base font-semibold">
                {{ record.date }}
              </span>
              <span v-if="!record.isGroup" class="text-sm text-[#64748b]">
                {{ formatWeekday(record.date) }}
              </span>
            </div>
            <div class="flex flex-wrap gap-2">
              <Tag
                v-if="showOnlyAbnormal"
                :color="getAttendanceTodoPriorityInfo(record.status).color"
              >
                {{ getAttendanceTodoPriorityInfo(record.status).label }}
              </Tag>
              <Tag
                v-if="
                  showOnlyAbnormal && getAttendanceAbnormalSummaryText(record)
                "
                color="purple"
              >
                累计 {{ record.abnormalCount || 0 }} 次
              </Tag>
              <Tag
                v-if="!record.isGroup"
                :color="getStatusInfo(record.status).color"
              >
                {{ getStatusInfo(record.status).text }}
              </Tag>
              <Tag
                v-if="!record.isGroup && getLeaveScopeInfo(record.leaveScope)"
                :color="getLeaveScopeInfo(record.leaveScope)?.color"
              >
                {{ getLeaveScopeInfo(record.leaveScope)?.text }}
              </Tag>
              <Tag
                v-if="!record.isGroup"
                class="max-w-full whitespace-normal break-all leading-[1.5]"
                :color="getDeviceStatusInfo(record).color"
              >
                {{ getDeviceStatusInfo(record).text }}
              </Tag>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <div v-if="showOnlyAbnormal" class="text-sm text-[#64748b]">
              处理提醒：{{
                getAttendanceTodoPriorityInfo(record.status).reason
              }}
            </div>
            <div
              v-if="
                showOnlyAbnormal && getAttendanceAbnormalSummaryText(record)
              "
              class="text-sm text-[#64748b]"
            >
              统计次数：{{ getAttendanceAbnormalSummaryText(record) }}
            </div>
            <div v-if="record.isGroup" class="space-y-2">
              <div
                v-for="detail in getAttendanceRecordDetails(record)"
                :key="detail.attendanceId"
                class="rounded-md bg-[#f8fafc] px-3 py-2"
              >
                <div class="mb-1 flex flex-wrap items-center gap-2">
                  <span class="font-semibold text-[#0f172a]">
                    {{ detail.date }}
                  </span>
                  <span class="text-xs text-[#64748b]">
                    {{ formatWeekday(detail.date) }}
                  </span>
                  <Tag
                    v-if="isLate(detail.status)"
                    color="red"
                    :bordered="false"
                  >
                    迟到
                  </Tag>
                  <Tag
                    v-if="isEarlyLeave(detail.status)"
                    color="orange"
                    :bordered="false"
                  >
                    早退
                  </Tag>
                </div>
                <div class="text-xs text-[#64748b]">
                  上班 {{ formatToLocalTime(detail.date, detail.punchIn) }}
                  <span class="mx-2">/</span>
                  下班 {{ formatToLocalTime(detail.date, detail.punchOut) }}
                </div>
              </div>
            </div>
            <template v-else>
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
            </template>
          </div>
          <div
            v-if="(!record.isGroup && record.workHours > 0) || showOnlyAbnormal"
            class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#f0f0f0] pt-3 text-xs text-[#64748b]"
          >
            <span v-if="!record.isGroup && record.workHours > 0">
              工作时长 {{ record.workHours.toFixed(2) }} 小时
            </span>
            <Button
              v-if="showOnlyAbnormal"
              :loading="isHandlingRecord(record)"
              size="small"
              type="primary"
              @click="handleConfirmAbnormal(record)"
            >
              {{ record.isGroup ? '全部确认已处理' : '确认已处理' }}
            </Button>
          </div>
        </div>
        <div
          v-if="!listLoading && visibleAttendanceRecords.length === 0"
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
