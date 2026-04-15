import { prismaClient } from '~/utils/db';

function getEmployeeModel() {
  return prismaClient.employee as any;
}

export interface EmployeeBindingAccountInfo {
  accountLabel: string;
  accountPhone: string;
  accountRealName: string;
  accountUsername: string;
  userId: number;
}

interface AccountRecord {
  id: number;
  phone: null | string;
  realName: null | string;
  username: null | string;
}

interface EmployeeBindingTarget {
  [key: string]: any;
  userId?: null | number;
}

function normalizeKeyword(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

export function normalizeEmployeeUserId(value: unknown) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
}

export function resolveEmployeeCustomerId(customerId?: unknown) {
  return String(customerId || process.env.DEFAULT_CUSTOMER_ID || 'default');
}

export function formatEmployeeBindingLabel(account: {
  phone?: null | string;
  realName?: null | string;
  username?: null | string;
}) {
  const realName = normalizeKeyword(account.realName);
  const username = normalizeKeyword(account.username);
  const phone = normalizeKeyword(account.phone);

  return realName || username || phone || '未命名账号';
}

function createBindingAccountInfo(
  account: AccountRecord,
): EmployeeBindingAccountInfo {
  return {
    accountLabel: formatEmployeeBindingLabel(account),
    accountPhone: account.phone ? String(account.phone) : '',
    accountRealName: String(account.realName || ''),
    accountUsername: String(account.username || ''),
    userId: Number(account.id),
  };
}

function createBindableAccountOption(account: AccountRecord) {
  return {
    label: formatEmployeeBindingLabel(account),
    phone: account.phone ? String(account.phone) : '',
    realName: String(account.realName || ''),
    username: String(account.username || ''),
    value: Number(account.id),
  };
}

export async function ensureEmployeeBindingUserAvailable(params: {
  customerId?: string;
  excludeEmployeeId?: number;
  userId: null | number;
}) {
  if (!params.userId) {
    return { account: null, error: null };
  }

  const account = await prismaClient.user.findFirst({
    select: {
      id: true,
      phone: true,
      realName: true,
      status: true,
      username: true,
    },
    where: {
      id: params.userId,
      ...(params.customerId ? { customerType: params.customerId } : null),
      status: {
        not: 2,
      },
    },
  });

  if (!account) {
    return {
      account: null,
      error: '绑定账号不存在或已删除',
    };
  }

  const employeeModel = getEmployeeModel();
  const boundEmployee = await employeeModel.findFirst({
    select: {
      employeeId: true,
      name: true,
    },
    where: {
      isDeleted: false,
      userId: params.userId,
      ...(params.excludeEmployeeId
        ? {
            NOT: {
              employeeId: params.excludeEmployeeId,
            },
          }
        : null),
    },
  });

  if (boundEmployee) {
    return {
      account: null,
      error: `该账号已绑定员工 ${boundEmployee.name}`,
    };
  }

  return { account, error: null };
}

export async function getEmployeeBindingAccountMap(params: {
  customerId?: string;
  userIds: number[];
}) {
  const userIds = [
    ...new Set(params.userIds.filter((id) => Number.isFinite(id) && id > 0)),
  ];
  if (userIds.length === 0) {
    return new Map<number, EmployeeBindingAccountInfo>();
  }

  const accounts = await prismaClient.user.findMany({
    orderBy: [{ realName: 'asc' }, { username: 'asc' }],
    select: {
      id: true,
      phone: true,
      realName: true,
      username: true,
    },
    where: {
      id: {
        in: userIds,
      },
      ...(params.customerId ? { customerType: params.customerId } : null),
    },
  });

  return new Map(
    accounts.map((account) => [account.id, createBindingAccountInfo(account)]),
  );
}

export async function attachEmployeeBindingInfo<
  T extends EmployeeBindingTarget,
>(items: T[], customerId?: string) {
  const bindingMap = await getEmployeeBindingAccountMap({
    customerId,
    userIds: items
      .map((item) => Number(item.userId))
      .filter((id) => Number.isFinite(id) && id > 0),
  });

  return items.map((item) => {
    const userId = Number(item.userId);
    const bindingInfo =
      Number.isFinite(userId) && userId > 0
        ? bindingMap.get(userId)
        : undefined;

    if (bindingInfo) {
      return {
        ...item,
        ...bindingInfo,
      };
    }

    return {
      ...item,
      accountLabel:
        Number.isFinite(userId) && userId > 0
          ? `账号 #${userId}（不存在）`
          : '',
      accountPhone: '',
      accountRealName: '',
      accountUsername: '',
    };
  });
}

export async function attachSingleEmployeeBindingInfo<
  T extends EmployeeBindingTarget,
>(item: T, customerId?: string) {
  const [enrichedItem] = await attachEmployeeBindingInfo([item], customerId);
  return enrichedItem ?? item;
}

export async function getBindableEmployeeAccountOptions(params: {
  customerId?: string;
  employeeId?: null | number;
  keyword?: string;
  limit?: number;
}) {
  const keyword = normalizeKeyword(params.keyword);
  const employeeModel = getEmployeeModel();
  const currentEmployee =
    params.employeeId &&
    Number.isFinite(params.employeeId) &&
    params.employeeId > 0
      ? await employeeModel.findUnique({
          select: {
            userId: true,
          },
          where: {
            employeeId: params.employeeId,
          },
        })
      : null;

  const occupiedEmployees = await employeeModel.findMany({
    select: {
      userId: true,
    },
    where: {
      isDeleted: false,
      userId: {
        not: null,
      },
      ...(params.employeeId
        ? {
            NOT: {
              employeeId: params.employeeId,
            },
          }
        : null),
    },
  });

  const occupiedUserIds = occupiedEmployees
    .map((item) => Number(item.userId))
    .filter((id) => Number.isFinite(id) && id > 0);

  const accounts = await prismaClient.user.findMany({
    orderBy: [{ realName: 'asc' }, { username: 'asc' }],
    select: {
      id: true,
      phone: true,
      realName: true,
      username: true,
    },
    take: params.limit ?? 50,
    where: {
      ...(params.customerId ? { customerType: params.customerId } : null),
      ...(occupiedUserIds.length > 0
        ? {
            id: {
              notIn: occupiedUserIds,
            },
          }
        : null),
      status: {
        not: 2,
      },
      ...(keyword
        ? {
            OR: [
              {
                phone: {
                  contains: keyword,
                },
              },
              {
                realName: {
                  contains: keyword,
                },
              },
              {
                username: {
                  contains: keyword,
                },
              },
            ],
          }
        : null),
    },
  });

  const accountOptions = new Map(
    accounts.map((account) => [
      account.id,
      createBindableAccountOption(account),
    ]),
  );

  const currentUserId = Number(currentEmployee?.userId);
  if (
    Number.isFinite(currentUserId) &&
    currentUserId > 0 &&
    !accountOptions.has(currentUserId)
  ) {
    const currentAccount = await prismaClient.user.findUnique({
      select: {
        id: true,
        phone: true,
        realName: true,
        username: true,
      },
      where: {
        id: currentUserId,
      },
    });

    if (currentAccount) {
      accountOptions.set(
        currentAccount.id,
        createBindableAccountOption(currentAccount),
      );
    } else {
      accountOptions.set(currentUserId, {
        label: `账号 #${currentUserId}（不存在）`,
        phone: '',
        realName: '',
        username: '',
        value: currentUserId,
      });
    }
  }

  return [...accountOptions.values()].sort((left, right) =>
    left.label.localeCompare(right.label, 'zh-CN'),
  );
}
