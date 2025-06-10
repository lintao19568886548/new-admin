import type { VbenFormSchema } from '@vben/common-ui';

import { h, markRaw } from 'vue';

import { getTenantSelectList } from '#/api';
import { getParkList } from '#/api/park';

import PenaltyForm from './penalty-form.vue';

/**
 * 账单详情配置接口
 */
export interface BillDetailConfig {
  amountLabel?: string; // 金额标签（如"电费金额"或"水费金额"）
  defaultItemName?: string; // 默认项目名称（如"主楼电费"或"主楼水费"）
  defaultSubItemName?: string; // 默认子项目名称（如"附楼电费"或"附楼水费"）
  itemsField?: string; // 账单项目字段名（如"electricityItems"或"waterItems"）
  modalClass?: string; // 模态窗口CSS类名
  modalTitle?: string; // 模态窗口标题
  readingLabel?: string; // 读数标签（如"电表数"或"水表数"）
  unitLabel?: string; // 单位标签（如"度"或"吨"）
  usageLabel?: string; // 用量标签（如"度数"或"用水量"）
}

// 基础账单项接口 - 根据 Prisma Schema 调整
export interface BaseBillItem {
  amount?: number; // 金额
  billId?: number; // 关联的账单ID
  createTime?: Date | string; // 创建时间
  currentReading?: number; // 本月读数
  meterName: string; // 表计名称
  monthlyUsage?: number; // 本月用量
  multiplier?: number; // 倍数
  previousReading?: number; // 上月读数
  receiptTime?: Date | string; // 收款时间
  remark?: string; // 备注
  totalUsage?: number; // 总用量
  unitPrice?: number; // 单价
}

// 基础账单接口 - 根据 Prisma Schema 调整
export interface BaseBill {
  billId: number; // 账单ID
  createTime?: Date | string; // 创建时间
  eleFee?: number; // 电费总额
  factoryRent?: number; // 厂房租金
  invoiceTax?: number; // 发票税费
  managementFee?: number; // 管理费
  receiptTime?: Date | string; // 收款时间
  serviceFee?: number; // 服务费
  tenantId: number; // 租户ID
  tenantName: string; // 租户名称
  totalFee?: number; // 总费用
  waterFee?: number; // 水费总额
}

// 电费账单项接口
export interface EleBillItem extends BaseBillItem {
  eleId: number; // 电费ID
}

// 水费账单项接口
export interface WaterBillItem extends BaseBillItem {
  waterId: number; // 水费ID
}

// 租户接口
export interface TenantInfo {
  tenantId: number; // 租户ID
  tenantName: string; // 租户名称
}

// 区域接口
export interface Area {
  key: string;
  name: string;
}

// 通用区域列表
export const commonAreaList = [
  { key: 'all', name: '全部区域' },
  { key: 'east', name: '东莞' },
  { key: 'central', name: '广州' },
  { key: 'south', name: '深圳' },
  { key: 'north', name: '佛山' },
  { key: 'west', name: '珠海' },
];

export function useTenantFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'ApiSelect',
      componentProps: {
        api: getTenantSelectList,
        // 确保指定了正确的 label 字段
        // 如果需要自定义过滤逻辑，可以添加 filterOption
        filterOption: (input: string, option: any) => {
          // 假设选项的标签字段是 'name'
          // 进行不区分大小写的模糊匹配
          return option?.label?.toLowerCase().includes(input.toLowerCase());
        },
        labelInValue: true,
        maxCount: 1,
        mode: 'tags',
        placeholder: '请选择或输入租户',
        showSearch: true,
      },
      fieldName: 'tenant',
      formItemClass: 'p-4', // 增加底部内边距
      label: '租户名称',
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
      formItemClass: 'p-4', // 增加底部内边距
      label: '所属园区',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入项目名称',
      },
      fieldName: 'projectName',
      formItemClass: 'p-4', // 增加底部内边距
      label: '项目名称',
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元',
        placeholder: '请输入厂房租金',
      },
      fieldName: 'factoryRent',
      formItemClass: 'p-4',
      label: '厂房租金',
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元',
        placeholder: '请输入基本管理费',
      },
      fieldName: 'managementFee',
      formItemClass: 'p-4',
      label: '基本电费',
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元/方',
        placeholder: '请输入垃圾处理费',
      },
      fieldName: 'garbageRate',
      formItemClass: 'p-4',
      label: '垃圾处理费',
      // rules: 'required',
    },

    // {
    //   component: 'InputNumber',
    //   componentProps: {
    //     addonAfter: '元',
    //     placeholder: '请输入收款金额',
    //   },
    //   fieldName: 'receiveFee',
    //   formItemClass: 'p-4',
    //   label: '收款金额',
    //   rules: 'required',
    // },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '%',
        placeholder: '请输入服务费比率',
      },
      fieldName: 'serviceRate',
      formItemClass: 'col-start-1 p-4',
      label: '服务费',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '%',
        mode: 'multiple',
        placeholder: '请输入电费附加费比率',
      },
      fieldName: 'extraEleRate',
      formItemClass: 'p-4',
      label: '电费附加费',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        // api: getElectricityList,
        mode: 'multiple',
        placeholder: '请选择电费附加费',
      },
      fieldName: 'extraEleItem',
      formItemClass: 'p-4',
      hideLabel: true,
      // label: '',
    },
    // {
    //   component: 'InputNumber',
    //   componentProps: {
    //     addonAfter: '%',
    //     placeholder: '请输入垃圾费比率',
    //   },
    //   fieldName: 'garbageRate',
    //   formItemClass: 'p-4',
    //   label: '垃圾处理费',
    // },
    // {
    //   component: 'InputNumber',
    //   componentProps: {
    //     addonAfter: '‰',
    //     placeholder: '请输入滞纳金比率',
    //   },
    //   fieldName: 'penaltyRate',
    //   formItemClass: 'p-4',
    //   label: '滞纳金',
    // },
    {
      component: markRaw(PenaltyForm),
      fieldName: 'penalty', // 保持不变，已与接口一致
      formItemClass: 'col-span-2 p-4',
      label: '滞纳金明细',
    },
    {
      component: 'DatePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: '请选择收款时间',
        valueFormat: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
      },
      fieldName: 'receiptTime',
      formItemClass: 'p-4',
      label: '收款时间',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入对公户名',
      },
      dependencies: {
        rules: (values) => {
          if (values.publicAccountNumber || values.publicAccountBank) {
            return 'required';
          }
          return null;
        },
        triggerFields: ['publicAccountNumber', 'publicAccountBank'],
      },
      fieldName: 'publicAccountName',
      formItemClass: 'col-start-1 p-4', // 增加底部内边距
      label: '对公账户',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入对公账号',
      },
      dependencies: {
        rules: (values) => {
          if (values.publicAccountName || values.publicAccountBank) {
            return 'required';
          }
          return null;
        },
        triggerFields: ['publicAccountName', 'publicAccountBank'],
      },
      fieldName: 'publicAccountNumber',
      formItemClass: 'p-4', // 增加底部内边距
      hideLabel: true,
      label: '对公账号',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入开户行',
      },
      dependencies: {
        rules: (values) => {
          if (values.publicAccountName || values.publicAccountNumber) {
            return 'required';
          }
          return null;
        },
        triggerFields: ['publicAccountName', 'publicAccountNumber'],
      },
      fieldName: 'publicAccountBank',
      formItemClass: 'p-4', // 增加底部内边距
      hideLabel: true,
      label: '开户行',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入对私户名',
      },
      dependencies: {
        rules: (values) => {
          if (values.privateAccountNumber || values.privateAccountBank) {
            return 'required';
          }
          return null;
        },
        triggerFields: ['privateAccountNumber', 'privateAccountBank'],
      },
      fieldName: 'privateAccountName',
      formItemClass: 'col-start-1 p-4', // 增加底部内边距
      label: '对私账户',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入对私账号',
      },
      dependencies: {
        rules: (values) => {
          if (values.privateAccountName || values.privateAccountBank) {
            return 'required';
          }
          return null;
        },
        triggerFields: ['privateAccountName', 'privateAccountBank'],
      },
      fieldName: 'privateAccountNumber',
      formItemClass: 'p-4', // 增加底部内边距
      hideLabel: true,
      label: '对私账号',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入开户行',
      },
      dependencies: {
        rules: (values) => {
          if (values.privateAccountName || values.privateAccountNumber) {
            return 'required';
          }
          return null;
        },
        triggerFields: ['privateAccountName', 'privateAccountNumber'],
      },
      fieldName: 'privateAccountBank',
      formItemClass: 'p-4', // 增加底部内边距
      hideLabel: true,
      label: '开户行',
    },
    {
      component: 'Divider',
      componentProps: {
        orientation: 'left',
        style: 'margin-bottom: 0; padding-bottom: 0;', // 减少底部间距
      },
      fieldName: '_divider',
      formItemClass: 'col-span-3 mb-0', // 减少底部 margin
      hideLabel: true,
      renderComponentContent: () => {
        return {
          default: () => h('div', '开票税金'),
        };
      },
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '%',
        placeholder: '请输入水费税率',
      },
      fieldName: 'waterTaxRate',
      formItemClass: 'p-4 pt-2', // 减少顶部内边距
      label: '水费税率',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '%',
        placeholder: '请输入电费税率',
      },
      fieldName: 'eleTaxRate',
      formItemClass: 'p-4',
      label: '电费税率',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '%',
        placeholder: '请输入房租税率',
      },
      fieldName: 'rentTaxRate',
      formItemClass: 'p-4',
      label: '房租税率',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元',
        placeholder: '请输入水费开票金额',
      },
      fieldName: 'waterTax',
      formItemClass: 'p-4 pt-2', // 减少顶部内边距
      label: '开票金额',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元',
        placeholder: '请输入电费开票金额',
      },
      fieldName: 'eleTax',
      formItemClass: 'p-4 pt-2', // 减少顶部内边距
      label: '开票金额',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元',
        placeholder: '请输入房租开票金额',
      },
      fieldName: 'rentTax',
      formItemClass: 'p-4 pt-2', // 减少顶部内边距
      label: '开票金额',
    },
  ];
}
