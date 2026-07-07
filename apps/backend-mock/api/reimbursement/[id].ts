import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const id = Number(event.context.params?.id);
    if (Number.isNaN(id)) {
      return useResponseError('无效的报销ID', 400);
    }

    // 查询报销记录
    const reimbursement = await prismaClient.reimbursement.findUnique({
      where: { id },
      include: {
        park: true,
        images: {
          include: {
            image: {
              select: {
                imgUrl: true,
              },
            },
          },
        },
      },
    });

    if (!reimbursement) {
      return useResponseError('未找到报销记录', 404);
    }

    return useResponseSuccess({
      ...reimbursement,
      imageCount: reimbursement.images.length,
      images: reimbursement.images
        .map((imageItem) => imageItem.image?.imgUrl)
        .filter(Boolean),
      park: reimbursement.park?.parkName || '',
    });
  } catch (error) {
    console.error('查询报销详情失败:', error);
    return useResponseError('查询报销详情失败', 500);
  }
});
