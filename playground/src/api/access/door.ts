import { requestClient } from '#/api/request';

export interface AccessDoorListParams {
  currentPage?: number;
  currentPark?: number;
  deviceCode?: string;
  deviceName?: string;
  location?: string;
  pageSize?: number;
  parkId?: number;
  status?: number;
}

export interface CreateDoorParams {
  deviceCode: string;
  deviceName: string;
  location: string;
  parkId: number;
  status: 0 | 1;
}

export async function getDoorList(params?: AccessDoorListParams) {
  const filteredParams = Object.fromEntries(
    Object.entries(params ?? {}).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );

  return requestClient.get('/access/door/list', {
    params: filteredParams,
  });
}

export async function updateDoorStatus(
  id: number,
  data: {
    status: 0 | 1;
  },
) {
  return requestClient.put(`/access/door/${id}`, data);
}

export async function createDoor(data: CreateDoorParams) {
  return requestClient.post('/access/door', data);
}

export async function deleteDoor(id: number) {
  return requestClient.delete(`/access/door/${id}`);
}
