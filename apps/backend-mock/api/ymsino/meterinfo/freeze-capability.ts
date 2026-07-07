import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';
import { createYmsinoCapability } from '~/utils/thirdparty/ymsino-capability.ts';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  return useResponseSuccess(
    createYmsinoCapability({
      capability: 'meter-freeze-reporting',
      details: [
        'daily freeze is supported by ymsino RM-http /GetTranDay',
        'electric meter protocol is marked as M-Bus in normalized payloads',
      ],
      missing: [
        'hour freeze API/topic',
        'month freeze API/topic',
        'offline cache backfill API/topic',
        'collector-side local buffering proof',
      ],
      status: 'partial',
      supportedBy: ['/GetTranDay'],
    }),
  );
});
