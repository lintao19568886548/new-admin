import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';
import { createYmsinoCapability } from '~/utils/thirdparty/ymsino-capability.ts';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  return useResponseSuccess(
    createYmsinoCapability({
      capability: 'meter-online-status',
      details: [
        'current ymsino RM-http docs expose device list and daily freeze only',
        'freeze payload can prove a reading exists for a day, but cannot prove live online status',
      ],
      missing: [
        'meter online/offline API',
        'meter online/offline MQTT topic or callback',
        'last communication time field from gateway/collector',
      ],
      status: 'blocked-by-vendor',
      supportedBy: [],
    }),
  );
});
