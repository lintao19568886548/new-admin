import dayjs from 'dayjs';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';
import {
  getInfo,
  getTranDay,
  ymsinoDefaultPtId,
} from '~/utils/thirdparty/ymsino';
import {
  buildYmsinoDailyFreezeChecks,
  buildYmsinoLookupDates,
  ensureYmsinoSuccess,
  findYmsinoDeviceByFactoryNo,
  flattenYmsinoDailyFreezeChecks,
  getYmsinoKnownWaterFactoryNos,
  getYmsinoRuntimeConfig,
  getYmsinoTjType,
  normalizeYmsinoLookbackDays,
} from '~/utils/thirdparty/ymsino-adapter.ts';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const query = getQuery(event) as any;
  const knownFactoryNos = getYmsinoKnownWaterFactoryNos();
  const factoryNo = String(
    query.factoryNo || query.comAddress || knownFactoryNos[0] || '',
  ).trim();
  const lookbackDays = normalizeYmsinoLookbackDays(query.lookbackDays);
  const ptId = String(query.ptId || ymsinoDefaultPtId);
  const tyDate = String(query.tyDate || '') || dayjs().format('YYYY-MM-DD');
  const lookupDates = buildYmsinoLookupDates(tyDate, lookbackDays);

  const [deviceResponse, ...freezeResponses] = await Promise.all([
    getInfo({ PtId: ptId, TjType: getYmsinoTjType('water') }),
    ...lookupDates.map((date) =>
      getTranDay({
        PtId: ptId,
        TjType: getYmsinoTjType('water'),
        TyDate: date,
      }),
    ),
  ]);

  ensureYmsinoSuccess(deviceResponse, 'Failed to get ymsino water devices');
  for (const freezeResponse of freezeResponses) {
    ensureYmsinoSuccess(
      freezeResponse,
      'Failed to get ymsino water freeze data',
    );
  }

  const device = findYmsinoDeviceByFactoryNo(
    deviceResponse?.Date || [],
    'water',
    factoryNo,
  );
  const dailyFreezeChecks = buildYmsinoDailyFreezeChecks(
    freezeResponses,
    lookupDates,
    'water',
    factoryNo,
  );
  const readings = flattenYmsinoDailyFreezeChecks(dailyFreezeChecks);
  const latestReading = readings[0] || null;
  const startupReady = Boolean(device && latestReading);

  return useResponseSuccess({
    binding: {
      matchedDevice: device,
      requiredFields: ['PtId', 'RmId', 'FactoryNo', 'DeviceId'],
      status: device ? 'found-in-ymsino-device-list' : 'not-found',
    },
    dailyFreeze: {
      checks: dailyFreezeChecks,
      latestReading,
      lookbackDays,
      readingCount: readings.length,
      readingEvidence: latestReading
        ? {
            freezeTime: latestReading.freezeTime,
            readAt: latestReading.readAt,
            total: latestReading.dataValue,
            writeTime: latestReading.writeTime,
          }
        : null,
      status: readings.length > 0 ? 'found-in-lookback-window' : 'not-found',
      tyDate,
    },
    factoryNo,
    knownWaterFactoryNos: knownFactoryNos,
    limitations: {
      alarm:
        'No water meter alarm API/topic is provided by current ymsino RM-http docs',
      commandLoop:
        'No water valve command callback/result-query API is provided by current ymsino RM-http docs',
      onlineStatus:
        'Daily freeze can prove a reading exists for the selected day, but cannot prove live online/offline status',
      protocol:
        'Water physical protocol is still unconfirmed; current adapter only uses ymsino RM-http daily freeze',
    },
    ptId,
    source: {
      ...getYmsinoRuntimeConfig(),
      kind: 'water',
      mode: 'vendor-platform',
      supportedBy: ['/GetInfo', '/GetTranDay'],
    },
    startupCheck: {
      ready: startupReady,
      status: startupReady
        ? 'device-and-selected-day-daily-freeze-found'
        : 'missing-device-or-selected-day-daily-freeze',
      warning:
        'This proves ymsino has device metadata and at least one daily freeze in the lookup window. It does not prove live heartbeat, online/offline status, hour/month freeze, offline backfill, or alarm reporting.',
    },
  });
});
