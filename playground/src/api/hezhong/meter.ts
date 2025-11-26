import { requestClient } from '#/api/request';

export async function getMeterData(params?: any) {
  return requestClient.get('/hezhong/meterinfo/data', { params });
}

export async function getMeterTree(params?: any) {
  return requestClient.get('/hezhong/meterinfo/tree', { params });
}
