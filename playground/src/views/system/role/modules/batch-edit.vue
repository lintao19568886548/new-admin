<script setup lang="ts">
import type { DataNode } from 'ant-design-vue/es/tree';

import type { Recordable } from '@vben/types';

import type { SystemRoleApi } from '#/api/system/role';

import { computed, ref, watch } from 'vue';

import { ApiComponent, useVbenDrawer, VbenTree } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Checkbox,
  InputNumber,
  Radio,
  RadioGroup,
  Select,
  Spin,
  TreeSelect,
} from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getParkList } from '#/api/park/park';
import { getMenuList } from '#/api/system/menu';
import { updateRole } from '#/api/system/role';
import { $t } from '#/locales';
import { useRoleStore } from '#/store/modules/role';

const emits = defineEmits(['success']);

// const RadioButton = Radio.Button;

// 使用角色store
const roleStore = useRoleStore();

// 字段启用状态
const fieldEnabled = ref({
  parentid: false,
  parkIds: false,
  permissions: false,
  rates: false,
  reimbursementAuth: false,
  remark: false,
  status: false,
});

// 调试：监听fieldEnabled变化
// watch(
//   fieldEnabled,
//   (newVal) => {
//     console.warn('fieldEnabled变化:', newVal);
//   },
//   { deep: true, immediate: true },
// );

// 选中的角色列表
const selectedRoles = ref<string[]>([]);

// 园区数据缓存
const parkOptions = ref<any[]>([]);
const parkDataLoaded = ref(false);

/**
 * 获取园区数据（带缓存）
 */
const getCachedParkList = async () => {
  if (parkDataLoaded.value && parkOptions.value.length > 0) {
    return parkOptions.value;
  }
  const result = await getParkList();
  parkOptions.value = result;
  parkDataLoaded.value = true;
  return result;
};

// 角色树数据（用于角色选择）
const roleTreeData = ref<DataNode[]>([]);

/**
 * 处理后的角色树数据（添加禁用状态）
 */
const processedRoleTreeData = computed(() => {
  if (roleTreeData.value.length === 0 || roleStore.roleList.length === 0) {
    return roleTreeData.value;
  }

  // 每次selectedRoles变化时重新计算可选择的角色
  // 确保传递给getSelectableRoles的是字符串数组
  const selectedRoleStrings = selectedRoles.value.map(String);
  const selectableIds = getSelectableRoles(selectedRoleStrings);
  // 将可选ID转换为Set以便于查找
  const selectableIdSet = new Set(selectableIds);

  // 调试信息：打印可选角色ID
  // console.log('[DEBUG] 当前选中的角色(原始):', selectedRoles.value);
  // console.log('[DEBUG] 当前选中的角色(字符串):', selectedRoleStrings);
  // console.log('[DEBUG] 可选的角色ID集合:', [...selectableIdSet]);

  function processNode(node: DataNode): DataNode {
    // node.value是number类型，需要转换为字符串进行比较
    const nodeValueStr = String(node.value);
    const isDisabled = !selectableIdSet.has(nodeValueStr);

    // 调试信息：打印每个节点的处理结果
    // console.log(`[DEBUG] 处理节点 ${node.title} (ID: ${node.value}):`, {
    //   disabled: isDisabled,
    //   inSelectableSet: selectableIdSet.has(nodeValueStr),
    // });

    const processedNode = {
      ...node,
      disabled: isDisabled,
    };

    if (node.children) {
      processedNode.children = node.children.map((child) => processNode(child));
    }

    return processedNode;
  }

  return roleTreeData.value.map((node) => processNode(node));
});

// 权限树数据
const menuTreeData = ref<DataNode[]>([]);
const loadingPermissions = ref(false);

// 批量修改表单schema
const batchEditSchema = computed(() => [
  {
    component: 'Input',
    fieldName: 'roleSelection',
    formItemClass: 'items-start',
    label: '角色选择',
    slot: 'roleSelection',
  },
  {
    component: 'Input',
    fieldName: 'parentid',
    formItemClass: 'items-start',
    label: '上级角色',
    slot: 'parentid',
  },
  {
    component: 'Input',
    defaultValue: 1, // 默认启用状态
    fieldName: 'status',
    label: $t('system.role.status'),
    slot: 'status',
  },
  {
    component: 'Input',
    fieldName: 'parkIds',
    formItemClass: 'items-start',
    label: $t('page.common.park'),
    slot: 'parkIds',
  },
  {
    component: 'Input',
    fieldName: 'permissions',
    formItemClass: 'items-start',
    label: $t('system.role.setPermissions'),
    slot: 'permissions',
  },
  {
    component: 'Textarea',
    componentProps: {
      disabled: !fieldEnabled.value.remark,
      placeholder: fieldEnabled.value.remark ? '请输入备注' : '未启用此字段',
    },
    fieldName: 'remark',
    label: $t('system.role.remark'),
    slot: 'remark',
  },
  {
    component: 'Input',
    fieldName: 'reimbursementAuth',
    label: '审核权限',
    slot: 'reimbursementAuth',
  },
  {
    component: 'Input',
    fieldName: 'rates',
    label: '审核金额',
    slot: 'rates',
  },
]);

const [Form, formApi] = useVbenForm({
  schema: batchEditSchema.value,
  showDefaultActions: false,
});

// 调试：监听表单值变化
// watch(
//   () => formApi.getValues(),
//   (values) => {
//     console.warn('表单值变化:', values);
//   },
//   { deep: true },
// );

// 调试：表单API初始化后的状态
// console.warn('表单API初始化完成:', formApi);

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    // if (selectedRoles.value.length === 0) {
    //   console.warn('请选择要修改的角色');
    //   return;
    // }

    const { valid } = await formApi.validate();
    if (!valid) return;

    const values = await formApi.getValues();

    // 构建更新数据，只包含启用的字段
    const updateData: Partial<SystemRoleApi.SystemRole> = {};

    if (fieldEnabled.value.parentid && values.parentid) {
      updateData.parentid = values.parentid;
    }
    if (fieldEnabled.value.parkIds && values.parkIds) {
      updateData.parkIds = values.parkIds;
    }
    if (fieldEnabled.value.status && values.status !== undefined) {
      updateData.status = Boolean(values.status); // 将值转换为布尔类型
    }
    if (fieldEnabled.value.permissions && values.permissions) {
      updateData.permissions = values.permissions;
    }
    if (
      fieldEnabled.value.reimbursementAuth &&
      values.reimbursementAuth !== undefined
    ) {
      updateData.reimbursementAuth = values.reimbursementAuth;
    }
    if (fieldEnabled.value.rates && values.rates !== undefined) {
      updateData.rates = values.rates;
    }
    if (fieldEnabled.value.remark && values.remark) {
      updateData.remark = values.remark;
    }

    // 检查是否有要更新的字段
    // if (Object.keys(updateData).length === 0) {
    //   console.warn('请至少启用一个字段进行修改');
    //   return;
    // }

    drawerApi.lock();

    try {
      // 批量更新选中的角色
      const updatePromises = selectedRoles.value.map((roleId) =>
        updateRole(
          roleId,
          updateData as Omit<
            SystemRoleApi.SystemRole,
            'children' | 'createTime' | 'roleId' | 'updateTime'
          >,
        ),
      );

      await Promise.all(updatePromises);

      // 更新store中的数据
      roleStore.refreshRoles();

      emits('success');
      drawerApi.close();
    } catch (error) {
      console.error('批量更新失败:', error);
      drawerApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      // 重置表单和状态
      formApi.resetForm();
      selectedRoles.value = [];
      Object.keys(fieldEnabled.value).forEach((key) => {
        fieldEnabled.value[key as keyof typeof fieldEnabled.value] = false;
      });

      // 加载角色树、权限树和园区数据
      loadRoleTree();
      loadPermissions();
      loadParkOptions();
    }
  },
});

/**
 * 加载角色树数据
 */
async function loadRoleTree() {
  try {
    await roleStore.fetchRoles();
    const roles = roleStore.roleList;
    roleTreeData.value = buildRoleTree(roles);
  } catch (error) {
    console.error('加载角色树失败:', error);
  }
}

/**
 * 构建角色树结构
 */
function buildRoleTree(roles: SystemRoleApi.SystemRole[]): DataNode[] {
  return roles.map((role) => ({
    key: role.roleId,
    title: role.name,
    value: role.roleId,
    children: role.children ? buildRoleTree(role.children) : undefined,
  }));
}

/**
 * 加载权限树数据
 */
async function loadPermissions() {
  loadingPermissions.value = true;
  try {
    const res = await getMenuList();
    menuTreeData.value = res as unknown as DataNode[];
  } finally {
    loadingPermissions.value = false;
  }
}

/**
 * 加载园区选项数据
 */
async function loadParkOptions() {
  try {
    const response = await getParkList();
    parkOptions.value = response.items || response || [];
  } catch (error) {
    console.error('加载园区数据失败:', error);
  }
}

/**
 * 获取可选择的角色（顶级角色及其同级角色、已选角色的子角色）
 * 规则嵌套生效：选择a后，可选择a的同级角色b和a的子角色c，选择c后，可选择c的同级角色d和c的子角色e
 */
function getSelectableRoles(selectedRoleIds: string[]): string[] {
  const allRoles = flattenRoles(roleStore.roleList);
  const selectableIds = new Set<string>();

  if (selectedRoleIds.length === 0) {
    // 如果没有选中任何角色，只能选择顶级角色
    const topLevelRoles = allRoles.filter(
      (r) =>
        r.parentid === null || r.parentid === undefined || r.parentid === 0,
    );
    topLevelRoles.forEach((role) => selectableIds.add(String(role.roleId)));
    return [...selectableIds];
  }

  // 递归处理所有选中角色的同级角色和子角色（嵌套规则）
  function addSelectableRoles(roleIds: string[]) {
    roleIds.forEach((roleId) => {
      const role = allRoles.find((r) => String(r.roleId) === roleId);
      if (role) {
        // 添加同级角色（包括自己）
        const siblings = allRoles.filter((r) => {
          // 处理顶级角色的情况
          if (
            (role.parentid === null ||
              role.parentid === undefined ||
              role.parentid === 0) &&
            (r.parentid === null ||
              r.parentid === undefined ||
              r.parentid === 0)
          ) {
            return true;
          }
          // 处理非顶级角色的情况
          return r.parentid === role.parentid;
        });
        siblings.forEach((sibling) => {
          const siblingId = String(sibling.roleId);
          if (!selectableIds.has(siblingId)) {
            selectableIds.add(siblingId);
          }
        });

        // 只添加直接子角色（不递归添加所有后代）
        const directChildren = allRoles.filter(
          (r) => r.parentid === role.roleId,
        );
        directChildren.forEach((child) => {
          const childId = String(child.roleId);
          if (!selectableIds.has(childId)) {
            selectableIds.add(childId);
          }
        });
      }
    });
  }

  // 初始处理所有已选中的角色
  addSelectableRoles(selectedRoleIds);

  // 继续处理新增的可选角色中已被选中的角色（嵌套规则）
  let previousSize = 0;
  while (selectableIds.size > previousSize) {
    previousSize = selectableIds.size;
    const currentSelectableIds = [...selectableIds];
    const newlySelectedIds = currentSelectableIds.filter((id) =>
      selectedRoleIds.includes(id),
    );
    addSelectableRoles(newlySelectedIds);
  }

  return [...selectableIds];
}

/**
 * 将树形角色数据扁平化
 */
function flattenRoles(
  roles: SystemRoleApi.SystemRole[],
): SystemRoleApi.SystemRole[] {
  const result: SystemRoleApi.SystemRole[] = [];

  function flatten(roleList: SystemRoleApi.SystemRole[]) {
    roleList.forEach((role) => {
      result.push(role);
      if (role.children && role.children.length > 0) {
        flatten(role.children);
      }
    });
  }

  flatten(roles);
  return result;
}

/**
 * 获取权限树节点的样式类
 */
function getPermissionNodeClass(node: Recordable<any>) {
  const classes: string[] = [];
  if (node.value?.type === 'button') {
    classes.push('inline-flex');
    if (node.index % 3 >= 1) {
      classes.push('!pl-0');
    }
  }
  return classes.join(' ');
}

// 监听选中角色变化
watch(
  selectedRoles,
  (newVal, oldVal) => {
    // console.log('[DEBUG] 角色选择变化，新选中的keys:', newVal);

    // 检测取消选中的角色
    if (oldVal) {
      const removedRoles = oldVal.filter((id) => !newVal.includes(id));

      if (removedRoles.length > 0) {
        // 获取所有角色数据
        const allRoles = flattenRoles(roleStore.roleList);

        // 递归获取被取消选中角色的所有子孙角色
        function getAllDescendants(parentRoleId: number): string[] {
          const children = allRoles.filter((r) => r.parentid === parentRoleId);

          // 使用 flatMap 一次性收集所有后代，避免多次调用 push()
          return children.flatMap((child) => [
            String(child.roleId),
            ...getAllDescendants(child.roleId),
          ]);
        }

        // 收集所有需要取消选中的角色ID（包括子孙角色）
        const rolesToRemove = new Set<string>();
        removedRoles.forEach((removedRoleId) => {
          const roleId = Number(removedRoleId);
          const descendants = getAllDescendants(roleId);
          descendants.forEach((id) => rolesToRemove.add(id));
        });

        // 从选中列表中移除这些角色
        if (rolesToRemove.size > 0) {
          const filteredRoles = newVal.filter(
            (id) => !rolesToRemove.has(String(id)),
          );
          if (filteredRoles.length !== newVal.length) {
            selectedRoles.value = filteredRoles;
          }
        }
      }
    }
  },
  { deep: true },
);

// 监听字段启用状态变化，重置对应字段值
watch(
  fieldEnabled,
  (newVal, oldVal) => {
    Object.keys(newVal).forEach((key) => {
      if (
        oldVal[key as keyof typeof oldVal] &&
        !newVal[key as keyof typeof newVal]
      ) {
        // 字段被禁用时，清空对应值
        formApi.setFieldValue(key, undefined);
      } else if (
        !oldVal[key as keyof typeof oldVal] &&
        newVal[key as keyof typeof newVal] && // 字段被启用时，设置默认值
        key === 'status'
      ) {
        formApi.setFieldValue(key, 1); // 默认启用状态
      }
    });
  },
  { deep: true },
);

defineExpose({
  open: drawerApi.open,
});
</script>

<template>
  <Drawer title="批量修改角色">
    <Form>
      <!-- 角色选择插槽 -->
      <template #roleSelection>
        <div class="space-y-2">
          <div class="mb-2 text-sm text-gray-600">
            选择规则：只能选择顶级角色及其同级角色、已选角色的子角色
          </div>
          <VbenTree
            v-model="selectedRoles"
            :tree-data="processedRoleTreeData"
            multiple
            checkable
            check-strictly
            :default-expanded-level="2"
            value-field="value"
            label-field="title"
          >
            <template #node="{ value }">
              <span
                :class="{
                  'text-gray-400': value.disabled,
                  'text-gray-900': !value.disabled,
                }"
              >
                {{ value.title }}
              </span>
            </template>
          </VbenTree>
        </div>
      </template>

      <!-- 上级角色插槽 -->
      <template #parentid="slotProps">
        <div class="flex items-center gap-2">
          <Checkbox v-model:checked="fieldEnabled.parentid" />
          <div class="flex-1">
            <ApiComponent
              v-model:value="slotProps.modelValue"
              :api="
                async () => {
                  if (roleStore.isLoaded && roleStore.roleList.length > 0) {
                    return roleStore.roleList;
                  }
                  return await roleStore.fetchRoles();
                }
              "
              :component="TreeSelect"
              class="w-full"
              :disabled="!fieldEnabled.parentid"
              :field-names="{
                label: 'name',
                value: 'roleId',
                children: 'children',
              }"
              :filter-tree-node="
                (input: string, node: Recordable<any>) => {
                  if (!input || input.length === 0) return true;
                  const name = node.name ?? '';
                  return name.includes(input);
                }
              "
              loading-slot="suffixIcon"
              model-prop-name="value"
              options-prop-name="treeData"
              placeholder="请选择上级角色"
              show-search
              tree-default-expand-all
              tree-node-filter-prop="name"
              visible-event="onVisibleChange"
            />
          </div>
        </div>
      </template>

      <!-- 所属园区插槽 -->
      <template #parkIds="slotProps">
        <div class="flex items-center gap-2">
          <Checkbox v-model:checked="fieldEnabled.parkIds" />
          <div class="flex-1" style="min-width: 200px">
            <ApiComponent
              v-model:value="slotProps.modelValue"
              :api="getCachedParkList"
              :component="Select"
              class="w-full"
              :disabled="!fieldEnabled.parkIds"
              :field-names="{ label: 'parkName', value: 'parkId' }"
              loading-slot="suffixIcon"
              mode="multiple"
              model-prop-name="value"
              placeholder="请选择所属园区"
              show-search
              style="width: 100%; min-width: 200px"
              visible-event="onVisibleChange"
            />
          </div>
        </div>
      </template>

      <!-- 状态插槽 -->
      <template #status="slotProps">
        <div class="flex items-center gap-2">
          <Checkbox v-model:checked="fieldEnabled.status" />
          <div class="flex-1">
            <RadioGroup
              v-bind="slotProps"
              :disabled="!fieldEnabled.status"
              button-style="solid"
              option-type="button"
            >
              <Radio :value="1">{{ $t('common.enabled') }}</Radio>
              <Radio :value="0">{{ $t('common.disabled') }}</Radio>
            </RadioGroup>
          </div>
        </div>
      </template>

      <!-- 授权插槽 -->
      <template #permissions="slotProps">
        <div class="flex items-start gap-2">
          <Checkbox v-model:checked="fieldEnabled.permissions" class="mt-1" />
          <div class="flex-1">
            <Spin :spinning="loadingPermissions">
              <VbenTree
                v-model:value="slotProps.modelValue"
                :tree-data="menuTreeData"
                :disabled="!fieldEnabled.permissions"
                menu-tree-data
                multiple
                bordered
                checkable
                :default-expanded-level="2"
                :get-node-class="getPermissionNodeClass"
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
          </div>
        </div>
      </template>

      <!-- 审核权限插槽 -->
      <template #reimbursementAuth="slotProps">
        <div class="flex items-center gap-2">
          <Checkbox v-model:checked="fieldEnabled.reimbursementAuth" />
          <div class="flex-1" style="min-width: 200px">
            <Select
              v-model:value="slotProps.modelValue"
              allow-clear
              class="w-full"
              :disabled="!fieldEnabled.reimbursementAuth"
              :options="[
                { label: '允许', value: 1 },
                { label: '拒绝', value: 0 },
              ]"
              style="width: 100%; min-width: 200px"
            />
          </div>
        </div>
      </template>

      <!-- 审核金额插槽 -->
      <template #rates="slotProps">
        <div class="flex items-center gap-2">
          <Checkbox v-model:checked="fieldEnabled.rates" />
          <div class="flex-1">
            <InputNumber
              v-model:value="slotProps.modelValue"
              allow-clear
              class="w-full"
              :disabled="!fieldEnabled.rates"
              :min="0"
              placeholder="请输入此角色可审核的最大金额"
            />
          </div>
        </div>
      </template>

      <!-- 备注插槽 -->
      <template #remark="slotProps">
        <div class="flex items-start gap-2">
          <Checkbox v-model:checked="fieldEnabled.remark" class="mt-1" />
          <div class="flex-1">
            <textarea
              v-model="slotProps.modelValue"
              :disabled="!fieldEnabled.remark"
              :placeholder="fieldEnabled.remark ? '请输入备注' : '未启用此字段'"
              class="ant-input"
              :class="{ 'ant-input-disabled': !fieldEnabled.remark }"
              rows="3"
            ></textarea>
          </div>
        </div>
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

.ant-input-disabled {
  color: rgb(0 0 0 / 25%);
  cursor: not-allowed;
  background-color: #f5f5f5;
  opacity: 1;
}

.ant-radio-button-wrapper-disabled {
  color: rgb(0 0 0 / 25%);
  cursor: not-allowed;
  background-color: #f5f5f5;
  border-color: #d9d9d9;
}

.ant-radio-button-wrapper-disabled input {
  cursor: not-allowed;
}

.ant-select-disabled {
  color: rgb(0 0 0 / 25%);
  cursor: not-allowed;
  background-color: #f5f5f5;
  border-color: #d9d9d9;
}

.ant-select-multiple {
  padding: 4px 8px;
  background-color: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
}

.ant-select-multiple:focus {
  border-color: #1890ff;
  outline: none;
  box-shadow: 0 0 0 2px rgb(24 144 255 / 20%);
}
</style>
