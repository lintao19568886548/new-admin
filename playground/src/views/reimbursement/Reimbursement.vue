<script lang="ts" setup>
import type { Rule } from 'ant-design-vue/es/form';

import { h, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';
import { formatDateTime } from '@vben/utils';

import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  message,
  Modal, // <-- 引入 Modal
  Select,
  Table,
  Tag,
} from 'ant-design-vue';

import { createReimbursement, getReimbursementList } from '#/api/reimbursement';
import { $t } from '#/locales';

// 表单实例
const formRef = ref();

// 提交状态
const submitting = ref(false);

// 控制记录弹窗的显示状态
const isRecordModalVisible = ref(false);

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
const currentUsername = userStore.userInfo?.username || '';

// 报销列表数据
// eslint-disable-next-line no-use-before-define
const reimbursementList = ref<ReimbursementItem[]>([]);
const loading = ref(false);

// 分页相关状态
const pagination = reactive({
  current: 1,
  pageSize: 10,
  pageSizeOptions: ['10', '20', '50', '100'],
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  total: 0,
});

// 定义类型
interface ReimbursementItem {
  amount: number;
  createTime?: string;
  date: string;
  department: string;
  id: number | string;
  payee: string;
  purpose: string;
  remark?: string;
  status: number;
  updateTime?: string;
  userName?: string;
}

// 状态映射
const STATUS_MAP = {
  0: { color: 'warning', text: '待审核' },
  1: { color: 'success', text: '已通过' },
  2: { color: 'error', text: '已拒绝' },
};

// 表格列定义
const columns = [
  {
    dataIndex: 'purpose',
    key: 'purpose',
    title: '用途',
  },
  {
    customRender: ({ text }: { text: number }) =>
      `￥${Number(text).toFixed(2)}`,
    dataIndex: 'amount',
    key: 'amount',
    title: '金额(元)',
  },
  {
    customRender: ({ text }: { text: string }) =>
      departmentOptions.find((opt) => opt.value === text)?.label || text,
    dataIndex: 'department',
    key: 'department',
    title: '申请部门',
  },
  {
    dataIndex: 'payee',
    key: 'payee',
    title: '领款人',
  },
  {
    // 为 text 参数添加 string 类型注解
    customRender: ({ text }: { text: string }) => formatDateTime(text),
    dataIndex: 'date',
    key: 'date',
    title: '申请日期',
  },
  {
    // 同样为 status 列的 text 添加 number 类型注解
    customRender: ({ text }: { text: number }) => {
      // 使用类型断言或类型守卫确保类型安全
      const statusInfo =
        typeof text === 'number' && text in STATUS_MAP
          ? STATUS_MAP[text as keyof typeof STATUS_MAP]
          : { color: 'default', text: '未知' };
      return h(Tag, { color: statusInfo.color }, () => statusInfo.text);
    },
    dataIndex: 'status',
    key: 'status',
    title: '状态',
  },
  {
    dataIndex: 'remark',
    key: 'remark',
    title: '备注',
  },
];

// 获取报销列表
async function fetchReimbursements() {
  loading.value = true;
  try {
    const params: any = {
      pageNo: pagination.current,
      pageSize: pagination.pageSize,
    };
    // 检查用户名是否为 'vben' 或 'admin'
    if (currentUsername !== 'vben' && currentUsername !== 'admin') {
      params.userName = currentUsername;
    }
    // 根据条件调用 API
    const res = await getReimbursementList(params);
    reimbursementList.value = res.items || [];
    // 更新分页总数
    pagination.total = res.total || 0;
  } catch (error) {
    console.error('获取报销列表失败:', error);
    message.error('获取报销列表失败');
  } finally {
    loading.value = false;
  }
}

// 处理分页变化
function handleTableChange(pag: any) {
  pagination.current = pag.current;
  pagination.pageSize = pag.pageSize;
  fetchReimbursements();
}

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
      userName: currentUsername, // 添加当前用户名
    };

    // 调用API提交数据
    await createReimbursement(submitData);

    // 提交成功后的处理
    message.success('报销申请提交成功');

    // 重置表单
    resetForm();
    // 重新获取列表
    await fetchReimbursements();
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

// 显示记录弹窗
function showRecordModal() {
  isRecordModalVisible.value = true;
  // 如果列表为空或者需要刷新，可以在这里调用 fetchReimbursements
  if (reimbursementList.value.length === 0) {
    fetchReimbursements();
  }
}

// 组件挂载时获取数据 (如果希望首次加载时不显示列表，可以注释掉这里)
// onMounted(() => {
//   fetchReimbursements();
// });
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
            <Button @click="showRecordModal">申请记录</Button>
            <!-- ^-- 添加查看记录按钮 -->
          </div>
        </Form.Item>
      </Form>
    </Card>

    <!-- 将表格移入 Modal -->
    <Modal
      v-model:visible="isRecordModalVisible"
      :title="$t('我的报销记录')"
      width="80%"
      :footer="null"
      :destroy-on-close="true"
    >
      <Table
        :columns="columns"
        :data-source="reimbursementList"
        :loading="loading"
        row-key="id"
        :pagination="pagination"
        @change="handleTableChange"
      />
    </Modal>
  </Page>
</template>
