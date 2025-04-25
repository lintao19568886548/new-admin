import Nzh from 'nzh';
import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

// 使用nzh库的简体中文转换器
const nzhcn = Nzh.cn;

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
    const where: any = {};

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

    // 金额范围查询，支持模糊查询
    if (query.amount) {
      const amountStr = String(query.amount);

      // 检查是否包含比较运算符
      if (amountStr.startsWith('>')) {
        // 大于查询
        const value = Number(amountStr.slice(1));
        where.amount = { gt: value };
      } else if (amountStr.startsWith('>=')) {
        // 大于等于查询
        const value = Number(amountStr.slice(2));
        where.amount = { gte: value };
      } else if (amountStr.startsWith('<')) {
        // 小于查询
        const value = Number(amountStr.slice(1));
        where.amount = { lt: value };
      } else if (amountStr.startsWith('<=')) {
        // 小于等于查询
        const value = Number(amountStr.slice(2));
        where.amount = { lte: value };
      } else if (amountStr.includes('-')) {
        // 范围查询，例如 "100-200"
        const [min, max] = amountStr.split('-').map(Number);
        where.amount = {
          gte: min,
          lte: max,
        };
      } else {
        // 精确匹配
        where.amount = Number(amountStr);
      }
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
      const startDate = new Date(startTimeStr);
      const endDate = new Date(endTimeStr);

      // 日志输出转换后的日期，便于调试
      console.log('日期范围查询:', {
        startTime: startTimeStr,
        endTime: endTimeStr,
        startDate,
        endDate,
      });

      where.transactionTime = {
        gte: startDate,
        lte: endDate,
      };
    }

    // 区域查询
    if (query.currentPark) {
      if (Number(query.currentPark) === -1) {
        // 选择全部区域时,直接查询全部有权限的园区
        const parks = await prismaClient.park.findMany({
          where: {
            parkName: {
              in: userinfo.parks.map((park) => park.parkName),
            },
          },
          select: { parkId: true },
        });

        if (parks.length > 0) {
          where.parkId = {
            in: parks.map((park) => park.parkId),
          };
        }
      } else if (
        userinfo.parks
          .map((park) => park.parkId)
          .includes(Number(query.currentPark))
      ) {
        // 当用户有权限查看特定园区时
        const park = await prismaClient.park.findFirst({
          where: { parkId: Number(query.currentPark) },
          select: { parkId: true },
        });

        if (park) {
          where.parkId = park.parkId;
        }
      } else {
        return useResponseError('没有查看权限');
      }
    }

    console.log('构建的查询条件:', where);

    // 计算分页参数
    const currentPage = Number(query.currentPage) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const skip = (currentPage - 1) * pageSize;

    // 查询总记录数
    const total = await prismaClient.finance.count({
      where,
    });

    // 执行分页查询
    const financeList = await prismaClient.finance.findMany({
      where,
      orderBy: {
        transactionTime: 'desc',
      },
      skip,
      take: pageSize,
    });

    // console.log(
    //   `查询到 ${financeList.length} 条记录，总记录数: ${total}
    //   \n查询数据:`,
    //   financeList,
    // );

    // 返回带有分页信息的结果
    return useResponseSuccess({
      items: financeList,
      total,
      currentPage,
      pageSize,
    });
  } catch (error) {
    console.error('查询财务数据失败:', error);
    return useResponseError('查询财务数据失败', 500);
  }
});
