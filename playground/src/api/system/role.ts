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
    /** 创建时间 */
    createTime?: string;
    /** 角色拥有的菜单ID列表 (根据后端实际情况可能需要调整) */
    menuIds?: number[];
    /** 角色名称 */
    name?: string;
    /** 父级角色ID */
    parentid?: null | number;
    /** 角色关联的园区ID列表 (根据后端实际情况可能需要调整) */
    parkIds?: number[];
    /** 权限等级 */
    privilegeLevel?: number;
    /** 费率/评分 */
    rates?: number;
    /** 备注 */
    remark?: string;
    /** 角色ID */
    roleId: number;
    /** 状态 (true: 启用, false: 禁用) */
    status: boolean;
    /** 更新时间 */
    updateTime?: string;
    // [key: string]: any; // 移除宽泛的索引签名，明确列出字段
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
 * @param data 角色数据，需包含 parentid, privilegeLevel, rates 等字段
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
 * @param data 角色数据，需包含 parentid, privilegeLevel, rates 等字段
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

export {
  createRole,
  deleteRole,
  getRoleList,
  getRolePermissionTree,
  updateRole,
};
