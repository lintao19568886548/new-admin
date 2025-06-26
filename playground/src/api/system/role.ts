import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';
// 引入 getMenuList 用于权限树
import { getMenuList } from '#/api/system/menu';

export namespace SystemRoleApi {
  /**
   * @description 系统角色类型定义
   */
  export interface SystemRole {
    /** 子角色列表 */
    children?: SystemRole[];
    /** 权限码列表 */
    codes?: string[];
    /** 创建时间 */
    createTime?: string;
    /** 角色名称 */
    name?: string;
    /** 父级角色ID */
    parentId?: null | number;
    /** 角色关联的园区ID列表 */
    parkIds?: number[];
    /** 角色拥有的权限菜单ID列表 */
    permissions?: number[];
    /** 权限等级 */
    privilegeLevel?: number;
    /** 费率/评分 */
    rates?: number;
    /** 审核权限 (1: 允许, 0: 拒绝) */
    reimbursementAuth?: number;
    /** 备注 */
    remark?: string;
    /** 角色ID */
    roleId: number;
    /** 状态 (true: 启用, false: 禁用) */
    status: boolean;
    /** 更新时间 */
    updateTime?: string;
  }
}

/**
 * @function getRoleList
 * @description 获取角色列表数据（支持层级）
 * @param params 查询参数，用于过滤和分页
 * @returns 返回角色列表，可能是层级结构或扁平列表
 */
async function getRoleList(params?: Recordable<any>) {
  // 后端已实现：无 params 时返回顶层及子级，有 params 时返回扁平分页列表
  return requestClient.get<
    | SystemRoleApi.SystemRole[]
    | { items: SystemRoleApi.SystemRole[]; total: number }
  >('/system/role/list', { params });
}

/**
 * @function createRole
 * @description 创建角色
 * @param data 角色数据，需包含 parentId, privilegeLevel, rates 等字段
 * @returns 返回创建结果
 */
async function createRole(
  data: Omit<
    SystemRoleApi.SystemRole,
    'children' | 'createTime' | 'roleId' | 'updateTime'
  >,
) {
  return requestClient.post('/system/role', data);
}

/**
 * @function updateRole
 * @description 更新角色
 * @param id 角色 ID
 * @param data 角色数据，需包含 parentId, privilegeLevel, rates 等字段
 * @returns 返回更新结果
 */
async function updateRole(
  id: number | string, // ID 类型可能为数字或字符串，与后端保持一致
  data: Omit<
    SystemRoleApi.SystemRole,
    'children' | 'createTime' | 'roleId' | 'updateTime'
  >,
) {
  return requestClient.put(`/system/role/${id}`, data);
}

/**
 * @function deleteRole
 * @description 删除角色
 * @param id 角色 ID
 * @returns 返回删除结果
 */
async function deleteRole(id: number | string) {
  // ID 类型可能为数字或字符串
  return requestClient.delete(`/system/role/${id}`);
}

/**
 * @function getRolePermissionTree
 * @description 获取角色权限树（复用菜单树）
 * @returns 返回菜单树作为权限树
 */
async function getRolePermissionTree() {
  // 直接调用 getMenuList 获取菜单树作为权限树
  return getMenuList();
}

/**
 * @function getRoleById
 * @description 根据 ID 获取单个角色信息
 * @param id 角色 ID
 * @returns 返回角色详细信息
 */
async function getRoleById(id: number | string) {
  return requestClient.get<SystemRoleApi.SystemRole>(`/system/role/${id}`);
}

/**
 * @function createRoleCodeAssociation
 * @description 创建角色权限码关联
 * @param roleId 角色ID
 * @param codeId 权限码ID
 * @returns 返回创建结果
 */
async function createRoleCodeAssociation(roleId: number, codeId: number) {
  return requestClient.post('/system/role/code', { codeId, roleId });
}

/**
 * @function deleteRoleCodeAssociation
 * @description 删除角色权限码关联
 * @param roleId 角色ID
 * @param codeId 权限码ID
 * @returns 返回删除结果
 */
async function deleteRoleCodeAssociation(roleId: number, codeId: number) {
  return requestClient.delete('/system/role/code', {
    data: { codeId, roleId },
  });
}

/**
 * @function addPermissionsToRole
 * @description 向角色追加权限
 * @params id 角色 ID
 * @params data 包含权限ID列表
 * @returns 返回操作结果
 */
async function addPermissionsToRole(
  id: number | string,
  data: {
    batchRoleIds?: (number | string)[];
    permissions: (number | string)[];
  },
) {
  return requestClient.post(`/system/role/${id}/add-permissions`, data);
}

/**
 * @function removePermissionsFromRole
 * @description 从角色移除权限
 * @params id 角色 ID
 * @params data 包含权限ID列表
 * @returns 返回操作结果
 */
async function removePermissionsFromRole(
  id: number | string,
  data: { permissions: (number | string)[] },
) {
  return requestClient.post(`/system/role/${id}/remove-permissions`, data);
}

export {
  addPermissionsToRole,
  createRole,
  createRoleCodeAssociation,
  deleteRole,
  deleteRoleCodeAssociation,
  getRoleById,
  getRoleList,
  getRolePermissionTree,
  removePermissionsFromRole,
  updateRole,
};
