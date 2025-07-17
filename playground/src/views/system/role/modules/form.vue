<script lang="ts" setup>
import type { DataNode } from 'ant-design-vue/es/tree';

import type { Recordable } from '@vben/types';

// 导入类型
import type { SystemRoleApi } from '#/api/system/role';

import { computed, ref } from 'vue';

import { useVbenDrawer, VbenTree } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Spin } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
// 引入菜单 API 用于权限树
import { getMenuList, getMenusByParentRole } from '#/api/system/menu';
import {
  createRole,
  createRoleCodeAssociation,
  deleteRoleCodeAssociation,
  getRoleById,
  updateRole,
} from '#/api/system/role';
import { $t } from '#/locales';
import { useRoleStore } from '#/store/modules/role';

import { useFormSchema } from '../data';

// 定义 UpsertRole 类型，与 createRole/updateRole 的参数类型一致
type UpsertRole = Omit<
  SystemRoleApi.SystemRole,
  'children' | 'createTime' | 'roleId' | 'updateTime'
>;

const emits = defineEmits(['success']);

// 使用角色store
const roleStore = useRoleStore();

const formData = ref<SystemRoleApi.SystemRole>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const menuTreeData = ref<DataNode[]>([]); // 重命名为 menuTreeData 更清晰
const loadingPermissions = ref(false);

// 权限码选中状态跟踪
const originalCodeSelections = ref<Set<number>>(new Set()); // 原始权限码选中状态
const currentCodeSelections = ref<Set<number>>(new Set()); // 当前权限码选中状态

const id = ref();
const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    // 获取表单值并进行类型断言
    const values = (await formApi.getValues()) as UpsertRole;
    drawerApi.lock();

    try {
      // 先保存角色基本信息
      const result = await (id.value
        ? updateRole(id.value, values)
        : createRole(values));

      // 获取当前角色ID（新建时从返回结果获取，编辑时使用现有ID）
      const currentRoleId =
        id.value ||
        (result && typeof result === 'object' && 'roleId' in result
          ? result.roleId
          : null);

      if (currentRoleId) {
        // 处理权限码选中状态变化
        await handleCodeSelectionChanges(currentRoleId);
      }

      // 更新store中的数据
      if (id.value) {
        // 编辑模式：重新获取该角色的最新数据并更新store
        try {
          const latestRoleData = await getRoleById(id.value);
          if (latestRoleData) {
            roleStore.updateRole(latestRoleData);
          }
        } catch (error) {
          console.error('获取最新角色数据失败，刷新整个列表:', error);
          // 如果获取单个角色失败，则强制清空缓存并重新加载
          roleStore.clearRoles();
          roleStore.fetchRoles();
        }
      } else {
        // 新增模式：添加新角色
        if (result && typeof result === 'object' && 'roleId' in result) {
          // 如果API返回了完整的角色对象
          roleStore.addRole(result as SystemRoleApi.SystemRole);
        } else {
          // 如果API只返回ID，则刷新整个列表
          roleStore.refreshRoles();
        }
      }

      emits('success');
      drawerApi.close();
    } catch (error) {
      console.error('保存角色失败:', error);
      drawerApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<SystemRoleApi.SystemRole>();
      formApi.resetForm();
      if (data) {
        formData.value = data;
        id.value = data.roleId;
        formApi.setValues(data);
      } else {
        id.value = undefined;
        formData.value = undefined;
        // 清空权限码选中状态
        originalCodeSelections.value.clear();
        currentCodeSelections.value.clear();
      }

      // 每次打开都重新加载权限树，确保根据当前角色的父角色权限正确显示
      // 加载完成后再初始化权限码选中状态
      loadPermissions();
    }
  },
});

async function loadPermissions() {
  loadingPermissions.value = true;
  try {
    // 根据当前角色的父角色ID获取权限树
    const parentRoleId = formData.value?.parentId;
    const res = parentRoleId
      ? await getMenusByParentRole(parentRoleId) // 有父角色时，根据父角色权限限制显示范围
      : await getMenuList(); // 顶级角色显示所有权限
    menuTreeData.value = res as unknown as DataNode[]; // 更新 menuTreeData

    // 菜单树数据加载完成后，如果是编辑模式，初始化权限码选中状态
    if (formData.value?.roleId) {
      initializeCodeSelections(formData.value);
    }
  } finally {
    loadingPermissions.value = false;
  }
}

const getDrawerTitle = computed(() => {
  return formData.value?.roleId
    ? $t('common.edit', $t('system.role.name'))
    : $t('common.create', $t('system.role.name'));
});

function getNodeClass(node: Recordable<any>) {
  const classes: string[] = [];
  if (node.value?.type === 'button') {
    classes.push('inline-flex');
    if (node.index % 3 >= 1) {
      classes.push('!pl-0');
    }
  }

  return classes.join(' ');
}

/**
 * 初始化权限码选中状态
 * @param roleData 角色数据
 */
function initializeCodeSelections(roleData: SystemRoleApi.SystemRole) {
  // 从角色数据中获取已选中的权限码列表
  const selectedCodes = roleData.codes || [];

  // 将权限码转换为ID集合
  const codeIds = new Set<number>();

  // 遍历菜单树，找到type为button的项目，并检查其权限码是否被选中
  const extractCodeIds = (menus: any[]) => {
    menus.forEach((menu) => {
      if (
        menu.type === 'button' &&
        menu.code &&
        selectedCodes.includes(menu.authCode)
      ) {
        codeIds.add(menu.code.codeId);
      }
      if (menu.children) {
        extractCodeIds(menu.children);
      }
    });
  };

  // 确保菜单树数据已加载
  if (menuTreeData.value.length > 0) {
    extractCodeIds(menuTreeData.value as any[]);
  } else {
    console.warn(
      `[initializeCodeSelections] 菜单树数据为空，无法初始化权限码选中状态`,
    );
  }

  originalCodeSelections.value = new Set(codeIds);
  currentCodeSelections.value = new Set(codeIds);
}

/**
 * 处理权限码选中状态变化
 * @param roleId 角色ID
 */
async function handleCodeSelectionChanges(roleId: number) {
  // 获取当前表单中选中的权限项
  const formValues = await formApi.getValues();
  const selectedPermissions = formValues.permissions || [];

  // 从选中的权限中提取权限码ID
  const newCodeSelections = new Set<number>();

  const extractSelectedCodes = (menus: any[], selectedIds: number[]) => {
    menus.forEach((menu) => {
      if (
        menu.type === 'button' &&
        menu.authCode &&
        selectedIds.includes(menu.menuId)
      ) {
        newCodeSelections.add(menu.code.codeId);
      }
      if (menu.children) {
        extractSelectedCodes(menu.children, selectedIds);
      }
    });
  };

  if (menuTreeData.value.length > 0) {
    extractSelectedCodes(menuTreeData.value as any[], selectedPermissions);
  }

  // 找出新增的权限码
  const addedCodes = [...newCodeSelections].filter(
    (codeId) => !originalCodeSelections.value.has(codeId),
  );

  // 找出删除的权限码
  const removedCodes = [...originalCodeSelections.value].filter(
    (codeId) => !newCodeSelections.has(codeId),
  );

  // 处理新增的权限码关联
  for (const codeId of addedCodes) {
    try {
      await createRoleCodeAssociation(roleId, codeId);
    } catch (error) {
      console.error(
        `创建角色权限码关联失败 (roleId: ${roleId}, codeId: ${codeId}):`,
        error,
      );
    }
  }

  // 处理删除的权限码关联
  for (const codeId of removedCodes) {
    try {
      await deleteRoleCodeAssociation(roleId, codeId);
    } catch (error) {
      console.error(
        `删除角色权限码关联失败 (roleId: ${roleId}, codeId: ${codeId}):`,
        error,
      );
    }
  }

  // 更新原始选中状态
  originalCodeSelections.value = newCodeSelections;
}

// 导出drawer API供父组件使用
defineExpose({
  close: drawerApi.close,
  open: drawerApi.open,
  setData: drawerApi.setData,
});
</script>
<template>
  <Drawer :title="getDrawerTitle">
    <Form>
      <template #permissions="slotProps">
        <Spin :spinning="loadingPermissions">
          <VbenTree
            v-model:value="slotProps.modelValue"
            :tree-data="menuTreeData"
            menu-tree-data
            multiple
            bordered
            checkable
            :default-expanded-level="2"
            :get-node-class="getNodeClass"
            v-bind="slotProps"
            value-field="menuId"
            label-field="meta.title"
            icon-field="meta.icon"
          >
            <template #node="{ value }">
              <IconifyIcon v-if="value.meta.icon" :icon="value.meta.icon" />
              {{ $t(value.meta.title) }}
            </template>
          </VbenTree>
        </Spin>
      </template>
    </Form>
  </Drawer>
</template>
<style lang="css" scoped>
:deep(.ant-tree-title) {
  .tree-actions {
    display: none;
    margin-left: 20px;
  }
}

:deep(.ant-tree-title:hover) {
  .tree-actions {
    display: flex;
    flex: auto;
    justify-content: flex-end;
    margin-left: 20px;
  }
}
</style>
