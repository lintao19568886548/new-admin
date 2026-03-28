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

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const { category, currentPage, endTime, keyword, pageSize, startTime } =
    getQuery(event);

  const categoryValue = String(category || '').trim();
  const keywordValue = String(keyword || '').trim();
  const page = Math.max(Number(currentPage) || 1, 1);
  const size = Math.min(Math.max(Number(pageSize) || 20, 1), 100);

  if (categoryValue && !isFeedbackCategory(categoryValue)) {
    return badRequestResponse('反馈类型无效', event);
  }

  const where: Record<string, any> = {};

  if (categoryValue) {
    where.category = categoryValue;
  }

  if (keywordValue) {
    where.OR = [
      {
        content: {
          contains: keywordValue,
        },
      },
      {
        contact: {
          contains: keywordValue,
        },
      },
      {
        username: {
          contains: keywordValue,
        },
      },
      {
        realName: {
          contains: keywordValue,
        },
      },
    ];
  }

  if (startTime) {
    where.createTime = {
      ...where.createTime,
      gte: new Date(String(startTime)),
    };
  }

  if (endTime) {
    where.createTime = {
      ...where.createTime,
      lte: new Date(String(endTime)),
    };
  }

  try {
    const [total, feedbacks] = await Promise.all([
      prismaClient.feedback.count({ where }),
      prismaClient.feedback.findMany({
        orderBy: {
          createTime: 'desc',
        },
        skip: (page - 1) * size,
        take: size,
        where,
      }),
    ]);

    const feedbackIds = feedbacks.map((item) => item.id);
    const imageBindings =
      feedbackIds.length > 0
        ? await prismaClient.imageBinding.findMany({
            include: {
              image: {
                select: {
                  imgId: true,
                  imgUrl: true,
                },
              },
            },
            orderBy: [{ bizId: 'asc' }, { sort: 'asc' }],
            where: {
              bizId: {
                in: feedbackIds,
              },
              bizType: 'feedback',
              field: 'gallery',
            },
          })
        : [];

    const imagesByFeedbackId = new Map<
      number,
      Array<{
        field: null | string;
        id: number;
        imgId: number;
        imgUrl: string;
        sort: number;
      }>
    >();

    for (const binding of imageBindings) {
      if (!binding.image?.imgUrl) {
        continue;
      }
      const items = imagesByFeedbackId.get(binding.bizId) ?? [];
      items.push({
        field: binding.field,
        id: binding.id,
        imgId: binding.imgId,
        imgUrl: binding.image.imgUrl,
        sort: binding.sort,
      });
      imagesByFeedbackId.set(binding.bizId, items);
    }

    const items = feedbacks.map((item) => {
      const images = imagesByFeedbackId.get(item.id) ?? [];
      const categoryKey = String(item.category || '') as FeedbackCategory;

      return {
        category: item.category,
        categoryLabel: feedbackCategoryLabels[categoryKey] || item.category,
        centerUserId: item.centerUserId,
        clientPlatform: item.clientPlatform,
        contact: item.contact,
        content: item.content,
        createTime: item.createTime ? item.createTime.toISOString() : null,
        customerId: item.customerId,
        id: item.id,
        imageCount: images.length,
        images,
        realName: item.realName,
        source: item.source,
        updateTime: item.updateTime ? item.updateTime.toISOString() : null,
        userAgent: item.userAgent,
        userId: item.userId,
        username: item.username,
      };
    });

    return useResponseSuccess({
      items,
      total,
    });
  } catch (error) {
    console.error('获取反馈列表失败:', error);
    return serverErrorResponse('获取反馈列表失败', event);
  }
});
