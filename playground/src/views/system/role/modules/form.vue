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
import { createRole, getRoleById, updateRole } from '#/api/system/role';
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

const id = ref();
const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    // 获取表单值并进行类型断言
    const values = (await formApi.getValues()) as UpsertRole;
    drawerApi.lock();
    (id.value ? updateRole(id.value, values) : createRole(values))
      .then(async (result) => {
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
      })
      .catch(() => {
        drawerApi.unlock();
      });
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
      }

      // 每次打开都重新加载权限树，确保根据当前角色的父角色权限正确显示
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
