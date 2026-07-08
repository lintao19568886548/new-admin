import type {
  GetControlParams,
  GetDeviceParams,
  GetHDMDataParams,
  GetSingleDataBody,
  GetSingleDataResultParams,
  GetUseEnergyParams,
  GetUserInfoParams,
  ThirdPartyLoginResponse,
} from './types';

import axios, { AxiosInstance } from 'axios';
import CryptoJS from 'crypto-js';

import { request } from './token-manager';

const baseURL = process.env.TP_BASE_URL || 'https://devhzeb.szhzzd.top';
const userName = process.env.TP_LOGIN_USERNAME || '';
const key = process.env.TP_LOGIN_KEY || '';

export const http: AxiosInstance = axios.create({
  baseURL,
  timeout: Number(process.env.TP_TIMEOUT_MS || 15_000),
});

const getSignature = (userName: string, key: string) => {
  const time = Math.floor(Date.now() / 1000).toString();
  const num = String(Math.floor(Math.random() * 1e7)).padStart(7, '0');
  const raw = `userName=${userName}&time=${time}&num=${num}&key=${key}`;
  const sign = CryptoJS.SHA256(raw).toString();
  return { sign, time, num };
};

export async function login(): Promise<ThirdPartyLoginResponse> {
  if (!userName || !key) {
    throw new Error('TP_LOGIN_USERNAME and TP_LOGIN_KEY are required');
  }

  const res = await http.post<ThirdPartyLoginResponse>(
    `/hzeb-push/app/xcx/login`,
    {},
    {
      params: {
        userName,
        ...getSignature(userName, key),
      },
    },
  );
  return res.data;
}

/**
 * 获取计量设备详情
 *
 * 参数说明：
 * - comAddress（可选）：设备地址，例如 202208030498
 * - comtype（可选）：表型，例如 D.HTG.FOWBM、GD04
 * - projCode（必填）：项目编号（平台提供），例如 415
 * - pageSize（必填）：每页行数，数字或字符串，例如 10
 * - page（必填）：页码，数字或字符串，例如 1
 *
 * 示例：
 * getDevice({ projCode: 241, pageSize: 10, page: 1 })
 */
export async function getDevice(params: GetDeviceParams) {
  return await request({
    method: 'get',
    url: '/hzeb-push/app/meterinfo/getDevice',
    params,
  });
}

/**
 * 获取账单与用能数据
 *
 * 参数说明：
 * - timeFrom（可选）：时间起（YYYYMM 或 YYYYMMDD）
 * - timeTo（可选）：时间止（YYYYMM 或 YYYYMMDD）
 * - comAddress（可选）：设备地址；为空表示查询所有
 * - type（必填）：时间维度（平台定义：2/3）
 * - projCode（必填）：项目编号（平台提供）
 * - pageSize（必填）：每页行数
 * - page（必填）：页码
 * - comType（可选）：表型
 *
 * 示例：
 * getUseEnergy({ projCode: 415, type: 3, pageSize: 10, page: 1 })
 */
export async function getUseEnergy(params: GetUseEnergyParams) {
  return await request({
    method: 'get',
    url: '/hzeb-push/app/meterinfo/getUseEnergy',
    params,
  });
}

/**
 * 获取冻结抄表数据
 *
 * 参数说明：
 * - comAddress（可选）：设备地址
 * - type（必填）：时间维度/类型（1=小时，2=日，3=月，4=负荷）
 * - timeFrom（必填）：起始时间（yyyy-MM-dd HH:mm:ss）
 * - timeTo（必填）：结束时间（yyyy-MM-dd HH:mm:ss）
 * - projCode（必填）：项目编号（平台提供）
 * - pageSize（必填）：每页行数
 * - page（必填）：页码
 * - comType（可选）：表型（平台定义）
 *
 * 示例：
 * getHDMData({ projCode: 1, type: 1, timeFrom: '2023-06-01 00:00:00', timeTo: '2023-06-01 02:00:00', comType: 'HS.BLSTW.AKWAM-BT401' })
 */
export async function getHDMData(params: GetHDMDataParams) {
  return await request({
    method: 'get',
    url: '/hzeb-push/app/meterinfo/getHDMData',
    params,
  });
}

/**
 * 获取阀控列表
 *
 * 参数说明：
 * - timeFrom（必填）：开始时间（yyyy-MM-dd HH:mm:ss）
 * - timeTo（必填）：结束时间（yyyy-MM-dd HH:mm:ss）
 * - comAddress（可选）：设备地址
 * - projCode（必填）：项目编号（平台提供）
 * - pageSize（必填）：每页行数
 * - page（必填）：页码
 * - comType（可选）：表型
 *
 * 示例：
 * getControl({ projCode: 415, timeFrom: '2023-06-01 00:00:00', timeTo: '2023-06-02 00:00:00', pageSize: 10, page: 1 })
 */
export async function getControl(params: GetControlParams) {
  return await request({
    method: 'get',
    url: '/hzeb-push/app/hdmdata/getcontrol',
    params,
  });
}

/**
 * 单表数据实时读取
 *
 * 请求体参数：
 * - comAddress（必填）：设备地址
 * - projCode（必填）：项目编号（平台提供）
 * - comType（必填）：表型
 * - dataType（必填）：数据项编码，例如 Y-0001
 */
export async function getSingleData(data: GetSingleDataBody) {
  return await request({
    method: 'post',
    url: '/hzeb-push/app/send/dataread',
    data,
  });
}

/**
 * 主动获取单表数据结果
 *
 * 参数说明：
 * - itemID（必填）：任务 Id
 */
export async function getSingleDataResult(params: GetSingleDataResultParams) {
  return await request({
    method: 'get',
    url: '/hzeb-push/app/dataread/callback',
    params,
  });
}

/**
 * 获取用户接口
 * 参数说明：
 * - projCode (String, 必填)：项目编号（平台提供）
 * - buildingType (String, 可选)：建筑用户类型（23027=商户，23028=租户）
 * - buildingid (String, 可选)：BuildingId；不传查询所有，传入则返回单个
 * - pageSize (String, 必填)：每页显示的行数
 * - page (String, 必填)：需查询的页码
 */
export async function getUserInfo(params: GetUserInfoParams) {
  return await request({
    method: 'get',
    url: '/hzeb-push/app/usermanage/getUser',
    params,
  });
}
