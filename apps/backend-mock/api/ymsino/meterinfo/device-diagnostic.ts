import dayjs from 'dayjs';
import {
  badRequestResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
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
  getYmsinoKnownElectricFactoryNos,
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
  const knownFactoryNos = getYmsinoKnownElectricFactoryNos();
  const factoryNo = String(
    query.factoryNo || query.comAddress || knownFactoryNos[0] || '',
  ).trim();

  if (!factoryNo) {
    return badRequestResponse(
      'Missing electric meter factoryNo/comAddress; alternatively configure TP_YMSINO_KNOWN_ELECTRIC_FACTORY_NOS',
      event,
    );
  }

  const lookbackDays = normalizeYmsinoLookbackDays(query.lookbackDays);
  const ptId = String(query.ptId || ymsinoDefaultPtId);
  const tyDate = String(query.tyDate || '') || dayjs().format('YYYY-MM-DD');
  const lookupDates = buildYmsinoLookupDates(tyDate, lookbackDays);

  const [deviceResponse, ...freezeResponses] = await Promise.all([
    getInfo({ PtId: ptId, TjType: getYmsinoTjType('electric') }),
    ...lookupDates.map((date) =>
      getTranDay({
        PtId: ptId,
        TjType: getYmsinoTjType('electric'),
        TyDate: date,
      }),
    ),
  ]);

  ensureYmsinoSuccess(deviceResponse, 'Failed to get ymsino electric devices');
  for (const freezeResponse of freezeResponses) {
    ensureYmsinoSuccess(
      freezeResponse,
      'Failed to get ymsino electric freeze data',
    );
  }

  const device = findYmsinoDeviceByFactoryNo(
    deviceResponse?.Date || [],
    'electric',
    factoryNo,
  );
  const dailyFreezeChecks = buildYmsinoDailyFreezeChecks(
    freezeResponses,
    lookupDates,
    'electric',
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
            zComm: latestReading.dataValue3,
            zPeak: latestReading.dataValue2,
            zTip: latestReading.dataValue1,
            zVale: latestReading.dataValue4,
          }
        : null,
      status: readings.length > 0 ? 'found-in-lookback-window' : 'not-found',
      tyDate,
    },
    factoryNo,
    knownElectricFactoryNos: knownFactoryNos,
    limitations: {
      alarm:
        'No electric meter alarm API/topic is provided by current ymsino RM-http docs',
      commandLoop:
        'Relay/recharge APIs only prove ymsino platform response; device execution result still needs callback/result-query API',
      onlineStatus:
        'Daily freeze can prove a reading exists in the lookup window, but cannot prove live online/offline status',
      protocol:
        'Electric meter protocol is marked as M-Bus; current adapter uses ymsino RM-http daily freeze',
    },
    ptId,
    source: {
      ...getYmsinoRuntimeConfig(),
      kind: 'electric',
      mode: 'vendor-platform',
      protocol: 'M-Bus',
      supportedBy: ['/GetInfo', '/GetTranDay'],
    },
    startupCheck: {
      ready: startupReady,
      status: startupReady
        ? 'device-and-selected-day-daily-freeze-found'
        : 'missing-device-or-selected-day-daily-freeze',
      warning:
        'This proves ymsino has device metadata and at least one daily freeze in the lookup window. It does not prove live heartbeat, online/offline status, hour/month freeze, offline backfill, alarm reporting, or command execution closure.',
    },
  });
});
