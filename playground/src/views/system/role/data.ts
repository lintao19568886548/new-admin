import type { Recordable } from '@vben/types';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { h } from 'vue';

import { formatDateTime, getPopupContainer } from '@vben/utils';

import { getParkList } from '#/api/park/park';
import { $t } from '#/locales';
import { useRoleStore } from '#/store/modules/role';

export function useFormSchema(): VbenFormSchema[] {
  // 获取角色store实例
  const roleStore = useRoleStore();

  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.role.roleName'),
      rules: 'required',
    },
    // 添加父级角色选择
    {
      component: 'ApiTreeSelect',
      componentProps: {
        api: () => roleStore.fetchRoles(), // 使用角色store获取数据
        class: 'w-full',
        // 假设 getRoleList 在无参数时返回树状结构
        filterTreeNode(input: string, node: Recordable<any>) {
          if (!input || input.length === 0) {
            return true;
          }
          const name: string = node.name ?? '';
          if (!name) return false;
          return name.includes(input);
        },
        getPopupContainer,
        labelField: 'name', // 显示角色名称
        // resultField: 'items', // 移除resultField，因为store直接返回数组
        showSearch: true,
        treeDefaultExpandAll: true,
        valueField: 'roleId', // 值为角色ID
        childrenField: 'children', // 子节点字段
      },
      fieldName: 'parentid', // 字段名为 parentid
      label: $t('上级角色'), // 标签为“上级角色”
      renderComponentContent() {
        return {
          title({ label }: { label: string }) {
            if (!label) return '';
            // 可以在这里添加图标等渲染逻辑
            return h('div', { class: 'flex items-center gap-1' }, [
              h('span', { class: '' }, label || ''),
            ]);
          },
        };
      },
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
        optionType: 'button',
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('system.role.status'),
    },
    {
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: getParkList,
        class: 'w-full',
        labelField: 'parkName',
        mode: 'multiple',
        options: [],
        valueField: 'parkId',
      },
      fieldName: 'parkIds',
      label: $t('page.common.park'),
    },
    {
      component: 'Input', // component 类型不重要，因为会被 slot 覆盖
      fieldName: 'permissions', // 插槽名称必须与 fieldName 一致
      formItemClass: 'items-start',
      label: $t('system.role.setPermissions'),
      // 这个字段由 form.vue 中的 VbenTree 插槽处理，slotProps.modelValue 绑定到此字段
    },
    {
      component: 'Textarea',
      fieldName: 'remark',
      label: $t('system.role.remark'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        options: [
          { label: '允许', value: 1 },
          { label: '拒绝', value: 0 },
        ],
      },
      fieldName: 'reimbursementAuth',
      label: '审核权限',
    },
    {
      component: 'InputNumber',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        min: 0,
        placeholder: '请输入此角色可审核的最大金额',
      },
      fieldName: 'rates',
      label: '审核金额',
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.role.roleName'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
      },
      fieldName: 'status',
      label: $t('system.role.status'),
    },
    {
      component: 'RangePicker',
      fieldName: 'createTime',
      label: $t('system.role.createTime'),
    },
  ];
}

export function useColumns(
  onActionClick: OnActionClickFn,
  onStatusChange?: (
    newStatus: any,
    row: any,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  return [
    {
      align: 'left', // 左对齐以显示树结构
      field: 'name',
      title: $t('system.role.roleName'),
      treeNode: true, // 设置为树节点
      width: 200,
    },
    {
      field: 'rates',
      title: '审核金额(元)',
      width: 120,
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: $t('system.role.status'),
      width: 100,
    },
    {
      field: 'remark',
      minWidth: 100,
      title: $t('system.role.remark'),
    },
    {
      field: 'createTime',
      formatter: ({ cellValue }) => {
        return formatDateTime(cellValue);
      },
      title: $t('system.role.createTime'),
      width: 200,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'name',
          nameTitle: $t('system.role.name'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          // 添加操作选项
          {
            code: 'append',
            text: '新增下级',
          },
          'edit',
          'delete',
        ],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('system.role.operation'),
      width: 200,
    },
  ];
}
