import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { h, markRaw } from 'vue'; // 导入 markRaw

import { formatDateTime } from '@vben/utils';

import { getInvestmentParkList } from '#/api/investment';
// 确保导入路径正确，如果 ParkLabel 移动到了 playground/src/components
import ParkLabel from '#/components/LabelRouter.vue';
import MultiSelect from '#/components/MultiSelect.vue'; // 导入 MultiSelect 组件
import { $t } from '#/locales';

/**
 * 投资代理项目接口
 */
export interface InvestmentAgent {
  agentName: string; // 代理人名称
  createTime?: string; // 创建时间
  imageUrlList?: string[]; // 图片URL列表
  intentArea?: number; // 意向面积 (平方米)
  intentLevel: string; // 意向等级 (e.g., '很高', '高')
  investmentId?: number; // 项目ID
  meetingTime: string; // 会谈时间 (ISO 格式字符串)
  operator?: string; // 操作人
  parkId?: null | number; // 工厂ID
  parkName?: string; // 工厂名称 (可能由parkId解析)
  phoneNumber: string; // 电话号码
  progress: string; // 进展阶段 (e.g., '初步接洽', '深入沟通')
  remark?: string; // 备注
  tenantName: string; // 租户名称
  title?: string; // 项目标题，用于消息提示等
  updateTime?: string; // 更新时间
}

/**
 * 获取标签颜色
 */
export function getTagTypeOptions() {
  return [
    {
      color: 'red',
      label: $t('page.agent.level.veryHigh'),
      value: '很高',
    },
    {
      color: 'orange',
      label: $t('page.agent.level.high'),
      value: '高',
    },
    {
      color: 'blue',
      label: $t('page.agent.level.normal'),
      value: '一般',
    },
    {
      color: 'green',
      label: $t('page.agent.level.low'),
      value: '低',
    },
    {
      color: 'cyan',
      label: $t('page.agent.level.veryLow'),
      value: '很低',
    },
  ];
}

// 修改函数签名，接收 closeModal 函数
export function useFormSchema(closeModal: () => void): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'tenantName',
      label: $t('page.tenant.name'),
    },
    {
      component: 'Input',
      fieldName: 'agentName',
      label: $t('page.agent.name'),
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: '初步接洽', value: '初步接洽' },
          { label: '深入沟通', value: '深入沟通' },
          { label: '合同准备', value: '合同准备' },
          { label: '签约完成', value: '签约完成' },
        ],
        style: { width: '100%' },
      },
      fieldName: 'progress',
      label: $t('page.agent.progress'),
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: '很高', value: '很高' },
          { label: '高', value: '高' },
          { label: '一般', value: '一般' },
          { label: '低', value: '低' },
          { label: '很低', value: '很低' },
        ],
        style: { width: '100%' },
      },
      fieldName: 'intentLevel',
      label: $t('page.agent.intentLevel'),
      rules: 'required',
    },

    {
      component: 'InputNumber',
      // 添加 componentProps 以设置单位
      componentProps: {
        addonAfter: '㎡', // 在输入框后添加单位
        style: { width: '100%' }, // 可以根据需要调整样式
      },
      fieldName: 'intentArea',
      formItemClass: 'col-span-2',
      label: $t('page.agent.intentArea'),
    },

    {
      component: 'Input',
      fieldName: 'phoneNumber',
      formItemClass: 'col-span-2',
      label: $t('page.agent.phone'),
    },
    {
      component: 'DatePicker',
      componentProps: {
        format: 'YYYY-MM-DD HH:mm:ss',
        placeholder: '请选择日期',
        showTime: true,
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      fieldName: 'meetingTime',
      formItemClass: 'col-span-2',
      label: $t('page.common.date'),
      rules: 'required',
    },
    {
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: getInvestmentParkList,
        class: 'w-full',
        labelField: 'parkName',
        valueField: 'parkId',
      },
      fieldName: 'parkId',
      formItemClass: 'col-span-2',
      help: '新增工厂请在 租赁管理-工厂管理 中操作',
      // 使用 label 属性渲染自定义组件
      label: () =>
        h(ParkLabel, {
          beforeNavigate: closeModal, // 传递关闭模态框的回调
          buttonText: '新增工厂', // 自定义按钮文本
          label: $t('page.common.park'),
          path: '/rental/manage/', // 传递跳转路径
        }),
    },
    {
      component: 'Input',
      fieldName: 'remark',
      formItemClass: 'col-span-2',
      label: $t('page.common.remark'),
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: getInvestmentParkList,
        class: 'w-full',
        labelField: 'parkName',
        valueField: 'parkId',
      },
      fieldName: 'parkId',
      label: $t('page.common.park'),
    },
    {
      component: 'Input',
      fieldName: 'agentName',
      label: $t('page.agent.name'),
    },
    {
      component: 'Input',
      fieldName: 'tenantName',
      label: $t('page.tenant.name'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '很高', value: '很高' },
          { label: '高', value: '高' },
          { label: '一般', value: '一般' },
          { label: '低', value: '低' },
          { label: '很低', value: '很低' },
        ],
      },
      fieldName: 'intentLevel',
      formItemClass: 'col-span-1',
      label: $t('page.agent.intentLevel'),
    },
    // 使用 MultiSelect 组件替换 minIntentArea 和 maxIntentArea
    {
      component: markRaw(MultiSelect),
      componentProps: {
        unit: '㎡', // 设置单位
      },
      disabledOnChangeListener: false,
      fieldName: 'intentArea', // 字段名改为 intentArea
      label: $t('page.agent.intentArea'),
    },
    // {
    //   component: 'InputNumber',
    //   fieldName: 'minIntentArea',
    //   label: $t('page.agent.minIntentArea'),
    // },
    // {
    //   component: 'InputNumber',
    //   fieldName: 'maxIntentArea',
    //   label: $t('page.agent.maxIntentArea'),
    // },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '初步接洽', value: '初步接洽' },
          { label: '深入沟通', value: '深入沟通' },
          { label: '合同准备', value: '合同准备' },
          { label: '签约完成', value: '签约完成' },
        ],
      },
      fieldName: 'progress',
      label: $t('page.agent.progress'),
    },
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: ['开始日期', '结束日期'],
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'meetingTime',
      label: $t('page.common.date'),
    },
  ];
}

export function useColumns<T = InvestmentAgent>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'parkName',
      minWidth: 160,
      title: $t('page.park.name'),
    },
    {
      field: 'tenantName',
      minWidth: 150,
      title: $t('page.tenant.name'),
    },
    {
      field: 'agentName',
      minWidth: 150,
      title: $t('page.agent.name'),
    },

    {
      cellRender: {
        name: 'CellTag',
        options: getTagTypeOptions(),
      },
      field: 'intentLevel',
      minWidth: 100,
      title: $t('page.agent.intentLevel'),
    },
    {
      field: 'intentArea',
      formatter: ({ cellValue }) => {
        return `${cellValue}㎡`;
      },
      minWidth: 150,
      title: $t('page.agent.intentArea'),
    },
    {
      field: 'progress',
      minWidth: 120,
      title: $t('page.agent.progress'),
    },
    {
      field: 'phoneNumber',
      minWidth: 150,
      title: $t('page.agent.phone'),
    },
    {
      field: 'meetingTime',
      formatter: ({ cellValue }) => {
        return formatDateTime(cellValue);
      },
      minWidth: 150,
      title: $t('page.common.date'),
    },
    {
      field: 'remark',
      minWidth: 150,
      title: $t('page.common.remark'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'agentName',
          nameTitle: $t('page.agent.name'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: ['查看', 'edit', 'delete'],
      },
      field: 'operation',
      fixed: 'right',
      minWidth: 130,
      title: $t('system.role.operation'),
    },
  ];
}
