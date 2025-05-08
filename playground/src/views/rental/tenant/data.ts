import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { h } from 'vue';

import { Tag } from 'ant-design-vue';
import dayjs from 'dayjs';

import { z } from '#/adapter/form';
import { getParkList } from '#/api/park';
import { $t } from '#/locales';

/**
 * 获取标签颜色
 */
export function getTagTypeOptions() {
  return [
    {
      color: 'green',
      label: $t('system.rental.tenant.status.current'),
      value: '生效中',
    },
    {
      color: 'red',
      label: $t('system.rental.tenant.status.expired'),
      value: '过期',
    },
  ];
}

/**
 * 获取表单的字段配置
 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'tenantName',
      label: $t('system.rental.tenant.name'),
      rules: 'required',
    },
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: ['开始日期', '结束日期'],
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'contractDate',
      label: $t('system.rental.tenant.contractDate'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'phoneNumber',
      label: $t('page.tenant.phone'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'address',
      label: $t('system.rental.tenant.address'),
      rules: 'required',
    },
    {
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: getParkList,
        class: 'w-full',
        labelField: 'parkName',
        valueField: 'parkId',
      },
      fieldName: 'parkId',
      label: $t('page.common.park'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元/月',
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'rent',
      label: $t('page.common.rent'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '㎡',
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'area',
      label: $t('page.rental.area'),
    },

    {
      component: 'DatePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: '请选择涨租日期',
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD', // 简化日期格式
      },
      fieldName: 'increaseDate',
      label: $t('system.rental.tenant.increaseDate'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '%',
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'increaseRate',
      label: $t('system.rental.tenant.increaseRate'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '‰',
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'penaltyRate',
      label: $t('page.rental.penaltyRate'),
    },
    // {
    //   component: markRaw(IncreaseForm),
    //   fieldName: 'increaseData', // 保持不变，已与接口一致
    //   // label: $t('page.rental.increaseData'),
    // },

    // {
    //   component: 'RadioGroup',
    //   componentProps: {
    //     buttonStyle: 'solid',
    //     options: [
    //       { label: $t('system.rental.tenant.status.current'), value: '当期' },
    //       { label: $t('system.rental.tenant.status.expired'), value: '过期' },
    //     ],
    //     optionType: 'button',
    //   },
    //   defaultValue: '当期',
    //   fieldName: 'status',
    //   label: $t('system.rental.tenant.status.label'),
    // },
    {
      component: 'Textarea',
      componentProps: {
        maxLength: 200,
        rows: 4,
        showCount: true,
        style: {
          width: '100%',
        },
      },
      fieldName: 'remark',
      formItemClass: 'col-span-3',
      label: $t('page.common.remark'),
      rules: z
        .string()
        .max(
          200,
          $t('ui.formRules.maxLength', [$t('system.rental.description'), 300]),
        )
        .optional(),
    },
  ];
}

/**
 * 获取表格查询表单配置
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'tenantName',
      label: $t('system.rental.tenant.name'),
    },
    {
      component: 'Input',
      fieldName: 'phoneNumber',
      label: $t('page.tenant.phone'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('system.rental.tenant.status.current'), value: '生效中' },
          { label: $t('system.rental.tenant.status.expired'), value: '过期' },
        ],
      },
      fieldName: 'status',
      label: $t('system.rental.tenant.status.label'),
    },
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: ['开始日期', '结束日期'],
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'contractDate',
      label: $t('system.rental.tenant.contractDate'),
    },
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: ['开始日期', '结束日期'],
        valueFormat: 'YYYY-MM-DD', // 指定输出格式
      },
      fieldName: 'increaseDate',
      label: $t('system.rental.tenant.increaseDate'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '%',
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'increaseRate',
      label: $t('system.rental.tenant.increaseRate'),
    },
    {
      component: 'Input',
      fieldName: 'address',
      label: $t('system.rental.tenant.address'),
    },
  ];
}

export function useIncreaseFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'tenantName',
      label: $t('system.rental.tenant.name'),
    },
    {
      component: 'Input',
      fieldName: 'tenantName',
      label: $t('system.rental.tenant.name'),
    },
  ];
}

/**
 * 获取表格列配置
 */
export function useColumns<T = any>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'tenantName',
      minWidth: 150,
      title: $t('system.rental.tenant.name'),
    },
    {
      field: 'phoneNumber',
      title: $t('system.rental.tenant.phone'),
      width: 120,
    },
    // {
    //   cellRender: {
    //     name: 'CellTag',
    //     options: getTagTypeOptions(),
    //   },
    //   field: 'status',
    //   minWidth: 80,
    //   title: $t('system.rental.tenant.status.label'),
    // },
    {
      field: 'status',
      slots: {
        default: ({ row }) => {
          const isExpired = row.contractEnd
            ? dayjs().isAfter(dayjs(row.contractEnd))
            : false;
          const status = isExpired ? '过期' : '生效中';
          const option = getTagTypeOptions().find(
            (opt) => opt.value === status,
          );
          return h(Tag, { color: option?.color }, () => status);
        },
      },
      title: $t('system.rental.tenant.status.label'),
      width: 100,
    },
    {
      field: 'contractDate',
      formatter: ({ row }) => {
        const start = row.contractStart
          ? dayjs(row.contractStart).format('YYYY.MM.DD')
          : '';
        const end = row.contractEnd
          ? dayjs(row.contractEnd).format('YYYY.MM.DD')
          : '';

        if (!start && !end) return '';
        if (start && !end) return start;
        if (!start && end) return end;

        return `${start} - ${end}`;
      },
      title: $t('system.rental.tenant.contractDate'),
      width: 160,
    },
    {
      field: 'area',
      formatter: ({ cellValue }) => {
        if (!cellValue) return '';
        return `${cellValue}㎡`;
      },
      title: $t('page.rental.area'),
      width: 120,
    },
    {
      field: 'rent',
      formatter: ({ cellValue }) => {
        if (!cellValue) return '';
        return `${cellValue}元/月`;
      },
      title: $t('page.common.rent'),
      width: 120,
    },
    {
      field: 'increaseDate',
      formatter: ({ cellValue }) => {
        if (!cellValue) return '';
        return dayjs(cellValue).format('YYYY-MM-DD');
      },
      title: $t('system.rental.tenant.increaseDate'),
      width: 130,
    },
    {
      field: 'increaseRate',
      formatter: ({ cellValue }) => {
        return cellValue ? `${cellValue}%` : '';
      },
      title: $t('system.rental.tenant.increaseRate'),
      width: 80,
    },
    {
      field: 'address',
      minWidth: 180,
      title: $t('system.rental.tenant.address'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'tenantName',
          nameTitle: $t('system.rental.tenant.name'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'view',
            text: '查看',
          },
          'edit', // 默认的编辑按钮
          'delete', // 默认的删除按钮
        ],
      },
      field: 'operation',
      fixed: 'right',
      minWidth: 150,
      title: $t('system.rental.operation'),
    },
  ];
}
