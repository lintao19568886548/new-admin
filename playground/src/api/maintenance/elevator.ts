import { requestClient } from '#/api/request';

export async function getElevatorList(params: any) {
  return requestClient.get('/maintenance/elevator/list', { params });
}

export async function getElevatorDetail(id: number) {
  return requestClient.get(`/maintenance/elevator/${id}`);
}

export async function createElevator(data: any) {
  return requestClient.post('/maintenance/elevator', data);
}

export async function updateElevator(id: number, data: any) {
  return requestClient.put(`/maintenance/elevator/${id}`, data);
}

export async function deleteElevator(id: number) {
  return requestClient.delete(`/maintenance/elevator/${id}`);
}
