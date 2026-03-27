import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

type FeedbackCategory = 'bug' | 'experience' | 'feature' | 'other';

const feedbackCategoryLabels: Record<FeedbackCategory, string> = {
  bug: '问题异常',
  experience: '体验优化',
  feature: '功能建议',
  other: '其他反馈',
};

function isFeedbackCategory(value: string): value is FeedbackCategory {
  return Object.prototype.hasOwnProperty.call(feedbackCategoryLabels, value);
}

function normalizeImageIds(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return [
    ...new Set(
      input
        .map((item) => Number((item as { imgId?: unknown })?.imgId))
        .filter((imgId) => Number.isFinite(imgId) && imgId > 0),
    ),
  ];
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = (await readBody(event)) as Record<string, unknown>;
  const category = String(body.category || '').trim();
  const content = String(body.content || '').trim();
  const contact = String(body.contact || '').trim();
  const clientPlatform = String(body.clientPlatform || '').trim();
  const imageIds = normalizeImageIds(body.images);
  const userId = Number(userinfo.id || 0);
  const customerId = String(
    userinfo.customerId || process.env.DEFAULT_CUSTOMER_ID || 'default',
  );

  if (!isFeedbackCategory(category)) {
    return badRequestResponse('反馈类型无效', event);
  }
  if (!Number.isFinite(userId) || userId <= 0) {
    return badRequestResponse('当前账号信息无效', event);
  }
  if (!content) {
    return badRequestResponse('请输入反馈内容', event);
  }
  if (content.length < 10) {
    return badRequestResponse('反馈内容不能少于 10 个字符', event);
  }
  if (content.length > 500) {
    return badRequestResponse('反馈内容不能超过 500 个字符', event);
  }
  if (contact.length > 50) {
    return badRequestResponse('联系方式不能超过 50 个字符', event);
  }
  if (clientPlatform.length > 20) {
    return badRequestResponse('客户端标识无效', event);
  }

  try {
    if (imageIds.length > 0) {
      const existingImages = await prismaClient.image.findMany({
        select: { imgId: true },
        where: {
          imgId: {
            in: imageIds,
          },
        },
      });

      if (existingImages.length !== imageIds.length) {
        return badRequestResponse(
          '存在无效的反馈图片，请重新上传后再试',
          event,
        );
      }
    }

    const feedbackId = await prismaClient.$transaction(async (tx) => {
      const feedback = await tx.feedback.create({
        data: {
          category,
          content,
          contact: contact || null,
          clientPlatform: clientPlatform || null,
          source: 'profile',
          userAgent: getHeader(event, 'user-agent') || null,
          userId,
          username: String(userinfo.username || '') || null,
          realName: String(userinfo.realName || '') || null,
          centerUserId: Number(userinfo.centerUserId || 0) || null,
          customerId,
        },
        select: {
          id: true,
        },
      });

      const insertedFeedbackId = feedback.id;

      if (!Number.isFinite(insertedFeedbackId) || insertedFeedbackId <= 0) {
        throw new Error('Failed to resolve inserted feedback id');
      }

      if (imageIds.length > 0) {
        await tx.imageBinding.createMany({
          data: imageIds.map((imgId, index) => ({
            bizType: 'feedback',
            bizId: insertedFeedbackId,
            imgId,
            field: 'gallery',
            sort: index,
          })),
        });
      }

      return insertedFeedbackId;
    });

    return useResponseSuccess(
      {
        categoryLabel: feedbackCategoryLabels[category],
        feedbackId,
      },
      '反馈已提交，感谢您的建议',
    );
  } catch (error) {
    console.error('创建意见反馈失败:', error);
    return serverErrorResponse('创建意见反馈失败', event);
  }
});
