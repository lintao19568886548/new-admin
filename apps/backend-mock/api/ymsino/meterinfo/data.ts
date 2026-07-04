import dayjs from 'dayjs';
import {
  badRequestResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
import { getTranDay, ymsinoDefaultPtId } from '~/utils/thirdparty/ymsino';
import {
  ensureYmsinoSuccess,
  filterYmsinoFrozenReadings,
  getYmsinoRuntimeConfig,
  getYmsinoTjType,
  paginateYmsinoItems,
  parseYmsinoComAddresses,
} from '~/utils/thirdparty/ymsino-adapter.ts';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const query = getQuery(event) as any;
  const currentPage = Number(query.page ?? query.currentPage ?? 1) || 1;
  const pageSize = Number(query.pageSize ?? 20) || 20;
  const ptId = String(query.ptId || ymsinoDefaultPtId);
  const freezeType = String(query.freezeType || query.type || 'day');
  const tyDate = String(query.tyDate || '') || dayjs().format('YYYY-MM-DD');
  const comAddresses = parseYmsinoComAddresses(query.comAddress);

  if (!['2', 'day'].includes(freezeType)) {
    return badRequestResponse(
      'Ymsino RM-http currently supports daily freeze only; hour/month freeze needs vendor API/topic',
      event,
    );
  }

  const result = await getTranDay({
    PtId: ptId,
    TyDate: tyDate,
    TjType: getYmsinoTjType('electric'),
  });
  ensureYmsinoSuccess(result, 'Failed to get ymsino electric freeze data');

  const readings = filterYmsinoFrozenReadings(
    result?.Date || [],
    'electric',
    comAddresses,
  );
  const page = paginateYmsinoItems(readings, currentPage, pageSize);

  return useResponseSuccess({
    ...page,
    diagnostics: {
      freezeType: 'day',
      protocol: 'M-Bus',
      requestedDevices: comAddresses,
      unsupportedFields: [
        'hourFreeze',
        'monthFreeze',
        'offlineBackfill',
        'realOnlineStatus',
      ],
    },
    source: {
      ...getYmsinoRuntimeConfig(),
      kind: 'electric',
      mode: 'vendor-platform',
    },
  });
});
