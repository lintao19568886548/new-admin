import { defineRequest } from '@vben/request';
import { getErrorMessage } from '@vben/utils';

import { prisma } from '../../_prisma';

/**
 * @description 创建打卡记录
 */
export const createLocalization = defineRequest({
  handler: async (req) => {
    try {
      const { punchTime, username, address, status, userId } = req.body;

      if (!punchTime || !username || !address || !status || !userId) {
        return {
          error: '缺少必要的参数',
          statusCode: 400,
        };
      }

      const localization = await prisma.localization.create({
        data: {
          address,
          punchTime: new Date(punchTime),
          status,
          user: {
            connect: {
              id: userId,
            },
          },
          username,
        },
      });

      return {
        data: localization,
      };
    } catch (error) {
      return {
        error: getErrorMessage(error),
        statusCode: 500,
      };
    }
  },
  url: '/api/localization',
  method: 'POST',
});
