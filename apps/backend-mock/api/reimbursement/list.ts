import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

const DAY_MS = 24 * 60 * 60 * 1000;
const REIMBURSEMENT_URGENT_WAITING_DAYS = 7;
const REIMBURSEMENT_WARNING_WAITING_DAYS = 3;
const REIMBURSEMENT_URGENT_AMOUNT = 100_000;
const REIMBURSEMENT_WARNING_AMOUNT = 10_000;

function getReimbursementAuditBaseTime(item: {
  createTime?: Date | null;
  date?: Date | null;
}) {
  return item.createTime || item.date || new Date();
}

function getReimbursementAuditWaitingDays(item: {
  createTime?: Date | null;
  date?: Date | null;
  status?: null | number;
}) {
  if (Number(item.status) !== 0) {
    return 0;
  }

  const baseTime = getReimbursementAuditBaseTime(item).getTime();
  if (!Number.isFinite(baseTime)) {
    return 0;
  }

  return Math.max(Math.floor((Date.now() - baseTime) / DAY_MS), 0);
}

function getReimbursementAuditPriority(item: {
  amount?: unknown;
  createTime?: Date | null;
  date?: Date | null;
  status?: null | number;
}) {
  if (Number(item.status) !== 0) {
    return {
      auditPriority: 'done',
      auditPriorityLabel: '',
      auditPriorityReason: '',
      auditRiskScore: 0,
      auditWaitingDays: 0,
    };
  }

  const waitingDays = getReimbursementAuditWaitingDays(item);
  const amount = Number(item.amount || 0);
  if (
    waitingDays >= REIMBURSEMENT_URGENT_WAITING_DAYS ||
    amount >= REIMBURSEMENT_URGENT_AMOUNT
  ) {
    return {
      auditPriority: 'urgent',
      auditPriorityLabel: '紧急处理',
      auditPriorityReason:
        waitingDays >= REIMBURSEMENT_URGENT_WAITING_DAYS
          ? `已等待 ${waitingDays} 天`
          : '大额报销',
      auditRiskScore: 3,
      auditWaitingDays: waitingDays,
    };
  }

  if (
    waitingDays >= REIMBURSEMENT_WARNING_WAITING_DAYS ||
    amount >= REIMBURSEMENT_WARNING_AMOUNT
  ) {
    return {
      auditPriority: 'warning',
      auditPriorityLabel: '重点关注',
      auditPriorityReason:
        waitingDays >= REIMBURSEMENT_WARNING_WAITING_DAYS
          ? `已等待 ${waitingDays} 天`
          : '金额较高',
      auditRiskScore: 2,
      auditWaitingDays: waitingDays,
    };
  }

  return {
    auditPriority: 'normal',
    auditPriorityLabel: '常规审核',
    auditPriorityReason:
      waitingDays > 0 ? `已等待 ${waitingDays} 天` : '今日提交',
    auditRiskScore: 1,
    auditWaitingDays: waitingDays,
  };
}

function buildReimbursementListInclude(imageMode: unknown) {
  const imageSummaryMode = imageMode === 'summary';
  return imageSummaryMode
    ? {
        _count: {
          select: {
            images: true,
          },
        },
        images: {
          include: {
            image: {
              select: {
                imgUrl: true,
              },
            },
          },
          orderBy: {
            createTime: 'asc' as const,
          },
          take: 1,
        },
        park: true,
      }
    : {
        images: {
          include: {
            image: {
              select: {
                imgUrl: true,
              },
            },
          },
        },
        park: true,
      };
}

function mapReimbursementListItem(item: any) {
  const images = Array.isArray(item.images)
    ? item.images
        .map((imageItem: any) => imageItem.image?.imgUrl)
        .filter(Boolean)
    : [];
  const imageCount = Number(item._count?.images ?? images.length);
  const { _count, ...rest } = item;

  return {
    ...rest,
    ...getReimbursementAuditPriority(item),
    imageCount,
    images,
    park: item.park?.parkName || '',
  };
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const query = getQuery(event);
    console.log('后端收到的查询参数:', query);
    const hasAuditPermission = (userinfo.reimbursementAuth || 0) > 0;
    const allowedParkIds = (userinfo.parks || [])
      .map((park) => Number(park.parkId))
      .filter((parkId) => !Number.isNaN(parkId));

    // 构建查询条件
    const where: any = {
      isDeleted: false,
    };

    // 兼容旧版本查询
    if (query.claimant) {
      where.claimant = String(query.claimant);
    }
    if (hasAuditPermission) {
      if (allowedParkIds.length === 0) {
        return useResponseSuccess({
          items: [],
          total: 0,
        });
      }
      where.parkId = {
        in: allowedParkIds,
      };
    } else {
      // 非审核人员只能查看自己的申请记录
      where.userId = userinfo.id;
    }

    // 用途模糊查询
    if (query.purpose) {
      where.purpose = { contains: String(query.purpose) };
    }

    // 部门查询
    if (query.department) {
      where.department = String(query.department);
    }

    // 领款人模糊查询
    if (query.payee) {
      where.payee = { contains: String(query.payee) };
    }

    // 日期范围查询
    if (query.startDate) {
      where.date = {
        ...where.date,
        gte: new Date(String(query.startDate)),
      };
    }

    if (query.endDate) {
      where.date = {
        ...where.date,
        lte: new Date(String(query.endDate)),
      };
    }

    if (query.status !== undefined && query.status !== '') {
      where.status = Number(query.status);
    }

    if (query.parkId) {
      const parkId = Number(query.parkId);
      if (Number.isNaN(parkId)) {
        return useResponseError('园区参数无效', 400);
      }
      if (hasAuditPermission && !allowedParkIds.includes(parkId)) {
        return useResponseSuccess({
          items: [],
          total: 0,
        });
      }
      where.parkId = parkId;
    }

    // 分页参数
    const pageNo = Number(query.pageNo) || 1;
    const pageSize = Number(query.pageSize) || 10;
    const skip = (pageNo - 1) * pageSize;
    const pendingAuditView = Number(query.status) === 0;
    const listInclude = buildReimbursementListInclude(query.imageMode);

    if (pendingAuditView) {
      const [total, reimbursements] = await Promise.all([
        prismaClient.reimbursement.count({ where }),
        prismaClient.reimbursement.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: [{ createTime: 'asc' }, { amount: 'desc' }, { id: 'desc' }],
          include: listInclude,
        }),
      ]);

      return useResponseSuccess({
        items: reimbursements.map((item) => mapReimbursementListItem(item)),
        total,
      });
    }

    const [total, reimbursements] = await Promise.all([
      prismaClient.reimbursement.count({ where }),
      prismaClient.reimbursement.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ createTime: 'desc' as const }, { id: 'desc' as const }],
        include: listInclude,
      }),
    ]);

    return useResponseSuccess({
      items: reimbursements.map((item) => mapReimbursementListItem(item)),
      total,
    });
  } catch (error) {
    console.error('查询报销数据失败:', error);
    return useResponseError('查询报销数据失败', 500);
  }
});
