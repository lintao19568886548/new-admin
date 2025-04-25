import { requestClient } from '#/api/request';

export async function getDashboardWorkspaceList(params: any) {
  return requestClient.get('/dashboard/workspace/list', { params });
}
