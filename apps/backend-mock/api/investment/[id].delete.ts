import { prismaClient } from '~/utils/db';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const investmentId = Number.parseInt(event.context.params.id);
  if (!investmentId) {
    return useResponseError('investmentId error');
  }

  try {
    const result = await runWithRadarSharedScope(() =>
      prismaClient.investment.delete({
        where: {
          investmentId,
        },
      }),
    );

    return useResponseSuccess(result);
  } catch (error) {
    console.error('delete investment failed:', error);
    return serverErrorResponse('delete investment failed', event);
  }
});
