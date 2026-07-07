import type { AttendanceScheduleConfig } from '~/utils/attendance';

import {
  buildAmountBillListSummary,
  enrichAmountBillPaymentInfo,
  filterAmountBillsByCollectionStatus,
} from '~/utils/amount-bill-list-summary';
import {
  compareAmountBillProjectDesc,
  getAmountBillProjectSortKey,
} from '~/utils/amount-bill-project-period';
import {
  AttendanceStatus,
  getApprovedLeaveRangesByUserIds,
  getAttendanceScheduleMapForUsers,
  resolveAttendanceStateWithSchedule,
} from '~/utils/attendance';
import { getConfirmedAttendanceRecordAbnormalIdSet } from '~/utils/attendance-abnormal-confirmation';
import { prismaClient } from '~/utils/db';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

type TodoPriority = 'normal' | 'urgent' | 'warning';

type WorkbenchTodoType =
  | 'attendance_abnormal'
  | 'contract_expire'
  | 'investment_lead'
  | 'reimbursement_audit'
  | 'rent_unreceived'
  | 'repair_order'
  | 'vacant_factory';

interface WorkbenchTodo {
  businessId: string;
  businessName: string;
  content: string;
  createTime?: string;
  dueTime?: string;
  meta?: Record<string, unknown>;
  parkId?: number;
  parkName?: string;
  phoneNumber?: string;
  priority: TodoPriority;
  routeName?: string;
  routePath: string;
  routeQuery?: Record<string, number | string>;
  status: 'pending';
  title: string;
  todoId: string;
  type: WorkbenchTodoType;
}

interface WorkbenchTodoSection {
  count: number;
  items: WorkbenchTodo[];
  key: WorkbenchTodoType;
  title: string;
}

const TODO_LIMIT = 5;
const TODO_CANDIDATE_LIMIT = 50;
const NOTIFICATION_TODO_LIMIT = 30;
const REIMBURSEMENT_URGENT_WAITING_DAYS = 7;
const REIMBURSEMENT_WARNING_WAITING_DAYS = 3;
const REIMBURSEMENT_URGENT_AMOUNT = 100_000;
const REIMBURSEMENT_WARNING_AMOUNT = 10_000;
const INVESTMENT_FOLLOWUP_PROGRESS_VALUES = [
  '初步接洽',
  '深入沟通',
  '合同准备',
];
const DEFAULT_ATTENDANCE_SCHEDULE: Pick<
  AttendanceScheduleConfig,
  'scheduledCheckIn' | 'scheduledCheckOut' | 'source'
> = {
  scheduledCheckIn: '09:00:00',
  scheduledCheckOut: '18:00:00',
  source: 'default',
};

const ROLE_ALIASES = {
  access: ['门禁', '前台', '总台', '安保'],
  finance: ['财务', 'Finance', 'finance'],
  hrm: ['人事', 'HR', 'hr'],
  investment: ['招商', '招商经理', 'Investment', 'investment'],
  maintenance: ['维护', '维修', '维保', 'Maintenance', 'maintenance'],
  park: ['园区经理', '园区', '运营', '项目经理', '物业'],
  super: ['Super', '超管', '超级管理员', '老板', '董事长', '总经理'],
} as const;

const ALL_TODO_TYPES: WorkbenchTodoType[] = [
  'attendance_abnormal',
  'contract_expire',
  'investment_lead',
  'reimbursement_audit',
  'rent_unreceived',
  'repair_order',
  'vacant_factory',
];

function normalizeRoleNames(userinfo: any) {
  return (userinfo?.roles ?? [])
    .map((role: unknown) => String(role || '').trim())
    .filter(Boolean);
}

function hasAnyRoleName(roleNames: string[], aliases: readonly string[]) {
  return roleNames.some((role) =>
    aliases.some((alias) => role.toLowerCase().includes(alias.toLowerCase())),
  );
}

function getAllowedTodoTypes(userinfo: any) {
  const roleNames = normalizeRoleNames(userinfo);
  const allowed = new Set<WorkbenchTodoType>();

  if (hasAnyRoleName(roleNames, ROLE_ALIASES.super)) {
    return new Set(ALL_TODO_TYPES);
  }

  if (hasAnyRoleName(roleNames, ROLE_ALIASES.finance)) {
    allowed.add('reimbursement_audit');
    allowed.add('rent_unreceived');
  }

  if (hasAnyRoleName(roleNames, ROLE_ALIASES.hrm)) {
    allowed.add('attendance_abnormal');
  }

  if (hasAnyRoleName(roleNames, ROLE_ALIASES.investment)) {
    allowed.add('investment_lead');
    allowed.add('vacant_factory');
  }

  if (hasAnyRoleName(roleNames, ROLE_ALIASES.park)) {
    allowed.add('contract_expire');
    allowed.add('investment_lead');
    allowed.add('reimbursement_audit');
    allowed.add('rent_unreceived');
    allowed.add('repair_order');
    allowed.add('vacant_factory');
  }

  if (hasAnyRoleName(roleNames, ROLE_ALIASES.maintenance)) {
    allowed.add('repair_order');
  }

  if (Number(userinfo?.reimbursementAuth || 0) > 0) {
    allowed.add('reimbursement_audit');
  }

  return allowed;
}

function canViewAllAttendance(userinfo: any) {
  const roleNames = normalizeRoleNames(userinfo);
  return (
    hasAnyRoleName(roleNames, ROLE_ALIASES.super) ||
    hasAnyRoleName(roleNames, ROLE_ALIASES.hrm)
  );
}

function getAuthorizedParkIds(userinfo: any) {
  return (userinfo?.parks ?? [])
    .map((park: any) => Number(park.parkId))
    .filter((parkId: number) => Number.isInteger(parkId) && parkId > 0);
}

function getDefaultAttendanceSchedule(userId?: null | number) {
  return {
    ...DEFAULT_ATTENDANCE_SCHEDULE,
    userId: userId ?? undefined,
  };
}

function toNumber(value: unknown) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getDayDiff(target: Date, reference: Date) {
  const targetDay = startOfDay(target).getTime();
  const referenceDay = startOfDay(reference).getTime();
  return Math.ceil((targetDay - referenceDay) / 86_400_000);
}

function getContractExpireText(contractName: string, days: number) {
  if (days > 0) {
    return `${contractName}还有${days}天到期，请及时处理`;
  }
  if (days === 0) {
    return `${contractName}今天到期，请及时处理`;
  }
  return `${contractName}已过期${Math.abs(days)}天，请尽快处理`;
}

function getContractPriority(days: number): TodoPriority {
  if (days < 0) return 'urgent';
  if (days <= 7) return 'warning';
  return 'normal';
}

function getRentPriority(remainingAmount: number): TodoPriority {
  if (remainingAmount >= 10_000) return 'urgent';
  if (remainingAmount >= 1000) return 'warning';
  return 'normal';
}

function getReimbursementAuditBaseTime(item: {
  createTime?: Date | null;
  date?: Date | null;
}) {
  return item.createTime || item.date || new Date();
}

function getReimbursementAuditWaitingDays(item: {
  createTime?: Date | null;
  date?: Date | null;
}) {
  const baseTime = getReimbursementAuditBaseTime(item).getTime();
  if (!Number.isFinite(baseTime)) {
    return 0;
  }

  return Math.max(
    Math.floor((Date.now() - baseTime) / (24 * 60 * 60 * 1000)),
    0,
  );
}

function getReimbursementAuditPriority(item: {
  amount?: unknown;
  createTime?: Date | null;
  date?: Date | null;
}): TodoPriority {
  const waitingDays = getReimbursementAuditWaitingDays(item);
  const amount = toNumber(item.amount);
  if (
    waitingDays >= REIMBURSEMENT_URGENT_WAITING_DAYS ||
    amount >= REIMBURSEMENT_URGENT_AMOUNT
  ) {
    return 'urgent';
  }
  if (
    waitingDays >= REIMBURSEMENT_WARNING_WAITING_DAYS ||
    amount >= REIMBURSEMENT_WARNING_AMOUNT
  ) {
    return 'warning';
  }
  return 'normal';
}

function getReimbursementAuditRiskScore(item: {
  amount?: unknown;
  createTime?: Date | null;
  date?: Date | null;
}) {
  return (
    getReimbursementAuditWaitingDays(item) * 10_000 + toNumber(item.amount)
  );
}

function getCurrentProjectMonthKey() {
  const now = new Date();
  return now.getFullYear() * 12 + now.getMonth() + 1;
}

function getAmountBillOverdueRisk(item: {
  createTime?: Date | null;
  projectName?: null | string;
  receiptTime?: Date | null;
}) {
  const projectKey = getAmountBillProjectSortKey(item);
  return projectKey !== null && projectKey < getCurrentProjectMonthKey()
    ? 1
    : 0;
}

function compareAmountBillCollectionRisk(first: any, second: any) {
  const overdueDiff =
    getAmountBillOverdueRisk(second) - getAmountBillOverdueRisk(first);
  if (overdueDiff !== 0) {
    return overdueDiff;
  }

  const amountDiff =
    toNumber(second.remainingAmount) - toNumber(first.remainingAmount);
  if (amountDiff !== 0) {
    return amountDiff;
  }

  const firstProjectKey = getAmountBillProjectSortKey(first);
  const secondProjectKey = getAmountBillProjectSortKey(second);
  if (firstProjectKey !== null && secondProjectKey !== null) {
    const projectDiff = firstProjectKey - secondProjectKey;
    if (projectDiff !== 0) {
      return projectDiff;
    }
  }
  if (firstProjectKey === null && secondProjectKey !== null) {
    return 1;
  }
  if (firstProjectKey !== null && secondProjectKey === null) {
    return -1;
  }

  return compareAmountBillProjectDesc(first, second);
}

function getInvestmentProgressStage(progress?: null | string) {
  const text = String(progress || '');
  if (text.includes('签约')) {
    return 'signed';
  }
  if (text.includes('合同')) {
    return 'contract';
  }
  if (
    text.includes('深入') ||
    text.includes('沟通') ||
    text.includes('谈判') ||
    text.includes('报价') ||
    text.includes('看房') ||
    text.includes('跟进')
  ) {
    return 'active';
  }
  if (text.includes('初步') || text.includes('接洽')) {
    return 'initial';
  }
  return 'unknown';
}

function getInvestmentIntentLevel(intentLevel?: null | string) {
  const level = String(intentLevel || '').toLowerCase();
  if (level.includes('很高') || level.startsWith('a')) {
    return 'very_high';
  }
  if (level.includes('高')) {
    return 'high';
  }
  if (level.includes('中') || level.includes('一般') || level.startsWith('b')) {
    return 'medium';
  }
  return 'low';
}

function getInvestmentLeadPriority(
  progress: string,
  meetingTime?: Date | null,
  intentLevel?: null | string,
): TodoPriority {
  const stage = getInvestmentProgressStage(progress);
  const intent = getInvestmentIntentLevel(intentLevel);
  const isOverdue = meetingTime
    ? startOfDay(meetingTime) < startOfDay(new Date())
    : false;

  if (stage === 'contract') {
    return isOverdue || ['high', 'very_high'].includes(intent)
      ? 'urgent'
      : 'warning';
  }

  if (stage === 'active') {
    if (isOverdue && ['high', 'very_high'].includes(intent)) {
      return 'urgent';
    }
    if (isOverdue || ['high', 'very_high'].includes(intent)) {
      return 'warning';
    }
  }

  if (stage === 'initial') {
    if (isOverdue || ['high', 'very_high'].includes(intent)) {
      return 'warning';
    }
    return 'normal';
  }

  if (isOverdue || ['high', 'very_high'].includes(intent)) {
    return 'warning';
  }

  return 'normal';
}

function getInvestmentLeadRiskScore(
  progress: string,
  meetingTime?: Date | null,
  intentLevel?: null | string,
) {
  let score = 0;
  const stage = getInvestmentProgressStage(progress);
  const intent = getInvestmentIntentLevel(intentLevel);

  if (meetingTime) {
    const daysUntilMeeting = getDayDiff(meetingTime, new Date());
    if (daysUntilMeeting < 0) {
      const overdueDays = Math.min(Math.abs(daysUntilMeeting), 60);
      switch (stage) {
        case 'active': {
          score += 55 + overdueDays;

          break;
        }
        case 'contract': {
          score += 90 + overdueDays;

          break;
        }
        case 'initial': {
          score += 25 + Math.min(overdueDays, 20);

          break;
        }
        default: {
          score += 40 + Math.min(overdueDays, 30);
        }
      }
    } else {
      score += Math.max(30 - daysUntilMeeting, 0);
    }
  }

  switch (stage) {
    case 'active': {
      score += 45;

      break;
    }
    case 'contract': {
      score += 80;

      break;
    }
    case 'initial': {
      score += 10;

      break;
    }
    // No default
  }

  switch (intent) {
    case 'high': {
      score += 40;

      break;
    }
    case 'medium': {
      score += 20;

      break;
    }
    case 'very_high': {
      score += 50;

      break;
    }
    // No default
  }

  return score;
}

function compareInvestmentLeadRisk(first: any, second: any) {
  const riskDiff =
    getInvestmentLeadRiskScore(
      second.progress || '',
      second.meetingTime,
      second.intentLevel,
    ) -
    getInvestmentLeadRiskScore(
      first.progress || '',
      first.meetingTime,
      first.intentLevel,
    );
  if (riskDiff !== 0) {
    return riskDiff;
  }

  const firstTime = new Date(
    first.meetingTime || first.createTime || 0,
  ).getTime();
  const secondTime = new Date(
    second.meetingTime || second.createTime || 0,
  ).getTime();
  return secondTime - firstTime;
}

function getRepairOrderPriority(
  priority?: null | string,
  status?: null | string,
) {
  if (String(priority || '').includes('紧急')) {
    return 'urgent';
  }

  if (['处理中', '待接单'].includes(String(status || ''))) {
    return 'warning';
  }

  return 'normal';
}

function getRepairOrderRiskScore(
  priority?: null | string,
  status?: null | string,
) {
  let score = 0;
  const priorityText = String(priority || '');
  const statusText = String(status || '');

  if (priorityText.includes('紧急')) {
    score += 100;
  } else if (priorityText.includes('高')) {
    score += 60;
  }

  switch (statusText) {
    case '处理中': {
      score += 40;

      break;
    }
    case '待接单': {
      score += 50;

      break;
    }
    case '待验收': {
      score += 30;

      break;
    }
    // No default
  }

  return score;
}

function compareRepairOrderRisk(first: any, second: any) {
  const riskDiff =
    getRepairOrderRiskScore(second.priority, second.status) -
    getRepairOrderRiskScore(first.priority, first.status);
  if (riskDiff !== 0) {
    return riskDiff;
  }

  const firstTime = new Date(first.createTime || 0).getTime();
  const secondTime = new Date(second.createTime || 0).getTime();
  return secondTime - firstTime;
}

function getAttendancePriority(abnormalCount: number): TodoPriority {
  if (abnormalCount >= 10) {
    return 'urgent';
  }
  if (abnormalCount >= 3) {
    return 'warning';
  }
  return 'normal';
}

function getVacantFactoryPriority(area: number): TodoPriority {
  if (area >= 5000) return 'urgent';
  if (area >= 1000) return 'warning';
  return 'normal';
}

function compareTodoPriority(first: WorkbenchTodo, second: WorkbenchTodo) {
  const priorityDiff =
    getTodoPriorityWeight(first.priority) -
    getTodoPriorityWeight(second.priority);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const riskDiff = getTodoRiskScore(second) - getTodoRiskScore(first);
  if (riskDiff !== 0) {
    return riskDiff;
  }

  const firstTime = new Date(first.dueTime || first.createTime || 0).getTime();
  const secondTime = new Date(
    second.dueTime || second.createTime || 0,
  ).getTime();
  return firstTime - secondTime;
}

function getTodoPriorityWeight(priority: TodoPriority) {
  if (priority === 'urgent') {
    return 0;
  }
  if (priority === 'warning') {
    return 1;
  }
  return 2;
}

function getTodoRiskScore(todo: WorkbenchTodo) {
  const value = todo.meta?.riskScore;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return 0;
}

function buildSection(
  key: WorkbenchTodoType,
  title: string,
  items: WorkbenchTodo[],
  count = items.length,
): WorkbenchTodoSection {
  const sortedItems = [...items].sort(compareTodoPriority);
  return {
    count,
    items: sortedItems.slice(0, TODO_LIMIT),
    key,
    title,
  };
}

function buildNotificationItems(items: WorkbenchTodo[]) {
  return [...items].sort(compareTodoPriority).slice(0, NOTIFICATION_TODO_LIMIT);
}

function createEmptyCountedTodos() {
  return { count: 0, todos: [] as WorkbenchTodo[] };
}

function createEmptyRentUnreceivedTodos() {
  return {
    count: 0,
    summary: buildAmountBillListSummary([]),
    todos: [] as WorkbenchTodo[],
  };
}

async function runTimedTodoBuilder<T>(
  label: string,
  builder: () => Promise<T>,
) {
  const shouldLog = process.env.NODE_ENV !== 'production';
  const start = shouldLog ? Date.now() : 0;
  try {
    return await builder();
  } finally {
    if (shouldLog) {
      console.info(`[workbench-todos] ${label} ${Date.now() - start}ms`);
    }
  }
}

async function runSafeTodoBuilder<T>(
  label: string,
  fallback: T,
  builder: () => Promise<T>,
) {
  try {
    return await runTimedTodoBuilder(label, builder);
  } catch (error) {
    console.error(`[workbench-todos] ${label} failed:`, error);
    return fallback;
  }
}

function dedupeBy<T>(items: T[], getKey: (item: T) => number | string) {
  const map = new Map<number | string, T>();
  for (const item of items) {
    const key = getKey(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}

async function buildContractExpireTodos(
  parkIds: number[],
  referenceDate: Date,
) {
  const referenceDay = startOfDay(referenceDate);
  const expiredLimit = addDays(referenceDay, -90);
  const expiringLimit = addDays(referenceDay, 30);
  const where = {
    contractEnd: {
      gte: expiredLimit,
      lte: expiringLimit,
    },
    isDeleted: false,
    parkId: {
      in: parkIds,
    },
  };
  const count = await prismaClient.rentalTenant.count({ where });
  const contracts = await prismaClient.rentalTenant.findMany({
    include: {
      park: {
        select: {
          parkName: true,
        },
      },
    },
    orderBy: [{ contractEnd: 'asc' }, { rentalTenantId: 'desc' }],
    take: TODO_CANDIDATE_LIMIT,
    where,
  });

  const todos = contracts.flatMap((contract): WorkbenchTodo[] => {
    if (!contract.contractEnd) {
      return [];
    }

    const businessName = `${contract.tenantName}合同`;
    const days = getDayDiff(contract.contractEnd, referenceDay);
    return [
      {
        businessId: String(contract.rentalTenantId),
        businessName,
        content: getContractExpireText(businessName, days),
        dueTime: contract.contractEnd?.toISOString(),
        meta: {
          daysUntilExpire: days,
          riskScore: days < 0 ? Math.abs(days) : Math.max(30 - days, 0),
        },
        parkId: contract.parkId ?? undefined,
        parkName: contract.park?.parkName,
        phoneNumber: contract.phoneNumber,
        priority: getContractPriority(days),
        routeName: 'TenantMobileList',
        routePath: '/rental/tenant/mobile',
        routeQuery: {
          contractView: 'attention',
          tenantName: contract.tenantName,
        },
        status: 'pending',
        title: '合同到期提醒',
        todoId: `contract-expire-${contract.rentalTenantId}`,
        type: 'contract_expire',
      },
    ];
  });
  return { count, todos };
}

async function buildRentUnreceivedTodos(parkIds: number[]) {
  const where = {
    parkId: {
      in: parkIds,
    },
    totalFee: {
      gt: 0,
    },
  };
  const summaryItems = await prismaClient.amountBill.findMany({
    select: {
      billId: true,
      createTime: true,
      projectName: true,
      receiptAmount: true,
      receiptTime: true,
      totalFee: true,
    },
    where,
  });

  const summarySource = summaryItems
    .map((bill) =>
      enrichAmountBillPaymentInfo({
        billId: bill.billId,
        createTime: bill.createTime,
        projectName: bill.projectName,
        receiptAmount: bill.receiptAmount,
        receiptTime: bill.receiptTime,
        totalFee: bill.totalFee,
      }),
    )
    .filter((bill) => ['partial', 'unpaid'].includes(bill.collectionStatus));
  const summary = buildAmountBillListSummary(summarySource);
  const topBillIds = summarySource
    .sort(compareAmountBillCollectionRisk)
    .slice(0, TODO_CANDIDATE_LIMIT)
    .map((bill) => bill.billId);

  if (topBillIds.length === 0) {
    return {
      count: summary.billCount,
      summary,
      todos: [] as WorkbenchTodo[],
    };
  }

  const detailBills = await prismaClient.amountBill.findMany({
    include: {
      park: {
        select: {
          parkName: true,
        },
      },
      tenant: {
        select: {
          phoneNumber: true,
          tenantName: true,
        },
      },
    },
    where: {
      ...where,
      billId: {
        in: topBillIds,
      },
    },
  });

  const unreceivedBills = filterAmountBillsByCollectionStatus(
    detailBills.map((bill) =>
      enrichAmountBillPaymentInfo({
        ...bill,
        parkName: bill.park?.parkName,
        tenantName: bill.tenant?.tenantName || bill.tenantName,
      }),
    ),
    'unreceived',
  ).sort(compareAmountBillCollectionRisk);

  const todos = unreceivedBills.map((bill: any): WorkbenchTodo => {
    const remainingAmount = Math.max(toNumber(bill.remainingAmount), 0);
    const tenantName = String(bill.tenantName || '客户');
    const projectName = String(bill.projectName || '账单');
    return {
      businessId: String(bill.billId),
      businessName: projectName,
      content: `${tenantName}${projectName}未收${remainingAmount.toFixed(2)}元，请及时跟进`,
      createTime: bill.createTime?.toISOString?.(),
      meta: {
        collectionStatus: bill.collectionStatus,
        remainingAmount,
        riskScore: remainingAmount,
        totalFee: toNumber(bill.totalFee),
      },
      parkId: bill.parkId ?? undefined,
      parkName: bill.parkName,
      phoneNumber: bill.tenant?.phoneNumber,
      priority: getRentPriority(remainingAmount),
      routeName: 'BillMobileList',
      routePath: '/bill/mobile-list',
      routeQuery: {
        collectionStatus: 'unreceived',
        parkId: bill.parkId,
        tenantName,
      },
      status: 'pending',
      title: '未收租提醒',
      todoId: `rent-unreceived-${bill.billId}`,
      type: 'rent_unreceived',
    };
  });

  return {
    count: summary.billCount,
    summary,
    todos,
  };
}

async function buildInvestmentLeadTodos(parkIds: number[]) {
  const where = {
    parkId: {
      in: parkIds,
    },
    progress: {
      in: INVESTMENT_FOLLOWUP_PROGRESS_VALUES,
    },
  };
  const select = {
    agentName: true,
    createTime: true,
    intentArea: true,
    intentLevel: true,
    investmentId: true,
    meetingTime: true,
    park: {
      select: {
        parkName: true,
      },
    },
    parkId: true,
    phoneNumber: true,
    progress: true,
    tenantName: true,
  } as const;
  const orderBy = [
    { meetingTime: 'asc' as const },
    { investmentId: 'desc' as const },
  ];
  const referenceDay = startOfDay(new Date());
  const activeProgressWhere = {
    ...where,
    OR: ['合同', '深入', '沟通', '谈判', '报价', '看房', '跟进'].map(
      (keyword) => ({
        progress: {
          contains: keyword,
        },
      }),
    ),
  };
  const highIntentWhere = {
    ...where,
    OR: ['很高', '高', 'A', 'a'].map((keyword) => ({
      intentLevel: {
        contains: keyword,
      },
    })),
  };
  const [count, overdueLeads, activeLeads, highIntentLeads, upcomingLeads] =
    await runWithRadarSharedScope(() =>
      Promise.all([
        prismaClient.investment.count({ where }),
        prismaClient.investment.findMany({
          orderBy,
          select,
          take: TODO_CANDIDATE_LIMIT,
          where: {
            ...where,
            meetingTime: {
              lt: referenceDay,
            },
          },
        }),
        prismaClient.investment.findMany({
          orderBy,
          select,
          take: TODO_CANDIDATE_LIMIT,
          where: activeProgressWhere,
        }),
        prismaClient.investment.findMany({
          orderBy,
          select,
          take: TODO_CANDIDATE_LIMIT,
          where: highIntentWhere,
        }),
        prismaClient.investment.findMany({
          orderBy,
          select,
          take: TODO_CANDIDATE_LIMIT,
          where,
        }),
      ]),
    );

  const leads = dedupeBy(
    [...overdueLeads, ...activeLeads, ...highIntentLeads, ...upcomingLeads],
    (lead) => lead.investmentId,
  ).sort(compareInvestmentLeadRisk);

  const todos = leads.map((lead): WorkbenchTodo => {
    const tenantName = lead.tenantName || '意向客户';
    const progress = lead.progress || '待跟进';
    return {
      businessId: String(lead.investmentId),
      businessName: tenantName,
      content: `${tenantName}招商进度为${progress}，请及时跟进`,
      createTime: lead.createTime?.toISOString?.(),
      dueTime: lead.meetingTime?.toISOString?.(),
      meta: {
        agentName: lead.agentName,
        intentArea: lead.intentArea,
        intentLevel: lead.intentLevel,
        progress,
        riskScore: getInvestmentLeadRiskScore(
          progress,
          lead.meetingTime,
          lead.intentLevel,
        ),
      },
      parkId: lead.parkId ?? undefined,
      parkName: lead.park?.parkName,
      phoneNumber: lead.phoneNumber || undefined,
      priority: getInvestmentLeadPriority(
        progress,
        lead.meetingTime,
        lead.intentLevel,
      ),
      routeName: 'InvestmentAgentMobileList',
      routePath: '/investment/mobile',
      routeQuery: {
        currentPark: lead.parkId || -1,
        tenantName,
        todoView: 'followup',
      },
      status: 'pending',
      title: '招商线索',
      todoId: `investment-lead-${lead.investmentId}`,
      type: 'investment_lead',
    };
  });

  return { count, todos };
}

async function buildReimbursementAuditTodos(parkIds: number[], userinfo: any) {
  if (Number(userinfo?.reimbursementAuth || 0) <= 0) {
    return { count: 0, todos: [] as WorkbenchTodo[] };
  }

  const where = {
    isDeleted: false,
    parkId: {
      in: parkIds,
    },
    status: 0,
  };
  const [count, reimbursements] = await Promise.all([
    prismaClient.reimbursement.count({ where }),
    prismaClient.reimbursement.findMany({
      orderBy: [{ createTime: 'asc' }, { amount: 'desc' }, { id: 'desc' }],
      select: {
        amount: true,
        createTime: true,
        date: true,
        department: true,
        id: true,
        park: {
          select: {
            parkName: true,
          },
        },
        parkId: true,
        payee: true,
        purpose: true,
        username: true,
      },
      take: TODO_CANDIDATE_LIMIT,
      where,
    }),
  ]);

  const todos = reimbursements.map((item): WorkbenchTodo => {
    const amount = toNumber(item.amount);
    const waitingDays = getReimbursementAuditWaitingDays(item);
    const applicant = item.username || item.payee || '申请人';
    const purpose = item.purpose || '报销';
    return {
      businessId: String(item.id),
      businessName: `${applicant}报销`,
      content: `${applicant}提交${purpose}报销${amount.toFixed(2)}元${
        waitingDays > 0 ? `，已等待${waitingDays}天` : '，今日提交'
      }`,
      createTime:
        item.createTime?.toISOString?.() || item.date?.toISOString?.(),
      meta: {
        amount,
        department: item.department,
        payee: item.payee,
        purpose,
        riskScore: getReimbursementAuditRiskScore(item),
        waitingDays,
      },
      parkId: item.parkId ?? undefined,
      parkName: item.park?.parkName,
      priority: getReimbursementAuditPriority(item),
      routeName: 'ReimbursementMobileAudit',
      routePath: '/reimbursement/mobile-audit',
      routeQuery: {
        parkId: item.parkId ?? '',
        status: 0,
      },
      status: 'pending',
      title: '报销审核',
      todoId: `reimbursement-audit-${item.id}`,
      type: 'reimbursement_audit',
    };
  });

  return { count, todos };
}

async function buildRepairOrderTodos(parkIds: number[]) {
  const where = {
    parkId: {
      in: parkIds,
    },
    status: {
      in: ['待接单', '处理中', '待验收'],
    },
  };
  const select = {
    assigneePhone: true,
    createTime: true,
    orderNo: true,
    park: {
      select: {
        parkName: true,
      },
    },
    parkId: true,
    priority: true,
    repairOrderId: true,
    repairType: true,
    status: true,
    tenantPhone: true,
  } as const;
  const orderBy = [
    { createTime: 'desc' as const },
    { repairOrderId: 'desc' as const },
  ];
  const [
    count,
    urgentOrders,
    highOrders,
    waitingOrders,
    processingOrders,
    checkingOrders,
  ] = await Promise.all([
    prismaClient.repairOrder.count({ where }),
    prismaClient.repairOrder.findMany({
      orderBy,
      select,
      take: TODO_CANDIDATE_LIMIT,
      where: {
        ...where,
        priority: {
          contains: '紧急',
        },
      },
    }),
    prismaClient.repairOrder.findMany({
      orderBy,
      select,
      take: TODO_CANDIDATE_LIMIT,
      where: {
        ...where,
        priority: {
          contains: '高',
        },
      },
    }),
    prismaClient.repairOrder.findMany({
      orderBy,
      select,
      take: TODO_CANDIDATE_LIMIT,
      where: {
        ...where,
        status: '待接单',
      },
    }),
    prismaClient.repairOrder.findMany({
      orderBy,
      select,
      take: TODO_CANDIDATE_LIMIT,
      where: {
        ...where,
        status: '处理中',
      },
    }),
    prismaClient.repairOrder.findMany({
      orderBy,
      select,
      take: TODO_CANDIDATE_LIMIT,
      where: {
        ...where,
        status: '待验收',
      },
    }),
  ]);

  const orders = dedupeBy(
    [
      ...urgentOrders,
      ...highOrders,
      ...waitingOrders,
      ...processingOrders,
      ...checkingOrders,
    ],
    (order) => order.repairOrderId,
  ).sort(compareRepairOrderRisk);

  const todos = orders.map((order): WorkbenchTodo => {
    const businessName = order.orderNo || `工单${order.repairOrderId}`;
    return {
      businessId: String(order.repairOrderId),
      businessName,
      content: `${businessName}${order.status}，${order.repairType}报修请及时处理`,
      createTime: order.createTime?.toISOString?.(),
      meta: {
        priority: order.priority,
        repairType: order.repairType,
        riskScore: getRepairOrderRiskScore(order.priority, order.status),
        status: order.status,
      },
      parkId: order.parkId,
      parkName: order.park?.parkName,
      phoneNumber: order.tenantPhone || order.assigneePhone || undefined,
      priority: getRepairOrderPriority(order.priority, order.status),
      routeName: 'RepairOrderMobile',
      routePath: '/maintenance/repair-order/mobile',
      routeQuery: {
        orderNo: order.orderNo,
        status: order.status,
      },
      status: 'pending',
      title: '维护工单',
      todoId: `repair-order-${order.repairOrderId}`,
      type: 'repair_order',
    };
  });
  return { count, todos };
}

async function buildAttendanceAbnormalTodos(userinfo: any) {
  const viewAllAttendance = canViewAllAttendance(userinfo);
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const endDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59,
    999,
  );

  const records = await prismaClient.attendance.findMany({
    orderBy: {
      punchIn: 'desc',
    },
    select: {
      attendanceId: true,
      punchIn: true,
      punchOut: true,
      userId: true,
      username: true,
    },
    where: {
      ...(viewAllAttendance ? {} : { userId: userinfo.id }),
      punchIn: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const leaveMap = await getApprovedLeaveRangesByUserIds(
    records.map((record) => record.userId).filter(Boolean),
    startDate,
    endDate,
  );
  const confirmedAttendanceIdSet =
    await getConfirmedAttendanceRecordAbnormalIdSet(
      records.map((record) => record.attendanceId),
    );
  const scheduleMap = await getAttendanceScheduleMapForUsers(
    records.map((record) => ({
      realName: record.username,
      userId: record.userId,
      username: record.username,
    })),
  );
  const grouped = new Map<
    string,
    {
      abnormalCount: number;
      earlyLeaveCount: number;
      lateCount: number;
      latestTime?: Date | null;
      recordIds: number[];
      username: string;
    }
  >();

  for (const record of records) {
    if (confirmedAttendanceIdSet.has(record.attendanceId)) {
      continue;
    }

    const schedule = record.userId
      ? (scheduleMap.get(record.userId) ??
        getDefaultAttendanceSchedule(record.userId))
      : getDefaultAttendanceSchedule(userinfo.id);
    const attendanceState = resolveAttendanceStateWithSchedule({
      leaveRanges: record.userId ? (leaveMap.get(record.userId) ?? []) : [],
      punchIn: record.punchIn,
      punchOut: record.punchOut,
      schedule,
    });

    const status = attendanceState.status;
    let lateCount = 0;
    let earlyLeaveCount = 0;
    if (
      status === AttendanceStatus.Late ||
      status === AttendanceStatus.LateAndEarlyLeave
    ) {
      lateCount += 1;
    }
    if (
      status === AttendanceStatus.EarlyLeave ||
      status === AttendanceStatus.LateAndEarlyLeave
    ) {
      earlyLeaveCount += 1;
    }
    const abnormalCount = lateCount + earlyLeaveCount;
    if (abnormalCount === 0) {
      continue;
    }

    const username = record.username || '员工';
    const key = String(record.userId || username);
    const current = grouped.get(key) ?? {
      abnormalCount: 0,
      earlyLeaveCount: 0,
      lateCount: 0,
      latestTime: record.punchIn,
      recordIds: [],
      username,
    };
    current.abnormalCount += abnormalCount;
    current.lateCount += lateCount;
    current.earlyLeaveCount += earlyLeaveCount;
    current.recordIds.push(record.attendanceId);
    current.latestTime =
      !current.latestTime ||
      (record.punchIn && record.punchIn > current.latestTime)
        ? record.punchIn
        : current.latestTime;
    grouped.set(key, current);
  }

  return [...grouped.values()].map((item): WorkbenchTodo => {
    const detail = [
      item.lateCount > 0 ? `迟到${item.lateCount}次` : '',
      item.earlyLeaveCount > 0 ? `早退${item.earlyLeaveCount}次` : '',
    ]
      .filter(Boolean)
      .join('、');

    return {
      businessId: String(item.recordIds[0] ?? item.username),
      businessName: item.username,
      content: `${item.username}本月考勤异常${item.abnormalCount}次${detail ? `（${detail}）` : ''}，请及时处理`,
      createTime: item.latestTime?.toISOString?.(),
      meta: {
        abnormalCount: item.abnormalCount,
        earlyLeaveCount: item.earlyLeaveCount,
        lateCount: item.lateCount,
        recordIds: item.recordIds,
        riskScore: item.abnormalCount,
      },
      priority: getAttendancePriority(item.abnormalCount),
      routeName: 'HrmAttendanceStats',
      routePath: '/hrm/attendance/stats',
      routeQuery: {
        attendanceStatus: 'abnormal',
        username: item.username,
      },
      status: 'pending',
      title: '考勤异常',
      todoId: `attendance-abnormal-${item.username}-${today.getFullYear()}-${today.getMonth() + 1}`,
      type: 'attendance_abnormal',
    };
  });
}

async function buildVacantFactoryTodos(parkIds: number[]) {
  const floors = await prismaClient.factoryFloor.findMany({
    select: {
      floorId: true,
      status: true,
      totalArea: true,
      usedArea: true,
      factory: {
        select: {
          parkId: true,
          park: {
            select: {
              parkName: true,
            },
          },
        },
      },
    },
    where: {
      factory: {
        isDeleted: false,
        parkId: {
          in: parkIds,
        },
      },
      isDeleted: false,
    },
  });

  const grouped = new Map<
    number,
    {
      area: number;
      parkName?: string;
    }
  >();

  for (const floor of floors) {
    const parkId = floor.factory.parkId;
    if (!parkId) continue;

    const vacantArea = Math.max(
      toNumber(floor.totalArea) - toNumber(floor.usedArea),
      0,
    );
    if (vacantArea <= 0 && !String(floor.status || '').includes('空')) {
      continue;
    }

    const current = grouped.get(parkId) ?? {
      area: 0,
      parkName: floor.factory.park?.parkName,
    };
    current.area += vacantArea;
    grouped.set(parkId, current);
  }

  return [...grouped.entries()]
    .sort(([, a], [, b]) => b.area - a.area)
    .map(([parkId, item]): WorkbenchTodo => {
      const parkName = item.parkName || `园区${parkId}`;
      return {
        businessId: String(parkId),
        businessName: parkName,
        content: `${parkName}当前未租厂房面积${item.area.toFixed(2)}㎡，请及时推广获客`,
        meta: {
          vacantArea: item.area,
        },
        parkId,
        parkName,
        priority: getVacantFactoryPriority(item.area),
        routeName: 'FactoryList',
        routePath: '/rental/factory',
        routeQuery: {
          parkId,
        },
        status: 'pending',
        title: '空置厂房',
        todoId: `vacant-factory-${parkId}`,
        type: 'vacant_factory',
      };
    });
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const parkIds = getAuthorizedParkIds(userinfo);
    if (parkIds.length === 0) {
      return useResponseSuccess({
        generatedAt: new Date().toISOString(),
        notificationItems: [],
        sections: [],
        summary: {
          total: 0,
        },
      });
    }

    const referenceDate = new Date();
    const allowedTodoTypes = getAllowedTodoTypes(userinfo);
    const hasTodoType = (type: WorkbenchTodoType) => allowedTodoTypes.has(type);
    const [
      contractTodos,
      rentTodos,
      reimbursementTodos,
      investmentTodos,
      repairTodos,
      attendanceTodos,
      vacantFactoryTodos,
    ] = await Promise.all([
      hasTodoType('contract_expire')
        ? runSafeTodoBuilder('contract_expire', createEmptyCountedTodos(), () =>
            buildContractExpireTodos(parkIds, referenceDate),
          )
        : Promise.resolve(createEmptyCountedTodos()),
      hasTodoType('rent_unreceived')
        ? runSafeTodoBuilder(
            'rent_unreceived',
            createEmptyRentUnreceivedTodos(),
            () => buildRentUnreceivedTodos(parkIds),
          )
        : Promise.resolve(createEmptyRentUnreceivedTodos()),
      hasTodoType('reimbursement_audit')
        ? runSafeTodoBuilder(
            'reimbursement_audit',
            createEmptyCountedTodos(),
            () => buildReimbursementAuditTodos(parkIds, userinfo),
          )
        : Promise.resolve(createEmptyCountedTodos()),
      hasTodoType('investment_lead')
        ? runSafeTodoBuilder('investment_lead', createEmptyCountedTodos(), () =>
            buildInvestmentLeadTodos(parkIds),
          )
        : Promise.resolve(createEmptyCountedTodos()),
      hasTodoType('repair_order')
        ? runSafeTodoBuilder('repair_order', createEmptyCountedTodos(), () =>
            buildRepairOrderTodos(parkIds),
          )
        : Promise.resolve(createEmptyCountedTodos()),
      hasTodoType('attendance_abnormal')
        ? runSafeTodoBuilder('attendance_abnormal', [] as WorkbenchTodo[], () =>
            buildAttendanceAbnormalTodos(userinfo),
          )
        : Promise.resolve([] as WorkbenchTodo[]),
      hasTodoType('vacant_factory')
        ? runSafeTodoBuilder('vacant_factory', [] as WorkbenchTodo[], () =>
            buildVacantFactoryTodos(parkIds),
          )
        : Promise.resolve([] as WorkbenchTodo[]),
    ]);
    const rentSummary = rentTodos.summary || buildAmountBillListSummary([]);
    const sections = [
      buildSection(
        'contract_expire',
        '合同到期提醒',
        contractTodos.todos,
        contractTodos.count,
      ),
      buildSection(
        'rent_unreceived',
        '未收租提醒',
        rentTodos.todos,
        rentTodos.count,
      ),
      buildSection(
        'reimbursement_audit',
        '报销审核',
        reimbursementTodos.todos,
        reimbursementTodos.count,
      ),
      buildSection('vacant_factory', '空置厂房', vacantFactoryTodos),
      buildSection(
        'investment_lead',
        '招商线索',
        investmentTodos.todos,
        investmentTodos.count,
      ),
      buildSection(
        'repair_order',
        '维护工单',
        repairTodos.todos,
        repairTodos.count,
      ),
      buildSection('attendance_abnormal', '考勤异常', attendanceTodos),
    ].filter((section) => section.count > 0);
    const total = sections.reduce((sum, section) => sum + section.count, 0);
    const notificationItems = buildNotificationItems([
      ...contractTodos.todos,
      ...rentTodos.todos,
      ...reimbursementTodos.todos,
      ...vacantFactoryTodos,
      ...investmentTodos.todos,
      ...repairTodos.todos,
      ...attendanceTodos,
    ]);

    return useResponseSuccess({
      generatedAt: referenceDate.toISOString(),
      notificationItems,
      sections,
      summary: {
        byType: Object.fromEntries(
          sections.map((section) => [section.key, section.count]),
        ),
        total,
        unreceivedAmount: rentSummary.remainingAmount,
      },
    });
  } catch (error) {
    console.error('获取首页待办失败:', error);
    return serverErrorResponse('获取首页待办失败', event);
  }
});
