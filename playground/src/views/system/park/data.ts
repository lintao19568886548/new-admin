import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { $t } from '#/locales';

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'parkName',
      label: $t('page.park.name'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'address',
      label: $t('page.park.address'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        style: {
          width: '100%',
        },
      },
      fieldName: 'area',
      label: $t('page.park.area'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'status',
      label: $t('page.park.status'),
    },
    {
      component: 'Textarea',
      fieldName: 'description',
      label: $t('page.park.description'),
    },
  ];
}

// 删除 useGridFormSchema 函数

export function useColumns(
  onActionClick: OnActionClickFn,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'parkName',
      minWidth: 150,
      title: $t('page.park.name'),
    },
    {
      field: 'address',
      minWidth: 150,
      title: $t('page.park.address'),
    },
    {
      field: 'area',
      minWidth: 100,
      title: $t('page.park.area'),
    },
    {
      field: 'status',
      minWidth: 100,
      title: $t('page.park.status'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'parkName',
          nameTitle: $t('page.park.name'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: ['edit', { code: 'factory', text: '管理厂房' }, 'delete'],
      },
      field: 'operation',
      fixed: 'right',
      minWidth: 200,
      title: $t('system.role.operation'),
    },
  ];
}
