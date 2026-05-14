import { prismaClient } from '~/utils/db';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const investmentId = Number.parseInt(event.context.params.id);
  if (!investmentId) {
    return useResponseError('investmentId error');
  }

  const body = await readBody(event);
  delete body.investmentId;

  try {
    const result = await runWithRadarSharedScope(() =>
      prismaClient.investment.update({
        data: body,
        where: {
          investmentId,
        },
      }),
    );

    return useResponseSuccess(result);
  } catch (error) {
    console.error('update investment failed:', error);
    return serverErrorResponse('update investment failed', event);
  }
});
