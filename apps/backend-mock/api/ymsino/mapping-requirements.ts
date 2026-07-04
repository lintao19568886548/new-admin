import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';
import { getYmsinoKnownWaterFactoryNos } from '~/utils/thirdparty/ymsino-adapter.ts';
import { createYmsinoCapability } from '~/utils/thirdparty/ymsino-capability.ts';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  return useResponseSuccess(
    createYmsinoCapability({
      capability: 'device-business-object-mapping',
      details: [
        'software currently maps ymsino devices by PtId/RmId/FactoryNo/DeviceId',
        'mapping is read from vendor RM-http responses and is not persisted by this change',
        'these identifiers are necessary but not enough without field ledger confirmation',
        `known ymsino water FactoryNo list: ${getYmsinoKnownWaterFactoryNos().join(', ')}`,
      ],
      missing: [
        'gateway/collector id',
        'building id/name',
        'tenant id/name',
        'field-level one-to-one confirmation for park/building/room/tenant/meter',
      ],
      status: 'partial',
      supportedBy: ['/GetPlt', '/GetInfo'],
    }),
  );
});
