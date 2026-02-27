import type { UploadFile, UploadProps } from 'ant-design-vue';

import type { FinanceItem } from './types';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';
import { formatDateTime } from '@vben/utils';

import { message } from 'ant-design-vue';

import { getParkList } from '#/api/park';
import { $t } from '#/locales';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

const ONE_MB = 1024 * 1024;

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

/**
 * 预览图片
 */
const imageOnPreview: UploadProps['onPreview'] = async (file) => {
  let src = file.url as string;
  if (!src) {
    src = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file.originFileObj as any);
      reader.addEventListener('load', () => resolve(reader.result as string));
    });
  }
  const image = new Image();
  image.src = src;
  const imgWindow = window.open(src);
  imgWindow?.document.write(image.outerHTML);
};

/**
 * 上传前校验
 * @param file
 */
function beforeUpload(file: UploadFile) {
  const isJpgOrPng =
    file.type === 'image/jpeg' ||
    file.type === 'image/png' ||
    file.type === 'image/jpg';
  if (!isJpgOrPng) {
    message.error('只允许上传 JPG/PNG 格式的图片!');
  }
  const isLt2M = (file.size || 0) / ONE_MB < 2;
  if (!isLt2M) {
    message.error('图片大小不能超过 2MB!');
  }
  return isJpgOrPng && isLt2M;
}

export function getBillCategoryOptions() {
  return [
    { label: '账单收入', value: '账单收入' },
    { label: '水费', value: '水费' },
    { label: '电费', value: '电费' },
    { label: '燃气费', value: '燃气费' },
    { label: '其他费用', value: '其他费用' },
  ];
}

export function useFormSchema(): VbenFormSchema[] {
  const accessStore = useAccessStore();

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
        options: getBillCategoryOptions(),
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
    {
      component: 'Upload',
      componentProps: {
        action: `${apiURL}/image/upload`,
        beforeUpload,
        headers: {
          Authorization: `Bearer ${accessStore.accessToken}`,
        },
        onPreview: imageOnPreview,
        listType: 'picture-card',
      },
      fieldName: 'images',
      label: $t('page.finance.images'),
      renderComponentContent: () => {
        return {
          default: () => $t('page.finance.uploadImage'),
        };
      },
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
        options: getBillCategoryOptions(),
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

export function useColumns<T = FinanceItem>(
  onActionClick: OnActionClickFn<T>,
  enableMask = true,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'parkName',
      minWidth: 140,
      title: $t('page.park.item'),
    },
    {
      field: 'billName',
      minWidth: 200,
      title: $t('page.finance.billName'),
    },
    {
      field: 'billCategory',
      minWidth: 120,
      title: $t('page.finance.billCategory'),
    },
    {
      cellRender: {
        name: 'CellTag',
        options: getTagTypeOptions(),
      },
      field: 'transactionType',
      minWidth: 120,
      title: $t('page.finance.transactionType'),
    },
    {
      field: 'amount',
      formatter: ({ cellValue }) => {
        if (!cellValue) return '0';
        const amount = Number(cellValue);
        if (!enableMask) {
          return `¥${amount.toFixed(2)}`;
        }
        const intPart = Math.floor(amount);
        const decimalPart = ((amount - intPart) * 100)
          .toFixed(0)
          .padStart(2, '0');
        const intStr = String(intPart);
        if (intStr.length <= 1) {
          return `¥${intStr}.${decimalPart}`;
        }
        const masked = intStr[0] + '*'.repeat(intStr.length - 1);
        return `¥${masked}.${decimalPart}`;
      },
      minWidth: 120,
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
      minWidth: 180,
      title: $t('page.finance.transactionTime'),
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
      minWidth: 130,
      title: $t('system.role.operation'),
    },
  ];
}
