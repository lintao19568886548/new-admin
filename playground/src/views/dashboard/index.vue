<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { VbenIcon } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Card, Col, Row, Skeleton } from 'ant-design-vue';
import dayjs from 'dayjs';

import { getVisitorList } from '#/api/access/visitor';
import { getTodayRecord } from '#/api/hrm/attendance';
import { getReimbursementSummary } from '#/api/reimbursement/reimbursement';

interface VisitorPreview {
  name: string;
  reason?: string;
  status: string;
  time: string;
}

interface CheckInPreview {
  hasSignedIn: boolean;
  punchIn: string;
  punchOut: string;
}

const loading = ref(true);
const router = useRouter();
const userStore = useUserStore();
const reimburse = ref({ approved: 0, pending: 0, rejected: 0, total: 0 });
const visitors = ref<VisitorPreview[]>([]);
const checkIn = ref<CheckInPreview>({
  hasSignedIn: false,
  punchIn: '',
  punchOut: '',
});
const checkInStatusText = computed(() =>
  checkIn.value.hasSignedIn ? '已签到' : '未签到',
);

onMounted(() => {
  fetchPreviewData();
});

async function fetchPreviewData() {
  loading.value = true;
  try {
    try {
      const summary = await getReimbursementSummary();
      reimburse.value = {
        approved: summary?.approved || 0,
        pending: summary?.pending || 0,
        rejected: summary?.rejected || 0,
        total: summary?.total || 0,
      };
    } catch (error) {
      console.error('reimbursement stats failed', error);
    }

    try {
      const res = await getVisitorList({
        currentPage: 1,
        currentPark: -1,
        pageSize: 3,
      });

      const items = Array.isArray(res?.items) ? res.items : [];
      visitors.value = items.map((it: any) => {
        let statusNum = 1;
        if (typeof it.status === 'number') {
          statusNum = it.status;
        } else if (String(it.status).includes('入')) {
          statusNum = 0;
        }

        return {
          name: it.visitorName,
          reason: it.remark || it.parkName,
          status: statusNum === 0 ? '进入' : '离开',
          time: it.registerTime || it.createTime || '',
        };
      });
    } catch (error) {
      console.error('visitor list failed', error);
      visitors.value = [];
    }

    try {
      const username = userStore.userInfo?.realName;
      if (username) {
        const data = await getTodayRecord({ username });
        checkIn.value = {
          hasSignedIn: Boolean(data?.punchIn),
          punchIn: data?.punchIn ? dayjs(data.punchIn).format('HH:mm:ss') : '',
          punchOut: data?.punchOut
            ? dayjs(data.punchOut).format('HH:mm:ss')
            : '',
        };
      } else {
        checkIn.value = { hasSignedIn: false, punchIn: '', punchOut: '' };
      }
    } catch (error) {
      console.error('today attendance failed', error);
      checkIn.value = { hasSignedIn: false, punchIn: '', punchOut: '' };
    }
  } finally {
    loading.value = false;
  }
}

function goVisitorManagement() {
  router.push({ name: 'VisitorMobileList' });
}

async function goReimbursementApplication() {
  const hasAuditPermission = (userStore.userInfo?.reimbursementAuth || 0) > 0;
  const routeNames = hasAuditPermission
    ? ['ReimbursementMobileAudit', 'ReimbursementAudit']
    : ['ReimbursementMobileApply', 'ReimbursementApplication'];
  const routePaths = hasAuditPermission
    ? ['/reimbursement/mobile-audit', '/reimbursement/audit']
    : ['/reimbursement/mobile-apply', '/reimbursement/application'];

  try {
    for (const name of routeNames) {
      if (!router.hasRoute(name)) continue;
      await router.push({ name });
      return;
    }

    const allRoutes = router.getRoutes();
    for (const path of routePaths) {
      if (!allRoutes.some((route) => route.path === path)) continue;
      await router.push(path);
      return;
    }

    await router.push(routePaths[0]!);
  } catch (error) {
    console.error('go reimbursement application failed:', error);
  }
}

async function goAttendanceCheckIn() {
  const routeNames = ['HrmAttendancePunch', 'attendance'];
  const routePaths = ['/hrm/attendance/check-in', '/hrm/attendance/punch'];

  try {
    for (const name of routeNames) {
      if (!router.hasRoute(name)) continue;
      await router.push({ name });
      return;
    }

    const allRoutes = router.getRoutes();
    for (const path of routePaths) {
      if (!allRoutes.some((route) => route.path === path)) continue;
      await router.push(path);
      return;
    }

    await router.push(routePaths[0]!);
  } catch (error) {
    console.error('go attendance check-in failed:', error);
  }
}

function statusClass(status: string) {
  const s = status.toLowerCase();
  if (s.includes('通过')) return 'text-green-600 border-green-400/50';
  if (s.includes('拒')) return 'text-red-500 border-red-400/50';
  return 'text-amber-500 border-amber-400/50';
}
</script>

<template>
  <div class="dark:bg-background min-h-full bg-gray-50 p-4">
    <template v-if="loading">
      <Row :gutter="[16, 16]">
        <Col v-for="n in 4" :key="n" :lg="6" :md="6" :sm="12" :xs="12">
          <Card>
            <Skeleton active :paragraph="{ rows: 1 }" avatar />
          </Card>
        </Col>
      </Row>
    </template>

    <template v-else>
      <div class="mt-2">
        <Row :gutter="[16, 16]">
          <Col :lg="8" :md="8" :sm="24" :xs="24">
            <div
              class="group relative cursor-pointer"
              @click="goAttendanceCheckIn"
            >
              <div
                class="dark:to-slate-900/92 relative overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-50/95 to-slate-100/95 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.1)] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_14px_28px_rgba(14,165,233,0.18)] dark:border-slate-600/80 dark:from-slate-800/95 dark:shadow-[0_10px_24px_rgba(2,6,23,0.42)] dark:group-hover:shadow-[0_14px_28px_rgba(14,165,233,0.24)]"
              >
                <div
                  class="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-400/10 via-transparent to-emerald-400/10"
                ></div>
                <div
                  class="relative z-10 flex items-center justify-between gap-2"
                >
                  <div class="flex items-center gap-2">
                    <span
                      class="inline-flex h-7 w-7 items-center justify-center rounded-[10px] border border-sky-200/90 bg-gradient-to-br from-cyan-50 to-blue-100 text-[15px] text-sky-600 dark:border-cyan-700/60 dark:from-cyan-900/40 dark:to-slate-700/80 dark:text-sky-300"
                    >
                      <VbenIcon icon="mdi:calendar-check-outline" />
                    </span>
                    <div>
                      <div
                        class="text-[15px] font-bold text-slate-900 dark:text-slate-100"
                      >
                        今日打卡
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="checkIn.hasSignedIn"
                    class="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/90 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                  >
                    <span
                      class="h-[7px] w-[7px] rounded-full bg-current"
                    ></span>
                    {{ checkInStatusText }}
                  </div>
                  <div
                    v-else
                    class="inline-flex items-center gap-1.5 rounded-full bg-amber-100/90 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                  >
                    <span
                      class="h-[7px] w-[7px] rounded-full bg-current"
                    ></span>
                    {{ checkInStatusText }}
                  </div>
                </div>

                <div class="relative z-10 mt-2.5">
                  <div class="mt-2 grid grid-cols-2 gap-2">
                    <div
                      class="rounded-[10px] border border-slate-200/90 bg-white/75 px-[9px] py-[7px] dark:border-slate-600/80 dark:bg-slate-800/70"
                    >
                      <div
                        class="text-[11px] text-slate-500 dark:text-slate-400"
                      >
                        上班打卡
                      </div>
                      <div
                        class="mt-0.5 text-[13px] font-bold tracking-[0.2px] text-slate-900 dark:text-slate-50"
                      >
                        {{ checkIn.punchIn || '--:--:--' }}
                      </div>
                    </div>
                    <div
                      class="rounded-[10px] border border-slate-200/90 bg-white/75 px-[9px] py-[7px] dark:border-slate-600/80 dark:bg-slate-800/70"
                    >
                      <div
                        class="text-[11px] text-slate-500 dark:text-slate-400"
                      >
                        下班打卡
                      </div>
                      <div
                        class="mt-0.5 text-[13px] font-bold tracking-[0.2px] text-slate-900 dark:text-slate-50"
                      >
                        {{ checkIn.punchOut || '--:--:--' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Col>
          <Col :lg="8" :md="8" :sm="24" :xs="24">
            <Card
              class="cursor-pointer rounded-xl bg-white/80 dark:bg-gray-800/80"
              @click="goReimbursementApplication"
            >
              <div class="mb-2 flex items-center justify-between">
                <div
                  class="text-base font-semibold text-gray-800 dark:text-gray-200"
                >
                  报销申请
                </div>
              </div>
              <div class="grid grid-cols-4 gap-3">
                <div
                  class="rounded-[10px] bg-slate-50 px-2.5 py-2 text-center dark:bg-gray-900"
                >
                  <div class="text-xl font-bold text-blue-600">
                    {{ reimburse.pending }}
                  </div>
                  <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    待处理
                  </div>
                </div>
                <div
                  class="rounded-[10px] bg-slate-50 px-2.5 py-2 text-center dark:bg-gray-900"
                >
                  <div class="text-xl font-bold text-green-600">
                    {{ reimburse.approved }}
                  </div>
                  <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    已通过
                  </div>
                </div>
                <div
                  class="rounded-[10px] bg-slate-50 px-2.5 py-2 text-center dark:bg-gray-900"
                >
                  <div class="text-xl font-bold text-red-500">
                    {{ reimburse.rejected }}
                  </div>
                  <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    已拒绝
                  </div>
                </div>
                <div
                  class="rounded-[10px] bg-slate-50 px-2.5 py-2 text-center dark:bg-gray-900"
                >
                  <div
                    class="text-xl font-bold text-gray-700 dark:text-gray-200"
                  >
                    {{ reimburse.total }}
                  </div>
                  <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    总计
                  </div>
                </div>
              </div>
            </Card>
          </Col>
          <Col :lg="8" :md="8" :sm="24" :xs="24">
            <Card class="rounded-xl bg-white/80 dark:bg-gray-800/80">
              <div class="mb-2 flex items-center justify-between">
                <div
                  class="text-base font-semibold text-gray-800 dark:text-gray-200"
                >
                  访客管理
                </div>
              </div>
              <div class="flex flex-col gap-2.5">
                <div
                  v-for="v in visitors"
                  :key="v.name + v.time"
                  class="grid grid-cols-[36px_1fr_auto] items-center gap-2.5 rounded-xl border border-slate-200 bg-gradient-to-b from-[#f6f9fc] to-[#e9eef5] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_6px_16px_rgba(0,0,0,0.16)] dark:border-gray-700 dark:bg-gradient-to-b dark:from-[#111827] dark:to-[#0f172a]"
                  @click="goVisitorManagement"
                >
                  <div
                    class="flex items-center justify-center text-slate-500 dark:text-slate-300"
                  >
                    <VbenIcon icon="carbon:user-avatar" class="text-[22px]" />
                  </div>
                  <div class="min-w-0">
                    <div class="font-semibold">{{ v.name }}</div>
                    <div
                      class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400"
                    >
                      {{ v.time }} · {{ v.reason }}
                    </div>
                  </div>
                  <div
                    class="rounded-full border border-slate-200 px-2 py-0.5 text-xs"
                    :class="statusClass(v.status)"
                  >
                    {{ v.status }}
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </template>
  </div>
</template>
