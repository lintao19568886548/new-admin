import { requestClient } from '#/api/request';

export namespace EmployeeApi {
  export interface EmployeeAccountOption {
    label: string;
    phone?: string;
    realName?: string;
    username?: string;
    value: number;
  }

  export interface Employee {
    [key: string]: any;
    accountLabel?: string;
    accountPhone?: string;
    accountRealName?: string;
    accountUsername?: string;
    address?: string;
    age?: number;
    checkIn?: string;
    checkOut?: string;
    createTime?: string;
    department?: string;
    education?: string;
    employeeId: number;
    gender: string;
    hireDate?: string;
    idNumber?: string;
    isDeleted?: boolean;
    isResigned?: boolean;
    leaveDate?: string;
    name: string;
    phone: string;
    remark?: string;
    updateTime?: string;
    userId?: null | number;
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

export function getEmployeeAccountDisplayName(
  employee?: Pick<EmployeeApi.Employee, 'accountLabel' | 'accountRealName'>,
) {
  return employee?.accountRealName || employee?.accountLabel || '';
}

/**
 * 获取员工列表数据
 * @param params 查询参数
 */
export async function getEmployeeList(params?: EmployeeApi.EmployeeQuery) {
  return requestClient.get<EmployeeApi.EmployeePageResult>(
    '/hrm/employee/list',
    {
      params,
    },
  );
}

/**
 * 创建员工
 * @param data 员工数据
 */
export async function createEmployee(
  data: Omit<EmployeeApi.Employee, 'createTime' | 'employeeId' | 'updateTime'>,
) {
  return requestClient.post<EmployeeApi.Employee>('/hrm/employee', data);
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

/**
 * 获取可绑定账号选项
 * @param params 查询参数
 * @param params.employeeId 员工ID
 * @param params.keyword 搜索关键词
 */
export async function getEmployeeAccountOptions(params?: {
  employeeId?: number;
  keyword?: string;
}) {
  const options = await requestClient.get<EmployeeApi.EmployeeAccountOption[]>(
    '/hrm/employee/accounts',
    {
      params,
    },
  );

  return options.map((item) => ({
    ...item,
    label: item.realName || item.label,
  }));
}
