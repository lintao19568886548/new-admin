import { requestClient } from '#/api/request';

export namespace RentalDetailApi {
  export interface RentalDetail {
    [key: string]: any;
    children?: RentalDetail[];
    id: string;
    name: string;
    remark?: string;
    status: 0 | 1;
  }
}

/**
 * 获取部门列表数据
 */
async function getRentalDetail() {
  return requestClient.get<Array<RentalDetailApi.RentalDetail>>(
    '/system/dept/list',
  );
}

export { getRentalDetail };
