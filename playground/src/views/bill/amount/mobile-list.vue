<script lang="ts" setup>
import type { Rule } from 'ant-design-vue/es/form';

import type { AmountBill } from './data';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import { MoreOutlined, PlusOutlined } from '@ant-design/icons-vue'; // 使用 antd 图标
import {
  Avatar,
  Button,
  DatePicker,
  Dropdown,
  Form,
  Input,
  List,
  Menu,
  MenuItem,
  message,
  Modal,
  Spin,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { deleteAmountBill, getAmountBillList } from '#/api/bill';
// 用于 AreaSelector 和可能的打印选项
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import MobileAmountBillDetail from './modules/MobileAmountBillDetail.vue';
// 导入手机端表单和详情组件 (稍后创建)
import MobileAmountBillForm from './modules/MobileAmountBillForm.vue';

const router = useRouter();

// 数据状态
const bills = ref<AmountBill[]>([]);
const currentPage = ref(1);
const pageSize = ref(15);
const totalBills = ref(0);
const loading = ref(false);
const allLoaded = ref(false); // 是否已加载所有数据

const currentPark = ref(); // 当前园区，用于 AreaSelector 和 API 调用
const parkSelectorRef = ref();

const mobileBillFormRef = ref();
const mobileBillDetailRef = ref();

// Helper to format fee with currency
const formatFee = (value?: number | string) => {
  const numValue = Number(value);
  return Number.isNaN(numValue) ? '0.00 元' : `${numValue.toFixed(2)} 元`;
};

// 获取账单列表
async function fetchBillList(isRefresh = false) {
  if (loading.value || (!isRefresh && allLoaded.value)) return;
  loading.value = true;
  if (isRefresh) {
    currentPage.value = 1;
    bills.value = [];
    allLoaded.value = false;
  }

  try {
    const defaultSearchFormData = {
      projectName: '',
      receiptTime: [],
      tenantName: '',
    };

    const params = {
      ...defaultSearchFormData,
      currentPage: currentPage.value,
      currentPark: currentPark.value ? currentPark.value.parkId : -1,
      pageSize: pageSize.value,
    };

    const result = await getAmountBillList(params);

    // 确保 result.items 和 result.total 存在
    if (result && result.items && typeof result.total === 'number') {
      bills.value = [...bills.value, ...result.items];
      totalBills.value = result.total; // 使用 result.total
      if (bills.value.length >= totalBills.value) {
        allLoaded.value = true;
      }
    } else {
      console.warn(
        'API 返回的数据结构不符合预期或缺少必要字段 (items, total):',
        result,
      );
      message.warn('获取账单列表失败，数据结构异常。');
      bills.value = [];
      totalBills.value = 0;
    }
  } catch (error: any) {
    console.error('获取账单列表失败 (mobile):', error);
    message.error(error?.message || '获取账单列表失败');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchBillList(true); // 初始加载
});

function handleLoadMore() {
  if (!allLoaded.value) {
    currentPage.value++;
    fetchBillList();
  }
}

function refreshList() {
  fetchBillList(true);
}

// --- 操作处理 ---
function handleCreate() {
  mobileBillFormRef.value?.open();
}

function handleEdit(item: AmountBill) {
  mobileBillFormRef.value?.open(item);
}

function handleView(item: AmountBill) {
  mobileBillDetailRef.value?.open(item);
}

function handleNext(item: AmountBill) {
  // 'next' 功能通常是基于当前账单创建下一个周期的账单
  // 这里需要传递原始账单数据，并标记为创建下一个账期
  mobileBillFormRef.value?.open(item, 'next');
}

async function handleDelete(item: AmountBill) {
  Modal.confirm({
    cancelText: $t('common.cancel'),
    content: $t('ui.actionMessage.deleteConfirmContent', [
      item.tenantName || '该账单',
    ]),
    okText: $t('common.confirm'),
    async onOk() {
      if (!item.billId) return;
      message.loading({
        content: $t('ui.actionMessage.deleting', [item.tenantName]),
        duration: 0,
        key: 'action_process_msg',
      });
      try {
        await deleteAmountBill(item.billId);
        message.success({
          content: $t('ui.actionMessage.deleteSuccess', [item.tenantName]),
          key: 'action_process_msg',
        });
        refreshList();
      } catch (error: any) {
        console.error('删除账单失败:', error);
        message.error({
          content:
            error?.message ||
            $t('ui.actionMessage.operationFailed', [item.tenantName]),
          key: 'action_process_msg',
        });
      }
    },
    title: $t('common.confirmDelete'),
  });
}

// --- 打印逻辑 (复用自 list.vue) ---
const printModalVisible = ref(false);
const printFormRef = ref();
const currentPrintingBillId = ref<number | string | undefined>(undefined);
const printFormData = ref({
  bankName: '',
  billingDate: dayjs(),
  companyAccountName: '',
  companyAccountNumber: '4430 4001 0400 21090', // 注意：硬编码
  cutoffDate: dayjs().add(10, 'day'),
  parkManager: '',
});

// 从 Local Storage 加载打印设置
try {
  const savedSettings = localStorage.getItem('billPrintSettings');
  if (savedSettings) {
    const parsedSettings = JSON.parse(savedSettings);
    if (parsedSettings.bankName)
      printFormData.value.bankName = parsedSettings.bankName;
    if (parsedSettings.companyAccountName)
      printFormData.value.companyAccountName =
        parsedSettings.companyAccountName;
    if (parsedSettings.companyAccountNumber)
      printFormData.value.companyAccountNumber =
        parsedSettings.companyAccountNumber;
    if (parsedSettings.parkManager)
      printFormData.value.parkManager = parsedSettings.parkManager;
  }
} catch (error) {
  console.error('加载保存的打印设置失败:', error);
}

const printFormRules: Record<string, Rule[]> = {
  bankName: [{ message: '请输入开户行', required: true, trigger: 'blur' }],
  billingDate: [
    { message: '请选择制单日期', required: true, trigger: 'change' },
  ],
  companyAccountName: [
    { message: '请输入对公户名', required: true, trigger: 'blur' },
  ],
  companyAccountNumber: [
    { message: '请输入对公账号', required: true, trigger: 'blur' },
  ],
  cutoffDate: [
    { message: '请选择停止供水供电时间', required: true, trigger: 'change' },
  ],
  parkManager: [
    { message: '请输入园区负责人信息', required: true, trigger: 'blur' },
  ],
};

function handlePrint(item: AmountBill) {
  currentPrintingBillId.value = item.billId;
  printModalVisible.value = true;
}

async function handlePrintOk() {
  try {
    await printFormRef.value?.validate();
    const storageData = {
      bankName: printFormData.value.bankName,
      companyAccountName: printFormData.value.companyAccountName,
      companyAccountNumber: printFormData.value.companyAccountNumber,
      parkManager: printFormData.value.parkManager,
    };
    localStorage.setItem('billPrintSettings', JSON.stringify(storageData));

    const formData = printFormData.value;
    const printSettings = {
      bankName: formData.bankName,
      billingDate: dayjs(formData.billingDate).format('YYYY-MM-DD'),
      companyAccountName: formData.companyAccountName,
      companyAccountNumber: formData.companyAccountNumber,
      cutoffDate: dayjs(formData.cutoffDate).format('YYYY-MM-DD HH:00:00'),
      parkManager: formData.parkManager,
    };

    const routeData = router.resolve({
      path: `/bill/print/${currentPrintingBillId.value}`, // 假设打印页面路由已存在
      query: { ...printSettings },
    });
    window.open(routeData.href, '_blank');
    printModalVisible.value = false;
  } catch (error) {
    console.error(error);
    message.error('请检查表单输入项！');
  }
}

function handlePrintCancel() {
  printModalVisible.value = false;
}

// 表单成功回调
function handleFormSuccess() {
  refreshList();
}

// 园区选择变化
function onParkChange(park: any) {
  currentPark.value = park;
  refreshList(); // 切换园区后刷新列表
}

const listIsEmpty = computed(() => !loading.value && bills.value.length === 0);
</script>

<template>
  <Page
    :title="$t('page.bill.amount.mobileTitle', '总账单管理')"
    class="amount-bill-mobile-page"
  >
    <template #headerContent>
      <div class="flex items-center justify-between bg-white p-2 dark:bg-black">
        <AreaSelector
          :default-area="currentPark"
          :refresh-callback="refreshList"
          @change="onParkChange"
          ref="parkSelectorRef"
          size="small"
          class="w-1/2"
        />
        <Button type="primary" @click="handleCreate" size="small">
          <PlusOutlined /> {{ $t('common.create') }}
        </Button>
      </div>
    </template>

    <div class="p-2">
      <Spin :spinning="loading && currentPage === 1">
        <List
          item-layout="horizontal"
          :data-source="bills"
          :loading="loading && currentPage > 1"
        >
          <template #renderItem="{ item }: { item: AmountBill }">
            <List.Item
              class="mb-2 rounded-md bg-white p-3 shadow-sm dark:bg-white dark:bg-opacity-10"
            >
              <template #actions>
                <Dropdown placement="bottomRight">
                  <Button type="text" size="small" class="px-1">
                    <MoreOutlined class="text-lg" />
                  </Button>
                  <template #overlay>
                    <Menu>
                      <MenuItem @click="handleView(item)"> 查看 </MenuItem>
                      <MenuItem @click="handleEdit(item)">
                        {{ $t('common.edit') }}
                      </MenuItem>
                      <MenuItem @click="handleNext(item)">新增下月</MenuItem>
                      <MenuItem @click="handlePrint(item)"> 打印 </MenuItem>
                      <MenuItem @click="handleDelete(item)" danger>
                        {{ $t('common.delete') }}
                      </MenuItem>
                    </Menu>
                  </template>
                </Dropdown>
              </template>
              <List.Item.Meta>
                <template #title>
                  <span class="font-semibold">{{ item.tenantName }}</span>
                  <Tag
                    v-if="item.projectName"
                    color="blue"
                    class="ml-2 text-xs"
                  >
                    {{ item.projectName }}
                  </Tag>
                </template>
                <template #description>
                  <div class="space-y-1 text-xs">
                    <p v-if="item.receiptTime">
                      <!-- Add v-if here -->
                      收款时间:
                      {{ formatDateTime(item.receiptTime) }}
                    </p>
                    <p>
                      总费用:
                      <span class="font-medium text-red-500">{{
                        formatFee(item.totalFee)
                      }}</span>
                    </p>
                    <p v-if="item.eleFee">电费: {{ formatFee(item.eleFee) }}</p>
                    <p v-if="item.waterFee">
                      水费: {{ formatFee(item.waterFee) }}
                    </p>
                  </div>
                </template>
                <template #avatar>
                  <Avatar class="bg-blue-500 text-white">
                    {{ item.tenantName?.substring(0, 1) }}
                  </Avatar>
                </template>
              </List.Item.Meta>
            </List.Item>
          </template>

          <template #loadMore v-if="!allLoaded && !loading">
            <div class="my-4 text-center">
              <Button @click="handleLoadMore">加载更多</Button>
            </div>
          </template>
          <template #header v-if="listIsEmpty">
            <div class="p-10 text-center text-gray-500">暂无账单数据</div>
          </template>
        </List>
      </Spin>
    </div>

    <!-- 打印设置模态框 -->
    <Modal
      v-model:open="printModalVisible"
      :title="$t('page.bill.amount.printSettingsTitle', '打印设置')"
      @ok="handlePrintOk"
      @cancel="handlePrintCancel"
      :mask-closable="false"
      width="90%"
      wrap-class-name="mobile-modal-wrap"
    >
      <Form
        ref="printFormRef"
        :model="printFormData"
        :rules="printFormRules"
        layout="vertical"
        class="mt-4"
      >
        <Form.Item label="对公户名" name="companyAccountName">
          <Input v-model:value="printFormData.companyAccountName" />
        </Form.Item>
        <Form.Item label="对公账号" name="companyAccountNumber">
          <Input v-model:value="printFormData.companyAccountNumber" />
        </Form.Item>
        <Form.Item label="开户行" name="bankName">
          <Input v-model:value="printFormData.bankName" />
        </Form.Item>
        <Form.Item label="水电停供时间" name="cutoffDate">
          <DatePicker
            v-model:value="printFormData.cutoffDate"
            :show-time="{ format: 'HH' }"
            format="YYYY-MM-DD HH"
            value-format="YYYY-MM-DD HH:00:00"
            class="w-full"
          />
        </Form.Item>
        <Form.Item label="园区负责人" name="parkManager">
          <Input v-model:value="printFormData.parkManager" />
        </Form.Item>
        <Form.Item label="制单日期" name="billingDate">
          <DatePicker
            v-model:value="printFormData.billingDate"
            value-format="YYYY-MM-DD"
            class="w-full"
          />
        </Form.Item>
      </Form>
    </Modal>

    <!-- 手机端表单和详情组件的引用 -->
    <MobileAmountBillForm
      ref="mobileBillFormRef"
      @success="handleFormSuccess"
    />
    <MobileAmountBillDetail ref="mobileBillDetailRef" />
  </Page>
</template>

<style lang="less" scoped>
.amount-bill-mobile-page {
  :deep(.ant-page-header-heading) {
    // Возможно, потребуется настроить заголовок страницы для мобильных устройств
    padding-left: 8px;
    padding-right: 8px;
  }
  :deep(.ant-list-item-meta-title) {
    margin-bottom: 2px;
    font-size: 0.9rem;
  }
  :deep(.ant-list-item-meta-description) {
    font-size: 0.75rem;
  }
  :deep(.ant-list-item-action > li) {
    padding: 0 4px;
  }
}
.mobile-modal-wrap {
  .ant-modal-content {
    padding: 16px;
  }
  .ant-modal-header {
    padding: 16px 16px 0;
    margin-bottom: 12px;
  }
  .ant-modal-body {
    padding: 0; // Form has its own padding
  }
  .ant-form-item {
    margin-bottom: 12px;
  }
}
</style>
