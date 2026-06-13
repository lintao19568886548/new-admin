import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveCrmInvite } from '../crm-scrm';

const mockDb = vi.hoisted(() => {
  let bindingId = 1;
  let scanLogId = 1;

  const state = {
    bindings: [] as any[],
    channels: [] as any[],
    contactWays: [] as any[],
    scanLogs: [] as any[],
    users: [] as any[],
  };

  function reset() {
    bindingId = 1;
    scanLogId = 1;
    state.bindings = [];
    state.channels = [
      {
        channelName: '销售A-默认渠道',
        channelType: 'sales',
        createTime: new Date('2026-01-01T00:00:00.000Z'),
        id: 1,
        qrCodeUrl: null,
        salesName: '销售A',
        salesUserId: 101,
        scene: 's_101_a',
        status: 1,
        updateTime: null,
        weworkUserId: 'ww_a',
      },
      {
        channelName: '销售B-默认渠道',
        channelType: 'sales',
        createTime: new Date('2026-01-01T00:00:00.000Z'),
        id: 2,
        qrCodeUrl: null,
        salesName: '销售B',
        salesUserId: 202,
        scene: 's_202_b',
        status: 1,
        updateTime: null,
        weworkUserId: 'ww_b',
      },
    ];
    state.contactWays = [];
    state.scanLogs = [];
    state.users = [
      {
        id: 101,
        phone: '13800000001',
        realName: '销售A',
        status: 1,
        username: 'sales-a',
      },
      {
        id: 202,
        phone: '13800000002',
        realName: '销售B',
        status: 1,
        username: 'sales-b',
      },
    ];
  }

  function clone<T>(value: T): T {
    return value ? ({ ...(value as any) } as T) : value;
  }

  function matchesWhere(record: any, where: Record<string, any>) {
    return Object.entries(where).every(([key, value]) => {
      if (value && typeof value === 'object' && 'not' in value) {
        return record[key] !== value.not;
      }
      return record[key] === value;
    });
  }

  const systemDbClient = {
    crmCustomerOwnerBinding: {
      create: vi.fn(async ({ data }) => {
        const now = new Date('2026-01-01T00:00:00.000Z');
        const binding = {
          createTime: now,
          firstScanAt: data.firstScanAt || now,
          id: bindingId++,
          status: 1,
          updateTime: null,
          ...data,
        };
        state.bindings.push(binding);
        return clone(binding);
      }),
      findFirst: vi.fn(async ({ where }) => {
        const binding = state.bindings.find((item) =>
          matchesWhere(item, where || {}),
        );
        return clone(binding || null);
      }),
      update: vi.fn(async ({ data, where }) => {
        const binding = state.bindings.find((item) => item.id === where.id);
        if (!binding) {
          throw new Error('binding not found');
        }
        Object.assign(binding, data, {
          updateTime: new Date('2026-01-01T00:00:01.000Z'),
        });
        return clone(binding);
      }),
    },
    crmSalesChannel: {
      findUnique: vi.fn(async ({ where }) => {
        const channel = state.channels.find(
          (item) => item.scene === where.scene,
        );
        return clone(channel || null);
      }),
    },
    crmScanLog: {
      create: vi.fn(async ({ data }) => {
        const log = {
          createTime: new Date('2026-01-01T00:00:00.000Z'),
          id: scanLogId++,
          ...data,
        };
        state.scanLogs.push(log);
        return clone(log);
      }),
    },
    crmWeworkContactWay: {
      findFirst: vi.fn(async ({ where }) => {
        const contactWay = state.contactWays.find((item) =>
          matchesWhere(item, where || {}),
        );
        return clone(contactWay || null);
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }) => {
        const user = state.users.find((item) => item.id === where.id);
        return clone(user || null);
      }),
    },
  };

  reset();

  return {
    reset,
    state,
    systemDbClient,
  };
});

vi.mock('~/utils/db', () => ({
  systemDbClient: mockDb.systemDbClient,
}));

describe('crm scrm owner binding', () => {
  beforeEach(() => {
    mockDb.reset();
    vi.clearAllMocks();
  });

  it('keeps the first sales owner when the same customer scans another sales code', async () => {
    const first = await resolveCrmInvite({
      customerName: '客户一',
      openid: 'openid-customer-1',
      scene: 's_101_a',
      source: 'miniprogram',
    });
    const second = await resolveCrmInvite({
      openid: 'openid-customer-1',
      scene: 's_202_b',
      source: 'miniprogram',
    });

    expect(first.isFirstBind).toBe(true);
    expect(first.binding.customerName).toBe('客户一');
    expect(first.owner.salesUserId).toBe(101);
    expect(second.isFirstBind).toBe(false);
    expect(second.owner.salesUserId).toBe(101);
    expect(second.binding.ownerSalesUserId).toBe(101);
    expect(second.binding.firstScene).toBe('s_101_a');
    expect(mockDb.state.bindings).toHaveLength(1);
    expect(mockDb.state.scanLogs.at(-1)).toMatchObject({
      customerName: '客户一',
      isFirstBind: false,
      requestedSalesUserId: 202,
      resolvedSalesUserId: 101,
      scene: 's_202_b',
    });
  });

  it('records anonymous scans without creating customer ownership', async () => {
    const result = await resolveCrmInvite({
      scene: 's_101_a',
      source: 'h5',
    });

    expect(result.binding).toBeNull();
    expect(result.identityRequired).toBe(true);
    expect(result.owner.salesUserId).toBe(101);
    expect(mockDb.state.bindings).toHaveLength(0);
    expect(mockDb.state.scanLogs).toHaveLength(1);
    expect(mockDb.state.scanLogs[0]).toMatchObject({
      bindingId: null,
      isFirstBind: false,
      requestedSalesUserId: 101,
      resolvedSalesUserId: null,
      scene: 's_101_a',
      source: 'h5',
    });
  });

  it('fills missing customer name on later scans without changing owner', async () => {
    await resolveCrmInvite({
      phone: '13800000009',
      scene: 's_101_a',
      source: 'h5',
    });

    const result = await resolveCrmInvite({
      customerName: '王客户',
      phone: '13800000009',
      scene: 's_202_b',
      source: 'h5',
    });

    expect(result.isFirstBind).toBe(false);
    expect(result.binding.customerName).toBe('王客户');
    expect(result.binding.ownerSalesUserId).toBe(101);
    expect(result.binding.firstScene).toBe('s_101_a');
    expect(mockDb.state.bindings).toHaveLength(1);
    expect(mockDb.state.scanLogs.at(-1)).toMatchObject({
      customerName: '王客户',
      isFirstBind: false,
      requestedSalesUserId: 202,
      resolvedSalesUserId: 101,
      scene: 's_202_b',
    });
  });

  it('detects scan source from user agent before writing scan log', async () => {
    await resolveCrmInvite({
      customerName: '微信客户',
      phone: '13800000010',
      scene: 's_101_a',
      source: 'h5',
      userAgent: 'Mozilla/5.0 AppleWebKit/537.36 Mobile MicroMessenger/8.0.49',
    });

    expect(mockDb.state.scanLogs.at(-1)).toMatchObject({
      source: 'wechat',
    });
  });

  it('does not reassign an inactive binding by scan; only manual transfer may change owner', async () => {
    await resolveCrmInvite({
      openid: 'openid-customer-2',
      scene: 's_101_a',
      source: 'miniprogram',
    });
    mockDb.state.bindings[0].status = 0;

    const result = await resolveCrmInvite({
      openid: 'openid-customer-2',
      scene: 's_202_b',
      source: 'miniprogram',
    });

    expect(result.isFirstBind).toBe(false);
    expect(result.binding.ownerSalesUserId).toBe(101);
    expect(result.binding.status).toBe(0);
    expect(result.binding.firstScene).toBe('s_101_a');
    expect(mockDb.state.bindings).toHaveLength(1);
    expect(mockDb.state.scanLogs.at(-1)).toMatchObject({
      isFirstBind: false,
      requestedSalesUserId: 202,
      resolvedSalesUserId: 101,
      scene: 's_202_b',
    });
  });
});
