import { useResponseSuccess } from '~/utils/response';
import { getInfo, ymsinoDefaultPtId } from '~/utils/thirdparty/ymsino';
import {
  buildYmsinoDeviceTree,
  ensureYmsinoSuccess,
  filterYmsinoDevices,
  getYmsinoRuntimeConfig,
  getYmsinoTjType,
  validateYmsinoDeviceList,
} from '~/utils/thirdparty/ymsino-adapter';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const query = getQuery(event) as any;
  const keyword = String(query?.keyword || '').trim();
  const ptId = String(query?.ptId || ymsinoDefaultPtId);

  const result = await getInfo({
    PtId: ptId,
    TjType: getYmsinoTjType('water'),
  });
  ensureYmsinoSuccess(result, 'Failed to get ymsino water devices');

  const rawItems = result?.Date || [];
  const validation = validateYmsinoDeviceList(rawItems);
  const records = filterYmsinoDevices(rawItems, 'water', keyword);
  const tree = buildYmsinoDeviceTree(records);
  const includeDiagnostics =
    query?.includeDiagnostics === '1' || query?.includeDiagnostics === 'true';

  return useResponseSuccess(
    includeDiagnostics
      ? {
          diagnostics: {
            bindingValidated: validation.ok,
            errors: validation.errors,
            requiredFields: ['FactoryNo', 'DeviceId', 'RmId'],
          },
          items: tree,
          source: {
            ...getYmsinoRuntimeConfig(),
            kind: 'water',
            mode: 'vendor-platform',
            protocol: records[0]?.protocol,
          },
        }
      : tree,
  );
});
