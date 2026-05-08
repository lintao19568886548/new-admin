import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

const INTENT_LEVELS = ['很高', '高', '一般', '低', '很低'] as const;

type IntentLevel = (typeof INTENT_LEVELS)[number];

function emptyStats() {
  return {
    intentLevels: INTENT_LEVELS.map((name) => ({ name, value: 0 })),
    negotiationProgress: [],
    summary: {
      currentMonthNewCustomers: 0,
      negotiatingCustomers: 0,
      receivedCustomers: 0,
      totalCustomers: 0,
    },
  };
}

function normalizeIntentLevel(intentLevel: string): IntentLevel {
  if ((INTENT_LEVELS as readonly string[]).includes(intentLevel)) {
    return intentLevel as IntentLevel;
  }

  return '一般';
}

function resolveParkIds(
  queryParkId: unknown,
  authorizedParkIds: number[],
): null | number[] {
  if (queryParkId === undefined || queryParkId === 'all') {
    return authorizedParkIds;
  }

  const parkId = Number(queryParkId);
  if (!Number.isFinite(parkId) || !authorizedParkIds.includes(parkId)) {
    return null;
  }

  return [parkId];
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const authorizedParkIds =
      userinfo.parks?.map((park) => Number(park.parkId)).filter(Boolean) ?? [];

    if (authorizedParkIds.length === 0) {
      return useResponseSuccess(emptyStats());
    }

    const query = getQuery(event);
    const parkIds = resolveParkIds(query.parkId, authorizedParkIds);
    if (!parkIds) {
      return useResponseSuccess(emptyStats());
    }

    const investments = await prismaClient.investment.findMany({
      select: {
        intentLevel: true,
        progress: true,
      },
      where: {
        parkId: {
          in: parkIds,
        },
      },
    });

    const progressCounts = new Map<string, number>();
    const intentLevelCounts = new Map<IntentLevel, number>(
      INTENT_LEVELS.map((level) => [level, 0]),
    );
    let signedCustomers = 0;

    for (const investment of investments) {
      const intentLevel = normalizeIntentLevel(investment.intentLevel);
      intentLevelCounts.set(
        intentLevel,
        (intentLevelCounts.get(intentLevel) || 0) + 1,
      );

      const progress = investment.progress?.trim();
      if (progress) {
        progressCounts.set(progress, (progressCounts.get(progress) || 0) + 1);
        if (progress === '签约完成') {
          signedCustomers++;
        }
      }
    }

    return useResponseSuccess({
      intentLevels: INTENT_LEVELS.map((name) => ({
        name,
        value: intentLevelCounts.get(name) || 0,
      })),
      negotiationProgress: [...progressCounts.entries()].map(
        ([name, value]) => ({
          name,
          value,
        }),
      ),
      summary: {
        currentMonthNewCustomers: signedCustomers,
        negotiatingCustomers: investments.length,
        receivedCustomers: investments.length,
        totalCustomers: investments.length,
      },
    });
  } catch (error) {
    console.error('获取客户总览统计数据失败:', error);
    return serverErrorResponse('获取客户总览统计数据失败', event);
  }
});
