import { requestClient } from '#/api/request';

export async function getWaterData(params?: any) {
  return requestClient.get('/hezhong/waterinfo/data', { params });
}

export async function getWaterTree(params?: any) {
  return requestClient.get('/hezhong/waterinfo/tree', { params });
}
