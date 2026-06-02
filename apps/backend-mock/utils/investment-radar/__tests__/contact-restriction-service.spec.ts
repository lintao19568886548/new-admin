import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaClient } from '~/utils/db';

import {
  inferContactRestrictionFromReply,
  mapRestrictionReason,
  normalizeContactPhone,
} from '../contact-restriction-policy';
import {
  listContactRestrictions,
  releaseContactRestriction,
} from '../contact-restriction-service';

vi.mock('~/utils/db', () => ({
  prismaClient: {
    $executeRawUnsafe: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  },
}));

const mockedPrisma = vi.mocked(prismaClient);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('contact restriction service policy', () => {
  it('normalizes common phone separators before matching or storing', () => {
    expect(normalizeContactPhone(' 177-7011 3605 ')).toBe('17770113605');
    expect(normalizeContactPhone('177 7011-3605')).toBe('17770113605');
  });

  it('maps negative replies into contact restrictions', () => {
    expect(
      inferContactRestrictionFromReply({
        replyContent: '暂时不需要',
        replyStatus: 'NEGATIVE',
      }),
    ).toEqual({
      reason: '暂时不需要',
      restrictionType: 'NEGATIVE_REPLY',
    });
  });

  it('treats unsubscribe language as a stronger restriction than negative', () => {
    expect(
      inferContactRestrictionFromReply({
        replyContent: '请不要再联系我',
        replyStatus: 'NEGATIVE',
      }),
    ).toEqual({
      reason: '请不要再联系我',
      restrictionType: 'UNSUBSCRIBED',
    });
  });

  it('recognizes blacklist status or content', () => {
    expect(
      inferContactRestrictionFromReply({
        replyContent: '客户要求拉黑',
        replyStatus: 'REPLIED',
      }),
    ).toEqual({
      reason: '客户要求拉黑',
      restrictionType: 'BLACKLIST',
    });
    expect(mapRestrictionReason('BLACKLIST')).toBe('该联系人已加入触达限制');
  });

  it('does not restrict positive replies', () => {
    expect(
      inferContactRestrictionFromReply({
        replyContent: '可以安排看厂',
        replyStatus: 'POSITIVE',
      }),
    ).toBeNull();
  });

  it('lists contact restrictions with pagination and summary', async () => {
    mockedPrisma.$queryRawUnsafe = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        {
          activeRestrictions: 1,
          blacklistRestrictions: 0,
          negativeReplyRestrictions: 0,
          releasedRestrictions: 0,
          totalRestrictions: 1,
          unsubscribedRestrictions: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          contactName: '张三',
          createTime: '2026-05-25T08:00:00.000Z',
          enterpriseId: 11,
          enterpriseName: '测试企业',
          leadId: 22,
          parkName: '测试园区',
          phoneNumber: '17770113605',
          reason: '请不要再联系我',
          restrictionId: 33,
          restrictionType: 'UNSUBSCRIBED',
          status: 'ACTIVE',
          updateTime: '2026-05-25T08:00:00.000Z',
        },
      ]);

    const result = await listContactRestrictions({
      currentPage: 2,
      keyword: '测试',
      pageSize: 5,
      status: 'ACTIVE',
    });

    expect(result.total).toBe(1);
    expect(result.page).toEqual({ currentPage: 2, pageSize: 5, total: 1 });
    expect(result.summary.unsubscribedRestrictions).toBe(1);
    expect(result.items[0]).toMatchObject({
      leadId: 22,
      restrictionId: 33,
      restrictionType: 'UNSUBSCRIBED',
    });
  });

  it('releases active contact restrictions', async () => {
    mockedPrisma.$queryRawUnsafe = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          restrictionId: 33,
          status: 'ACTIVE',
        },
      ]);

    const result = await releaseContactRestriction(33);

    expect(result).toEqual({ restrictionId: 33, status: 'RELEASED' });
    expect(mockedPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'RELEASED'"),
      33,
    );
  });
});
