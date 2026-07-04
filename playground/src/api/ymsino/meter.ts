import { requestClient } from '#/api/request';

export interface YmsinoListPayload<T> {
  items: T[];
  raw: unknown;
  total: number;
}

export interface YmsinoPltItem {
  OrgId: string;
  PtId: string;
  PtName: string;
}

export interface YmsinoMeterItem {
  Ct?: string;
  DeviceId?: string;
  FactoryNo?: string;
  Pt?: string;
  RmId?: string;
  RmName?: string;
  TjType?: string;
}

export interface YmsinoTranDayItem extends YmsinoMeterItem {
  FTotal?: string;
  TranDate?: string;
  ZComm?: string;
  ZPeak?: string;
  ZTip?: string;
  ZTotal?: string;
  ZVale?: string;
}

export interface YmsinoBalanceItem extends YmsinoMeterItem {
  Account?: string;
  MayAcc?: string;
  NewTotal?: string;
}

export async function getYmsinoPltList(params?: Record<string, unknown>) {
  return requestClient.get<YmsinoListPayload<YmsinoPltItem>>(
    '/ymsino/plt/list',
    { params },
  );
}

export async function getYmsinoMeterList(params?: Record<string, unknown>) {
  return requestClient.get<YmsinoListPayload<YmsinoMeterItem>>(
    '/ymsino/meter/list',
    { params },
  );
}

export async function getYmsinoTranDay(params?: Record<string, unknown>) {
  return requestClient.get<YmsinoListPayload<YmsinoTranDayItem>>(
    '/ymsino/meter/tran-day',
    { params },
  );
}

export async function getYmsinoDeviceBalance(params?: Record<string, unknown>) {
  return requestClient.get<YmsinoListPayload<YmsinoBalanceItem>>(
    '/ymsino/meter/balance',
    { params },
  );
}

export async function getYmsinoCustomerBalance(
  params?: Record<string, unknown>,
) {
  return requestClient.get<YmsinoListPayload<YmsinoBalanceItem>>(
    '/ymsino/meter/customer-balance',
    { params },
  );
}

export async function rechargeYmsinoDevice(payload: {
  ctime?: string;
  dev: string;
  money: number | string;
  payFrom?: string;
  ptId?: string;
  sid: string;
}) {
  return requestClient.post('/ymsino/meter/recharge', payload);
}

export async function rechargeYmsinoCustomer(payload: {
  ctime?: string;
  money: number | string;
  payFrom?: string;
  ptId?: string;
  rmId: string;
  sid: string;
}) {
  return requestClient.post('/ymsino/meter/customer-recharge', payload);
}

export async function controlYmsinoDevice(payload: {
  dev: string;
  ptId?: string;
  type: '0' | '1';
}) {
  return requestClient.post('/ymsino/meter/on-off', payload);
}
