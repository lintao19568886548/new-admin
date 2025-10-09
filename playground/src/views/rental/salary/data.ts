import type { SalaryItem } from './types';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { h } from 'vue';

import { Tag } from 'ant-design-vue';
import dayjs from 'dayjs';

import { z } from '#/adapter/form';
import { getSalaryTenantOptions } from '#/api/rental';
import { $t } from '#/locales';

/**
 * 发放状态选项
 */
export function getIssuedOptions(): {
  label: string;
  value: 'false' | 'true';
}[] {
  return [
    {
      label: $t('system.rental.salary.issued.true'),
      value: 'true',
    },
    {
      label: $t('system.rental.salary.issued.false'),
      value: 'false',
    },
  ];
}

/**
 * 格式化日期显示
 */
export function formatDateDisplay(value?: null | string) {
  return value ? dayjs(value).format('YYYY-MM-DD') : '--';
}

/**
 * 格式化日期时间显示
 */
export function formatDateTimeDisplay(value?: null | string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '--';
}

/**
 * 格式化金额显示
 */
export function formatSalaryAmount(value?: null | number) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '--';
  }
  return `${value}元`;
}

/**
 * 渲染发放状态标签
 */
export function renderIssuedTag(issued?: boolean | null) {
  const isIssued = Boolean(issued);
  const color = isIssued ? 'green' : 'red';
  const text = isIssued
    ? $t('system.rental.salary.issued.true')
    : $t('system.rental.salary.issued.false');
  return h(Tag, { color }, () => text);
}

/**
 * 工资表单
 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      dependencies: {
        show: () => false,
        triggerFields: [],
      },
      fieldName: 'tenantName',
      formItemClass: 'hidden',
    },
    {
      component: 'ApiSelect',
      componentProps: (_values, actions) => ({
        allowClear: true,
        api: getSalaryTenantOptions,
        class: 'w-full',
        filterOption(input: string, option: any) {
          const label = option?.label ?? '';
          const phone = option?.phoneNumber ?? '';
          return (
            label.toString().toLowerCase().includes(input.toLowerCase()) ||
            phone.toString().includes(input)
          );
        },
        labelField: 'tenantName',
        onChange: (_value: any, option: any) => {
          const selected = Array.isArray(option) ? option[0] : option;
          const phoneNumber = selected?.phoneNumber ?? '';
          const tenantName = selected?.label ?? '';
          actions?.setFieldValue?.('phoneNumber', phoneNumber);
          actions?.setFieldValue?.('tenantName', tenantName);
        },
        onClear: () => {
          actions?.setFieldValue?.('phoneNumber', '');
          actions?.setFieldValue?.('tenantName', '');
        },
        optionFilterProp: 'label',
        showSearch: true,
        valueField: 'rentalTenantId',
      }),
      fieldName: 'rentalTenantId',
      formItemClass: 'sm:col-span-full md:col-span-1',
      label: $t('system.rental.salary.contractor'),
      rules: 'selectRequired',
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
      },
      fieldName: 'phoneNumber',
      formItemClass: 'sm:col-span-full md:col-span-1',
      label: $t('system.rental.salary.phone'),
      rules: z
        .string()
        .max(
          20,
          $t('ui.formRules.maxLength', [$t('system.rental.salary.phone'), 20]),
        )
        .optional(),
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元',
        min: 0,
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'salaryAmount',
      formItemClass: 'sm:col-span-full md:col-span-1',
      label: $t('system.rental.salary.amount'),
      rules: 'required',
    },
    {
      component: 'DatePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'issueDate',
      formItemClass: 'sm:col-span-full md:col-span-1',
      label: $t('system.rental.salary.issueDate'),
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        options: getIssuedOptions(),
      },
      defaultValue: 'false',
      fieldName: 'issued',
      formItemClass: 'sm:col-span-full md:col-span-1',
      label: $t('system.rental.salary.issued.label'),
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: {
        maxLength: 300,
        rows: 4,
        showCount: true,
        style: { width: '100%' },
      },
      fieldName: 'remark',
      formItemClass: 'col-span-full',
      label: $t('page.common.remark'),
      rules: z
        .string()
        .max(300, $t('ui.formRules.maxLength', [$t('page.common.remark'), 300]))
        .optional(),
    },
  ];
}

/**
 * 工资查询表单
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'tenantName',
      label: $t('system.rental.salary.contractor'),
    },
    {
      component: 'Input',
      fieldName: 'phoneNumber',
      label: $t('system.rental.salary.phone'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: getIssuedOptions(),
      },
      fieldName: 'issued',
      label: $t('system.rental.salary.issued.label'),
    },
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'issueDate',
      label: $t('system.rental.salary.issueDate'),
    },
  ];
}

/**
 * 工资表格列
 */
export function useColumns<T = SalaryItem>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'tenantName',
      minWidth: 160,
      title: $t('system.rental.salary.contractor'),
    },
    {
      field: 'phoneNumber',
      minWidth: 140,
      title: $t('system.rental.salary.phone'),
    },
    {
      field: 'salaryAmount',
      minWidth: 120,
      slots: {
        default: ({ row }: { row: SalaryItem }) =>
          formatSalaryAmount(row.salaryAmount),
      },
      title: $t('system.rental.salary.amount'),
    },
    {
      field: 'issueDate',
      minWidth: 140,
      slots: {
        default: ({ row }: { row: SalaryItem }) =>
          formatDateDisplay(row.issueDate),
      },
      title: $t('system.rental.salary.issueDate'),
    },
    {
      field: 'issued',
      minWidth: 120,
      slots: {
        default: ({ row }: { row: SalaryItem }) => renderIssuedTag(row.issued),
      },
      title: $t('system.rental.salary.issued.label'),
    },
    {
      field: 'remark',
      minWidth: 200,
      title: $t('page.common.remark'),
    },
    {
      field: 'createTime',
      minWidth: 180,
      slots: {
        default: ({ row }: { row: SalaryItem }) =>
          formatDateTimeDisplay(row.createTime),
      },
      title: $t('system.rental.salary.createTime'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'tenantName',
          nameTitle: $t('system.rental.salary.contractor'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: ['edit', 'delete'],
      },
      field: 'operation',
      fixed: 'right',
      minWidth: 150,
      title: $t('system.rental.operation'),
    },
  ];
}
