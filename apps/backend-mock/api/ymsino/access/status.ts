import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';
import { createYmsinoCapability } from '~/utils/thirdparty/ymsino-capability.ts';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  return useResponseSuccess(
    createYmsinoCapability({
      capability: 'access-controller-status',
      details: [
        'Ymsino does not provide access-control devices in this integration',
        'Access-control status is outside the ymsino meter integration scope',
      ],
      missing: [],
      status: 'not-applicable',
      supportedBy: [],
    }),
  );
});
