import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemRoleApi, SystemUserApi } from '#/api';

import { formatDateTime } from '@vben/utils';

import { getRoleList } from '#/api/system/role';
import { $t } from '#/locales';

export async function getRoleOptions() {
  const result = await getRoleList();
  const roles: SystemRoleApi.SystemRole[] = Array.isArray(result)
    ? result
    : (result?.items ?? []);

  const options: Array<{ label: string; value: number }> = [];
  const walk = (nodes: SystemRoleApi.SystemRole[]) => {
    nodes.forEach((node) => {
      if (node.roleId && node.name) {
        options.push({
          label: String(node.name),
          value: Number(node.roleId),
        });
      }
      if (node.children && node.children.length > 0) {
        walk(node.children);
      }
    });
  };
  walk(roles);

  return options;
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入账号',
      },
      fieldName: 'username',
      label: '账号',
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入姓名',
      },
      fieldName: 'realName',
      label: '姓名',
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入手机号',
      },
      fieldName: 'phone',
      label: '手机号',
    },
    {
      component: 'InputPassword',
      componentProps: {
        placeholder: '请输入密码',
      },
      fieldName: 'password',
      label: '密码',
    },
    {
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: getRoleOptions,
        class: 'w-full',
        labelField: 'label',
        mode: 'multiple',
        valueField: 'value',
      },
      fieldName: 'roleIds',
      label: '角色',
    },
    {
      component: 'Select',
      fieldName: 'parkIds',
      label: '可管理园区',
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
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'username',
      label: '账号',
    },
    {
      component: 'Input',
      fieldName: 'realName',
      label: '姓名',
    },
    {
      component: 'Input',
      fieldName: 'phone',
      label: '手机号',
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
  ];
}

export function useColumns(
  onActionClick: OnActionClickFn<SystemUserApi.SystemUser>,
): VxeTableGridOptions<SystemUserApi.SystemUser>['columns'] {
  return [
    {
      field: 'username',
      minWidth: 140,
      title: '账号',
    },
    {
      field: 'realName',
      minWidth: 120,
      title: '姓名',
    },
    {
      field: 'phone',
      minWidth: 130,
      title: '手机号',
    },
    {
      field: 'roles',
      formatter: ({ row }) => {
        if (!Array.isArray(row.roles) || row.roles.length === 0) {
          return '-';
        }
        return row.roles.join(', ');
      },
      minWidth: 180,
      title: '角色',
    },
    {
      field: 'parks',
      formatter: ({ row }) => {
        if (!Array.isArray(row.parks) || row.parks.length === 0) {
          return '-';
        }
        return row.parks.map((park) => park.parkName).join(', ');
      },
      minWidth: 220,
      title: '可管理园区',
    },
    {
      cellRender: {
        name: 'CellTag',
      },
      field: 'status',
      minWidth: 100,
      title: $t('system.role.status'),
    },
    {
      field: 'createTime',
      formatter: ({ cellValue }) => formatDateTime(cellValue),
      minWidth: 180,
      title: $t('system.role.createTime'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'username',
          nameTitle: '账号',
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: ['edit', 'delete'],
      },
      field: 'operation',
      fixed: 'right',
      minWidth: 130,
      title: $t('system.role.operation'),
    },
  ];
}
