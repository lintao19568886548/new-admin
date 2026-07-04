import dayjs from 'dayjs';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';
import {
  getInfo,
  getPlt,
  getTranDay,
  ymsinoDefaultPtId,
} from '~/utils/thirdparty/ymsino';
import {
  filterYmsinoFrozenReadings,
  findYmsinoDeviceByFactoryNo,
  getYmsinoKnownElectricFactoryNos,
  getYmsinoKnownWaterFactoryNos,
  getYmsinoRuntimeConfig,
  getYmsinoTjType,
  validateYmsinoDeviceList,
} from '~/utils/thirdparty/ymsino-adapter.ts';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const query = getQuery(event) as any;
  const ptId = String(query?.ptId || ymsinoDefaultPtId);
  const tyDate = String(query?.tyDate || '') || dayjs().format('YYYY-MM-DD');

  const [plt, electricInfo, waterInfo, electricFreeze, waterFreeze] =
    await Promise.all([
      getPlt(),
      getInfo({ PtId: ptId, TjType: getYmsinoTjType('electric') }),
      getInfo({ PtId: ptId, TjType: getYmsinoTjType('water') }),
      getTranDay({
        PtId: ptId,
        TjType: getYmsinoTjType('electric'),
        TyDate: tyDate,
      }),
      getTranDay({
        PtId: ptId,
        TjType: getYmsinoTjType('water'),
        TyDate: tyDate,
      }),
    ]);

  const electricValidation = validateYmsinoDeviceList(electricInfo?.Date || []);
  const waterValidation = validateYmsinoDeviceList(waterInfo?.Date || []);
  const electricReadings = filterYmsinoFrozenReadings(
    electricFreeze?.Date || [],
    'electric',
    [],
  );
  const waterReadings = filterYmsinoFrozenReadings(
    waterFreeze?.Date || [],
    'water',
    [],
  );
  const electricDeviceCount = electricInfo?.Date?.length || 0;
  const waterDeviceCount = waterInfo?.Date?.length || 0;
  const hasElectricDevices = electricDeviceCount > 0;
  const hasWaterDevices = waterDeviceCount > 0;
  const hasAnyDevice = hasElectricDevices || hasWaterDevices;
  const knownElectricFactoryNos = getYmsinoKnownElectricFactoryNos();
  const knownElectricDevices = knownElectricFactoryNos.map((factoryNo) => {
    const matchedDevice = findYmsinoDeviceByFactoryNo(
      electricInfo?.Date || [],
      'electric',
      factoryNo,
    );
    const matchedReadings = electricReadings.filter(
      (item) => item.factoryNo === factoryNo,
    );

    return {
      factoryNo,
      hasDailyFreeze: matchedReadings.length > 0,
      inDeviceList: Boolean(matchedDevice),
      latestDailyFreeze: matchedReadings[0] || null,
      matchedDevice,
      readingCount: matchedReadings.length,
      startupEvidence:
        matchedDevice && matchedReadings.length > 0
          ? 'electric meter is visible in ymsino device list and selected-day daily freeze'
          : 'electric meter startup cannot be proven by current selected-day ymsino data',
      status: getKnownMeterDeviceStatus(
        Boolean(matchedDevice),
        matchedReadings.length,
      ),
    };
  });
  const knownWaterFactoryNos = getYmsinoKnownWaterFactoryNos();
  const knownWaterDevices = knownWaterFactoryNos.map((factoryNo) => {
    const matchedDevice = findYmsinoDeviceByFactoryNo(
      waterInfo?.Date || [],
      'water',
      factoryNo,
    );
    const matchedReadings = waterReadings.filter(
      (item) => item.factoryNo === factoryNo,
    );

    return {
      factoryNo,
      hasDailyFreeze: matchedReadings.length > 0,
      inDeviceList: Boolean(matchedDevice),
      latestDailyFreeze: matchedReadings[0] || null,
      matchedDevice,
      readingCount: matchedReadings.length,
      startupEvidence:
        matchedDevice && matchedReadings.length > 0
          ? 'water meter is visible in ymsino device list and selected-day daily freeze'
          : 'water meter startup cannot be proven by current selected-day ymsino data',
      status: getKnownMeterDeviceStatus(
        Boolean(matchedDevice),
        matchedReadings.length,
      ),
    };
  });

  return useResponseSuccess({
    accessControl: {
      scope: 'not-applicable',
      reason:
        'Ymsino does not provide access-control devices in this integration; ymsino diagnostics only cover electric/water meters',
    },
    acceptanceChecklist: {
      commandLoop: {
        evidence: {
          rechargeApis: ['/CzDev', '/CzCus'],
          switchRelayApi: '/OnOff',
        },
        missing: [
          'device command receipt acknowledgement',
          'device execution result callback/query API',
          'vendor-defined timeout/retry policy',
        ],
        status: 'partial',
      },
      dataReporting: {
        evidence: {
          dailyFreezeApi: '/GetTranDay',
          electricReadingCount: electricReadings.length,
          waterReadingCount: waterReadings.length,
          supportedFields: [
            'FactoryNo',
            'DeviceId',
            'TranDate',
            'ZTotal',
            'ZTip',
            'ZPeak',
            'ZComm',
            'ZVale',
            'Pt',
            'Ct',
          ],
        },
        missing: [
          'hour freeze API/topic',
          'month freeze API/topic',
          'offline local-cache backfill API/topic',
          'real device status in freeze payload',
        ],
        status:
          electricReadings.length > 0 || waterReadings.length > 0
            ? 'partial'
            : 'missing-data',
      },
      deviceAccess: {
        evidence: {
          electricDeviceCount,
          electricValidation,
          requiredMappingKeys: ['PtId', 'RmId', 'FactoryNo', 'DeviceId'],
          mappingBoundary:
            'PtId/RmId/FactoryNo/DeviceId are necessary identifiers, but embedded/vendor side must confirm the one-to-one field ledger with park/building/room/tenant/device',
          sourceApis: ['/GetPlt', '/GetInfo'],
          waterDeviceCount,
          waterValidation,
        },
        missing: [
          'gateway/collector identifier',
          'building binding field',
          'tenant binding field',
        ],
        status: hasAnyDevice
          ? 'needs-mapping-confirmation'
          : 'needs-vendor-data',
      },
      integrationDocuments: {
        evidence: {
          localDocs: [
            'C:/Users/Administrator/Desktop/ymsino-sdk',
            'C:/Users/Administrator/Desktop/ymsino-test.js',
            'Desktop ymsino API test html',
            'Desktop ymsino RM-http API pdf 20260514',
          ],
          projectDoc: 'apps/backend-mock/docs/ymsino-device-integration.md',
        },
        missing: [
          'MQTT topic list or callback URL list',
          'hour/month/offline-backfill sample payloads',
          'complete error code table',
        ],
        status: 'partial',
      },
      protocolImplementation: {
        evidence: {
          electric:
            'M-Bus meter protocol confirmed; integrated through ymsino RM-http platform adapter',
          water:
            'unconfirmed physical protocol; RM-http adapter can only read existing daily freeze',
        },
        missing: [
          'water meter physical protocol confirmation: NB/LoRa/M-Bus/private',
        ],
        status: 'partial',
      },
      statusAndAlarm: {
        evidence: {
          currentDeviceStatus:
            'reported-reading-only means a freeze record exists; it is not online/offline',
        },
        missing: [
          'meter online/offline API/topic',
          'electric meter abnormal alarm API/topic',
          'water valve abnormal alarm API/topic',
        ],
        status: 'blocked-by-vendor',
      },
    },
    commandLoop: {
      recharge: {
        ready: true,
        supportedBy: ['/CzDev', '/CzCus'],
        limitation:
          'Synchronous response only confirms vendor platform receipt; device execution result needs vendor callback or result-query API',
      },
      switchRelay: {
        ready: true,
        supportedBy: ['/OnOff'],
        limitation:
          'Synchronous response only confirms vendor platform receipt; device execution result needs vendor callback or result-query API',
      },
    },
    devices: {
      electric: {
        count: electricInfo?.Date?.length || 0,
        knownFactoryNos: knownElectricDevices,
        startupCheck: {
          checkedFactoryNos: knownElectricFactoryNos,
          evidence:
            'A selected-day daily freeze proves ymsino platform received a reading for that day; it is not a heartbeat or live online proof',
          ready: knownElectricDevices.some(
            (item) => item.status === 'device-and-daily-freeze-found',
          ),
          tyDate,
        },
        validation: electricValidation,
      },
      water: {
        count: waterInfo?.Date?.length || 0,
        knownFactoryNos: knownWaterDevices,
        startupCheck: {
          checkedFactoryNos: knownWaterFactoryNos,
          evidence:
            'A selected-day daily freeze proves ymsino platform received a reading for that day; it is not a heartbeat or live online proof',
          ready: knownWaterDevices.some(
            (item) => item.status === 'device-and-daily-freeze-found',
          ),
          tyDate,
        },
        validation: waterValidation,
      },
    },
    freezeData: {
      electric: {
        count: electricReadings.length,
        fields: [
          'FactoryNo',
          'DeviceId',
          'TranDate',
          'ZTotal',
          'ZTip',
          'ZPeak',
          'ZComm',
          'ZVale',
          'Pt',
          'Ct',
        ],
        limitation:
          'Current ymsino adapter only reads daily freeze from GetTranDay; hour/month freeze, online status and offline backfill need vendor API/topic/callback',
      },
      water: {
        count: waterReadings.length,
        fields: ['FactoryNo', 'DeviceId', 'TranDate', 'ZTotal', 'Pt', 'Ct'],
        limitation:
          'Water protocol is unconfirmed. Current ymsino adapter only reads daily freeze from GetTranDay; hour/month freeze, online status and offline backfill need vendor API/topic/callback',
      },
    },
    platform: {
      parks: plt?.Date || [],
      response: { code: plt?.Code, message: plt?.Msg },
      runtime: getYmsinoRuntimeConfig(),
    },
    ptId,
    rmHttpApis: [
      '/GetToken',
      '/GetPlt',
      '/GetInfo',
      '/GetTranDay',
      '/CzDevSy',
      '/CzCusSy',
      '/CzDev',
      '/CzCus',
      '/OnOff',
    ],
    tyDate,
    unsupportedByCurrentYmsinoDocs: [
      'gateway/collector inventory',
      'water meter physical protocol',
      'hour freeze',
      'month freeze',
      'offline cache backfill',
      'online/offline status',
      'meter alarms',
      'water valve alarms',
    ],
  });
});

function getKnownMeterDeviceStatus(
  inDeviceList: boolean,
  readingCount: number,
) {
  if (inDeviceList && readingCount > 0) {
    return 'device-and-daily-freeze-found';
  }
  if (inDeviceList) {
    return 'device-found-without-selected-day-freeze';
  }
  return 'not-found-in-device-list';
}
