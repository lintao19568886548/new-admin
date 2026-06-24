import type { AmountBillCollectionSmsType } from './amount-bill-collection-sms.ts';

import { prismaScopeStorage, systemDbClient } from '~/utils/db';

import {
  checkAmountBillCollectionSmsTemplateStatuses,
  listAmountBillCollectionSmsCandidatesForAutomation,
  normalizeAmountBillCollectionSmsOptions,
  recordAmountBillCollectionSmsSendResults,
  sendAmountBillCollectionSmsItems,
} from './amount-bill-collection-sms.ts';
import { getSmsTemplateStatus, sendTemplateSms } from './sms-service.ts';

const WORKER_NAME = 'amount-bill-collection-sms-worker';
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_TRIGGER_HOUR = 18;
const DEFAULT_TRIGGER_MINUTE = 0;
const DEFAULT_TRIGGER_WINDOW_MINUTES = 30;
const BEIJING_TIME_ZONE = 'Asia/Shanghai';

type WorkerState = {
  executedKeys: Set<string>;
  intervalId: ReturnType<typeof setInterval>;
  running: boolean;
};

type WorkerConfig = {
  enabled: boolean;
  intervalMs: number;
  triggerDays: number[];
  triggerHour: number;
  triggerMinute: number;
  triggerWindowMinutes: number;
};

type CustomerScope = {
  customerId: string;
  dbName?: null | string;
};

const globalForCollectionSms = globalThis as typeof globalThis & {
  __amountBillCollectionSmsWorker?: WorkerState;
};

const beijingDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  month: '2-digit',
  second: '2-digit',
  timeZone: BEIJING_TIME_ZONE,
  year: 'numeric',
});

function normalizeBooleanEnv(name: string, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  return String(raw).trim().toLowerCase() === 'true';
}

function normalizePositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function normalizeIntegerEnv(
  name: string,
  fallback: number,
  min: number,
  max: number,
) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= min && value <= max
    ? Math.floor(value)
    : fallback;
}

function normalizeDayListEnv(name: string, fallback: number[]) {
  const raw = String(process.env[name] || '')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 31);
  const normalized = [...new Set(raw)];
  return normalized.length > 0 ? normalized : fallback;
}

function getBeijingDateParts(date: Date) {
  const parts: Record<string, number> = {};
  for (const part of beijingDateFormatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      parts[part.type] = Number(part.value);
    }
  }

  return {
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    month: parts.month,
    second: parts.second,
    year: parts.year,
  };
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function getBeijingDayKey(date: Date) {
  const parts = getBeijingDateParts(date);
  return `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`;
}

function getWorkerConfig(): null | WorkerConfig {
  if (!normalizeBooleanEnv('AMOUNT_BILL_COLLECTION_SMS_WORKER_ENABLED')) {
    return null;
  }

  const triggerDays = normalizeDayListEnv(
    'AMOUNT_BILL_COLLECTION_SMS_TRIGGER_DAYS',
    [5, 10, 30],
  );

  return {
    enabled: true,
    intervalMs: normalizePositiveIntegerEnv(
      'AMOUNT_BILL_COLLECTION_SMS_WORKER_INTERVAL_MS',
      DEFAULT_INTERVAL_MS,
    ),
    triggerDays,
    triggerHour: normalizeIntegerEnv(
      'AMOUNT_BILL_COLLECTION_SMS_TRIGGER_HOUR',
      DEFAULT_TRIGGER_HOUR,
      0,
      23,
    ),
    triggerMinute: normalizeIntegerEnv(
      'AMOUNT_BILL_COLLECTION_SMS_TRIGGER_MINUTE',
      DEFAULT_TRIGGER_MINUTE,
      0,
      59,
    ),
    triggerWindowMinutes: normalizePositiveIntegerEnv(
      'AMOUNT_BILL_COLLECTION_SMS_TRIGGER_WINDOW_MINUTES',
      DEFAULT_TRIGGER_WINDOW_MINUTES,
    ),
  };
}

function getCollectionTypeByTriggerDay(
  triggerDay: number,
): AmountBillCollectionSmsType {
  if (triggerDay === 30) {
    return 'final_30';
  }
  if (triggerDay === 10) {
    return 'overdue_10';
  }
  return 'payment_reminder';
}

function getTodayTriggerKey(dayKey: string, triggerDay: number) {
  return `${dayKey}:${triggerDay}`;
}

function shouldTriggerNow(
  config: WorkerConfig,
  now: Date,
): null | { dayKey: string; triggerDay: number } {
  const parts = getBeijingDateParts(now);
  if (!config.triggerDays.includes(parts.day)) {
    return null;
  }
  const currentSeconds =
    parts.hour * 60 * 60 + parts.minute * 60 + parts.second;
  const triggerSeconds =
    config.triggerHour * 60 * 60 + config.triggerMinute * 60;
  const windowSeconds = config.triggerWindowMinutes * 60;
  if (
    currentSeconds < triggerSeconds ||
    currentSeconds >= triggerSeconds + windowSeconds
  ) {
    return null;
  }
  return {
    dayKey: getBeijingDayKey(now),
    triggerDay: parts.day,
  };
}

async function listCustomerScopes() {
  const customers = await systemDbClient.customer.findMany({
    where: {
      status: {
        not: 0,
      },
    },
    select: {
      customerId: true,
      dbName: true,
    },
  });

  return customers.map((customer) => ({
    customerId: customer.customerId,
    dbName: customer.dbName ? String(customer.dbName) : null,
  }));
}

async function runForCustomerScope(scope: CustomerScope, triggerDay: number) {
  const collectionType = getCollectionTypeByTriggerDay(triggerDay);
  const options = normalizeAmountBillCollectionSmsOptions({
    collectionType,
    dueDate: undefined,
    overdueDays: triggerDay,
  });
  const items = await prismaScopeStorage.run(scope, async () =>
    listAmountBillCollectionSmsCandidatesForAutomation(options),
  );
  const sendableItems = items.filter((item) => item.canSend);
  if (sendableItems.length === 0) {
    return {
      failedCount: 0,
      sendChannel: 'template' as const,
      successCount: 0,
      totalCount: 0,
    };
  }

  const templateCheckResult =
    await checkAmountBillCollectionSmsTemplateStatuses({
      getTemplateStatus: getSmsTemplateStatus,
      items: sendableItems,
    });
  if (templateCheckResult.missingEnvNames.length > 0) {
    console.info(
      `[${WORKER_NAME}] skip customerId=${scope.customerId} triggerDay=${triggerDay}: template missing: ${templateCheckResult.missingEnvNames.join(',')}`,
    );
    return {
      failedCount: sendableItems.length,
      sendChannel: 'template' as const,
      successCount: 0,
      totalCount: sendableItems.length,
    };
  }

  if (templateCheckResult.unapproved.length > 0) {
    const detail = templateCheckResult.unapproved
      .map((item) => {
        const reason =
          item.status.status === 'rejected' && item.status.refuseReason
            ? ` reason=${item.status.refuseReason}`
            : '';
        return `${item.envName}=${item.status.templateId} status=${item.status.statusLabel}${reason}`;
      })
      .join('; ');
    console.info(
      `[${WORKER_NAME}] skip customerId=${scope.customerId} triggerDay=${triggerDay}: template not approved: ${detail}`,
    );
    return {
      failedCount: sendableItems.length,
      sendChannel: 'template' as const,
      successCount: 0,
      totalCount: sendableItems.length,
    };
  }

  const results = await sendAmountBillCollectionSmsItems({
    items: sendableItems,
    sendTemplateSms,
  });
  await recordAmountBillCollectionSmsSendResults({
    items: sendableItems,
    results,
  });
  const successCount = results.filter((item) => item.success).length;
  const failedCount = results.length - successCount;

  console.info(
    `[${WORKER_NAME}] customerId=${scope.customerId} triggerDay=${triggerDay} total=${results.length} success=${successCount} failed=${failedCount}`,
  );

  return {
    failedCount,
    sendChannel: 'template' as const,
    successCount,
    totalCount: results.length,
  };
}

async function runWorkerTick(config: WorkerConfig) {
  const state = globalForCollectionSms.__amountBillCollectionSmsWorker;
  if (!state || state.running) {
    return;
  }

  const now = new Date();
  const trigger = shouldTriggerNow(config, now);
  if (!trigger) {
    return;
  }

  const triggerKey = getTodayTriggerKey(trigger.dayKey, trigger.triggerDay);
  if (state.executedKeys.has(triggerKey)) {
    return;
  }

  state.running = true;
  try {
    const customerScopes = await listCustomerScopes();
    for (const scope of customerScopes) {
      try {
        await prismaScopeStorage.run(scope, async () =>
          runForCustomerScope(scope, trigger.triggerDay),
        );
      } catch (error) {
        console.error(
          `[${WORKER_NAME}] tick failed customerId=${scope.customerId}:`,
          error,
        );
      }
    }
    state.executedKeys.add(triggerKey);
  } catch (error) {
    console.error(`[${WORKER_NAME}] tick failed:`, error);
  } finally {
    state.running = false;
  }
}

export function startAmountBillCollectionSmsWorker() {
  const config = getWorkerConfig();
  if (!config) {
    console.info(`[${WORKER_NAME}] worker disabled`);
    return;
  }

  if (globalForCollectionSms.__amountBillCollectionSmsWorker) {
    return;
  }

  const state: WorkerState = {
    executedKeys: new Set<string>(),
    intervalId: setInterval(() => {
      void runWorkerTick(config);
    }, config.intervalMs),
    running: false,
  };

  state.intervalId.unref?.();
  globalForCollectionSms.__amountBillCollectionSmsWorker = state;

  console.info(
    `[${WORKER_NAME}] worker started intervalMs=${config.intervalMs} triggerDays=${config.triggerDays.join(',')} triggerTime=${String(config.triggerHour).padStart(2, '0')}:${String(config.triggerMinute).padStart(2, '0')} windowMinutes=${config.triggerWindowMinutes}`,
  );
  setTimeout(() => {
    void runWorkerTick(config);
  }, 1000).unref?.();
}
