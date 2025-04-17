<script lang="ts" setup>
import type { Rule } from 'ant-design-vue/es/form';

import { reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  message,
  Select,
} from 'ant-design-vue';

import { createReimbursement } from '#/api/reimbursement';
import { $t } from '#/locales';

// 表单实例
const formRef = ref();

// 提交状态
const submitting = ref(false);

// 部门选项
const departmentOptions = [
  { label: '技术部', value: 'tech' },
  { label: '财务部', value: 'finance' },
  { label: '人力资源部', value: 'hr' },
  { label: '市场部', value: 'marketing' },
  { label: '行政部', value: 'admin' },
];

// 表单数据
const formState = reactive({
  amount: undefined,
  department: undefined,
  payee: '',
  purpose: '',
  remark: '',
});

// 表单验证规则
const rules: Record<string, Rule[]> = {
  amount: [
    { message: '请输入报销金额', required: true, trigger: 'blur' },
    { message: '金额必须为数字', trigger: 'blur', type: 'number' },
  ],
  department: [
    { message: '请选择申请部门', required: true, trigger: 'change' },
  ],
  payee: [
    { message: '请输入领款人姓名', required: true, trigger: 'blur' },
    { max: 50, message: '领款人姓名不能超过50个字符', trigger: 'blur' },
  ],
  purpose: [
    { message: '请输入报销用途', required: true, trigger: 'blur' },
    { max: 100, message: '用途不能超过100个字符', trigger: 'blur' },
  ],
  remark: [{ max: 200, message: '备注不能超过200个字符', trigger: 'blur' }],
};

// 获取用户存储
const userStore = useUserStore();

// 提交表单
async function handleSubmit() {
  try {
    // 表单验证
    await formRef.value.validate();

    submitting.value = true;

    // 构建提交数据，添加当前日期和用户名
    const submitData = {
      ...formState,
      date: new Date().toISOString(),
      status: 0, // 初始状态：待审核
      userName: userStore.userInfo?.username || '', // 添加当前用户名
    };

    // 调用API提交数据
    await createReimbursement(submitData);

    // 提交成功后的处理
    message.success('报销申请提交成功');

    // 重置表单
    resetForm();
  } catch (error) {
    console.error('提交报销申请失败:', error);
    message.error('提交报销申请失败，请重试');
  } finally {
    submitting.value = false;
  }
}

// 重置表单
function resetForm() {
  formRef.value.resetFields();
}
</script>

<template>
  <Page>
    <Card :title="$t('报销申请')" class="mb-4">
      <Form
        :ref="(el) => (formRef = el)"
        :model="formState"
        :rules="rules"
        layout="vertical"
        name="reimbursementForm"
      >
        <Form.Item name="purpose" label="用途">
          <Input
            v-model:value="formState.purpose"
            placeholder="请输入报销用途"
            :maxlength="100"
            show-count
          />
        </Form.Item>

        <Form.Item name="amount" label="金额(元)">
          <InputNumber
            v-model:value="formState.amount"
            placeholder="请输入报销金额"
            :precision="2"
            :min="0"
            style="width: 100%"
          />
        </Form.Item>

        <Form.Item name="department" label="申请部门">
          <Select
            v-model:value="formState.department"
            placeholder="请选择申请部门"
            :options="departmentOptions"
          />
        </Form.Item>

        <Form.Item name="payee" label="领款人">
          <Input
            v-model:value="formState.payee"
            placeholder="请输入领款人姓名"
            :maxlength="50"
            show-count
          />
        </Form.Item>

        <Form.Item name="remark" label="备注">
          <Input.TextArea
            v-model:value="formState.remark"
            placeholder="请输入备注信息（选填）"
            :maxlength="200"
            :auto-size="{ minRows: 3, maxRows: 6 }"
            show-count
          />
        </Form.Item>

        <Form.Item>
          <div class="flex gap-2">
            <Button type="primary" @click="handleSubmit" :loading="submitting">
              提交申请
            </Button>
            <Button @click="resetForm">重置</Button>
          </div>
        </Form.Item>
      </Form>
    </Card>
  </Page>
</template>
