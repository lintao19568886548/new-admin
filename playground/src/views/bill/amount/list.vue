<script lang="ts" setup>
import type { Rule } from 'ant-design-vue/es/form';

import type { AmountBill } from './data';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router'; // 新增: 引入 useRouter

import { Page } from '@vben/common-ui';
import { Download, Plus } from '@vben/icons';

import {
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
import { deleteAmountBill, getAmountBillList, getExportData } from '#/api/bill';
import { getVisitorParkList } from '#/api/park';
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';
import { executeBill } from '#/utils/excel';

import {
  electricityFormConfig,
  summaryFormConfig,
  useColumns,
  useGridFormSchema,
  waterFormConfig,
} from './data';
import MultipageBillForm from './modules/MultipageBillForm.vue';

onMounted(async () => {
  const parkList = await getVisitorParkList({ area: 'all' });
  options.value = parkList.map((park: any) => ({
    label: park.parkName,
    value: park.parkId,
  }));
});

const currentPark = ref();
const parkSelectorRef = ref();

// 账单表单组件引用
const billFormRef = ref();

// 账单详情组件引用
const billDetailRef = ref();

const formConfig = {
  ...summaryFormConfig,
  electricityConfig: electricityFormConfig,
  waterConfig: waterFormConfig,
};

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
    receiptTime: dayjs().toISOString(),
    serviceFee: 0,
    tenantName: '',
    totalFee: 0,
    waterBills: [],
    waterFee: 0,
  };
  billFormRef.value?.open(newBill);
}

/**
 * 删除账单
 * @param row
 */
async function onDelete(row: AmountBill) {
  Modal.confirm({
    centered: true,
    content: $t('ui.actionMessage.deleteConfirm', [row.tenantName]),
    async onOk() {
      message.loading({
        content: $t('ui.actionMessage.deleting', [row.tenantName]),
        duration: 0,
        key: 'action_process_msg',
      });

      const { billId } = row;
      if (billId) {
        try {
          await deleteAmountBill(billId);
          message.success({
            content: $t('ui.actionMessage.deleteSuccess', [row.tenantName]),
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
    },
    title: '删除账单',
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

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    compact: true,
    fieldMappingTime: [['receiptTime', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
    showCollapseButton: true,
    wrapperClass: 'grid-cols-1 lg:grid-cols-3 gap-4',
  },
  gridOptions: {
    border: true,
    columns: useColumns(onActionClick),
    footerAlign: 'center',
    footerMethod({ columns, data }: { columns: any[]; data: any[] }) {
      // 返回一个合计行
      return [
        columns.map((column) => {
          // 根据列的字段名称进行不同的合计计算
          if (column.field === 'parkName') {
            return '合计';
          }

          // 如果有需要计算合计的数值列，可以在这里添加
          // 例如：计算某个数值列的合计
          if (column.field === 'eleFee') {
            const sum = data.reduce((sum, row) => {
              return sum + (Number(row.eleFee) || 0);
            }, 0);
            return `${sum.toFixed(2)}元`;
          }

          if (column.field === 'waterFee') {
            const sum = data.reduce((sum, row) => {
              return sum + (Number(row.waterFee) || 0);
            }, 0);
            return `${sum.toFixed(2)}元`;
          }
          if (column.field === 'factoryRent') {
            const sum = data.reduce((sum, row) => {
              return sum + (Number(row.factoryRent) || 0);
            }, 0);
            return `${sum.toFixed(2)}元`;
          }
          if (column.field === 'managementFee') {
            const sum = data.reduce((sum, row) => {
              return sum + (Number(row.managementFee) || 0);
            }, 0);
            return `${sum.toFixed(2)}元`;
          }
          if (column.field === 'penaltyFee') {
            const sum = data.reduce((sum, row) => {
              return sum + (Number(row.penaltyFee) || 0);
            }, 0);
            return `${sum.toFixed(2)}元`;
          }
          if (column.field === 'invoiceTax') {
            const sum = data.reduce((sum, row) => {
              return sum + (Number(row.invoiceTax) || 0);
            }, 0);
            return `${sum.toFixed(2)}元`;
          }
          if (column.field === 'totalFee') {
            const sum = data.reduce((sum, row) => {
              return sum + (Number(row.totalFee) || 0);
            }, 0);
            return `${sum.toFixed(2)}元`;
          }
          // 其他列不显示合计
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
            currentPark: currentPark.value ? currentPark.value.parkId : -1,
            pageSize: page.page?.pageSize || 20,
          };
          try {
            // 调用API获取数据
            const result = await getAmountBillList(params);
            // 返回格式化后的数据
            return {
              ...result,
            };
          } catch (error) {
            console.error('获取账单列表失败:', error);
            message.error('获取账单列表失败');
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

// 导出Excel模态框相关状态
const exportModalVisible = ref(false);
const exportLoading = ref(false);
const exportParks = ref([]);
const options = ref([]);

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
    <MultipageBillForm
      ref="billFormRef"
      :config="formConfig"
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

    <Grid table-title="总账单" class="amount-bill-grid">
      <template #toolbar-actions>
        <!-- 区域选择下拉菜单 -->
        <AreaSelector
          :default-area="currentPark"
          :refresh-callback="refreshGrid"
          @change="(park) => (currentPark = park)"
          ref="parkSelectorRef"
        />
      </template>
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate" style="margin-right: 10px">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', ['总账单']) }}
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
