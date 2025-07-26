<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { ReimbursementItem } from './data';

import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { useAppConfig } from '@vben/hooks';
import { Search } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import {
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Spin,
  Table,
  Upload,
} from 'ant-design-vue';

import { getVisitorParkList } from '#/api/park';
import {
  createReimbursement,
  deleteReimbursement,
  getReimbursementList,
} from '#/api/reimbursement';
import { $t } from '#/locales';

import { STATUS_MAP, useColumns, useFormRules } from './data';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
// 控制记录弹窗的显示状态
const isRecordModalVisible = ref(false);

// 获取用户存储
const userStore = useUserStore();
const accessStore = useAccessStore();
const currentUsername = computed(() => userStore.userInfo?.username || '');

// 使用shallowRef优化性能
const reimbursementList = shallowRef<ReimbursementItem[]>([]);
const loading = ref(false);

// 搜索条件
const searchForm = reactive<{
  dateRange: [Dayjs, Dayjs] | undefined; // Changed null to undefined
  purpose: string;
  status: number | undefined;
}>({
  dateRange: undefined, // Changed null to undefined
  purpose: '',
  status: undefined,
});

// 分页相关状态
const pagination = reactive({
  current: 1,
  pageSize: 10,
  pageSizeOptions: ['10', '20', '50', '100'],
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  total: 0,
});

// 状态选项
const statusOptions = Object.entries(STATUS_MAP).map(([value, item]) => ({
  label: item.text,
  value: Number(value),
}));

// 获取报销列表
async function fetchReimbursements() {
  loading.value = true;
  console.warn(
    `[ReimbursementList] fetchReimbursements 调用时 currentUsername: ${currentUsername.value}`,
  );
  // 如果当前用户名为空，则不进行查询，直接返回并提示错误
  if (!currentUsername.value) {
    reimbursementList.value = [];
    pagination.total = 0;
    loading.value = false;
    message.error($t('无法获取当前用户信息，请检查登录状态或联系管理员。'));
    return;
  }
  try {
    const params: any = {
      pageNo: pagination.current,
      pageSize: pagination.pageSize,
    };

    // 所有用户只能查看自己的申请记录。后端会根据提交的 claimant (realName)
    // 和当前用户的 userId 进行联合查询，以兼容新旧数据。
    params.claimant = userStore.userInfo?.realName;

    // 添加其他搜索条件
    if (searchForm.purpose) {
      params.purpose = searchForm.purpose;
    }

    if (searchForm.status !== undefined) {
      params.status = searchForm.status;
    }

    if (searchForm.dateRange && searchForm.dateRange.length === 2) {
      params.startDate = searchForm.dateRange[0];
      params.endDate = searchForm.dateRange[1];
    }

    // 调用 API
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

// 撤销报销申请
async function handleCancelReimbursement(record: ReimbursementItem) {
  Modal.confirm({
    cancelText: '取消',
    content: `确定要撤销"${record.purpose}"的报销申请吗？`,
    okText: '确认',
    onOk: async () => {
      try {
        await deleteReimbursement(Number(record.id));
        message.success('申请撤销成功');
        await fetchReimbursements();
      } catch (error) {
        console.error('撤销申请失败:', error);
        message.error('撤销申请失败，请重试');
      }
    },
    title: '确认撤销',
  });
}

// 修改报销申请
function handleModifyReimbursement(record: ReimbursementItem) {
  Modal.confirm({
    cancelText: '取消',
    content:
      '修改此申请将删除原记录，并将数据加载到主表单中以便重新提交。确定要继续吗？',
    okText: '确认修改',
    onOk: async () => {
      try {
        // 1. 删除旧记录
        await deleteReimbursement(Number(record.id));

        // 2. 填充表单
        // 确保 record.amount 是 number 类型，如果可能为 null/undefined，需要处理
        formState.amount = record.amount; // 类型检查现在应该通过
        formState.applicant = record.username || '';
        formState.parkId =
          typeof record.parkId === 'string'
            ? Number.parseInt(record.parkId, 10)
            : record.parkId;
        formState.payee = record.payee;
        formState.purpose = record.purpose;
        formState.remark = record.remark || '';
        formState.images = []; // 图片需要重新上传

        // 3. 关闭弹窗并提示
        isRecordModalVisible.value = false;
        message.success('原申请已删除，请在表单中修改后重新提交。');

        // 4. 刷新背景列表
        await fetchReimbursements();
      } catch (error) {
        console.error('修改申请（删除步骤）失败:', error);
        message.error('删除原申请失败，请重试');
      }
    },
    title: '确认修改并删除',
  });
}

// 显示记录弹窗
function showRecordModal() {
  // 重置搜索表单字段
  searchForm.dateRange = undefined;
  searchForm.purpose = '';
  searchForm.status = undefined;
  pagination.current = 1;

  // 清空可能存在的旧列表数据
  reimbursementList.value = [];
  pagination.total = 0;

  isRecordModalVisible.value = true;
  // 数据加载将由下面的 watch 触发
}

// 侦听用户名和弹窗可见性的变化
watch(
  [currentUsername, isRecordModalVisible],
  ([newUsername, modalVisible], [oldUsername, oldModalVisible]) => {
    if (modalVisible) {
      if (newUsername) {
        // 弹窗可见且用户名有效
        // 在以下任一情况下获取数据:
        // 1. 弹窗刚刚打开 (之前不可见)
        // 2. 用户名刚刚变为有效 (之前无效)
        // 3. 用户名在弹窗打开期间发生了变化
        if (!oldModalVisible || !oldUsername || newUsername !== oldUsername) {
          console.warn(
            `[ReimbursementList] 用户名: ${newUsername}, 弹窗已显示。准备获取报销记录。`,
          );
          // 确保在获取数据前重置搜索条件
          searchForm.dateRange = undefined;
          searchForm.purpose = '';
          searchForm.status = undefined;
          pagination.current = 1;
          fetchReimbursements();
        }
      } else {
        // 弹窗可见但用户名无效
        console.warn(
          '[ReimbursementList] 用户名无效但弹窗已显示。清空列表并提示错误。',
        );
        reimbursementList.value = [];
        pagination.total = 0;
        loading.value = false; // 关闭加载状态
        message.error($t('无法获取当前用户信息，请检查登录状态或联系管理员。'));
      }
    } else {
      // 弹窗不可见，不执行任何操作
      // console.log('[ReimbursementList] 弹窗已关闭。');
    }
  },
  { immediate: false }, // 不在组件挂载时立即执行，等待变化
);

// 处理搜索
function handleSearch() {
  pagination.current = 1; // 重置为第一页
  fetchReimbursements();
}

// 重置搜索条件
function resetSearch() {
  searchForm.dateRange = undefined;
  searchForm.purpose = '';
  searchForm.status = undefined;
  pagination.current = 1;
  fetchReimbursements();
}

// 表单相关
const formRef = ref();
const submitting = ref(false);
const parkList = ref([]);
const headers = ref();

// 定义表单状态类型
interface FormState {
  amount: number | undefined; // 允许 undefined 以匹配初始状态
  applicant: string;
  images: any[];
  parkId: number | undefined;
  payee: string;
  purpose: string;
  remark: string;
}

// 表单数据
const formState = reactive<FormState>({
  amount: undefined, // 保持初始为 undefined，但在 handleModifyReimbursement 中赋值时类型兼容
  applicant: '',
  images: [], // 添加图片列表字段
  parkId: undefined,
  payee: '',
  purpose: '',
  remark: '',
});

// 表单验证规则
const rules = useFormRules();

// 图片上传相关
const previewVisible = ref(false);
const previewImage = ref('');
const previewTitle = ref('');

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

// 上传前检查
const beforeUpload = (file: File) => {
  const isImage = file.type.startsWith('image/');
  if (!isImage) {
    message.error('只能上传图片文件!');
    return false;
  }

  // 检查文件大小（限制为10MB）
  const fileSize = file.size / 1024 / 1024;
  const isLt10M = fileSize < 10;
  if (!isLt10M) {
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
    return;
  }
  if (info.file.status === 'done') {
    // 当上传成功后，从服务器响应中提取 imgId 并附加到文件对象上
    const responseData = info.file.response?.data;
    if (responseData && responseData.imgId) {
      info.file.imgId = responseData.imgId;
    } else {
      // 如果响应格式不正确或缺少imgId，将状态标记为错误并提示
      info.file.status = 'error';
      message.error(
        `文件 ${info.file.name} 上传成功，但无法获取图片ID，请检查服务器响应。`,
      );
    }
  }
  if (info.file.status === 'error') {
    message.error(`文件 ${info.file.name} 上传失败。`);
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

// 重置表单
function resetForm() {
  formRef.value?.resetFields();
  formState.images = [];
}

// 提交表单
async function handleSubmit() {
  try {
    // 表单验证
    await formRef.value.validate();

    submitting.value = true;

    // 关键改动：创建一个纯净的提交对象，而不是从formState派生。
    // 这避免了任何可能从`formState`泄露的旧数据。
    const newImages = formState.images
      .filter((file: any) => file.status === 'done' && file.imgId)
      .map((file: any) => ({
        imgId: file.imgId,
      }));

    // 创建模式：构建完整的创建数据
    const createData = {
      amount: formState.amount,
      claimant: userStore.userInfo?.realName, // 自动填充当前用户的 realName
      date: new Date().toISOString(),
      images: newImages,
      parkId: formState.parkId,
      payee: formState.payee,
      purpose: formState.purpose,
      remark: formState.remark,
      status: 0, // 初始状态：待审核
      username: formState.applicant, // 使用"申请人"作为记录的用户名
    };
    await createReimbursement(createData);
    message.success('报销申请提交成功');

    // 重置表单
    resetForm();

    // 自动显示记录弹窗
    showRecordModal();
  } catch (error) {
    console.error('提交报销申请失败:', error);
    message.error('提交报销申请失败，请重试');
  } finally {
    submitting.value = false;
  }
}

// 组件挂载时初始化
onMounted(() => {
  // 获取园区列表
  fetchParkList();
  headers.value = {
    Authorization: `Bearer ${accessStore.accessToken}`,
  };
});
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
        <Form.Item name="applicant" label="申请人">
          <Input
            v-model:value="formState.applicant"
            placeholder="请输入申请人姓名"
            :maxlength="50"
            show-count
          />
        </Form.Item>
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
              :key="(park as any).parkId"
              :value="(park as any).parkId"
            >
              {{ (park as any).parkName }}
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
            :action="`${apiURL}/image/upload`"
            :headers="headers"
            list-type="picture-card"
            :before-upload="beforeUpload"
            @change="handleChange"
            @preview="handlePreview"
          >
            <div>
              <div>上传</div>
            </div>
          </Upload>
          <Modal
            v-model:open="previewVisible"
            :title="previewTitle"
            :footer="null"
          >
            <img alt="预览图片" style="width: 100%" :src="previewImage" />
          </Modal>
        </Form.Item>

        <div class="mt-4 flex gap-2">
          <Button @click="resetForm">重置</Button>
          <Button type="primary" @click="handleSubmit" :loading="submitting">
            提交申请
          </Button>
          <Button @click="showRecordModal">申请记录</Button>
        </div>
      </Form>
    </Card>

    <!-- 记录列表弹窗 -->
    <Modal
      v-model:open="isRecordModalVisible"
      :footer="null"
      :title="$t('我的报销记录')"
      width="80vw"
    >
      <!-- 搜索区域 -->
      <div class="mb-4 flex flex-wrap gap-2">
        <DatePicker.RangePicker
          v-model:value="searchForm.dateRange"
          :placeholder="['开始日期', '结束日期']"
          class="w-64"
        />
        <Input
          v-model:value="searchForm.purpose"
          placeholder="搜索用途"
          class="w-48"
          allow-clear
        />
        <Select
          v-model:value="searchForm.status"
          :options="statusOptions"
          placeholder="选择状态"
          class="w-32"
          allow-clear
        />
        <Button type="primary" @click="handleSearch">
          <Search class="mr-1 h-4 w-4" />
          搜索
        </Button>
        <Button @click="resetSearch">重置</Button>
      </div>

      <Spin :spinning="loading" tip="加载中...">
        <Table
          :columns="
            useColumns(handleCancelReimbursement, handleModifyReimbursement)
          "
          :data-source="reimbursementList"
          row-key="id"
          :pagination="pagination"
          @change="handleTableChange"
          :scroll="{ x: 1200 }"
        >
          <template #emptyText>
            <Empty :description="loading ? '加载中...' : '暂无数据'" />
          </template>
        </Table>
      </Spin>
    </Modal>
  </Page>
</template>

<style scoped>
.ant-btn {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
