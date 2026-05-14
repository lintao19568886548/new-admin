import { prismaClient } from '~/utils/db';
import { runWithRadarSharedScope } from '~/utils/investment-radar/shared-scope';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = await readBody(event);

  try {
    const result = await runWithRadarSharedScope(() =>
      prismaClient.investment.create({
        data: {
          ...body,
        },
      }),
    );

    return useResponseSuccess(result);
  } catch (error) {
    console.error('create investment failed:', error);
    return serverErrorResponse('create investment failed', event);
  }
});
