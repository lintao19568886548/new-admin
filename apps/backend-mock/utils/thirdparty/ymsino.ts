/**
 * ============================================================================
 * utils/thirdparty/ymsino.ts
 * 亿玛系统开放平台 SDK 封装（仿项目 hezhong.ts 风格）
 * ============================================================================
 *
 * 注意：导入 ymsinoRequest（不是 request），避免和 hezhong 的自动导入冲突
 * ============================================================================
 */

import axios, { AxiosInstance } from 'axios';

import { ymsinoRequest } from './ymsino-token-manager';

const baseURL =
  process.env.TP_YMSINO_BASE_URL || 'http://pt.ymsino1.com/ymcb/inter';
const username = process.env.TP_YMSINO_USERNAME || 'yzwl';
const password = process.env.TP_YMSINO_PASSWORD || 'yzwl';
const orgId = process.env.TP_YMSINO_ORG_ID || '1024';

export const ymsinoHttp: AxiosInstance = axios.create({
  baseURL,
  timeout: Number(process.env.TP_YMSINO_TIMEOUT_MS || 15_000),
  headers: { 'Content-Type': 'application/json' },
});

// ===================== 1. 认证 =====================
export interface YmsinoTokenResponse {
  UserName?: string;
  Token?: string;
  Code: string;
  Msg: string;
}

export async function ymsinoLogin(): Promise<YmsinoTokenResponse> {
  const res = await ymsinoHttp.post<YmsinoTokenResponse>('/GetToken', {
    UserName: username,
    PassWord: password,
    OrgId: orgId,
  });
  return res.data;
}

// ===================== 2. 小区信息 =====================
export interface YmsinoPltItem {
  OrgId: string;
  PtId: string;
  PtName: string;
}

export interface YmsinoPltResponse {
  Code: string;
  Msg: string;
  Date?: YmsinoPltItem[];
}

export async function getPlt() {
  return await ymsinoRequest<YmsinoPltResponse>({
    method: 'post',
    url: '/GetPlt',
    data: { OrgId: orgId },
  });
}

// ===================== 3. 设备信息 =====================
export interface YmsinoDeviceInfo {
  RmId: string;
  RmName: string;
  DeviceId: string;
  FactoryNo: string;
  TjType: string;
  Pt: string;
  Ct: string;
}

export interface YmsinoInfoResponse {
  Code: string;
  Msg: string;
  OrgId: string;
  PtId: string;
  Date?: YmsinoDeviceInfo[];
}

export interface GetInfoParams {
  PtId: string;
  RmId?: string;
  TjType?: string;
}

export async function getInfo(params: GetInfoParams) {
  return await ymsinoRequest<YmsinoInfoResponse>({
    method: 'post',
    url: '/GetInfo',
    data: { OrgId: orgId, ...params },
  });
}

// ===================== 4. 冻结数据（抄表） =====================
export interface YmsinoTranDayItem {
  RmId: string;
  RmName: string;
  DeviceId: string;
  FactoryNo: string;
  TjType: string;
  Pt: string;
  Ct: string;
  TranDate: string;
  ZTotal: string;
  FTotal: string;
  ZTip: string;
  ZPeak: string;
  ZComm: string;
  ZVale: string;
}

export interface YmsinoTranDayResponse {
  Code: string;
  Msg: string;
  OrgId: string;
  PtId: string;
  Date?: YmsinoTranDayItem[];
}

export interface GetTranDayParams {
  PtId: string;
  TyDate: string;
  RmId?: string;
  TjType?: string;
}

export async function getTranDay(params: GetTranDayParams) {
  return await ymsinoRequest<YmsinoTranDayResponse>({
    method: 'post',
    url: '/GetTranDay',
    data: { OrgId: orgId, ...params },
  });
}

// ===================== 5. 设备余额 =====================
export interface YmsinoDevBalance {
  RmId: string;
  RmName: string;
  DeviceId: string;
  FactoryNo: string;
  TjType: string;
  Pt: string;
  Ct: string;
  Account: string;
  MayAcc: string;
  NewTotal: string;
}

export interface YmsinoDevBalanceResponse {
  Code: string;
  Msg: string;
  OrgId: string;
  PtId: string;
  Date?: YmsinoDevBalance[];
}

export interface GetDevBalanceParams {
  PtId: string;
  Dev: string;
  RmId?: string;
}

export async function getDevBalance(params: GetDevBalanceParams) {
  return await ymsinoRequest<YmsinoDevBalanceResponse>({
    method: 'post',
    url: '/CzDevSy',
    data: { OrgId: orgId, ...params },
  });
}

// ===================== 6. 用户余额 =====================
export interface YmsinoCusBalance {
  RmId: string;
  RmName: string;
  Account: string;
  MayAcc: string;
}

export interface YmsinoCusBalanceResponse {
  Code: string;
  Msg: string;
  OrgId: string;
  PtId: string;
  Date?: YmsinoCusBalance[];
}

export interface GetCusBalanceParams {
  PtId: string;
  RmId: string;
}

export async function getCusBalance(params: GetCusBalanceParams) {
  return await ymsinoRequest<YmsinoCusBalanceResponse>({
    method: 'post',
    url: '/CzCusSy',
    data: { OrgId: orgId, ...params },
  });
}

// ===================== 7. 设备充值 =====================
export interface YmsinoRechargeResponse {
  Code: string;
  Msg: string;
  OrgId: string;
  PtId: string;
  Dev?: string;
  Sid?: string;
  Money?: string;
  Ctime?: string;
}

export interface RechargeDevParams {
  PtId: string;
  Dev: string;
  Money: string;
  Sid: string;
  PayFrom?: string;
  Ctime?: string;
}

export async function rechargeDev(params: RechargeDevParams) {
  const data = {
    OrgId: orgId,
    PayFrom: '4',
    Ctime: new Date().toISOString().replace('T', ' ').slice(0, 19),
    ...params,
  };
  return await ymsinoRequest<YmsinoRechargeResponse>({
    method: 'post',
    url: '/CzDev',
    data,
  });
}

// ===================== 8. 用户充值 =====================
export interface RechargeCusParams {
  PtId: string;
  RmId: string;
  Money: string;
  Sid: string;
  PayFrom?: string;
  Ctime?: string;
}

export async function rechargeCus(params: RechargeCusParams) {
  const data = {
    OrgId: orgId,
    PayFrom: '4',
    Ctime: new Date().toISOString().replace('T', ' ').slice(0, 19),
    ...params,
  };
  return await ymsinoRequest<YmsinoRechargeResponse>({
    method: 'post',
    url: '/CzCus',
    data,
  });
}

// ===================== 9. 实时通断 =====================
export interface YmsinoOnOffResponse {
  Code: string;
  Msg: string;
  OrgId: string;
  PtId: string;
  Dev: string;
  Type: string;
  State: string;
}

export interface OnOffParams {
  PtId: string;
  Dev: string;
  Type: '0' | '1';
}

export async function doOnOff(params: OnOffParams) {
  return await ymsinoRequest<YmsinoOnOffResponse>({
    method: 'post',
    url: '/OnOff',
    data: { OrgId: orgId, ...params },
  });
}

export default {
  ymsinoLogin,
  getPlt,
  getInfo,
  getTranDay,
  getDevBalance,
  getCusBalance,
  rechargeDev,
  rechargeCus,
  doOnOff,
};
