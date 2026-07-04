import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';
import { createYmsinoCapability } from '~/utils/thirdparty/ymsino-capability.ts';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  return useResponseSuccess(
    createYmsinoCapability({
      capability: 'access-records',
      details: [
        'Ymsino does not provide access-control devices in this integration',
        'Open-door and card-swipe records are outside the ymsino meter integration scope',
      ],
      missing: [],
      status: 'not-applicable',
      supportedBy: [],
    }),
  );
});
