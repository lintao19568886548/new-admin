<script lang="ts" setup>
import type { Rule } from 'ant-design-vue/es/form';
import type { ColumnsType } from 'ant-design-vue/es/table';

import { h, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';
import { formatDateTime } from '@vben/utils';

import {
  Button,
  Card,
  Form,
  Image,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Table,
  Tag,
  Upload,
} from 'ant-design-vue';

import { getVisitorParkList } from '#/api/park';
import {
  createReimbursement,
  deleteReimbursement,
  getReimbursementList,
} from '#/api/reimbursement';
import { $t } from '#/locales';

const accessStore = useAccessStore();

// 表单实例
const formRef = ref();

const headers = ref();

// 提交状态
const submitting = ref(false);

// 控制记录弹窗的显示状态
const isRecordModalVisible = ref(false);

// 部门选项
// const departmentOptions = [
//   { label: '技术部', value: 'tech' },
//   { label: '财务部', value: 'finance' },
//   { label: '人事部', value: 'hr' },
//   { label: '市场部', value: 'marketing' },
//   { label: '采购部', value: 'procure' },
//   { label: '工程部', value: 'engineering project  ' },
//   { label: '销售部', value: 'sales' },
//   { label: '客服部', value: 'customerService' },
// ];

// 园区列表
const parkList = ref<any>([]);

// 获取园区列表
async function fetchParkList() {
  try {
    const result = await getVisitorParkList({ area: 'all' });
    parkList.value = result || [];
  } catch (error) {
    console.error('获取园区列表失败:', error);
    message.error('获取园区列表失败');
  }
}

// 在组件挂载时获取园区列表
onMounted(() => {
  fetchParkList();
  headers.value = {
    Authorization: `Bearer ${accessStore.accessToken}`,
  };
});

// 表单数据
const formState = reactive({
  amount: undefined,
  department: undefined,
  images: [], // 添加图片列表字段
  parkId: undefined,
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
  parkId: [{ message: '请填写所属园区', required: true, trigger: 'blur' }],
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
  park: string;
  payee: string;
  purpose: string;
  remark?: string;
  status: number;
  updateTime?: string;
  username?: string;
}

// 状态映射
const STATUS_MAP = {
  0: { color: 'warning', text: '待审核' },
  1: { color: 'success', text: '已通过' },
  2: { color: 'error', text: '已拒绝' },
};

// 表格列定义
const columns: ColumnsType<any> = [
  {
    align: 'center',
    dataIndex: 'purpose',
    ellipsis: true,
    key: 'purpose',
    title: '用途',
    width: 100,
  },
  {
    align: 'center',
    customRender: ({ text }: { text: number }) =>
      `￥${Number(text).toFixed(2)}`,
    dataIndex: 'amount',
    key: 'amount',
    title: '金额(元)',
    width: 120,
  },
  // {
  //   customRender: ({ text }: { text: string }) =>
  //     departmentOptions.find((opt) => opt.value === text)?.label || text,
  //   dataIndex: 'department',
  //   key: 'department',
  //   title: '申请部门',
  //   align: 'center',
  // },
  {
    align: 'center',
    dataIndex: 'payee',
    key: 'payee',
    title: '领款人',
    width: 120,
  },
  {
    align: 'center',
    // 为 text 参数添加 string 类型注解
    customRender: ({ text }: { text: string }) => formatDateTime(text),
    dataIndex: 'date',
    key: 'date',
    title: '申请日期',
    width: 160,
  },
  {
    align: 'center',
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
    width: 100,
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
    width: 200,
  },
  {
    align: 'center',
    dataIndex: 'remark',
    ellipsis: true,
    key: 'remark',
    title: '备注',
    width: 150,
  },
  {
    align: 'center',
    customRender: ({ record }: { record: ReimbursementItem }) => {
      // 只有待审核状态(status=0)的申请才能撤销
      const canCancel = record.status === 0;
      return h(
        Button,
        {
          danger: true,
          disabled: !canCancel,
          onClick: () => handleCancelReimbursement(record),
          type: 'link',
        },
        () => '撤销',
      );
    },
    key: 'action',
    title: '操作',
    width: 100,
  },
];

async function handleCancelReimbursement(record: ReimbursementItem) {
  Modal.confirm({
    cancelText: '取消',
    content: `确定要撤销"${record.purpose}"的报销申请吗？`,
    okText: '确认',
    onOk: async () => {
      try {
        // 这里需要调用API来撤销申请
        // 假设有一个 cancelReimbursement API
        await deleteReimbursement(Number(record.id));

        // 由于目前可能没有撤销API，我们可以先添加一个提示
        message.success('申请撤销成功');

        // 刷新列表
        await fetchReimbursements();
      } catch (error) {
        console.error('撤销申请失败:', error);
        message.error('撤销申请失败，请重试');
      }
    },
    title: '确认撤销',
  });
}

// 获取报销列表
async function fetchReimbursements() {
  loading.value = true;
  try {
    const params: any = {
      pageNo: pagination.current,
      pageSize: pagination.pageSize,
    };
    // 所有用户只能查看自己的申请记录
    params.username = currentUsername;

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
      // 处理图片数据，通常只需要保存上传成功后的URL
      images: formState.images
        .filter((file: any) => file.status === 'done')
        .map((file: any) => {
          return {
            imgId: file.response?.data?.imgId,
          };
        }),
      status: 0, // 初始状态：待审核
      username: currentUsername, // 添加当前用户名
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
  fetchReimbursements();
}

// 组件挂载时获取数据 (如果希望首次加载时不显示列表，可以注释掉这里)
// onMounted(() => {
//   fetchReimbursements();
// });

// 图片上传相关
const previewVisible = ref(false);
const previewImage = ref('');
const previewTitle = ref('');

// 上传前检查
const beforeUpload = (file: File) => {
  const isImage = file.type.startsWith('image/');
  if (!isImage) {
    message.error('只能上传图片文件!');
    return false;
  }

  // 检查文件大小（限制为2MB）
  const fileSize = file.size / 1024 / 1024;
  const isLt2M = fileSize < 10;
  if (!isLt2M) {
    Modal.error({
      content: `"${file.name}" 文件大小为 ${fileSize.toFixed(2)}MB，超过了最大限制 10MB。请压缩后重新上传。`,
      title: '文件过大',
    });
    return false;
  }

  return true;
};

const handleChange = (info: any) => {
  if (info.file.status === 'uploading') {
    loading.value = true;
    return;
  }
  if (info.file.status === 'done') {
    // Get this url from response in real world.
    getBase64(info.file.originFileObj);
  }
  if (info.file.status === 'error') {
    loading.value = false;
    message.error('upload error');
  }
};

// 将文件转换为Base64以便预览
function getBase64(file: File) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', (error) => reject(error));
  });
}

const handlePreview = async (file: any) => {
  if (!file.url && !file.preview) {
    file.preview = (await getBase64(file.originFileObj)) as string;
  }
  previewImage.value = file.url || file.preview;
  previewVisible.value = true;
  previewTitle.value =
    file.name || file.url.slice(Math.max(0, file.url.lastIndexOf('/') + 1));
};
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

        <!-- <Form.Item name="department" label="申请部门">
          <Select
            v-model:value="formState.department"
            placeholder="请选择申请部门"
            :options="departmentOptions"
          />
        </Form.Item> -->

        <Form.Item name="payee" label="领款人">
          <Input
            v-model:value="formState.payee"
            placeholder="请输入领款人姓名"
            :maxlength="50"
            show-count
          />
        </Form.Item>

        <Form.Item name="parkId" label="所属园区">
          <Select
            v-model:value="formState.parkId"
            placeholder="请选择所属园区"
            style="width: 100%"
            allow-clear
          >
            <Select.Option
              v-for="park in parkList"
              :key="park.parkId"
              :value="park.parkId"
            >
              {{ park.parkName }}
            </Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="remark" label="备注">
          <Input.TextArea
            v-model:value="formState.remark"
            placeholder="请输入备注信息（选填）"
            :maxlength="200"
            :auto-size="{ minRows: 1, maxRows: 4 }"
            show-count
          />
        </Form.Item>

        <Form.Item name="images" label="相关图片">
          <Upload
            v-model:file-list="formState.images"
            action="/api/image/upload"
            :headers="headers"
            list-type="picture-card"
            :before-upload="beforeUpload"
            @change="handleChange"
            @preview="handlePreview"
          >
            <div v-if="!formState.images || formState.images.length < 5">
              <div>上传</div>
            </div>
          </Upload>
          <Modal
            v-model:visible="previewVisible"
            :title="previewTitle"
            :footer="null"
          >
            <img alt="预览图片" style="width: 100%" :src="previewImage" />
          </Modal>
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
