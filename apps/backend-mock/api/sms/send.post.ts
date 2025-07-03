import CryptoJS from 'crypto-js';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const body = await readBody(event);
    const {
      tenantName,
      increaseDate,
      contractEndDate,
      phoneNumber,
      rentalTenantId,
    } = body;

    // 验证必要参数
    if (
      !tenantName ||
      !increaseDate ||
      !contractEndDate ||
      !phoneNumber ||
      !rentalTenantId
    ) {
      return useResponseError(
        '缺少必要参数：租户名称、合同递增时间、合同到期时间、手机号码、租户ID',
      );
    }

    // 构建短信内容

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
        [phoneNumber, tenantName, increaseDate, contractEndDate],
      ],
      TimeStamp: Math.round(Date.now()).toString(),
      SignType: 'MD5',
      Signature: '', // 这里需要根据实际签名算法生成
    };

    // 生成签名

    const appKey = process.env.SMS_SECRET_KEY;

    const sortedParams = Object.keys(smsData)
      .sort()
      // eslint-disable-next-line unicorn/no-array-reduce
      .reduce((result, key) => {
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
          result[key] = smsData[key];
        }
        return result;
      }, {});
    // const stringToSign = `AppId=${smsData.AppId}&MchId=${smsData.MchId}&SignName=${smsData.SignName}&SignType=${smsData.SignType}&TimeStamp=${smsData.TimeStamp}&Type=${smsData.Type}&Version=${smsData.Version}&key=${secretKey}`;
    const stringToSign = `${Object.entries(sortedParams)
      .map(([key, value]) => `${key}=${value}`)
      .join('&')}&key=${appKey}`;

    // 拼接字符串MD5加密后大写

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
        rentalTenantId: Number(rentalTenantId),
      },
      data: {
        sendMessage: new Date(),
      },
    });

    return useResponseSuccess({
      message: '短信发送成功',
      data: result,
    });
  } catch {
    return useResponseError('发送短信失败', 500);
  }
});
