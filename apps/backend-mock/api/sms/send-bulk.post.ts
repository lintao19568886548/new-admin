import CryptoJS from 'crypto-js';
import dayjs from 'dayjs';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const now = dayjs();

    // 查询符合条件的租户：
    // 1. 合同状态为生效中（合同结束日期大于当前日期）
    // 2. 合同截止日期少于90天 或 下次递增时间少于30天
    const tenants = await prismaClient.rentalTenant.findMany({
      where: {
        // 合同还未到期（生效中）
        contractEnd: {
          gt: now.toDate(),
        },
        OR: [
          // 合同截止日期少于90天
          {
            contractEnd: {
              lte: now.add(90, 'day').toDate(),
            },
          },
          // 这里需要根据increaseData计算下次递增时间少于30天的条件
          // 由于increaseData是JSON字符串，需要在应用层处理
        ],
      },
    });

    // 过滤出需要发送短信的租户（包含递增时间检查）
    const eligibleTenants = tenants.filter((tenant) => {
      // 检查合同截止日期
      const contractEndDate = dayjs(tenant.contractEnd);
      const daysToContractEnd = contractEndDate.diff(now, 'day');

      if (daysToContractEnd <= 90) {
        return true;
      }

      // 检查递增时间
      if (tenant.increaseData) {
        try {
          const increaseData = JSON.parse(tenant.increaseData as string);
          if (Array.isArray(increaseData) && increaseData.length > 0) {
            const contractStartDate = dayjs(tenant.contractStart);

            // 计算下次递增日期
            for (const increase of increaseData) {
              if (increase.date && increase.rate) {
                const nextIncreaseDate = contractStartDate.add(
                  increase.date,
                  'year',
                );
                const daysToIncrease = nextIncreaseDate.diff(now, 'day');

                // 如果下次递增时间少于30天
                if (daysToIncrease <= 30 && daysToIncrease > 0) {
                  return true;
                }
              }
            }
          }
        } catch (error) {
          console.error('解析递增数据失败:', error);
        }
      }

      return false;
    });

    if (eligibleTenants.length === 0) {
      return useResponseSuccess({
        message: '没有符合条件的租户需要发送短信',
        data: { count: 0 },
      });
    }

    // 批量发送短信
    const results = [];
    const errors = [];

    for (const tenant of eligibleTenants) {
      try {
        // 计算递增日期和合同到期日期
        let increaseDate = '';
        if (tenant.increaseData) {
          try {
            const increaseData = JSON.parse(tenant.increaseData as string);
            if (Array.isArray(increaseData) && increaseData.length > 0) {
              const contractStartDate = dayjs(tenant.contractStart);
              const nextIncrease = increaseData.find((increase) => {
                const nextIncreaseDate = contractStartDate.add(
                  increase.date,
                  'year',
                );
                return nextIncreaseDate.isAfter(now);
              });
              if (nextIncrease) {
                increaseDate = contractStartDate
                  .add(nextIncrease.date, 'year')
                  .format('YYYY-MM-DD');
              }
            }
          } catch (error) {
            console.error('解析递增数据失败:', error);
          }
        }

        const contractEndDate = dayjs(tenant.contractEnd).format('YYYY-MM-DD');

        // 准备发送到第三方SMS服务的数据
        const smsData = {
          MchId: process.env.SMS_MCH_ID,
          AppId: process.env.SMS_APP_ID,
          Version: '1.2.0',
          Type: '2',
          SignName: '【东莞市宜租网络科技有限公司】',
          SessionContextSet: [
            '尊敬的{%1%}，您好！您的合同递增比例将于 {%2%} 进行变更，合同到期日是{%3%}，请留意查收。',
          ],
          ContextParamSet: [
            [
              tenant.phoneNumber,
              tenant.tenantName,
              increaseDate,
              contractEndDate,
            ],
          ],
          TimeStamp: Math.round(Date.now()).toString(),
          SignType: 'MD5',
          Signature: '',
        };

        // 生成签名
        const appKey = process.env.SMS_SECRET_KEY;
        const sortedParams = {};
        const sortedKeys = Object.keys(smsData).sort();
        for (const key of sortedKeys) {
          if (
            ![
              'ContextParamSet',
              'PhoneList',
              'PhoneNumberSet',
              'phoneSet',
              'SessionContext',
              'SessionContextSet',
              'Signature',
              'TemplateParamSet',
            ].includes(key)
          ) {
            sortedParams[key] = smsData[key];
          }
        }

        const stringToSign = `${Object.entries(sortedParams)
          .map(([key, value]) => `${key}=${value}`)
          .join('&')}&key=${appKey}`;

        const signature = CryptoJS.MD5(stringToSign).toString().toUpperCase();
        smsData.Signature = signature;

        // 发送到第三方SMS服务
        const response = await fetch(
          'https://apis.shlianlu.com/sms/trade/personal/send',
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json;charset=utf-8',
            },
            body: JSON.stringify(smsData),
          },
        );

        if (!response.ok) {
          throw new Error(`SMS服务响应错误: ${response.status}`);
        }

        const result = await response.json();

        // 更新租户的短信发送时间
        await prismaClient.rentalTenant.update({
          where: {
            rentalTenantId: tenant.rentalTenantId,
          },
          data: {
            sendMessage: new Date(),
          },
        });

        results.push({
          tenantId: tenant.rentalTenantId,
          tenantName: tenant.tenantName,
          phoneNumber: tenant.phoneNumber,
          success: true,
          result,
        });
      } catch (error) {
        console.error(`发送短信失败 - 租户: ${tenant.tenantName}`, error);
        errors.push({
          tenantId: tenant.rentalTenantId,
          tenantName: tenant.tenantName,
          phoneNumber: tenant.phoneNumber,
          success: false,
          error: error.message,
        });
      }
    }

    return useResponseSuccess({
      message: `批量发送短信完成，成功: ${results.length}，失败: ${errors.length}`,
      data: {
        total: eligibleTenants.length,
        success: results.length,
        failed: errors.length,
        results,
        errors,
      },
    });
  } catch (error) {
    console.error('批量发送短信失败:', error);
    return useResponseError('批量发送短信失败', 500);
  }
});
