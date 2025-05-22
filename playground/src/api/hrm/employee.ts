import { requestClient } from '#/api/request';

export namespace EmployeeApi {
  export interface Employee {
    [key: string]: any;
    address?: string;
    age?: number;
    createTime?: string;
    department?: string;
    education?: string;
    employeeId: number;
    gender: string;
    hireDate?: string;
    idNumber?: string;
    isDeleted?: boolean;
    leaveDate?: string;
    name: string;
    phone: string;
    remark?: string;
    updateTime?: string;
  }

  export interface EmployeeQuery {
    age?: number;
    currentPage?: number;
    department?: string;
    education?: string;
    gender?: string;
    hireDate?: string;
    idNumber?: string;
    isDeleted?: string;
    name?: string;
    pageSize?: number;
    phone?: string;
  }

  export interface EmployeePageResult {
    currentPage: number;
    items: Employee[];
    pageSize: number;
    total: number;
  }
}

/**
 * 获取员工列表数据
 * @param params 查询参数
 */
export async function getEmployeeList(params?: EmployeeApi.EmployeeQuery) {
  return requestClient.get<EmployeeApi.EmployeePageResult>('/hrm/employee', {
    params,
  });
}

/**
 * 创建员工
 * @param data 员工数据
 */
export async function createEmployee(
  data: Omit<EmployeeApi.Employee, 'createTime' | 'employeeId' | 'updateTime'>,
) {
  return requestClient.post<EmployeeApi.Employee>('/hrm', data, {});
}

/**
 * 更新员工
 * @param id 员工ID
 * @param data 员工数据
 */
export async function updateEmployee(
  id: number,
  data: Partial<
    Omit<EmployeeApi.Employee, 'createTime' | 'employeeId' | 'updateTime'>
  >,
) {
  return requestClient.put<EmployeeApi.Employee>(`/hrm/employee/${id}`, data, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * 删除员工（软删除）
 * @param id 员工ID
 */
export async function deleteEmployee(id: number) {
  return requestClient.delete(`/hrm/employee/${id}`);
}

/**
 * 获取员工详情
 * @param id 员工ID
 */
export async function getEmployeeDetail(id: number) {
  return requestClient.get<EmployeeApi.Employee>(`/hrm/employee/${id}`);
}
