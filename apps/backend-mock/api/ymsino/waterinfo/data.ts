import dayjs from 'dayjs';
import { useResponseSuccess } from '~/utils/response';
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
  const tyDate = String(query.tyDate || '') || dayjs().format('YYYY-MM-DD');
  const comAddresses = parseYmsinoComAddresses(query.comAddress);

  const result = await getTranDay({
    PtId: ptId,
    TyDate: tyDate,
    TjType: getYmsinoTjType('water'),
  });
  ensureYmsinoSuccess(result, 'Failed to get ymsino water freeze data');

  const readings = filterYmsinoFrozenReadings(
    result?.Date || [],
    'water',
    comAddresses,
  );
  const page = paginateYmsinoItems(readings, currentPage, pageSize);

  return useResponseSuccess({
    ...page,
    diagnostics: {
      freezeType: 'day',
      requestedDevices: comAddresses,
      unsupportedFields: ['hourFreeze', 'monthFreeze', 'offlineBackfill'],
    },
    source: {
      ...getYmsinoRuntimeConfig(),
      kind: 'water',
      mode: 'vendor-platform',
    },
  });
});
