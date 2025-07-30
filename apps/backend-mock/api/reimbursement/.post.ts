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
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  console.log('请求体参数:', body);
  // 兼容旧版逻辑，过滤claimant字段
  const { images, ...reimbursementData } = body;
  const userId = userinfo.id;
  try {
    // 创建报销记录并关联图片
    const reimbursement = await prismaClient.reimbursement.create({
      data: {
        ...reimbursementData,
        userId,
        // 关联图片
        images: {
          create:
            images?.map((image: { imgId: number }) => ({
              image: {
                connect: { imgId: image.imgId },
              },
            })) || [],
        },
      },
      // 包含关联的图片信息在返回结果中
      include: {
        images: {
          include: {
            image: true,
          },
        },
      },
    });

    console.log('插入报销数据成功:', reimbursement);
    return useResponseSuccess(reimbursement);
  } catch (error) {
    console.error('插入报销数据失败:', error);
    return useResponseError('插入报销数据失败', 500);
  }
});
