import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';
import { createYmsinoCapability } from '~/utils/thirdparty/ymsino-capability.ts';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  return useResponseSuccess(
    createYmsinoCapability({
      capability: 'meter-alarms',
      details: [
        'current ymsino RM-http docs do not expose alarm list or alarm callback',
      ],
      missing: [
        'electric meter abnormal alarm API/topic',
        'water valve abnormal alarm API/topic',
        'alarm timestamp and recovery timestamp',
        'vendor error/alarm code table',
      ],
      status: 'blocked-by-vendor',
      supportedBy: [],
    }),
  );
});
