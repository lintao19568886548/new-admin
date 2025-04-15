<script lang="ts" setup>
import { Page } from '@vben/common-ui';

import { Card, message } from 'ant-design-vue';

import { useVbenForm, z } from '#/adapter/form';
import { submitReimbursement } from '#/api/reimbursement';
import { $t } from '#/locales';

// 表单提交处理函数
async function onSubmit(values: Record<string, any>) {
  try {
    // 调用API提交报销数据
    await submitReimbursement(values);
    message.success('报销申请提交成功！');
    // 不返回任何值
  } catch (error) {
    console.error('提交报销申请失败:', error);
    message.error('提交报销申请失败，请稍后重试！');
    // 不返回任何值
  }
}

// 部门选项
const departmentOptions = [
  { label: '技术部', value: 'tech' },
  { label: '财务部', value: 'finance' },
  { label: '人力资源部', value: 'hr' },
  { label: '市场部', value: 'marketing' },
  { label: '行政部', value: 'admin' },
];

// 使用VbenForm创建表单
const [ReimbursementForm] = useVbenForm({
  // 表单项共用配置
  commonConfig: {
    // 在label后显示冒号
    colon: true,
    // 所有表单项
    componentProps: {
      class: 'w-full',
    },
  },
  // 提交函数
  handleSubmit: onSubmit,
  // 表单布局
  layout: 'vertical',
  // 表单项配置
  schema: [
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入报销用途',
      },
      fieldName: 'purpose',
      label: '用途',
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元',
        min: 0,
        placeholder: '请输入报销金额',
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'amount',
      label: '金额',
      rules: z
        .number({
          invalid_type_error: '金额必须为数字',
          required_error: '请输入报销金额',
        })
        .min(0.01, '金额必须大于0'),
    },
    {
      component: 'Select',
      componentProps: {
        options: departmentOptions,
        placeholder: '请选择报销部门',
      },
      fieldName: 'department',
      label: '报销部门',
      rules: 'selectRequired',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入申请人姓名',
      },
      fieldName: 'payee',
      label: '申请人',
      rules: 'required',
    },
    {
      component: 'DatePicker',
      componentProps: {
        placeholder: '请选择报销日期',
        style: { width: '100%' },
      },
      fieldName: 'date',
      label: '报销日期',
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入备注信息（选填）',
        rows: 4,
      },
      fieldName: 'remark',
      label: '备注',
    },
  ],
});

// 重置表单
// function resetForm() {
//   formApi.resetForm();
// }
</script>

<template>
  <Page>
    <Card :title="$t('报销申请')" class="mb-4">
      <ReimbursementForm />

      <div class="mt-4 flex justify-end gap-2"></div>
    </Card>
  </Page>
</template>
