import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';
import { createYmsinoCapability } from '~/utils/thirdparty/ymsino-capability.ts';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  return useResponseSuccess(
    createYmsinoCapability({
      capability: 'water-meter-physical-protocol',
      details: [
        'current ymsino RM-http adapter can query existing daily freeze records',
        'water physical protocol has not been confirmed as M-Bus/RS485/NB/LoRa/private',
        'known water FactoryNo 00000260507851 can be used for device/freeze diagnostics, but it does not confirm the physical protocol',
      ],
      missing: [
        'water meter physical protocol',
        'water protocol field dictionary',
        'valve-control status fields',
        'water meter alarm code table',
      ],
      status: 'blocked-by-vendor',
      supportedBy: [],
    }),
  );
});
