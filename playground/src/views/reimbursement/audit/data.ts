import type { Rule } from 'ant-design-vue/es/form';
import type { ColumnsType } from 'ant-design-vue/es/table';

import { h } from 'vue';

import { formatDateTime } from '@vben/utils';

import { Image, Tag } from 'ant-design-vue';

/**
 * 报销记录项类型定义
 * 注意: 此处定义与type.ts中的相似，但有一些额外字段
 */
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

/**
 * 状态映射
 * 已更新为与type.ts中保持一致的文本描述
 */
export const STATUS_MAP = {
  0: { color: 'warning', text: '待审核' },
  1: { color: 'success', text: '已通过' },
  2: { color: 'error', text: '已拒绝' },
};

/**
 * 获取表单验证规则
 * @returns 表单验证规则
 */
export function useFormRules(): Record<string, Rule[]> {
  return {
    reason: [
      { message: '请输入审核意见', required: true, trigger: 'blur' },
      { max: 200, message: '审核意见不能超过200个字符', trigger: 'blur' },
    ],
    status: [{ message: '请选择审核结果', required: true, trigger: 'change' }],
  };
}

/**
 * 获取表格列配置
 * @param _onAuditFn 审核操作的回调函数
 * @returns 表格列配置
 */
export function useColumns(
  _onAuditFn: (record: ReimbursementItem) => void,
): ColumnsType<any> {
  return [
    {
      align: 'center',
      dataIndex: 'username',
      key: 'username',
      title: '申请人',
      width: 100,
    },
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
        return record.auditorName || '无';
      },
      key: 'auditorName',
      title: '审核人',
      width: 120,
    },
    {
      align: 'center',
      customRender: ({ record }: { record: any }) => {
        if (!record.images || record.images.length === 0) {
          return '无';
        }
        return h('div', { class: 'flex flex-wrap gap-2 justify-center' }, [
          h(Image.PreviewGroup, {}, () =>
            record.images.map((item: string) =>
              h(Image, {
                alt: '报销凭证',
                class: 'rounded object-cover',
                height: 60,
                src: item,
                width: 60,
              }),
            ),
          ),
        ]);
      },
      key: 'images',
      title: '相关图片',
      width: 180,
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
      dataIndex: 'auditOpinion',
      ellipsis: true,
      key: 'auditOpinion',
      title: '审核意见',
      width: 150,
    },
    {
      align: 'center',
      key: 'action',
      title: '操作',
      width: 120,
    },
  ];
}
