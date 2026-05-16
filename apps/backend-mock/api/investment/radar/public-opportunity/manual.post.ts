import { upsertManualPublicOpportunity } from '~/utils/investment-radar/public-opportunity-repository';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const body = await readBody(event);
    const title = String(body?.title || '').trim();
    if (!title) {
      return badRequestResponse('标题不能为空', event);
    }

    const opportunityType =
      body?.opportunityType === 'SUPPLY' ? 'SUPPLY' : 'DEMAND';
    const result = await runWithRadarSharedScope(() =>
      upsertManualPublicOpportunity({
        areaText: body?.areaText,
        city: body?.city,
        contactName: body?.contactName,
        description: body?.description,
        district: body?.district,
        industryText: body?.industryText,
        opportunityType,
        phoneNumber: body?.phoneNumber,
        priceText: body?.priceText,
        sourceSite: body?.sourceSite,
        sourceUrl: body?.sourceUrl,
        title,
      }),
    );

    return useResponseSuccess(result);
  } catch (error) {
    console.error('manual public opportunity failed:', error);
    return serverErrorResponse('手动录入公开机会失败', event);
  }
});
