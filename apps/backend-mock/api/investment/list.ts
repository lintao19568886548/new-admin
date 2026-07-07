import { prismaClient } from '~/utils/db';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';

const INVESTMENT_FOLLOWUP_PROGRESS_VALUES = [
  '初步接洽',
  '深入沟通',
  '合同准备',
];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDayDiff(target: Date, reference: Date) {
  return Math.ceil(
    (startOfDay(target).getTime() - startOfDay(reference).getTime()) /
      86_400_000,
  );
}

function getInvestmentProgressStage(progress?: null | string) {
  const text = String(progress || '');
  if (text.includes('签约')) {
    return 'signed';
  }
  if (text.includes('合同')) {
    return 'contract';
  }
  if (
    text.includes('深入') ||
    text.includes('沟通') ||
    text.includes('谈判') ||
    text.includes('报价') ||
    text.includes('看房') ||
    text.includes('跟进')
  ) {
    return 'active';
  }
  if (text.includes('初步') || text.includes('接洽')) {
    return 'initial';
  }
  return 'unknown';
}

function getInvestmentIntentLevel(intentLevel?: null | string) {
  const level = String(intentLevel || '').toLowerCase();
  if (level.includes('很高') || level.startsWith('a')) {
    return 'very_high';
  }
  if (level.includes('高')) {
    return 'high';
  }
  if (level.includes('中') || level.includes('一般') || level.startsWith('b')) {
    return 'medium';
  }
  return 'low';
}

function getInvestmentMeetingRisk(
  progress?: null | string,
  meetingTime?: Date | null,
) {
  if (!meetingTime) {
    return 0;
  }

  const stage = getInvestmentProgressStage(progress);
  const daysUntilMeeting = getDayDiff(meetingTime, new Date());
  if (daysUntilMeeting >= 0) {
    return Math.max(30 - daysUntilMeeting, 0);
  }

  const overdueDays = Math.min(Math.abs(daysUntilMeeting), 60);
  switch (stage) {
    case 'active': {
      return 55 + overdueDays;
    }
    case 'contract': {
      return 90 + overdueDays;
    }
    case 'initial': {
      return 25 + Math.min(overdueDays, 20);
    }
    default: {
      return 40 + Math.min(overdueDays, 30);
    }
  }
}

function getInvestmentProgressRisk(progress?: null | string) {
  switch (getInvestmentProgressStage(progress)) {
    case 'active': {
      return 45;
    }
    case 'contract': {
      return 80;
    }
    case 'initial': {
      return 10;
    }
    default: {
      return 0;
    }
  }
}

function getInvestmentIntentRisk(intentLevel?: null | string) {
  switch (getInvestmentIntentLevel(intentLevel)) {
    case 'high': {
      return 40;
    }
    case 'medium': {
      return 20;
    }
    case 'very_high': {
      return 50;
    }
    default: {
      return 0;
    }
  }
}

function getInvestmentRiskScore(item: {
  intentLevel?: null | string;
  meetingTime?: Date | null;
  progress?: null | string;
}) {
  return (
    getInvestmentMeetingRisk(item.progress, item.meetingTime) +
    getInvestmentProgressRisk(item.progress) +
    getInvestmentIntentRisk(item.intentLevel)
  );
}

function compareInvestmentRisk(first: any, second: any) {
  const riskDiff =
    getInvestmentRiskScore(second) - getInvestmentRiskScore(first);
  if (riskDiff !== 0) {
    return riskDiff;
  }

  const firstTime = new Date(
    first.meetingTime || first.createTime || 0,
  ).getTime();
  const secondTime = new Date(
    second.meetingTime || second.createTime || 0,
  ).getTime();
  return secondTime - firstTime;
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const query = getQuery(event);
  const {
    agentName,
    currentPage,
    currentPark,
    endTime,
    intentArea,
    intentLevel,
    pageSize,
    progress,
    startTime,
    tenantName,
    todoView,
  } = query;

  const where: any = {};
  const accessibleParkIds =
    userinfo.parks
      ?.map((park: { parkId: number }) => Number(park.parkId))
      .filter((parkId: number) => Number.isInteger(parkId) && parkId > 0) ?? [];

  if (accessibleParkIds.length === 0) {
    return useResponseSuccess({
      items: [],
      total: 0,
    });
  }

  if (currentPark && Number(currentPark) > 0) {
    const parkId = Number(currentPark);
    if (!accessibleParkIds.includes(parkId)) {
      return useResponseError('没有查看权限');
    }
    where.parkId = parkId;
  } else {
    where.parkId = {
      in: accessibleParkIds,
    };
  }

  if (agentName) {
    where.agentName = {
      contains: agentName,
    };
  }

  if (tenantName) {
    where.tenantName = {
      contains: tenantName,
    };
  }

  if (intentLevel) {
    where.intentLevel = {
      equals: intentLevel,
    };
  }

  if (intentArea) {
    const areaQuery = String(intentArea).split(',');
    if (areaQuery[0] === 'equal' && areaQuery[1]) {
      const value = Number.parseFloat(areaQuery[1]);
      if (!Number.isNaN(value)) {
        where.intentArea = { equals: value };
      }
    } else if (areaQuery[0] === 'between' && areaQuery[1] && areaQuery[2]) {
      const min = Number.parseFloat(areaQuery[1]);
      const max = Number.parseFloat(areaQuery[2]);
      if (!Number.isNaN(min) && !Number.isNaN(max)) {
        where.intentArea = {
          gte: min,
          lte: max,
        };
      }
    }
  }

  if (progress) {
    where.progress = {
      equals: progress,
    };
  } else if (todoView === 'followup') {
    where.progress = {
      in: INVESTMENT_FOLLOWUP_PROGRESS_VALUES,
    };
  }

  if (startTime && endTime) {
    where.meetingTime = {
      gte: new Date(startTime as string),
      lte: new Date(endTime as string),
    };
  }

  const page = Number(currentPage) || 1;
  const size = Number(pageSize) || 20;

  const { items, total } = await runWithRadarSharedScope(async () => {
    const candidateItems = await prismaClient.investment.findMany({
      select: {
        agentName: true,
        createTime: true,
        intentArea: true,
        intentLevel: true,
        investmentId: true,
        meetingTime: true,
        parkId: true,
        phoneNumber: true,
        progress: true,
        tenantName: true,
        updateTime: true,
      },
      where,
    });
    const sortedCandidates = candidateItems.sort(compareInvestmentRisk);
    const total = sortedCandidates.length;
    const paginatedIds = sortedCandidates
      .slice((page - 1) * size, page * size)
      .map((item) => item.investmentId);
    const detailItems =
      paginatedIds.length === 0
        ? []
        : await prismaClient.investment.findMany({
            include: {
              images: {
                include: {
                  image: true,
                },
              },
              park: {
                select: {
                  parkName: true,
                },
              },
            },
            where: {
              investmentId: {
                in: paginatedIds,
              },
            },
          });
    const detailItemMap = new Map(
      detailItems.map((item) => [item.investmentId, item]),
    );

    return {
      items: paginatedIds.flatMap((investmentId) => {
        const item = detailItemMap.get(investmentId);
        if (!item) {
          return [];
        }

        const imageUrls = item.images.map((img) => img.image.imgUrl);

        return [
          {
            ...item,
            imageUrlList: imageUrls,
            images: undefined,
            park: undefined,
            parkName: item.park?.parkName,
          },
        ];
      }),
      total,
    };
  });

  return useResponseSuccess({
    items,
    total,
  });
});
