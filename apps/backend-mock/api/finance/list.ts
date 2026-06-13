import Nzh from 'nzh';
import { prismaClient } from '~/utils/db';
import { compareFinanceBillNameDesc } from '~/utils/finance-bill-name-period';
import { buildFinanceAmountWhere } from '~/utils/finance-query';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { syncRentalExpenseFinanceRecords } from '~/utils/rental-expense-finance';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

// 使用nzh库的简体中文转换器
const nzhcn = Nzh.cn;

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveEndTimeWhere(value: string) {
  const endDate = parseDate(value);
  if (!endDate) {
    return {};
  }

  const normalizedValue = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    const exclusiveEndDate = new Date(endDate);
    exclusiveEndDate.setDate(exclusiveEndDate.getDate() + 1);
    return { lt: exclusiveEndDate };
  }

  if (/[ T]23:59:59(?:\.000)?$/.test(normalizedValue)) {
    const exclusiveEndDate = new Date(endDate);
    exclusiveEndDate.setSeconds(exclusiveEndDate.getSeconds() + 1);
    return { lt: exclusiveEndDate };
  }

  return { lte: endDate };
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }

  try {
    const query = getQuery(event);
    console.log('后端收到的查询参数:', query);

    // 构建查询条件
    const where: any = {
      isDeleted: false,
    };

    // 账单名称模糊查询，支持中文数字和阿拉伯数字互相匹配
    if (query.billName) {
      const billNameStr = String(query.billName);

      // 尝试提取字符串中的数字部分
      const arabicNumbers = billNameStr.match(/\d+/g) || [];
      const chineseNumbers =
        billNameStr.match(/[零一二三四五六七八九十百千万亿]+/g) || [];

      // 准备OR查询条件
      const orConditions = [{ billName: { contains: billNameStr } }];

      // 转换阿拉伯数字到中文并添加到查询条件
      for (const num of arabicNumbers) {
        try {
          const chineseNum = nzhcn.encodeS(num);
          orConditions.push({ billName: { contains: chineseNum } });
        } catch (error) {
          console.warn(`转换阿拉伯数字 ${num} 到中文失败:`, error);
        }
      }

      // 转换中文数字到阿拉伯并添加到查询条件
      for (const num of chineseNumbers) {
        try {
          // 修复：确保转换后的阿拉伯数字是字符串类型
          const arabicNum = String(nzhcn.decodeS(num));
          orConditions.push({ billName: { contains: arabicNum } });
        } catch (error) {
          console.warn(`转换中文数字 ${num} 到阿拉伯数字失败:`, error);
        }
      }

      // 设置OR查询条件
      where.OR = orConditions;
    }

    // 账单类别精确匹配
    if (query.billCategory) {
      where.billCategory = String(query.billCategory);
    }

    // 交易类型精确匹配
    if (query.transactionType) {
      where.transactionType = String(query.transactionType);
    }

    // 状态精确匹配
    if (query.status) {
      where.status = Number(query.status);
    }

    // 金额范围查询，支持模糊查询
    if (query.amount) {
      where.amount = buildFinanceAmountWhere(query.amount);
    }

    // 日期范围查询
    if (query.startTime && query.endTime) {
      // 确保日期字符串包含时分秒，如果没有则添加默认值
      console.log('原始日期字符串:', {
        startTime: query.startTime,
        endTime: query.endTime,
      });
      const startTimeStr = String(query.startTime);
      const endTimeStr = String(query.endTime);

      // 转换为日期对象
      const startDate = parseDate(startTimeStr);
      const endDate = parseDate(endTimeStr);
      const endTimeWhere = resolveEndTimeWhere(endTimeStr);

      // 日志输出转换后的日期，便于调试
      console.log('日期范围查询:', {
        endTimeWhere,
        startTime: startTimeStr,
        endTime: endTimeStr,
        startDate,
        endDate,
      });

      if (startDate && endDate) {
        where.transactionTime = {
          gte: startDate,
          ...endTimeWhere,
        };
      }
    }

    const accessibleParkIds = userinfo.parks?.map((park) => park.parkId) ?? [];

    // 区域查询
    if (query.parkId) {
      if (Number(query.parkId) === -1) {
        if (accessibleParkIds.length > 0) {
          where.parkId = {
            in: accessibleParkIds,
          };
        } else {
          return useResponseSuccess({
            items: [],
            total: 0,
            currentPage: Number(query.currentPage) || 1,
            pageSize: Number(query.pageSize) || 20,
          });
        }
      } else if (
        userinfo.parks &&
        accessibleParkIds.includes(Number(query.parkId))
      ) {
        // 当用户有权限查看特定园区时
        const park = await prismaClient.park.findFirst({
          where: { parkId: Number(query.parkId) },
          select: { parkId: true },
        });

        if (park) {
          where.parkId = park.parkId;
        }
      } else {
        console.log('用户没有查看权限，当前用户parks:', userinfo.parks);
        console.log('请求查询的parkId:', query.parkId);
        // 非严格模式下，不返回错误，而是返回空结果
        return useResponseSuccess({
          items: [],
          total: 0,
          currentPage: Number(query.currentPage) || 1,
          pageSize: Number(query.pageSize) || 20,
        });
      }
    } else {
      if (accessibleParkIds.length > 0) {
        where.parkId = {
          in: accessibleParkIds,
        };
      } else {
        return useResponseSuccess({
          items: [],
          total: 0,
          currentPage: Number(query.currentPage) || 1,
          pageSize: Number(query.pageSize) || 20,
        });
      }
    }

    let syncParkIds: number[] | undefined;
    if (query.parkId && Number(query.parkId) !== -1) {
      syncParkIds = [Number(query.parkId)];
    } else if (accessibleParkIds.length > 0) {
      syncParkIds = accessibleParkIds;
    }

    await syncRentalExpenseFinanceRecords({
      minIntervalMs: 60_000,
      parkIds: syncParkIds,
    });

    console.log('构建的查询条件:', where);

    // 计算分页参数
    const currentPage = Number(query.currentPage) || 1;
    const pageSize = Number(query.pageSize) || 20;

    // 查询总记录数
    const total = await prismaClient.finance.count({
      where,
    });

    // 账单名称中带月份时，按账单所属月份倒序；否则回退交易时间倒序。
    const financeList = await prismaClient.finance.findMany({
      where,
      include: {
        images: true, // 包含关联的图片
      },
    });

    const sortedFinanceList = financeList
      .sort(compareFinanceBillNameDesc)
      .slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // console.log(
    //   `查询到 ${financeList.length} 条记录，总记录数: ${total}
    //   \n查询数据:`,
    //   financeList,
    // );

    // 返回带有分页信息的结果
    return useResponseSuccess({
      items: sortedFinanceList,
      total,
      currentPage,
      pageSize,
    });
  } catch (error) {
    console.error('查询财务数据失败:', error);
    return useResponseError('查询财务数据失败', 500);
  }
});
