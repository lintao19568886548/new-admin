<script lang="ts" setup>
import type { AmountBill } from '../data';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, Steps, Table } from 'ant-design-vue';
import dayjs from 'dayjs'; // 添加 dayjs 导入

import { getAmountBillDetail } from '#/api/bill';

/**
 * 多页账单详情配置接口
 */
export interface MultipageBillDetailConfig {
  [key: string]: any; // 支持任意额外属性
  modalClass?: string; // 模态窗口CSS类名
  modalTitle?: string; // 模态窗口标题
}

// 组件属性定义
const props = defineProps<{
  config?: MultipageBillDetailConfig;
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>();

// 提取配置值
const config = computed<MultipageBillDetailConfig>(() => props.config || {});

// 设置默认值
const modalTitle = computed(() => config.value.modalTitle || '账单详情');
const modalClass = computed(
  () =>
    config.value.modalClass || 'multipage-bill-detail-modal max-w-[90%] w-auto',
);

// 当前激活的页签
const activeKey = ref('1');

// 创建引用来存储模态窗口参数
const modalProps = ref({
  class: modalClass.value,
  closeOnClickModal: false, // 防止点击模态窗口外部关闭
  closeOnPressEscape: false, // 防止ESC键关闭
  footer: true,
  onCancel: () => {
    handleClose();
  },
  showCancelButton: false, // 不显示取消按钮
  showConfirmButton: false, // 不显示确认按钮
  title: modalTitle.value,
});

// 修改模态窗口配置
const [Modal, modalApi] = useVbenModal(modalProps.value);

// 设置关闭前拦截
(modalApi as any).onBeforeClose = () => {
  return false; // 阻止除了右上角X之外的所有关闭方式
};

// 账单数据
const billData = ref<AmountBill>();

// 下一页方法
function handleNext() {
  const key = Number(activeKey.value);
  if (key < 3) {
    activeKey.value = String(key + 1);
  } else {
    // 如果是最后一页的关闭按钮，直接关闭窗口
    handleClose();
  }
}

// 关闭窗口方法
function handleClose() {
  modalApi.close();
  emit('close');
}

// 上一页方法
function handlePrev() {
  const key = Number(activeKey.value);
  if (key > 1) {
    activeKey.value = String(key - 1);
  }
}

// 电费表格列配置
const electricityColumns = [
  {
    dataIndex: 'meterName',
    key: 'meterName',
    title: '表计名称',
    width: 150,
  },
  {
    dataIndex: 'previousReading',
    key: 'previousReading',
    title: '上月电表数',
    width: 120,
  },
  {
    dataIndex: 'currentReading',
    key: 'currentReading',
    title: '本月电表数',
    width: 120,
  },
  {
    dataIndex: 'monthlyUsage',
    key: 'monthlyUsage',
    title: '本月度数',
    width: 100,
  },
  {
    dataIndex: 'multiplier',
    key: 'multiplier',
    title: '倍数',
    width: 80,
  },
  {
    dataIndex: 'totalUsage',
    key: 'totalUsage',
    title: '总用量',
    width: 120,
  },
  {
    dataIndex: 'unitPrice',
    key: 'unitPrice',
    title: '单价(元/度)',
    width: 120,
  },
  {
    dataIndex: 'amount',
    key: 'amount',
    render: (text: any) => (text ? Number.parseFloat(text).toFixed(2) : '0.00'),
    title: '电费金额(元)',
    width: 120,
  },
  {
    dataIndex: 'remarks',
    key: 'remarks',
    title: '备注',
    width: 160,
  },
];

// 水费表格列配置
const waterColumns = [
  {
    dataIndex: 'meterName',
    key: 'meterName',
    title: '表计名称',
    width: 150,
  },
  {
    dataIndex: 'previousReading',
    key: 'previousReading',
    title: '上月水表数',
    width: 120,
  },
  {
    dataIndex: 'currentReading',
    key: 'currentReading',
    title: '本月水表数',
    width: 120,
  },
  {
    dataIndex: 'monthlyUsage',
    key: 'monthlyUsage',
    title: '本月用水量',
    width: 100,
  },
  {
    dataIndex: 'multiplier',
    key: 'multiplier',
    title: '倍数',
    width: 80,
  },
  {
    dataIndex: 'totalUsage',
    key: 'totalUsage',
    title: '总用量',
    width: 120,
  },
  {
    dataIndex: 'unitPrice',
    key: 'unitPrice',
    title: '单价(元/吨)',
    width: 120,
  },
  {
    dataIndex: 'amount',
    key: 'amount',
    render: (text: any) => (text ? Number.parseFloat(text).toFixed(2) : '0.00'),
    title: '水费金额(元)',
    width: 120,
  },
  {
    dataIndex: 'remarks',
    key: 'remarks',
    title: '备注',
    width: 160,
  },
];

// 费用合计表格列配置
const amountColumns = [
  {
    dataIndex: 'name',
    key: 'name',
    title: '费用项目',
    width: 250,
  },
  {
    dataIndex: 'amount',
    key: 'amount',
    render: (text: any) => (text ? Number.parseFloat(text).toFixed(2) : '0.00'),
    title: '金额(元)',
    width: 200,
  },
];

// 总费用数据
const amountData = computed(() => {
  if (!billData.value) return [];

  return [
    {
      amount: billData.value.eleFee || 0,
      key: '1',
      name: '电费合计',
    },
    {
      amount: billData.value.waterFee || 0,
      key: '2',
      name: '水费合计',
    },
    {
      amount: billData.value.factoryRent || 0,
      key: '3',
      name: '厂房租金',
    },
    {
      amount: billData.value.managementFee || 0,
      key: '4',
      name: '基本管理费',
    },
    {
      amount: billData.value.serviceFee || 0,
      key: '5',
      name: '服务费',
    },
    {
      amount: billData.value.invoiceTax || 0,
      key: '6',
      name: '开票税金',
    },
    {
      amount: billData.value.totalFee || 0,
      key: '7',
      name: '本月收费金额',
    },
  ];
});

// 初始化数据
function initData(data: any) {
  if (!data) return;
  // 复制账单基础信息
  billData.value = {
    ...data,
  };

  // 重置页签
  activeKey.value = '1';
}

// 暴露组件实例的方法和对象
defineExpose({
  close: () => {
    handleClose();
  },
  modalApi,
  open: async (data: any) => {
    // 更新模态窗口配置
    modalProps.value = {
      ...modalProps.value,
      class:
        config.value.modalClass ||
        'multipage-bill-detail-modal max-w-[90%] w-auto',
      closeOnClickModal: false,
      closeOnPressEscape: false,
      title: config.value.modalTitle || '账单详情',
    };

    // 重新设置关闭前拦截
    (modalApi as any).onBeforeClose = () => {
      return false; // 阻止除了右上角X之外的所有关闭方式
    };
    const billDetail = await getAmountBillDetail(data.billId);
    // modalApi.setData(billDetail.data);
    initData(billDetail);
    modalApi.open();
  },
});

const formattedReceiptTime = computed(() => {
  if (!billData.value?.receiptTime) return '';
  return dayjs(billData.value.receiptTime).format('YYYY-MM-DD');
});
</script>

<template>
  <Modal>
    <!-- 基本信息 -->
    <div class="mb-4 grid grid-cols-3 gap-4">
      <div class="rounded border p-3">
        <div class="text-gray-500">公司名称</div>
        <div class="font-medium">{{ billData?.tenantName }}</div>
      </div>
      <div class="rounded border p-3">
        <div class="text-gray-500">项目名称</div>
        <div class="font-medium">{{ billData?.projectName }}</div>
      </div>
      <div class="rounded border p-3">
        <div class="text-gray-500">账单日期</div>
        <div class="font-medium">{{ formattedReceiptTime }}</div>
      </div>
    </div>

    <!-- 步骤条 -->
    <Steps class="mb-6" :current="Number(activeKey) - 1">
      <Steps.Step title="电费明细" />
      <Steps.Step title="水费明细" />
      <Steps.Step title="费用合计" />
    </Steps>

    <!-- 页签内容 -->
    <div class="tab-content">
      <!-- 电费表格 -->
      <div v-show="activeKey === '1'" class="tab-pane">
        <Table
          :columns="electricityColumns"
          :data-source="billData?.eleBills || []"
          :pagination="false"
          :scroll="{ x: 1200, scrollToFirstRowOnChange: true }"
          class="passive-wheel-table"
          bordered
        />
      </div>

      <!-- 水费表格 -->
      <div v-show="activeKey === '2'" class="tab-pane">
        <Table
          :columns="waterColumns"
          :data-source="billData?.waterBills || []"
          :pagination="false"
          :scroll="{ x: 1200, scrollToFirstRowOnChange: true }"
          class="passive-wheel-table"
          bordered
        />
      </div>

      <!-- 费用合计 -->
      <div v-show="activeKey === '3'" class="tab-pane">
        <Table
          :columns="amountColumns"
          :data-source="amountData"
          :pagination="false"
          class="passive-wheel-table"
          bordered
          style="margin-bottom: 8px"
        />
      </div>
    </div>

    <!-- 底部按钮 -->
    <template #footer>
      <div class="footer-buttons">
        <div class="left-buttons">
          <Button
            v-if="Number(activeKey) > 1"
            class="prev-button"
            @click="handlePrev"
          >
            <span class="button-icon">←</span> 上一页
          </Button>
          <div v-else class="placeholder-button"></div>
        </div>

        <div class="page-indicator">
          <span
            v-for="page in 3"
            :key="page"
            class="page-dot"
            :class="[{ active: Number(activeKey) === page }]"
          ></span>
          <span class="page-text">{{ activeKey }}/3</span>
        </div>

        <div class="right-buttons">
          <Button
            v-if="Number(activeKey) < 3"
            type="primary"
            class="next-button"
            @click="handleNext"
          >
            下一页 <span class="button-icon">→</span>
          </Button>
          <Button
            v-else
            type="primary"
            class="close-button"
            @click="handleClose"
          >
            关闭
          </Button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<style lang="less" scoped>
.tab-content {
  height: 400px;
  overflow-y: auto;

  .tab-pane {
    height: 100%;
  }
}

// 底部按钮样式
.footer-buttons {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;

  .left-buttons,
  .right-buttons {
    display: flex;
    align-items: center;
    width: 100px; // 固定宽度，确保中间部分居中
  }

  .right-buttons {
    justify-content: flex-end; // 右侧按钮靠右对齐
  }

  .placeholder-button {
    width: 90px; // 与按钮宽度相同
    height: 32px; // 与按钮高度相同
  }

  .button-icon {
    display: inline-block;
    margin: 0 2px;
  }

  .next-button,
  .prev-button,
  .close-button {
    min-width: 90px;
    transition: all 0.3s;

    &:hover {
      transform: translateY(-2px);
    }
  }

  .page-indicator {
    display: flex;
    flex: 1;
    justify-content: center; // 确保水平居中
    align-items: center;

    .page-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin: 0 4px;
      border-radius: 50%;
      background-color: #e0e0e0;
      transition: all 0.3s;

      &.active {
        background-color: #1890ff;
        transform: scale(1.2);
      }
    }

    .page-text {
      margin-left: 8px;
      font-size: 14px;
      color: #666;
    }
  }
}

// 添加 passive wheel 相关样式
:deep(.passive-wheel-table) {
  &.ant-table-wrapper {
    overflow-x: auto;
    scroll-behavior: smooth;
  }
}

// 确保表格单元格不会换行
:deep(.ant-table-cell) {
  padding: 8px;
  vertical-align: middle;
  white-space: nowrap; // 防止文本换行
}

// 确保模态窗口内容可以横向滚动
:deep(.multipage-bill-detail-modal) {
  .ant-table-wrapper {
    overflow-x: auto;
  }

  .ant-table-container {
    min-width: 1200px; // 确保表格有最小宽度
  }

  // 增强表格滚动区域样式
  .ant-table-body {
    overflow-x: auto !important;
    &::-webkit-scrollbar {
      height: 8px; // 设置横向滚动条高度
    }
    &::-webkit-scrollbar-thumb {
      background-color: #d9d9d9; // 滚动条颜色
      border-radius: 4px; // 滚动条圆角
    }
    &::-webkit-scrollbar-track {
      background-color: #f1f1f1; // 滚动条轨道颜色
    }
  }
}
</style>

// 格式化账单月份 const formattedReceiptTime = computed(() => { if
(!billData.value?.receiptTime) return ''; return
dayjs(billData.value.receiptTime).format('YYYYMMDD'); });
