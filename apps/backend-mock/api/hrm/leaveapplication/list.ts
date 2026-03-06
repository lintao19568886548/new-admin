import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const query = getQuery(event);
    const { currentPage, pageSize, user, parkId } = query;

    const where: { [key: string]: any } = {};
    const roleNames = userinfo.roles ?? [];
    const isSuper =
      roleNames.includes('Super') ||
      roleNames.includes('董事长') ||
      roleNames.includes('人事部');

    if (user) {
      where.user = { contains: user };
    }

    if (parkId) {
      where.parkId = Number(parkId);
    }

    if (!isSuper) {
      where.userId = userinfo.id;
    }

    const leaveApplicationsRaw = await prismaClient.leaveApplication.findMany({
      where,
      orderBy: {
        createdTime: 'desc',
      },
      skip: (Number(currentPage) - 1) * Number(pageSize),
      take: Number(pageSize),
      include: {
        applicant: { select: { realName: true } },
        parkInfo: { select: { parkName: true } },
        auditor: { select: { realName: true } },
      },
    });

    const total = await prismaClient.leaveApplication.count({ where });

    const leaveApplications = leaveApplicationsRaw.map((app) => ({
      ...app,
      user: app.applicant?.realName || app.user,
      park: app.parkInfo?.parkName || app.park,
      auditUser: app.auditor?.realName || app.auditUser,
    }));

    return useResponseSuccess({
      items: leaveApplications,
      total,
    });
  } catch (error) {
    console.error('获取请假申请列表失败:', error);
    return serverErrorResponse(`获取请假申请列表失败`, event);
  }
});
