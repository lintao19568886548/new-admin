import { prismaClient, prismaScopeStorage, systemDbClient } from '~/utils/db';

const AUTO_RENTAL_EXPENSE_MARKER = '[AUTO_RENTAL_EXPENSE]';
const DEFAULT_BILL_CATEGORY = '其他费用';
const DEFAULT_BILL_NAME = '租金支出';
const DEFAULT_WORKER_INTERVAL_MS = 60 * 60 * 1000;

const globalForRentalExpenseFinance = globalThis as typeof globalThis & {
  __rentalExpenseFinanceSyncCache?: Map<
    string,
    {
      finishedAt: number;
      result: SyncRentalExpenseFinanceRecordsResult;
    }
  >;
  __rentalExpenseFinanceSyncLocks?: Map<string, Promise<void>>;
  __rentalExpenseFinanceSyncPromises?: Map<
    string,
    Promise<SyncRentalExpenseFinanceRecordsResult>
  >;
  __rentalExpenseFinanceWorker?: {
    intervalId: ReturnType<typeof setInterval>;
    running: boolean;
  };
};

interface SyncRentalExpenseFinanceRecordsOptions {
  customerScope?: {
    customerId: string;
    dbName?: null | string;
  };
  minIntervalMs?: number;
  now?: Date;
  parkIds?: number[];
  tenantIds?: number[];
}

interface SyncRentalExpenseFinanceRecordsResult {
  created: number;
  dueRecords: number;
  skipped: number;
  tenants: number;
}

interface AutoFinanceCreateInput {
  amount: number;
  billCategory: string;
  billName: string;
  parkId: null | number;
  remark: string;
  transactionTime: Date;
  transactionType: string;
}

interface CustomerScope {
  customerId: string;
  dbName?: null | string;
}

function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function normalizeIdList(values?: number[]) {
  if (!Array.isArray(values) || values.length === 0) {
    return undefined;
  }

  const normalized = [...new Set(values)]
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0);

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeCustomerScope(
  value?: CustomerScope | null,
): CustomerScope | null {
  const customerId = String(value?.customerId || '').trim();
  if (!customerId) {
    return null;
  }

  const dbName = String(value?.dbName || '').trim();
  return {
    customerId,
    dbName: dbName || null,
  };
}

function isSameCustomerScope(
  left?: CustomerScope | null,
  right?: CustomerScope | null,
) {
  const normalizedLeft = normalizeCustomerScope(left);
  const normalizedRight = normalizeCustomerScope(right);

  return (
    normalizedLeft?.customerId === normalizedRight?.customerId &&
    String(normalizedLeft?.dbName || '') ===
      String(normalizedRight?.dbName || '')
  );
}

function getWorkerIntervalMs() {
  const value = Number(process.env.RENTAL_EXPENSE_FINANCE_WORKER_INTERVAL_MS);
  return Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : DEFAULT_WORKER_INTERVAL_MS;
}

function isWorkerEnabled() {
  return (
    String(process.env.RENTAL_EXPENSE_FINANCE_WORKER_ENABLED ?? 'false')
      .trim()
      .toLowerCase() === 'true'
  );
}

function isSyncEnabled() {
  return (
    String(
      process.env.RENTAL_EXPENSE_FINANCE_SYNC_ENABLED ??
        process.env.RENTAL_EXPENSE_FINANCE_WORKER_ENABLED ??
        'false',
    )
      .trim()
      .toLowerCase() === 'true'
  );
}

function getMonthKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

function getMonthNumber(date: Date) {
  return date.getMonth() + 1;
}

function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function buildMonthlyDueDate(
  anchorDate: Date,
  year: number,
  monthIndex: number,
) {
  const day = Math.min(anchorDate.getDate(), getDaysInMonth(year, monthIndex));

  return new Date(
    year,
    monthIndex,
    day,
    anchorDate.getHours(),
    anchorDate.getMinutes(),
    anchorDate.getSeconds(),
    anchorDate.getMilliseconds(),
  );
}

function getMonthlyDueDates(
  anchorDate: Date,
  now: Date,
  contractEnd?: Date | null,
) {
  if (!isValidDate(anchorDate) || anchorDate > now) {
    return [] as Date[];
  }

  const endLimit =
    isValidDate(contractEnd) && contractEnd < now ? contractEnd : now;

  if (endLimit < anchorDate) {
    return [] as Date[];
  }

  const dueDates: Date[] = [];
  let year = anchorDate.getFullYear();
  let monthIndex = anchorDate.getMonth();

  while (true) {
    const dueDate = buildMonthlyDueDate(anchorDate, year, monthIndex);

    if (dueDate > endLimit) {
      break;
    }

    if (dueDate >= anchorDate) {
      dueDates.push(dueDate);
    }

    monthIndex += 1;
    if (monthIndex > 11) {
      monthIndex = 0;
      year += 1;
    }
  }

  return dueDates;
}

function buildDisplayRemark(tenantName: string, dueDate: Date) {
  return `${tenantName} ${getMonthNumber(dueDate)}月租金`;
}

function buildAutoRemark(params: {
  dueDate: Date;
  period: string;
  tenantId: number;
  tenantName: string;
}) {
  return `${buildDisplayRemark(
    params.tenantName,
    params.dueDate,
  )} ${AUTO_RENTAL_EXPENSE_MARKER} tenantId=${params.tenantId};period=${params.period}`;
}

function buildDisplayRecordSignature(input: {
  amount: number;
  billName: string;
  parkId: null | number;
  remark: string;
  transactionTime: Date;
  transactionType: string;
}) {
  return [
    input.billName,
    input.remark,
    String(input.parkId ?? ''),
    input.transactionType,
    input.transactionTime.toISOString(),
    String(input.amount),
  ].join('|');
}

function buildBaseRecordSignature(input: {
  amount: number;
  billName: string;
  parkId: null | number;
  transactionTime: Date;
  transactionType: string;
}) {
  return [
    input.billName,
    String(input.parkId ?? ''),
    input.transactionType,
    input.transactionTime.toISOString(),
    String(input.amount),
  ].join('|');
}

function parseAutoRemark(remark?: null | string) {
  const match = String(remark || '').match(
    /\[AUTO_RENTAL_EXPENSE\]\s+tenantId=(\d+);period=(\d{4}-\d{2})/,
  );

  if (!match?.[1] || !match?.[2]) {
    return null;
  }

  return {
    period: match[2],
    tenantId: Number(match[1]),
  };
}

function getEmptySyncResult(): SyncRentalExpenseFinanceRecordsResult {
  return {
    created: 0,
    dueRecords: 0,
    skipped: 0,
    tenants: 0,
  };
}

function getSyncMapKey(
  options: SyncRentalExpenseFinanceRecordsOptions,
  scope?: CustomerScope | null,
) {
  const normalizedScope = normalizeCustomerScope(scope);
  const parkIds = normalizeIdList(options.parkIds)?.join(',') || 'all';
  const tenantIds = normalizeIdList(options.tenantIds)?.join(',') || 'all';

  return [
    normalizedScope?.customerId || '',
    normalizedScope?.dbName || '',
    `parks=${parkIds}`,
    `tenants=${tenantIds}`,
  ].join('|');
}

function getSyncScopeKey(scope?: CustomerScope | null) {
  const normalizedScope = normalizeCustomerScope(scope);
  return [
    normalizedScope?.customerId || '',
    normalizedScope?.dbName || '',
  ].join('|');
}

async function runWithSyncScopeLock<T>(
  scopeKey: string,
  action: () => Promise<T>,
) {
  globalForRentalExpenseFinance.__rentalExpenseFinanceSyncLocks ??= new Map();

  const previous =
    globalForRentalExpenseFinance.__rentalExpenseFinanceSyncLocks.get(
      scopeKey,
    ) ?? Promise.resolve();
  let releaseCurrentLock: () => void = () => {};
  const currentLock = new Promise<void>((resolve) => {
    releaseCurrentLock = resolve;
  });
  const lockChain = previous.catch(() => undefined).then(() => currentLock);

  globalForRentalExpenseFinance.__rentalExpenseFinanceSyncLocks.set(
    scopeKey,
    lockChain,
  );

  await previous.catch(() => undefined);

  try {
    return await action();
  } finally {
    releaseCurrentLock();
    if (
      globalForRentalExpenseFinance.__rentalExpenseFinanceSyncLocks.get(
        scopeKey,
      ) === lockChain
    ) {
      globalForRentalExpenseFinance.__rentalExpenseFinanceSyncLocks.delete(
        scopeKey,
      );
    }
  }
}

async function syncRentalExpenseFinanceRecordsInCurrentScope(
  options: SyncRentalExpenseFinanceRecordsOptions = {},
): Promise<SyncRentalExpenseFinanceRecordsResult> {
  const now = isValidDate(options.now) ? options.now : new Date();
  const parkIds = normalizeIdList(options.parkIds);
  const tenantIds = normalizeIdList(options.tenantIds);

  const tenantWhere: Record<string, any> = {
    isDeleted: false,
    rent: {
      gt: 0,
    },
    transactionType: false,
  };

  if (parkIds) {
    tenantWhere.parkId = {
      in: parkIds,
    };
  }

  if (tenantIds) {
    tenantWhere.rentalTenantId = {
      in: tenantIds,
    };
  }

  const tenants = await prismaClient.rentalTenant.findMany({
    where: tenantWhere,
    select: {
      contractEnd: true,
      contractStart: true,
      createTime: true,
      parkId: true,
      rentalTenantId: true,
      rent: true,
      tenantName: true,
    },
  });

  if (tenants.length === 0) {
    return {
      created: 0,
      dueRecords: 0,
      skipped: 0,
      tenants: 0,
    };
  }

  const existingFinanceWhere: Record<string, any> = {
    transactionType: '支出',
    OR: [
      {
        remark: {
          contains: AUTO_RENTAL_EXPENSE_MARKER,
        },
      },
      {
        billName: DEFAULT_BILL_NAME,
      },
    ],
  };

  if (parkIds) {
    existingFinanceWhere.parkId = {
      in: parkIds,
    };
  }

  const existingRecords = await prismaClient.finance.findMany({
    where: existingFinanceWhere,
    select: {
      amount: true,
      billName: true,
      financeId: true,
      parkId: true,
      remark: true,
      transactionTime: true,
    },
  });

  const existingPeriods = new Set<string>();
  const existingDisplayRecords = new Map<
    string,
    {
      financeId: number;
      remark: null | string;
    }
  >();
  const existingBaseRecords = new Map<
    string,
    Array<{
      financeId: number;
      remark: null | string;
    }>
  >();
  for (const record of existingRecords) {
    const parsed = parseAutoRemark(record.remark);
    if (parsed) {
      existingPeriods.add(`${parsed.tenantId}:${parsed.period}`);
    }

    if (
      record.billName === DEFAULT_BILL_NAME &&
      isValidDate(record.transactionTime)
    ) {
      existingDisplayRecords.set(
        buildDisplayRecordSignature({
          amount: Number(record.amount),
          billName: record.billName,
          parkId: record.parkId ?? null,
          remark: String(record.remark || ''),
          transactionTime: record.transactionTime,
          transactionType: '支出',
        }),
        {
          financeId: record.financeId,
          remark: record.remark,
        },
      );

      const baseSignature = buildBaseRecordSignature({
        amount: Number(record.amount),
        billName: record.billName,
        parkId: record.parkId ?? null,
        transactionTime: record.transactionTime,
        transactionType: '支出',
      });
      const baseRecords = existingBaseRecords.get(baseSignature) || [];
      baseRecords.push({
        financeId: record.financeId,
        remark: record.remark,
      });
      existingBaseRecords.set(baseSignature, baseRecords);
    }
  }

  const recordsToCreate: AutoFinanceCreateInput[] = [];
  const recordsToMark: Array<{ financeId: number; remark: string }> = [];
  let dueRecords = 0;

  for (const tenant of tenants) {
    const anchorDate =
      tenant.contractStart && isValidDate(tenant.contractStart)
        ? tenant.contractStart
        : tenant.createTime;

    const dueDates = getMonthlyDueDates(anchorDate, now, tenant.contractEnd);
    if (dueDates.length === 0) {
      continue;
    }

    const amount = Number(tenant.rent);
    if (!Number.isFinite(amount) || amount <= 0) {
      continue;
    }

    for (const dueDate of dueDates) {
      const period = getMonthKey(dueDate);
      const recordKey = `${tenant.rentalTenantId}:${period}`;
      const displayRemark = buildDisplayRemark(tenant.tenantName, dueDate);
      const autoRemark = buildAutoRemark({
        dueDate,
        period,
        tenantId: tenant.rentalTenantId,
        tenantName: tenant.tenantName,
      });
      const displayRecordSignature = buildDisplayRecordSignature({
        amount,
        billName: DEFAULT_BILL_NAME,
        parkId: tenant.parkId ?? null,
        remark: displayRemark,
        transactionTime: dueDate,
        transactionType: '支出',
      });
      const baseRecordSignature = buildBaseRecordSignature({
        amount,
        billName: DEFAULT_BILL_NAME,
        parkId: tenant.parkId ?? null,
        transactionTime: dueDate,
        transactionType: '支出',
      });
      dueRecords += 1;

      if (existingPeriods.has(recordKey)) {
        continue;
      }

      const existingDisplayRecord = existingDisplayRecords.get(
        displayRecordSignature,
      );
      if (existingDisplayRecord) {
        existingPeriods.add(recordKey);
        const baseRecords = existingBaseRecords.get(baseRecordSignature);
        const baseRecordIndex =
          baseRecords?.findIndex(
            (record) => record.financeId === existingDisplayRecord.financeId,
          ) ?? -1;
        if (baseRecords && baseRecordIndex >= 0) {
          baseRecords.splice(baseRecordIndex, 1);
        }
        if (!parseAutoRemark(existingDisplayRecord.remark)) {
          recordsToMark.push({
            financeId: existingDisplayRecord.financeId,
            remark: autoRemark,
          });
        }
        continue;
      }

      const legacyBaseRecords =
        existingBaseRecords.get(baseRecordSignature)?.filter((record) => {
          return !parseAutoRemark(record.remark);
        }) || [];
      if (legacyBaseRecords.length > 0) {
        const legacyRecord = legacyBaseRecords[0];
        if (!legacyRecord) {
          continue;
        }
        existingPeriods.add(recordKey);
        if (legacyBaseRecords.length === 1) {
          const baseRecords = existingBaseRecords.get(baseRecordSignature);
          const baseRecordIndex =
            baseRecords?.findIndex(
              (record) => record.financeId === legacyRecord.financeId,
            ) ?? -1;
          if (baseRecords && baseRecordIndex >= 0) {
            baseRecords.splice(baseRecordIndex, 1);
          }
          recordsToMark.push({
            financeId: legacyRecord.financeId,
            remark: autoRemark,
          });
        }
        continue;
      }

      existingPeriods.add(recordKey);
      existingDisplayRecords.set(displayRecordSignature, {
        financeId: 0,
        remark: autoRemark,
      });
      recordsToCreate.push({
        amount,
        billCategory: DEFAULT_BILL_CATEGORY,
        billName: DEFAULT_BILL_NAME,
        parkId: tenant.parkId ?? null,
        remark: autoRemark,
        transactionTime: dueDate,
        transactionType: '支出',
      });
    }
  }

  if (recordsToMark.length > 0) {
    await Promise.all(
      recordsToMark.map((record) =>
        prismaClient.finance.updateMany({
          data: {
            remark: record.remark,
          },
          where: {
            financeId: record.financeId,
          },
        }),
      ),
    );
  }

  if (recordsToCreate.length > 0) {
    await prismaClient.finance.createMany({
      data: recordsToCreate,
    });
  }

  return {
    created: recordsToCreate.length,
    dueRecords,
    skipped: Math.max(dueRecords - recordsToCreate.length, 0),
    tenants: tenants.length,
  };
}

export async function syncRentalExpenseFinanceRecords(
  options: SyncRentalExpenseFinanceRecordsOptions = {},
): Promise<SyncRentalExpenseFinanceRecordsResult> {
  if (!isSyncEnabled()) {
    return getEmptySyncResult();
  }

  const targetScope = normalizeCustomerScope(options.customerScope);
  const currentScope = normalizeCustomerScope(prismaScopeStorage.getStore());
  const syncScope = targetScope || currentScope;
  const syncKey = getSyncMapKey(options, syncScope);
  const syncScopeKey = getSyncScopeKey(syncScope);
  const minIntervalMs = Math.max(Number(options.minIntervalMs || 0), 0);
  const now = Date.now();

  globalForRentalExpenseFinance.__rentalExpenseFinanceSyncCache ??= new Map();
  globalForRentalExpenseFinance.__rentalExpenseFinanceSyncPromises ??=
    new Map();

  const cached =
    minIntervalMs > 0
      ? globalForRentalExpenseFinance.__rentalExpenseFinanceSyncCache.get(
          syncKey,
        )
      : undefined;
  if (cached && now - cached.finishedAt < minIntervalMs) {
    return cached.result;
  }

  const running =
    globalForRentalExpenseFinance.__rentalExpenseFinanceSyncPromises.get(
      syncKey,
    );
  if (running) {
    return running;
  }

  const syncPromise = (async () => {
    return runWithSyncScopeLock(syncScopeKey, async () => {
      if (targetScope && !isSameCustomerScope(targetScope, currentScope)) {
        return prismaScopeStorage.run(targetScope, async () =>
          syncRentalExpenseFinanceRecordsInCurrentScope(options),
        );
      }

      return syncRentalExpenseFinanceRecordsInCurrentScope(options);
    });
  })();

  globalForRentalExpenseFinance.__rentalExpenseFinanceSyncPromises.set(
    syncKey,
    syncPromise,
  );

  try {
    const result = await syncPromise;
    globalForRentalExpenseFinance.__rentalExpenseFinanceSyncCache.set(syncKey, {
      finishedAt: Date.now(),
      result,
    });
    return result;
  } finally {
    globalForRentalExpenseFinance.__rentalExpenseFinanceSyncPromises.delete(
      syncKey,
    );
  }
}

async function listActiveCustomerScopes() {
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

  return customers
    .map((customer) =>
      normalizeCustomerScope({
        customerId: customer.customerId,
        dbName: customer.dbName,
      }),
    )
    .filter(Boolean) as CustomerScope[];
}

async function runRentalExpenseFinanceWorkerTick() {
  const worker = globalForRentalExpenseFinance.__rentalExpenseFinanceWorker;
  if (!worker || worker.running) {
    return;
  }

  worker.running = true;
  try {
    const customerScopes = await listActiveCustomerScopes();

    for (const customerScope of customerScopes) {
      try {
        await syncRentalExpenseFinanceRecords({
          customerScope,
        });
      } catch (error) {
        console.error(
          `同步租户月度支出失败(customerId=${customerScope.customerId}):`,
          error,
        );
      }
    }
  } catch (error) {
    console.error('同步租户月度支出失败:', error);
  } finally {
    worker.running = false;
  }
}

export function startRentalExpenseFinanceWorker() {
  if (!isWorkerEnabled()) {
    return;
  }

  if (globalForRentalExpenseFinance.__rentalExpenseFinanceWorker?.intervalId) {
    return;
  }

  globalForRentalExpenseFinance.__rentalExpenseFinanceWorker = {
    intervalId: setInterval(() => {
      void runRentalExpenseFinanceWorkerTick();
    }, getWorkerIntervalMs()),
    running: false,
  };

  void runRentalExpenseFinanceWorkerTick();
}
