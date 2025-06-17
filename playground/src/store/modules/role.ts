import type { SystemRoleApi } from '#/api/system/role';

import { ref } from 'vue';

import { defineStore } from 'pinia';

import { getRoleList } from '#/api/system/role';

/**
 * 角色数据状态管理
 * 用于在角色列表页面和表单页面之间共享角色数据，避免重复API调用
 */
export const useRoleStore = defineStore('role', () => {
  // 角色列表数据
  const roleList = ref<SystemRoleApi.SystemRole[]>([]);

  // 加载状态
  const loading = ref(false);

  // 数据是否已加载
  const isLoaded = ref(false);

  /**
   * 获取角色列表数据
   * 如果数据已存在则直接返回，否则调用API获取
   */
  const fetchRoles = async (): Promise<SystemRoleApi.SystemRole[]> => {
    loading.value = true;
    try {
      const result = await getRoleList();

      // 处理API返回的不同数据格式
      let roles: SystemRoleApi.SystemRole[];
      if (Array.isArray(result)) {
        roles = result;
      } else if (result && typeof result === 'object' && 'items' in result) {
        roles = result.items;
      } else {
        roles = [];
      }

      roleList.value = roles;
      isLoaded.value = true;
      return roles;
    } catch (error) {
      console.error('获取角色列表失败:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 刷新角色列表数据
   */
  const refreshRoles = async (): Promise<SystemRoleApi.SystemRole[]> => {
    return fetchRoles();
  };

  /**
   * 清空角色列表数据
   */
  const clearRoles = () => {
    roleList.value = [];
    isLoaded.value = false;
  };

  /**
   * 添加角色到列表
   */
  const addRole = (role: SystemRoleApi.SystemRole) => {
    roleList.value.push(role);
  };

  /**
   * 更新角色列表中的某个角色
   */
  const updateRole = (updatedRole: SystemRoleApi.SystemRole) => {
    const index = roleList.value.findIndex(
      (role) => role.roleId === updatedRole.roleId,
    );
    if (index !== -1) {
      roleList.value[index] = updatedRole;
    }
  };

  /**
   * 从角色列表中删除某个角色
   */
  const removeRole = (roleId: number) => {
    const index = roleList.value.findIndex((role) => role.roleId === roleId);
    if (index !== -1) {
      roleList.value.splice(index, 1);
    }
  };

  return {
    addRole,
    clearRoles,
    fetchRoles,
    isLoaded,
    loading,
    refreshRoles,
    removeRole,
    roleList,
    updateRole,
  };
});
