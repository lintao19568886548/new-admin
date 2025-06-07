import type { Rule } from 'ant-design-vue/es/form';
import type { ColumnsType } from 'ant-design-vue/es/table';

import { h } from 'vue';

import { formatDateTime } from '@vben/utils';

import { Button, Tag } from 'ant-design-vue';

// 定义类型
export interface ReimbursementItem {
  amount: number;
  auditorLevel?: number;
  createTime?: string;
  date: string;
  department: string;
  id: number | string;
  images?: Array<string>;
  park: string;
  parkId?: number | string;
  payee: string;
  purpose: string;
  reason?: string;
  remark?: string;
  status: number;
  updateTime?: string;
  username?: string;
}

// 状态映射
export const STATUS_MAP = {
  0: { color: 'warning', text: '待审核' },
  1: { color: 'success', text: '董事长已审核' },
  2: { color: 'error', text: '已拒绝' },
  3: { color: 'processing', text: '园区经理已审核' },
  4: { color: 'processing', text: '总监已审核' },
};

// 审核人等级映射
export const AUDITOR_LEVEL_MAP = {
  0: '无',
  2: '园区经理',
  3: '总监',
  4: '董事长',
};

/**
 * 获取表单验证规则
 * @returns 表单验证规则
 */
export function useFormRules(): Record<string, Rule[]> {
  return {
    amount: [
      { message: '请输入报销金额', required: true, trigger: 'blur' },
      { message: '金额必须是数字', trigger: 'blur', type: 'number' },
    ],
    applicant: [
      { message: '请输入申请人姓名', required: true, trigger: 'blur' },
    ],
    department: [{ message: '请输入部门', required: true, trigger: 'blur' }],
    parkId: [{ message: '请选择所属园区', required: true, trigger: 'change' }],
    payee: [{ message: '请输入领款人', required: true, trigger: 'blur' }],
    purpose: [
      { message: '请输入报销用途', required: true, trigger: 'blur' },
      { max: 50, message: '报销用途不能超过50个字符', trigger: 'blur' },
    ],
    remark: [{ max: 200, message: '备注不能超过200个字符', trigger: 'blur' }],
  };
}

/**
 * 获取表格列配置
 * @param onCancelFn 撤销操作的回调函数
 * @returns 表格列配置
 */
export function useColumns(
  onCancelFn: (record: ReimbursementItem) => void,
): ColumnsType<any> {
  return [
    {
      align: 'center',
      dataIndex: 'purpose',
      ellipsis: true,
      key: 'purpose',
      title: '用途',
      width: 120,
    },
    {
      align: 'center',
      customRender: ({ text }: { text: number }) =>
        `￥${Number(text).toFixed(2)}`,
      dataIndex: 'amount',
      key: 'amount',
      title: '金额(元)',
      width: 100,
    },
    {
      align: 'center',
      dataIndex: 'payee',
      key: 'payee',
      title: '领款人',
      width: 100,
    },
    {
      align: 'center',
      dataIndex: 'park',
      key: 'park',
      title: '所属园区',
      width: 120,
    },
    {
      align: 'center',
      customRender: ({ text }: { text: string }) => formatDateTime(text),
      dataIndex: 'date',
      key: 'date',
      title: '申请日期',
      width: 160,
    },
    {
      align: 'center',
      customRender: ({ text }: { text: number }) => {
        const statusInfo =
          typeof text === 'number' && text in STATUS_MAP
            ? STATUS_MAP[text as keyof typeof STATUS_MAP]
            : { color: 'default', text: '未知' };
        return h(Tag, { color: statusInfo.color }, () => statusInfo.text);
      },
      dataIndex: 'status',
      key: 'status',
      title: '状态',
      width: 120,
    },
    {
      align: 'center',
      customRender: ({ record }: { record: any }) => {
        if (!record.status || record.status === 0) return '无';
        const level = record.auditorLevel || 0;
        return (
          AUDITOR_LEVEL_MAP[level as keyof typeof AUDITOR_LEVEL_MAP] || '未知'
        );
      },
      key: 'auditorLevel',
      title: '审核人',
      width: 120,
    },
    {
      align: 'center',
      dataIndex: 'remark',
      ellipsis: true,
      key: 'remark',
      title: '备注',
      width: 120,
    },
    {
      align: 'center',
      customRender: ({ record }: { record: ReimbursementItem }) => {
        return h(
          Button,
          {
            danger: true,
            disabled: record.status !== 0, // 只有待审核状态可以撤销
            onClick: () => onCancelFn(record),
            size: 'small',
            type: 'link',
          },
          { default: () => '撤销' },
        );
      },
      key: 'action',
      title: '操作',
      width: 120,
    },
  ];
}
