<script lang="ts" setup>
import type { DataNode } from 'ant-design-vue/es/tree';

import type { Recordable } from '@vben/types';

// 导入类型
import type { SystemRoleApi } from '#/api/system/role';

import { computed, ref } from 'vue';

import { useVbenDrawer, VbenTree } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Spin,
} from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createPark, getParkList } from '#/api/park/park';
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
const parkOptions = ref<Recordable<any>[]>([]);
const parkLoading = ref(false);
const parkSearchText = ref('');
const quickParkModalOpen = ref(false);
const quickParkSaving = ref(false);
const quickParkForm = ref<{
  address: string;
  area?: number;
  parkName: string;
}>({
  address: '',
  area: undefined,
  parkName: '',
});

function normalizeMenuId(value: unknown) {
  const menuId = Number(value);
  return Number.isSafeInteger(menuId) && menuId > 0 ? menuId : undefined;
}

function filterPersistedMenuNodes(menus: any[]): any[] {
  return menus
    .map((menu) => {
      const menuId = normalizeMenuId(menu?.menuId);
      const children = Array.isArray(menu?.children)
        ? filterPersistedMenuNodes(menu.children)
        : [];

      if (!menuId) {
        return null;
      }

      return {
        ...menu,
        children: children.length > 0 ? children : undefined,
      };
    })
    .filter(Boolean);
}

function normalizePermissionIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) => normalizeMenuId(item))
        .filter((item): item is number => item !== undefined),
    ),
  ];
}

function normalizeParkOptions(response: any) {
  const responseItems = Array.isArray(response?.items) ? response.items : [];
  const list = Array.isArray(response) ? response : responseItems;
  const seenIds = new Set<number>();

  return list
    .map((item: Recordable<any>) => ({
      ...item,
      parkId: normalizeMenuId(item?.parkId),
      parkName: String(item?.parkName || '').trim(),
    }))
    .filter((item: Recordable<any>) => {
      if (!item.parkId || !item.parkName || seenIds.has(item.parkId)) {
        return false;
      }
      seenIds.add(item.parkId);
      return true;
    });
}

const parkSelectOptions = computed(() =>
  parkOptions.value.map((park) => ({
    address: park.address,
    label: park.parkName,
    parkName: park.parkName,
    value: park.parkId,
  })),
);

function upsertParkOption(park: Recordable<any>) {
  const parkId = normalizeMenuId(park?.parkId);
  const parkName = String(park?.parkName || '').trim();
  if (!parkId || !parkName) return;

  const nextPark = {
    ...park,
    parkId,
    parkName,
  };
  const index = parkOptions.value.findIndex((item) => item.parkId === parkId);
  if (index === -1) {
    parkOptions.value = [...parkOptions.value, nextPark];
  } else {
    parkOptions.value[index] = { ...parkOptions.value[index], ...nextPark };
  }
}

async function loadParkOptions() {
  if (parkLoading.value) return;
  parkLoading.value = true;
  try {
    parkOptions.value = normalizeParkOptions(await getParkList());
  } catch (error) {
    console.error('加载园区列表失败:', error);
    message.error('加载园区列表失败');
  } finally {
    parkLoading.value = false;
  }
}

function filterParkOption(input: string, option?: Recordable<any>) {
  if (!input) return true;
  const keyword = input.trim().toLowerCase();
  const text = [option?.label, option?.parkName, option?.address, option?.value]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return text.includes(keyword);
}

function resetQuickParkForm(parkName = '') {
  quickParkForm.value = {
    address: '',
    area: undefined,
    parkName,
  };
}

function openQuickCreatePark() {
  resetQuickParkForm(parkSearchText.value.trim());
  quickParkModalOpen.value = true;
}

function closeQuickCreatePark() {
  quickParkModalOpen.value = false;
  resetQuickParkForm();
}

async function submitQuickCreatePark() {
  const parkName = quickParkForm.value.parkName.trim();
  const address = quickParkForm.value.address.trim();
  const area = Number(quickParkForm.value.area);

  if (!parkName) {
    message.warning('请输入园区名称');
    return;
  }
  if (!address) {
    message.warning('请输入园区地址');
    return;
  }
  if (!Number.isFinite(area) || area <= 0) {
    message.warning('请输入有效的园区面积');
    return;
  }

  quickParkSaving.value = true;
  try {
    const createdPark = await createPark({
      address,
      area,
      parkName,
      status: '运营中',
    });
    await loadParkOptions();

    const createdParkId = normalizeMenuId((createdPark as any)?.parkId);
    const createdOption =
      (createdParkId
        ? parkOptions.value.find((park) => park.parkId === createdParkId)
        : undefined) ||
      parkOptions.value.find((park) => park.parkName === parkName) ||
      (createdParkId
        ? { address, area, parkId: createdParkId, parkName }
        : null);

    if (!createdOption?.parkId) {
      message.warning('园区已新增，但未能自动选中，请刷新后再选择');
      closeQuickCreatePark();
      return;
    }

    upsertParkOption(createdOption);
    const values = await formApi.getValues();
    const selectedParkIds = normalizePermissionIds(values.parkIds);
    formApi.setFieldValue('parkIds', [
      ...new Set([createdOption.parkId, ...selectedParkIds]),
    ]);
    message.success('园区已新增');
    closeQuickCreatePark();
  } catch (error) {
    console.error('新增园区失败:', error);
    message.error('新增园区失败');
  } finally {
    quickParkSaving.value = false;
  }
}

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    // 获取表单值并进行类型断言
    const values = (await formApi.getValues()) as UpsertRole;
    values.permissions = normalizePermissionIds(values.permissions);
    values.parkIds = normalizePermissionIds(values.parkIds);

    if (values.parkIds.length === 0) {
      message.warning('请选择所属园区');
      return;
    }

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
      loadParkOptions();
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
    menuTreeData.value = filterPersistedMenuNodes(
      res as unknown as any[],
    ) as DataNode[]; // 更新 menuTreeData

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

function getPermissionNodeTitle(value: Recordable<any>) {
  return value?.meta?.title || value?.name || value?.path || '';
}

function getPermissionNodeTags(value: Recordable<any>) {
  const meta = value?.meta || {};
  const pathText =
    `${value?.path || ''} ${value?.component || ''}`.toLowerCase();
  const tags: string[] = [];

  if (value?.type === 'button') {
    tags.push('按钮');
  }
  if (meta.isApp || pathText.includes('mobile') || pathText.includes('/app')) {
    tags.push('移动端');
  }
  if (meta.hideInMenu) {
    tags.push('隐藏');
  }
  if (pathText.includes(':') || pathText.includes('detail')) {
    tags.push('详情');
  }

  return [...new Set(tags)];
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
  const selectedPermissions = normalizePermissionIds(formValues.permissions);

  // 从选中的权限中提取权限码ID
  const newCodeSelections = new Set<number>();

  const extractSelectedCodes = (menus: any[], selectedIds: number[]) => {
    menus.forEach((menu) => {
      if (
        menu.type === 'button' &&
        menu.authCode &&
        selectedIds.includes(Number(menu.menuId))
      ) {
        const codeId = Number(menu.code?.codeId);
        if (Number.isSafeInteger(codeId) && codeId > 0) {
          newCodeSelections.add(codeId);
        }
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
      <template #parkIds="slotProps">
        <div class="space-y-2">
          <div class="flex gap-2">
            <Select
              v-model:value="slotProps.modelValue"
              allow-clear
              class="min-w-0 flex-1"
              :filter-option="filterParkOption"
              :loading="parkLoading"
              mode="multiple"
              :not-found-content="parkLoading ? undefined : '暂无匹配园区'"
              :options="parkSelectOptions"
              placeholder="输入搜索或下拉选择所属园区"
              show-search
              @change="
                (value: unknown) =>
                  formApi.setFieldValue(
                    'parkIds',
                    normalizePermissionIds(value),
                  )
              "
              @dropdown-visible-change="
                (open: boolean) => {
                  if (open) loadParkOptions();
                }
              "
              @search="(value: string) => (parkSearchText = value)"
            />
            <Button @click="openQuickCreatePark">新增园区</Button>
          </div>
          <div class="text-xs text-gray-500">
            可直接输入园区名称过滤，也可以展开下拉选择；保存时会自动去重。
          </div>
        </div>
      </template>

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
              <span class="permission-node">
                <IconifyIcon v-if="value.meta?.icon" :icon="value.meta.icon" />
                <span>{{ $t(getPermissionNodeTitle(value)) }}</span>
                <span
                  v-for="tag in getPermissionNodeTags(value)"
                  :key="tag"
                  class="permission-node-tag"
                >
                  {{ tag }}
                </span>
              </span>
            </template>
          </VbenTree>
        </Spin>
      </template>
    </Form>
    <Modal
      v-model:open="quickParkModalOpen"
      cancel-text="取消"
      :confirm-loading="quickParkSaving"
      ok-text="保存并选中"
      title="新增园区"
      @cancel="closeQuickCreatePark"
      @ok="submitQuickCreatePark"
    >
      <div class="space-y-3">
        <div>
          <div class="mb-1 text-sm">园区名称</div>
          <Input
            v-model:value="quickParkForm.parkName"
            placeholder="请输入园区名称"
          />
        </div>
        <div>
          <div class="mb-1 text-sm">园区地址</div>
          <Input
            v-model:value="quickParkForm.address"
            placeholder="请输入园区地址"
          />
        </div>
        <div>
          <div class="mb-1 text-sm">园区面积（㎡）</div>
          <InputNumber
            v-model:value="quickParkForm.area"
            class="w-full"
            :min="0.01"
            :precision="2"
            placeholder="请输入园区面积"
          />
        </div>
      </div>
    </Modal>
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

.permission-node {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  min-height: 22px;
}

.permission-node-tag {
  padding: 0 6px;
  font-size: 12px;
  line-height: 18px;
  color: #4b5563;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
}
</style>
