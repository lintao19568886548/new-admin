import { prismaClient } from '~/utils/db';
import { serverErrorResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { currentPage, pageSize, user, park } = query;

    const where: { [key: string]: any } = {};

    if (user) {
      where.user = { contains: user };
    }

    if (park) {
      where.park = { contains: park };
    }

    const leaveApplications = await prismaClient.leaveApplication.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip: (Number(currentPage) - 1) * Number(pageSize),
      take: Number(pageSize),
    });

    const total = await prismaClient.leaveApplication.count({ where });

    const parks = await prismaClient.park.findMany({
      where: {
        isDeleted: false,
      },
      select: {
        parkId: true,
        parkName: true,
      },
    });

    return useResponseSuccess({
      items: leaveApplications,
      total,
      parks,
    });
  } catch (error) {
    console.error('获取请假申请列表失败:', error);
    return serverErrorResponse(`获取请假申请列表失败\n${error}`, event);
  }
});
