import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemFinanceApi } from '#/api';

import { formatDateTime } from '@vben/utils';

import { getParkList } from '#/api/park';
import { $t } from '#/locales';

/**
 * 获取标签颜色
 */
export function getTagTypeOptions() {
  return [
    {
      color: 'red',
      label: $t('system.finance.transactionType.expense'),
      value: '支出',
    },
    {
      color: 'green',
      label: $t('system.finance.transactionType.income'),
      value: '收入',
    },
  ];
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'billName',
      label: $t('page.finance.billName'),
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: '房租', value: '房租' },
          { label: '水费', value: '水费' },
          { label: '电费', value: '电费' },
          { label: '燃气费', value: '燃气费' },
          { label: '其他费用', value: '其他费用' },
        ],
        style: { width: '25%' },
      },
      fieldName: 'billCategory',
      label: $t('page.finance.billCategory'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: '收入', value: '收入' },
          { label: '支出', value: '支出' },
        ],
        optionType: 'button',
      },
      defaultValue: '支出',
      fieldName: 'transactionType',
      label: $t('page.finance.transactionType'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonBefore: '¥',
        min: 0,
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'amount',
      label: $t('page.finance.amount'),
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
    // 添加备注字段
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入备注信息',
        style: { width: '100%' },
      },
      fieldName: 'remark',
      label: $t('page.finance.remark'),
    },
    {
      component: 'DatePicker',
      componentProps: {
        format: 'YYYY-MM-DD HH:mm:ss',
        placeholder: '请选择交易时间',
        showTime: true,
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD HH:mm:ss', // 添加valueFormat指定输出格式
      },
      fieldName: 'transactionTime',
      label: $t('page.finance.transactionTime'),
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'billName',
      label: $t('page.finance.billName'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '房租', value: '房租' },
          { label: '水费', value: '水费' },
          { label: '电费', value: '电费' },
          { label: '燃气费', value: '燃气费' },
          { label: '其他费用', value: '其他费用' },
        ],
      },
      fieldName: 'billCategory',
      label: $t('page.finance.billCategory'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '收入', value: '收入' },
          { label: '支出', value: '支出' },
        ],
      },
      fieldName: 'transactionType',
      label: $t('page.finance.transactionType'),
    },
    {
      component: 'Input', // 将 InputNumber 改为 Input
      componentProps: {
        placeholder: '支持 >100、<100、100-200 格式',
        style: { width: '100%' },
      },
      fieldName: 'amount',
      label: $t('page.finance.amount'),
    },
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD HH:mm:ss',
        placeholder: ['开始日期', '结束日期'],
        showTime: true, // 启用时间选择
        valueFormat: 'YYYY-MM-DD HH:mm:ss', // 指定输出格式包含时分秒
      },
      fieldName: 'transactionTime',
      label: $t('page.finance.transactionTime'),
    },
  ];
}

export function useColumns<T = SystemFinanceApi.SystemFinance>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'billName',
      title: $t('page.finance.billName'),
      width: 200,
    },
    {
      field: 'billCategory',
      title: $t('page.finance.billCategory'),
      width: 200,
    },
    {
      cellRender: {
        name: 'CellTag',
        options: getTagTypeOptions(),
      },
      field: 'transactionType',
      title: $t('page.finance.transactionType'),
      width: 100,
    },
    {
      field: 'amount',
      formatter: ({ cellValue }) => {
        return cellValue ? `¥${Number(cellValue).toFixed(2)}` : '0';
      },
      minWidth: 100,
      title: $t('page.finance.amount'),
    },
    // 添加备注列
    {
      field: 'remark',
      formatter: ({ cellValue }) => {
        // 当值为空时，转换为空字符串
        return cellValue || '';
      },
      minWidth: 150,
      title: $t('page.finance.remark'),
    },
    {
      field: 'transactionTime',
      formatter: ({ cellValue }) => {
        return formatDateTime(cellValue);
      },
      title: $t('page.finance.transactionTime'),
      width: 200,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'billName',
          nameTitle: $t('page.finance.billName'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: ['edit', 'delete'],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('system.role.operation'),
      width: 130,
    },
  ];
}
