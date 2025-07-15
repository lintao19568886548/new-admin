import { prismaClient } from '~/utils/db';
import { serverErrorResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { currentPage, pageSize, user, parkId } = query;

    const where: { [key: string]: any } = {};

    if (user) {
      where.user = { contains: user };
    }

    if (parkId) {
      where.parkId = Number(parkId);
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
