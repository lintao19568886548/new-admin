import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemRoleApi, SystemUserApi } from '#/api';

import { formatDateTime } from '@vben/utils';

import { getParkList } from '#/api/park';
import { getRoleList } from '#/api/system/role';
import { $t } from '#/locales';

type SelectOption = { label: string; value: number };

const OPTION_CACHE_TTL = 60_000;
let roleOptionsCache: null | { expiresAt: number; value: SelectOption[] } =
  null;
let roleOptionsRequest: null | Promise<SelectOption[]> = null;
let parkOptionsCache: null | { expiresAt: number; value: SelectOption[] } =
  null;
let parkOptionsRequest: null | Promise<SelectOption[]> = null;

function removeReadonlyOnInteract(event: Event) {
  const target = event.target as null | {
    removeAttribute?: (name: string) => void;
  };
  target?.removeAttribute?.('readonly');
}

function readCache(cache: null | { expiresAt: number; value: SelectOption[] }) {
  if (!cache || cache.expiresAt <= Date.now()) {
    return null;
  }
  return cache.value;
}

function writeCache(value: SelectOption[]) {
  return {
    expiresAt: Date.now() + OPTION_CACHE_TTL,
    value,
  };
}

async function fetchRoleOptions() {
  const result = await getRoleList();
  const roles: SystemRoleApi.SystemRole[] = Array.isArray(result)
    ? result
    : (result?.items ?? []);

  const options: SelectOption[] = [];
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

export async function getRoleOptions() {
  const cached = readCache(roleOptionsCache);
  if (cached) {
    return cached;
  }

  roleOptionsRequest ??= fetchRoleOptions()
    .then((options) => {
      roleOptionsCache = writeCache(options);
      return options;
    })
    .finally(() => {
      roleOptionsRequest = null;
    });

  return roleOptionsRequest;
}

export async function getParkOptions() {
  const cached = readCache(parkOptionsCache);
  if (cached) {
    return cached;
  }

  parkOptionsRequest ??= getParkList()
    .then((result) => {
      let parks: any[] = [];
      if (Array.isArray(result)) {
        parks = result;
      } else if (Array.isArray((result as any)?.items)) {
        parks = (result as any).items;
      }

      const options = parks
        .map((park: any) => ({
          label: String(park.parkName || ''),
          value: Number(park.parkId),
        }))
        .filter(
          (park: SelectOption) => park.label && Number.isInteger(park.value),
        );

      parkOptionsCache = writeCache(options);
      return options;
    })
    .finally(() => {
      parkOptionsRequest = null;
    });

  return parkOptionsRequest;
}

export function prefetchSystemUserFormOptions() {
  void Promise.all([getRoleOptions(), getParkOptions()]).catch((error) => {
    console.warn('预加载账号表单选项失败:', error);
  });
}

function getNoAutofillInputProps(options: {
  inputName: string;
  maskText?: boolean;
  placeholder: string;
}) {
  return {
    'aria-autocomplete': 'none',
    autoCapitalize: 'off',
    autoComplete: 'new-password',
    autocomplete: 'new-password',
    autoCorrect: 'off',
    'data-1p-ignore': 'true',
    'data-form-type': 'other',
    'data-lpignore': 'true',
    name: options.inputName,
    onFocus: removeReadonlyOnInteract,
    onPointerdown: removeReadonlyOnInteract,
    placeholder: options.placeholder,
    readonly: true,
    readOnly: true,
    spellcheck: false,
    ...(options.maskText
      ? {
          style: {
            WebkitTextSecurity: 'disc',
          },
        }
      : null),
  };
}

export function getAccountUsernameInputProps(
  placeholder: string,
  nameSuffix = '',
) {
  return getNoAutofillInputProps({
    inputName: `tenantAccountName${nameSuffix}`,
    placeholder,
  });
}

export function getAccountPasswordInputProps(
  placeholder: string,
  nameSuffix = '',
) {
  return {
    ...getNoAutofillInputProps({
      inputName: `tenantAccountCredential${nameSuffix}`,
      maskText: true,
      placeholder,
    }),
    type: 'text',
  };
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: getAccountUsernameInputProps('请输入账号'),
      fieldName: 'accountName',
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
      component: 'Input',
      componentProps: getAccountPasswordInputProps('请输入初始密码'),
      fieldName: 'accountSecret',
      label: '初始密码',
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
