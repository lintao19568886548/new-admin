import dotenv from 'dotenv';

dotenv.config({ path: 'apps/backend-mock/.env' });
dotenv.config({ path: '.env' });

const { noticesPrismaClient } = await import('../utils/notices-db');

const [total, valid, invalid, unchecked, invalidByReason] = await Promise.all([
  noticesPrismaClient.notice.count(),
  noticesPrismaClient.notice.count({ where: { isValid: true } }),
  noticesPrismaClient.notice.count({ where: { isValid: false } }),
  noticesPrismaClient.notice.count({
    where: {
      isValid: true,
      lastCheckedAt: null,
    },
  }),
  noticesPrismaClient.notice.groupBy({
    _count: { _all: true },
    by: ['invalidReason'],
    where: { isValid: false },
  }),
]);

console.log(
  JSON.stringify({
    invalid,
    invalidByReason: invalidByReason.map((item) => ({
      count: item._count._all,
      reason: item.invalidReason || 'UNKNOWN',
    })),
    total,
    unchecked,
    valid,
  }),
);

await noticesPrismaClient.$disconnect();
