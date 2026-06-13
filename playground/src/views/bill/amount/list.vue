<script lang="ts" setup>
import type { Rule } from 'ant-design-vue/es/form';

import type { AmountBill, AmountBillListSummary } from './data';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router'; // 新增: 引入 useRouter

import { Page } from '@vben/common-ui';
import { Download, Plus } from '@vben/icons';

import {
  Upload as AUpload,
  Button,
  Checkbox,
  DatePicker,
  Form,
  message,
  Modal,
  Select,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteAllAmountBill,
  deleteAmountBill,
  getAmountBillList,
  getExportData,
} from '#/api/bill';
import { getVisitorParkList } from '#/api/park';
import { getTenantSelectList } from '#/api/rental/tenant';
import SmsVerificationModal from '#/components/SmsVerificationModal.vue';
import { useSmsActionVerification } from '#/hooks/useSmsActionVerification';
import { $t } from '#/locales';
import { executeBill } from '#/utils/excel';

import {
  electricityFormConfig,
  emptyAmountBillListSummary,
  formatAmountBillMoney,
  summaryFormConfig,
  useColumns,
  useGridFormSchema,
  waterFormConfig,
} from './data';
import { analyzeAmountBillExcel, mapLlmResultToAmountBill } from './llm';
import MultipageBillForm from './modules/MultipageBillForm.vue';

const billParkOptions = ref<any[]>([]);
const billTenantOptions = ref<any[]>([]);
const billListSummary = ref<AmountBillListSummary>({
  ...emptyAmountBillListSummary,
});
const route = useRoute();
const DELETE_VERIFY_STORAGE_KEY = 'bill-delete-verified-at';
const deleteVerificationModalRef =
  ref<InstanceType<typeof SmsVerificationModal>>();

onMounted(async () => {
  const [parkResult, tenantResult] = await Promise.allSettled([
    getVisitorParkList({ area: 'all' }),
    getTenantSelectList({ scope: 'all' }),
  ]);

  if (parkResult.status === 'fulfilled') {
    billParkOptions.value = Array.isArray(parkResult.value)
      ? parkResult.value
      : [];
    options.value = billParkOptions.value.map((park: any) => ({
      label: park.parkName,
      value: park.parkId,
    }));
  } else {
    console.error('获取园区选项失败:', parkResult.reason);
  }

  if (tenantResult.status === 'fulfilled') {
    billTenantOptions.value = Array.isArray(tenantResult.value)
      ? tenantResult.value
      : [];
  } else {
    console.error('获取租户选项失败:', tenantResult.reason);
  }
});

// 账单表单组件引用
const billFormRef = ref();

// 账单详情组件引用
const billDetailRef = ref();

const formConfig = {
  ...summaryFormConfig,
  electricityConfig: electricityFormConfig,
  waterConfig: waterFormConfig,
};

const {
  ensureVerified: ensureDeleteVerified,
  handleVerificationCancel: onDeleteVerificationCancel,
  handleVerificationSuccess: onDeleteVerificationSuccess,
} = useSmsActionVerification({
  modalRef: deleteVerificationModalRef,
  storageKey: DELETE_VERIFY_STORAGE_KEY,
  uninitializedMessage: '删除验证组件未初始化',
  validDurationMs: 0,
});

function runDeleteWithVerification(action: () => Promise<void>) {
  window.setTimeout(() => {
    void (async () => {
      const verified = await ensureDeleteVerified();
      if (!verified) {
        message.info('已取消手机验证，删除操作未执行');
        return;
      }

      await action();
    })();
  }, 0);
}

/**
 * 编辑账单
 * @param row
 */
function onEdit(row: AmountBill) {
  billFormRef.value?.open(row);
}

function onNext(row: AmountBill) {
  billFormRef.value?.open(row, { isNextMonth: true });
}

/**
 * 创建新账单
 */
function onCreate() {
  const newBill: AmountBill = {
    eleBills: [],
    eleFee: 0,
    factoryRent: 0,
    garbageFee: 0,
    invoiceTax: 0,
    managementFee: 0,
    serviceFee: 0,
    tenantName: '',
    totalFee: 0,
    waterBills: [],
    waterFee: 0,
  };
  billFormRef.value?.open(newBill);
}

const aiImportLoading = ref(false);

async function handleAiImportBeforeUpload(file: File) {
  const fileName = String(file?.name || '');
  if (!/\.xlsx$/i.test(fileName)) {
    message.warning('AI 直传千问当前仅支持 .xlsx 文件');
    return false;
  }
  if (aiImportLoading.value) {
    return false;
  }

  aiImportLoading.value = true;
  message.loading({
    content: '正在上传 Excel 到千问并解析账单字段...',
    duration: 0,
    key: 'bill_ai_import',
  });

  try {
    const llmResult = await analyzeAmountBillExcel(file);
    if (!llmResult) {
      message.warning({
        content: '未识别到可填充的账单字段',
        key: 'bill_ai_import',
      });
      return false;
    }

    const mapped = mapLlmResultToAmountBill(llmResult, options.value as any);
    billFormRef.value?.open(mapped);

    message.success({
      content: '已完成字段提取，并填充到账单表单',
      key: 'bill_ai_import',
    });
  } catch (error: any) {
    console.error('AI导入账单失败:', error);
    const errorMessage = String(error?.message || error?.error || '');
    let errorTip = 'AI 导入失败，请稍后重试';
    if (errorMessage.includes('ALIYUN_BAILIAN_KEY')) {
      errorTip = '请先配置 ALIYUN_BAILIAN_KEY';
    } else if (errorMessage.includes('only .xlsx')) {
      errorTip = 'AI 直传千问当前仅支持 .xlsx 文件';
    } else if (errorMessage.toLowerCase().includes('timeout')) {
      errorTip = 'AI 导入超时，请稍后重试';
    }
    message.error({
      content: errorTip,
      key: 'bill_ai_import',
    });
  } finally {
    aiImportLoading.value = false;
  }

  return false;
}

/**
 * 删除账单
 * @param row
 */
async function onDelete(row: AmountBill) {
  const billDisplayName = row.tenantName || row.projectName || '该账单';

  Modal.confirm({
    cancelText: $t('common.cancel'),
    centered: true,
    content: $t('ui.actionMessage.deleteConfirm', [billDisplayName]),
    okText: $t('common.confirm'),
    okType: 'danger',
    onOk() {
      void executeDelete(row);
    },
    title: '确认删除账单',
  });
}

async function executeDelete(row: AmountBill) {
  const billDisplayName = row.tenantName || row.projectName || '该账单';

  message.loading({
    content: $t('ui.actionMessage.deleting', [billDisplayName]),
    duration: 0,
    key: 'action_process_msg',
  });

  const { billId } = row;
  if (billId) {
    try {
      await deleteAmountBill(billId);
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [billDisplayName]),
        key: 'action_process_msg',
      });
      refreshGrid();
    } catch (error) {
      console.error('删除账单失败:', error);
      message.error({
        content: $t('ui.actionMessage.operationFailed', [error]),
        key: 'action_process_msg',
      });
    }
  }
}

async function onDeleteAll() {
  runDeleteWithVerification(async () => {
    message.loading({
      content: '正在删除全部账单数据...',
      duration: 0,
      key: 'delete_all_bill',
    });

    try {
      const result = await deleteAllAmountBill();
      const deletedCount = Number(result?.deletedBillCount || 0);
      message.success({
        content:
          deletedCount > 0
            ? `已删除 ${deletedCount} 条账单`
            : '当前没有可删除的账单数据',
        key: 'delete_all_bill',
      });
      gridApi.reload();
    } catch (error) {
      console.error('删除全部账单失败:', error);
      message.error({
        content: '删除全部账单失败，请稍后重试',
        key: 'delete_all_bill',
      });
    }
  });
}

/**
 * 查看账单详情
 * @param row
 */
function onView(row: AmountBill) {
  billDetailRef.value?.open(row);
}

/**
 * 打印账单详情
 * @param row
 */
// --- 新增代码开始 ---
// 打印设置模态框相关状态
const printModalVisible = ref(false);
const printFormRef = ref(); // 表单引用
const currentPrintingBillId = ref<number | string | undefined>(undefined); // 当前要打印的账单ID

// 打印设置表单数据模型
const printFormData = ref({
  accountType: [], // 改为数组以支持多选
  billingDate: dayjs(), // 默认为当天
  cutoffDate: dayjs().add(10, 'day'), // 默认为10天后
});

// 表单验证规则 (可选，根据需要添加)
const printFormRules: Record<string, Rule[]> = {
  billingDate: [
    { message: '请选择制单日期', required: true, trigger: 'change' },
  ],
  cutoffDate: [
    { message: '请选择停止供水供电时间', required: true, trigger: 'change' },
  ],
};
// --- 新增代码结束 ---

function onPrint(row: AmountBill) {
  currentPrintingBillId.value = row.billId; // 保存当前账单ID
  // 可以根据需要重置或预设表单值
  printFormData.value.accountType = [];
  printModalVisible.value = true; // 打开模态框
}

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({ code, row }: OnActionClickParams<AmountBill>) {
  switch (code) {
    case 'delete':
    case 'delete-modal': {
      onDelete(row);
      break;
    }
    case 'edit': {
      onEdit(row);
      break;
    }
    case 'next': {
      onNext(row);
      break;
    }
    case 'print': {
      onPrint(row);
      break;
    }
    case 'view': {
      onView(row);
      break;
    }
  }
}

const currentPageTotalFields = new Set([
  'eleFee',
  'factoryRent',
  'garbageFee',
  'invoiceTax',
  'managementFee',
  'overpaidAmount',
  'penaltyFee',
  'receiptAmount',
  'remainingAmount',
  'serviceFee',
  'totalFee',
  'waterFee',
]);

function normalizeBillListSummary(
  summary?: Partial<AmountBillListSummary>,
): AmountBillListSummary {
  return {
    billCount: Number(summary?.billCount || 0),
    invoiceTax: Number(summary?.invoiceTax || 0),
    overpaidAmount: Number(summary?.overpaidAmount || 0),
    receiptAmount: Number(summary?.receiptAmount || 0),
    remainingAmount: Number(summary?.remainingAmount || 0),
    totalFee: Number(summary?.totalFee || 0),
  };
}

function sumCurrentPage(rows: any[], field: string) {
  return rows.reduce((sum, row) => sum + (Number(row?.[field]) || 0), 0);
}

function getRouteQueryText(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }

  return String(value || '').trim();
}

function getRouteBillFilters() {
  const query = route.query;
  const values: Record<string, any> = {};
  const collectionStatus = getRouteQueryText(query.collectionStatus);
  const parkId = Number(query.parkId ?? query.currentPark);
  const projectEndDate = getRouteQueryText(query.projectEndDate);
  const projectStartDate = getRouteQueryText(query.projectStartDate);
  const projectName = getRouteQueryText(query.projectName);
  const tenantName = getRouteQueryText(query.tenantName);

  if (Number.isInteger(parkId) && parkId > 0) {
    values.parkId = parkId;
  }

  if (projectName) {
    values.projectName = projectName;
  }

  if (tenantName) {
    values.tenantName = tenantName;
  }

  if (projectStartDate && projectEndDate) {
    values.projectPeriod = [projectStartDate, projectEndDate];
  }

  if (collectionStatus) {
    values.collectionStatus = collectionStatus;
  }

  return values;
}

async function applyRouteBillFilters() {
  const values = getRouteBillFilters();
  if (Object.keys(values).length === 0) {
    return;
  }

  await gridApi.formApi?.setValues?.(values);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    compact: true,
    fieldMappingTime: [
      ['receiptTime', ['startTime', 'endTime']],
      ['projectPeriod', ['projectStartDate', 'projectEndDate']],
    ],
    schema: useGridFormSchema(),
    showCollapseButton: true,
    wrapperClass: 'grid-cols-1 lg:grid-cols-3 gap-4',
  },
  gridOptions: {
    border: true,
    columns: useColumns(onActionClick),
    footerAlign: 'center',
    footerMethod({ columns, data }: { columns: any[]; data: any[] }) {
      return [
        columns.map((column) => {
          if (column.field === 'parkName') {
            return '当前页合计';
          }

          if (currentPageTotalFields.has(column.field)) {
            return formatAmountBillMoney(sumCurrentPage(data, column.field));
          }

          return '';
        }),
      ];
    },
    footerRowStyle: {
      color: 'black',
      fontSize: '15px',
    },
    height: '100%',
    keepSource: true,
    // 添加分页配置
    pagerConfig: {
      enabled: true,
      pageSize: 20,
      pageSizes: [10, 20, 30, 50, 100],
    },
    proxyConfig: {
      ajax: {
        query: async (page) => {
          // 获取表单数据
          const formData = (await gridApi.formApi?.getValues?.()) || {};

          // 构建查询参数，包含分页信息
          const params = {
            ...formData,
            currentPage: page.page?.currentPage || 1,
            currentPark: formData.parkId ?? -1,
            pageSize: page.page?.pageSize || 20,
          };
          try {
            // 调用API获取数据
            const result = await getAmountBillList(params);
            billListSummary.value = normalizeBillListSummary(result?.summary);
            // 返回格式化后的数据
            return {
              ...result,
            };
          } catch (error) {
            console.error('获取账单列表失败:', error);
            message.error('获取账单列表失败');
            billListSummary.value = { ...emptyAmountBillListSummary };
            return {
              page: {
                currentPage: 1,
                pageSize: 20,
                total: 0,
              },
              items: [],
            };
          }
        },
      },
    },
    rowConfig: {
      keyField: 'billId', // 确保使用正确的主键字段
    },
    scrollX: {
      enabled: true,
    },
    scrollY: {
      enabled: true,
    },
    showFooter: true,
    showOverflow: true,
    toolbarConfig: {
      custom: true,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions,
});

onMounted(() => {
  void (async () => {
    await applyRouteBillFilters();
    gridApi.query();
  })();
});

// 导出Excel模态框相关状态
const exportModalVisible = ref(false);
const exportLoading = ref(false);
const exportParks = ref<Array<number | string>>([]);
const options = ref<Array<{ label: string; value: number | string }>>([]);

async function onExport() {
  const exportData = await getExportData({
    parkIds: exportParks.value,
  });
  // const data = [[1, 2, 3]];
  executeBill(exportData);
}

/**
 * 刷新表格
 */
function refreshGrid() {
  gridApi.query();
}

const router = useRouter();

/**
 * 表单提交成功回调
 */
function handleFormSuccess(_data: any) {
  message.success('保存成功');
  refreshGrid();
}

/**
 * 处理打印设置模态框确认事件
 */
async function handlePrintOk() {
  try {
    await printFormRef.value?.validate(); // 触发表单验证

    const formData = printFormData.value;

    const printSettings = {
      accountType: formData.accountType,
      billingDate: dayjs(formData.billingDate).format('YYYY-MM-DD'),
      cutoffDate: dayjs(formData.cutoffDate).format('YYYY-MM-DD HH:00:00'),
    };

    const routeData = router.resolve({
      path: `/bill/print/${currentPrintingBillId.value}`,
      query: { ...printSettings },
    });
    window.open(routeData.href, '_blank');

    printModalVisible.value = false; // 关闭模态框
  } catch (error) {
    console.error(error);
    message.error('请检查表单输入项！');
  }
}

/**
 * 处理打印设置模态框取消事件
 */
function handlePrintCancel() {
  printModalVisible.value = false;
}
</script>

<template>
  <Page auto-content-height class="amount-bill-page">
    <SmsVerificationModal
      ref="deleteVerificationModalRef"
      title="删除账单验证"
      @success="onDeleteVerificationSuccess"
      @cancel="onDeleteVerificationCancel"
    />
    <MultipageBillForm
      ref="billFormRef"
      :config="formConfig"
      :park-options="billParkOptions"
      :tenant-options="billTenantOptions"
      @success="handleFormSuccess"
    />

    <!-- --- 新增代码开始 --- -->
    <!-- 打印设置模态框 -->
    <Modal
      v-model:open="printModalVisible"
      title="打印设置"
      @ok="handlePrintOk"
      @cancel="handlePrintCancel"
      :mask-closable="false"
      width="600px"
    >
      <Form
        ref="printFormRef"
        :model="printFormData"
        :rules="printFormRules"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 16 }"
        layout="horizontal"
        class="mt-4"
      >
        <Form.Item label="水电停供时间" name="cutoffDate">
          <DatePicker
            v-model:value="printFormData.cutoffDate"
            :show-time="{ format: 'HH' }"
            format="YYYY-MM-DD HH"
            value-format="YYYY-MM-DD HH:00:00"
            class="w-full"
          />
        </Form.Item>
        <Form.Item label="制单日期" name="billingDate">
          <DatePicker
            v-model:value="printFormData.billingDate"
            value-format="YYYY-MM-DD"
            class="w-full"
          />
        </Form.Item>
        <Form.Item label="账户类型" name="accountType">
          <Checkbox.Group v-model:value="printFormData.accountType">
            <Checkbox value="public">对公账户</Checkbox>
            <Checkbox value="private">对私账户</Checkbox>
          </Checkbox.Group>
        </Form.Item>
      </Form>
    </Modal>
    <!-- --- 新增代码结束 --- -->

    <!-- 导出Excel模态框 -->
    <Modal
      v-model:open="exportModalVisible"
      title="导出Excel"
      @ok="onExport"
      :confirm-loading="exportLoading"
      ok-text="导出"
      cancel-text="取消"
    >
      <div class="mb-4">
        <Select
          v-model:value="exportParks"
          mode="multiple"
          style="width: 100%"
          :options="options"
          placeholder="请选择园区"
        />
      </div>
    </Modal>

    <div class="mb-3 grid grid-cols-2 gap-2 xl:grid-cols-6">
      <div class="rounded-md border border-gray-200 bg-white px-4 py-3">
        <div class="text-sm text-gray-500">筛选账单</div>
        <div class="mt-1 text-xl font-semibold text-gray-900">
          {{ billListSummary.billCount }}
        </div>
      </div>
      <div class="rounded-md border border-gray-200 bg-white px-4 py-3">
        <div class="text-sm text-gray-500">应收合计</div>
        <div class="mt-1 text-xl font-semibold text-gray-900">
          {{ formatAmountBillMoney(billListSummary.totalFee) }}
        </div>
      </div>
      <div class="rounded-md border border-gray-200 bg-white px-4 py-3">
        <div class="text-sm text-gray-500">实收合计</div>
        <div class="mt-1 text-xl font-semibold text-emerald-700">
          {{ formatAmountBillMoney(billListSummary.receiptAmount) }}
        </div>
      </div>
      <div class="rounded-md border border-gray-200 bg-white px-4 py-3">
        <div class="text-sm text-gray-500">未收合计</div>
        <div class="mt-1 text-xl font-semibold text-red-600">
          {{ formatAmountBillMoney(billListSummary.remainingAmount) }}
        </div>
      </div>
      <div class="rounded-md border border-gray-200 bg-white px-4 py-3">
        <div class="text-sm text-gray-500">多收合计</div>
        <div class="mt-1 text-xl font-semibold text-orange-600">
          {{ formatAmountBillMoney(billListSummary.overpaidAmount) }}
        </div>
      </div>
      <div class="rounded-md border border-gray-200 bg-white px-4 py-3">
        <div class="text-sm text-gray-500">开票税金</div>
        <div class="mt-1 text-xl font-semibold text-gray-900">
          {{ formatAmountBillMoney(billListSummary.invoiceTax) }}
        </div>
      </div>
    </div>

    <Grid table-title="总账单" class="amount-bill-grid">
      <template #toolbar-tools>
        <AUpload
          :before-upload="handleAiImportBeforeUpload"
          :show-upload-list="false"
          accept=".xlsx"
        >
          <Button :loading="aiImportLoading" style="margin-right: 10px">
            AI导入Excel
          </Button>
        </AUpload>
        <Button type="primary" @click="onCreate" style="margin-right: 10px">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', ['总账单']) }}
        </Button>
        <Button danger @click="onDeleteAll" style="margin-right: 10px">
          删除全部
        </Button>
        <Button
          type="primary"
          shape="circle"
          @click="exportModalVisible = true"
        >
          <Download class="size-5" />
        </Button>
      </template>
    </Grid>
  </Page>
</template>

<style lang="less" scoped></style>
