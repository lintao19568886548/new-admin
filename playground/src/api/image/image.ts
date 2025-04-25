import { requestClient } from '#/api/request';

export async function uploadImage(data: any) {
  return requestClient.post('/image/upload', data, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}
