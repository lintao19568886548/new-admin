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
import { getMenuList } from '#/api/system/menu';
import { createRole, updateRole } from '#/api/system/role';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

// 定义 UpsertRole 类型，与 createRole/updateRole 的参数类型一致
type UpsertRole = Omit<
  SystemRoleApi.SystemRole,
  'children' | 'createTime' | 'roleId' | 'updateTime'
>;

const emits = defineEmits(['success']);

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
      .then(() => {
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
      }

      if (menuTreeData.value.length === 0) {
        // 使用 menuTreeData
        loadPermissions();
      }
    }
  },
});

async function loadPermissions() {
  loadingPermissions.value = true;
  try {
    // 使用菜单列表 API 获取权限树
    const res = await getMenuList(); // 调用 getMenuList
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
</script>
<template>
  <Drawer :title="getDrawerTitle">
    <Form>
      <template #permissions="slotProps">
        <Spin :spinning="loadingPermissions">
          <VbenTree
            v-model:value="slotProps.modelValue"
            绑定到
            form
            的
            menu-ids
            字段
            :tree-data="menuTreeData"
            使用
            menu-tree-data
            multiple
            bordered
            checkable
            允许勾选
            :default-expanded-level="2"
            :get-node-class="getNodeClass"
            check-strictly
            父子节点勾选状态不关联
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
