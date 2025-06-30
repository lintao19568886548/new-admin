<!-- eslint-disable vue/valid-v-model -->
<script lang="ts" setup>
import type { FormInstance } from 'ant-design-vue'; // Import FormInstance

import type { EmployeeApi } from '#/api/hrm/employee';

import { computed, onMounted, reactive, ref, watchEffect } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import {
  Form as AForm,
  Button, // Added Button for explicit reset
  DatePicker,
  Input,
  InputNumber,
  message,
  Radio,
  Select,
  TimePicker,
} from 'ant-design-vue';

import { createEmployee, updateEmployee } from '#/api/hrm/employee';
import { $t } from '#/locales'; // For internationalization

// Define emits and props if this component is used within another modal system
const emit = defineEmits(['success']);

// This ref will hold the data passed to the modal (for editing)
const formData = ref<EmployeeApi.Employee>();

const getTitle = computed(() => {
  return formData.value?.employeeId
    ? $t('编辑员工: {name}', { name: formData.value.name })
    : $t('新增员工');
});

// Reactive state for form fields
const formState = reactive({
  address: '',
  age: undefined as number | undefined,
  checkIn: '',
  checkOut: '',
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

const aFormRef = ref<FormInstance>(); // Use FormInstance type

// Validation rules (simplified for brevity, consider reusing from data.ts or a shared utility)
const rules: Record<string, Array<any>> = {
  gender: [{ message: $t('请选择性别'), required: true, trigger: 'change' }],
  idNumber: [
    {
      message: $t('请输入正确的身份证号码'),
      pattern: /(^\d{15}$)|(^\d{18}$)|(^\d{17}([\dX])$)/i,
      trigger: 'blur',
    },
  ],
  name: [
    { message: $t('请输入姓名'), required: true, trigger: 'blur' },
    {
      max: 20,
      message: $t('姓名长度在2-20个字符之间'),
      min: 2,
      trigger: 'blur',
    },
  ],
  phone: [
    { message: $t('请输入手机号'), required: true, trigger: 'blur' },
    {
      message: $t('请输入正确的手机号码'),
      pattern: /^1[3-9]\d{9}$/,
      trigger: 'blur',
    },
  ],
  // Add other rules as needed from your data.ts or schema
};

const educationOptions = [
  { label: $t('小学'), value: '小学' },
  { label: $t('初中'), value: '初中' },
  { label: $t('高中'), value: '高中' },
  { label: $t('专科'), value: '专科' },
  { label: $t('本科'), value: '本科' },
  { label: $t('研究生'), value: '研究生' },
  { label: $t('博士'), value: '博士' },
];

function resetForm() {
  const defaultState = {
    address: '',
    age: undefined,
    checkIn: '',
    checkOut: '',
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
  };
  Object.assign(formState, defaultState);
  aFormRef.value?.resetFields();
}

// Sync formState with formData when editing
watchEffect(() => {
  if (formData.value) {
    Object.assign(formState, {
      address: formData.value.address || '',
      age: formData.value.age || undefined,
      checkIn: formData.value.checkIn || '',
      checkOut: formData.value.checkOut || '',
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
  } else {
    // If formData is undefined (new employee), reset to defaults
    resetForm();
  }
});

function cleanFormDataForSubmission() {
  const cleanData: Partial<EmployeeApi.Employee> = {
    // Use Partial for flexibility
    gender: formState.gender,
    isDeleted: formState.isDeleted, // usually false for new/active
    name: formState.name,
    phone: formState.phone,
  };
  // Add other fields only if they have values, to avoid sending empty strings for optional fields
  if (formState.address) cleanData.address = formState.address;
  if (formState.age !== undefined) cleanData.age = formState.age;
  if (formState.department) cleanData.department = formState.department;
  if (formState.education) cleanData.education = formState.education;
  if (formState.hireDate) cleanData.hireDate = formState.hireDate;
  if (formState.idNumber) cleanData.idNumber = formState.idNumber;
  if (formState.leaveDate) cleanData.leaveDate = formState.leaveDate;
  if (formState.remark) cleanData.remark = formState.remark;
  if (formState.checkIn) cleanData.checkIn = formState.checkIn;
  if (formState.checkOut) cleanData.checkOut = formState.checkOut;

  return cleanData;
}

// This instance of useVbenModal controls the modal this form lives in
const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    try {
      await aFormRef.value?.validateMessages;
      modalApi.lock();
      const submittingData = cleanFormDataForSubmission();

      if (formData.value?.employeeId) {
        await updateEmployee(formData.value.employeeId, submittingData);
        message.success($t('员工信息更新成功'));
      } else {
        await createEmployee(
          submittingData as Omit<
            EmployeeApi.Employee,
            'createTime' | 'employeeId' | 'updateTime'
          >,
        ); // Cast if API expects specific create type
        message.success($t('员工创建成功'));
      }
      modalApi.close();
      emit('success');
    } catch (error: any) {
      console.error('表单验证或提交失败:', error);
      error?.errorFields?.length > 0
        ? message.error($t('表单填写不完整，请检查必填字段'))
        : message.error(error?.message || $t('提交失败，请重试'));
    } finally {
      modalApi.lock(false);
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      // Data is passed via modalApi.setData() from the parent (mobile-list.vue)
      const dataFromList = modalApi.getData<EmployeeApi.Employee>();
      // Assign using ternary expression to satisfy unicorn/prefer-ternary
      formData.value = dataFromList || undefined;
    }
  },
});

onMounted(() => {
  // Initial data load/reset is handled by onOpenChange and watchEffect
});
</script>

<template>
  <Modal :title="getTitle" :body-style="{ padding: '16px' }" width="90%">
    <AForm
      ref="aFormRef"
      :model="formState"
      :rules="rules"
      layout="vertical"
      class="mobile-employee-form"
    >
      <AForm.Item name="name" :label="$t('姓名')" required>
        <Input v-model:value="formState.name" :placeholder="$t('请输入姓名')" />
      </AForm.Item>

      <AForm.Item name="gender" :label="$t('性别')" required>
        <Radio.Group
          v-model:value="formState.gender"
          button-style="solid"
          style="width: 100%"
        >
          <Radio.Button value="男" style="width: 50%; text-align: center">
            {{ $t('男') }}
          </Radio.Button>
          <Radio.Button value="女" style="width: 50%; text-align: center">
            {{ $t('女') }}
          </Radio.Button>
        </Radio.Group>
      </AForm.Item>

      <AForm.Item name="phone" :label="$t('手机号')" required>
        <Input
          v-model:value="formState.phone"
          :placeholder="$t('请输入手机号')"
        />
      </AForm.Item>

      <AForm.Item name="idNumber" :label="$t('身份证号')">
        <Input
          v-model:value="formState.idNumber"
          :placeholder="$t('请输入身份证号')"
        />
      </AForm.Item>

      <AForm.Item name="department" :label="$t('部门')">
        <Input
          v-model:value="formState.department"
          :placeholder="$t('请输入部门')"
        />
      </AForm.Item>

      <AForm.Item name="age" :label="$t('年龄')">
        <InputNumber
          v-model:value="formState.age"
          :max="100"
          :min="18"
          :placeholder="$t('请输入年龄')"
          style="width: 100%"
        />
      </AForm.Item>

      <AForm.Item name="checkIn" label="上班时间">
        <TimePicker
          v-model:value="formState.checkIn"
          value-format="HH:mm:ss"
          placeholder="请选择上班时间"
          class="w-full"
        />
      </AForm.Item>

      <AForm.Item name="checkOut" label="下班时间">
        <TimePicker
          v-model:value="formState.checkOut"
          value-format="HH:mm:ss"
          placeholder="请选择下班时间"
          class="w-full"
        />
      </AForm.Item>

      <AForm.Item name="education" :label="$t('学历')">
        <Select
          v-model:value="formState.education"
          :placeholder="$t('请选择学历')"
          :options="educationOptions"
        />
      </AForm.Item>

      <AForm.Item name="hireDate" :label="$t('入职日期')">
        <DatePicker
          v-model:value="formState.hireDate"
          style="width: 100%"
          value-format="YYYY-MM-DD"
          :placeholder="$t('请选择入职日期')"
        />
      </AForm.Item>

      <AForm.Item name="leaveDate" :label="$t('离职日期')">
        <DatePicker
          v-model:value="formState.leaveDate"
          style="width: 100%"
          value-format="YYYY-MM-DD"
          :placeholder="$t('请选择离职日期')"
        />
      </AForm.Item>

      <AForm.Item name="address" :label="$t('地址')">
        <Input
          v-model:value="formState.address"
          :placeholder="$t('请输入地址')"
        />
      </AForm.Item>

      <AForm.Item name="remark" :label="$t('备注')">
        <Input.TextArea
          v-model:value="formState.remark"
          :placeholder="$t('请输入备注')"
          :rows="2"
          :maxlength="200"
          show-count
        />
      </AForm.Item>
    </AForm>
    <!-- Custom footer for mobile might be needed if default modal footer is not suitable -->
    <template #prepend-footer>
      <div style="flex-grow: 1; margin-right: 8px; text-align: left">
        <Button @click="resetForm" danger>{{ $t('重置') }}</Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.mobile-employee-form .ant-form-item {
  margin-bottom: 12px; /* Reduce margin for tighter mobile layout */
}

/* Ensure radio buttons fill width */
.mobile-employee-form .ant-radio-group {
  width: 100%;
}

.mobile-employee-form .ant-radio-button-wrapper {
  width: 50%; /* Adjust if more than 2 options */
  text-align: center;
}
</style>
