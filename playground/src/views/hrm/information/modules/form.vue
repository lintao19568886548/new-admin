<script lang="ts" setup>
import type { EmployeeApi } from '#/api/hrm/employee';

import { computed, onMounted, reactive, ref, watchEffect } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import {
  Form as AForm,
  DatePicker,
  Input,
  InputNumber,
  message,
  Radio,
  Select,
} from 'ant-design-vue';

import { createEmployee, updateEmployee } from '#/api/hrm/employee';

const emit = defineEmits(['success']);
const formData = ref<EmployeeApi.Employee>();
const getTitle = computed(() => {
  return formData.value?.employeeId
    ? `编辑员工: ${formData.value.name}`
    : '新增员工';
});

const formState = reactive({
  address: '',
  age: null as null | number,
  department: '',
  education: '',
  gender: '男',
  hireDate: '',
  idNumber: '',
  isDeleted: false,
  leaveDate: '',
  name: '',
  phone: '',
  remark: '',
});

const aFormRef = ref();
const rules: Record<
  string,
  Array<{
    max?: number;
    message: string;
    min?: number;
    pattern?: RegExp;
    required?: boolean;
    trigger: string | string[];
    validator?: (rule: any, value: any) => Promise<void>;
  }>
> = {
  gender: [{ message: '请选择性别', required: true, trigger: 'change' }],
  idNumber: [
    {
      message: '请输入正确的身份证号码',
      pattern: /(^\d{15}$)|(^\d{18}$)|(^\d{17}([\dX])$)/i,
      trigger: 'blur',
    },
  ],
  name: [
    { message: '请输入姓名', required: true, trigger: 'blur' },
    { max: 20, message: '姓名长度在 2-20 个字符之间', min: 2, trigger: 'blur' },
  ],
  phone: [
    { message: '请输入手机号', required: true, trigger: 'blur' },
    {
      message: '请输入正确的手机号码',
      pattern: /^1[3-9]\d{9}$/,
      trigger: 'blur',
    },
  ],
};

const educationOptions = [
  { label: '小学', value: '小学' },
  { label: '初中', value: '初中' },
  { label: '高中', value: '高中' },
  { label: '专科', value: '专科' },
  { label: '本科', value: '本科' },
  { label: '研究生', value: '研究生' },
  { label: '博士', value: '博士' },
];

function resetForm() {
  // 重置 reactive 表单状态
  Object.assign(formState, {
    address: '',
    age: null,
    department: '',
    education: '',
    gender: '男',
    hireDate: '',
    idNumber: '',
    isDeleted: false,
    leaveDate: '',
    name: '',
    phone: '',
    remark: '',
  });

  // 重置 AForm
  aFormRef.value?.resetFields();
}

// 同步 formState 和 formData
watchEffect(() => {
  if (formData.value) {
    Object.assign(formState, {
      address: formData.value.address || '',
      age: formData.value.age || null,
      department: formData.value.department || '',
      education: formData.value.education || '',
      gender: formData.value.gender || '男',
      hireDate: formData.value.hireDate || '',
      idNumber: formData.value.idNumber || '',
      isDeleted: formData.value.isDeleted || false,
      leaveDate: formData.value.leaveDate || '',
      name: formData.value.name || '',
      phone: formData.value.phone || '',
      remark: formData.value.remark || '',
    });
  }
});

// 提交前清理数据
function cleanFormData() {
  // 创建一个新对象，只包含数据库支持的字段
  const cleanData = {
    address: formState.address || undefined,
    age: formState.age || undefined,
    department: formState.department || undefined,
    education: formState.education || undefined,
    gender: formState.gender,
    hireDate: formState.hireDate || undefined,
    idNumber: formState.idNumber || undefined,
    isDeleted: formState.isDeleted,
    leaveDate: formState.leaveDate || undefined,
    name: formState.name,
    phone: formState.phone,
    remark: formState.remark || undefined,
  };

  // 移除所有 undefined 的字段
  Object.keys(cleanData).forEach((key) => {
    // @ts-ignore
    if (cleanData[key] === undefined) {
      // @ts-ignore
      delete cleanData[key];
    }
  });

  return cleanData;
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    try {
      // 使用 AForm 验证
      await aFormRef.value.validateFields();

      modalApi.lock();

      // 清理表单数据，只保留数据库支持的字段
      const submittingData = cleanFormData();
      console.warn('提交的表单数据:', submittingData);

      // 提交数据
      if (formData.value?.employeeId) {
        await updateEmployee(formData.value.employeeId, submittingData);
        message.success('员工信息更新成功');
      } else {
        await createEmployee(submittingData);
        message.success('员工创建成功');
      }

      modalApi.close();
      emit('success');
    } catch (error: any) {
      console.error('表单验证或提交失败:', error);
      if (error.errorFields) {
        message.error('表单填写不完整，请检查必填字段');
      } else {
        message.error(error.message || '提交失败');
      }
    } finally {
      modalApi.lock(false);
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<EmployeeApi.Employee>();
      console.error('打开表单，获取数据:', data);

      if (data) {
        // 编辑员工
        formData.value = data;
        // watchEffect 会自动同步数据到 formState
      } else {
        // 新增员工
        formData.value = undefined;
        resetForm();
      }
    }
  },
});

// 用于调试
onMounted(() => {
  console.warn('表单组件已挂载，初始状态:', formState);
});
</script>

<template>
  <Modal :title="getTitle">
    <!-- 使用 Ant Design Vue 表单组件 -->
    <AForm
      ref="aFormRef"
      :model="formState"
      :rules="rules"
      layout="vertical"
      class="mx-4"
    >
      <AForm.Item name="name" label="姓名" required>
        <Input v-model:value="formState.name" placeholder="请输入姓名" />
      </AForm.Item>

      <AForm.Item name="gender" label="性别" required>
        <Radio.Group v-model:value="formState.gender" button-style="solid">
          <Radio.Button value="男">男</Radio.Button>
          <Radio.Button value="女">女</Radio.Button>
        </Radio.Group>
      </AForm.Item>

      <AForm.Item name="phone" label="手机号" required>
        <Input v-model:value="formState.phone" placeholder="请输入手机号" />
      </AForm.Item>

      <AForm.Item name="idNumber" label="身份证号">
        <Input
          v-model:value="formState.idNumber"
          placeholder="请输入身份证号"
        />
      </AForm.Item>

      <AForm.Item name="department" label="部门">
        <Input v-model:value="formState.department" placeholder="请输入部门" />
      </AForm.Item>

      <AForm.Item name="age" label="年龄">
        <InputNumber
          v-model:value="formState.age as number | undefined"
          :min="18"
          :max="100"
          placeholder="请输入年龄"
          style="width: 100%"
        />
      </AForm.Item>

      <AForm.Item name="education" label="学历">
        <Select v-model:value="formState.education" placeholder="请选择学历">
          <Select.Option
            v-for="option in educationOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </Select.Option>
        </Select>
      </AForm.Item>

      <AForm.Item name="hireDate" label="入职日期">
        <DatePicker
          v-model:value="formState.hireDate"
          style="width: 100%"
          value-format="YYYY-MM-DD"
        />
      </AForm.Item>

      <AForm.Item name="leaveDate" label="离职日期">
        <DatePicker
          v-model:value="formState.leaveDate"
          style="width: 100%"
          value-format="YYYY-MM-DD"
        />
      </AForm.Item>

      <AForm.Item name="address" label="地址">
        <Input v-model:value="formState.address" placeholder="请输入地址" />
      </AForm.Item>

      <AForm.Item name="remark" label="备注">
        <Input.TextArea
          v-model:value="formState.remark"
          placeholder="请输入备注"
          :rows="3"
          :maxlength="200"
          show-count
        />
      </AForm.Item>
    </AForm>

    <template #prepend-footer>
      <div class="flex-auto">
        <Button type="primary" danger @click="resetForm"> 重置 </Button>
      </div>
    </template>
  </Modal>
</template>
