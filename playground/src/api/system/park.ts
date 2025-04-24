import { requestClient } from '#/api/request';

export async function getSystemParkList(params: any) {
  return requestClient.get('/system/park/list', { params });
}

export async function getSystemParkDetail(id: number) {
  return requestClient.get(`/system/park/${id}`);
}

export async function createSystemPark(data: any) {
  return requestClient.post('/system/park', data);
}

export async function updateSystemPark(id: number, data: any) {
  return requestClient.put(`/system/park/${id}`, data);
}

export async function deleteSystemPark(id: number) {
  return requestClient.delete(`/system/park/${id}`);
}

export async function uploadSystemParkImage(data: any) {
  return requestClient.post('/system/park/upload', data, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}
