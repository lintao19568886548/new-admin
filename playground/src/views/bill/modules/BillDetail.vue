<script lang="ts" setup>
import { computed } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import { Button, Table } from 'ant-design-vue';

/**
 * 通用账单项目接口
 */
export interface BillItem {
  actualUsage: number; // 实际用量
  amount: number; // 金额（元）
  currentMonthReading: number; // 本月读数
  id: number;
  key: string;
  lastMonthReading: number; // 上月读数
  monthlyUsage: number; // 本月用量
  multiplier: number; // 倍数
  name: string; // 名称
  remark: string; // 备注
  unitPrice: number; // 单价
}

/**
 * 通用账单接口
 */
export interface Bill {
  [key: string]: any; // 其他可能的属性
  companyName: string; // 公司名称
  id: number;
  items: BillItem[]; // 账单项目列表（会根据不同账单类型映射，如waterItems、electricityItems等）
  paymentTime: any; // 收款时间
  position: string; // 位置
  projectName: string; // 项目名称
}

/**
 * 表格列配置接口
 */
export interface ColumnConfig {
  dataIndex: string;
  key: string;
  render?: (text: any) => string;
  title: string;
  width: number;
}

/**
 * 账单详情配置接口
 */
export interface BillDetailConfig {
  [key: string]: any; // 支持任意额外属性
  amountLabel?: string; // 金额标签（如"电费金额"或"水费金额"）
  defaultItemName?: string; // 默认项目名称（如"主楼电费"或"主楼水费"）
  defaultSubItemName?: string; // 默认子项目名称（如"附楼电费"或"附楼水费"）
  itemsField?: string; // 账单项目字段名（如"electricityItems"或"waterItems"）
  modalClass?: string; // 模态窗口CSS类名
  modalTitle?: string; // 模态窗口标题
  readingLabel?: string; // 读数标签（如"电表数"或"水表数"）
  unitLabel?: string; // 单位标签（如"度"或"吨"）
  usageLabel?: string; // 用量标签（如"度数"或"用水量"）
}

// 组件属性定义 - 使用单一配置对象
const props = defineProps<{
  config?: BillDetailConfig;
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>();

// 提取配置值，支持直接传递旧式属性方式
const config = computed<BillDetailConfig>(() => props.config || {});

// 设置默认值
const modalTitle = computed(() => config.value.modalTitle || '账单详情');
const modalClass = computed(
  () => config.value.modalClass || 'bill-detail-modal max-w-[90%] w-auto',
);
const unitLabel = computed(() => config.value.unitLabel || '单位');
const usageLabel = computed(() => config.value.usageLabel || '用量');
const readingLabel = computed(() => config.value.readingLabel || '读数');
const amountLabel = computed(() => config.value.amountLabel || '金额');
const itemsField = computed(() => config.value.itemsField || 'items');
const defaultItemName = computed(
  () => config.value.defaultItemName || '主项目',
);
const defaultSubItemName = computed(
  () => config.value.defaultSubItemName || '附项目',
);

// 修改模态窗口配置，添加取消按钮配置
const [Modal, modalApi] = useVbenModal({
  cancelText: '关闭',
  // 通过class控制弹窗宽度，使用Tailwind宽度类
  class: modalClass.value,
  footer: true,
  onCancel: () => {
    modalApi.close();
    emit('close');
  },
  showConfirmButton: false, // 不显示确认按钮，只需要关闭按钮
  title: modalTitle.value,
});

const record = computed<Bill>(() => {
  const data = modalApi.getData() || {};
  // 创建一个包含预期items字段的新对象，并确保满足Bill接口
  return {
    companyName: data.companyName || '',
    id: data.id || 0,
    paymentTime: data.paymentTime || null,
    position: data.position || '',
    projectName: data.projectName || '',
    items: data[itemsField.value] || [],
    ...data, // 保留原始数据中的其他字段
  };
});

// 获取第一个账单项目的数据
const firstBillItem = computed<BillItem>(() => {
  const defaultItem: BillItem = {
    actualUsage: 0,
    amount: 0,
    currentMonthReading: 0,
    id: 0,
    key: '1',
    lastMonthReading: 0,
    monthlyUsage: 0,
    multiplier: 1,
    name: '',
    remark: '',
    unitPrice: 0,
  };

  if (!record.value.items || record.value.items.length === 0) {
    return defaultItem;
  }
  return record.value.items[0] || defaultItem;
});

// 关闭模态窗口的方法
function handleClose() {
  modalApi.close();
  emit('close');
}

// 动态生成表格列配置
const columns = computed<ColumnConfig[]>(() => [
  {
    dataIndex: 'name',
    key: 'name',
    title: '名称',
    width: 150,
  },
  {
    dataIndex: 'lastMonthReading',
    key: 'lastMonthReading',
    title: `上月${readingLabel.value}`,
    width: 120,
  },
  {
    dataIndex: 'currentMonthReading',
    key: 'currentMonthReading',
    title: `本月${readingLabel.value}`,
    width: 120,
  },
  {
    dataIndex: 'monthlyUsage',
    key: 'monthlyUsage',
    title: `本月${usageLabel.value}`,
    width: 100,
  },
  {
    dataIndex: 'multiplier',
    key: 'multiplier',
    title: '倍数',
    width: 80,
  },
  {
    dataIndex: 'actualUsage',
    key: 'actualUsage',
    title: `本月实际${usageLabel.value}`,
    width: 120,
  },
  {
    dataIndex: 'unitPrice',
    key: 'unitPrice',
    title: `单价(元/${unitLabel.value})`,
    width: 120,
  },
  {
    dataIndex: 'amount',
    key: 'amount',
    render: (text: any) => (text ? Number.parseFloat(text).toFixed(2) : '0.00'),
    title: `${amountLabel.value}(元)`,
    width: 120,
  },
  {
    dataIndex: 'remark',
    key: 'remark',
    title: '备注',
    width: 160,
  },
]);

// 创建表格数据源
const tableData = computed(() => {
  if (!record.value) return [];

  // 第一行数据计算
  const lastMonthReading1 = firstBillItem.value.lastMonthReading || 0;
  const currentMonthReading1 = firstBillItem.value.currentMonthReading || 0;
  const monthlyUsage1 = currentMonthReading1 - lastMonthReading1;
  const multiplier1 = firstBillItem.value.multiplier || 1;
  const actualUsage1 = monthlyUsage1 * multiplier1; // 本月实际用量 = 本月用量 * 倍数
  const unitPrice1 = firstBillItem.value.unitPrice || 0;
  const amount1 = actualUsage1 * unitPrice1; // 账单金额 = 本月实际用量 * 单价

  // 第二行示例数据
  const lastMonthReading2 = 2000;
  const currentMonthReading2 = 2400;
  const monthlyUsage2 = currentMonthReading2 - lastMonthReading2;
  const multiplier2 = 1.2;
  const actualUsage2 = monthlyUsage2 * multiplier2; // 本月实际用量 = 本月用量 * 倍数
  const unitPrice2 = 0.6;
  const amount2 = actualUsage2 * unitPrice2; // 账单金额 = 本月实际用量 * 单价

  // 计算合计数据
  const totalActualUsage = actualUsage1 + actualUsage2;
  const totalAmount = amount1 + amount2;

  // 返回表格行数据（两行数据和一行合计）
  return [
    // 第一行数据
    {
      actualUsage: actualUsage1,
      amount: amount1,
      currentMonthReading: currentMonthReading1,
      key: '1',
      lastMonthReading: lastMonthReading1,
      monthlyUsage: monthlyUsage1,
      multiplier: multiplier1,
      name: firstBillItem.value.name || defaultItemName.value,
      remark: firstBillItem.value.remark || '无',
      unitPrice: unitPrice1,
    },
    // 第二行数据（额外添加的示例数据）
    {
      actualUsage: actualUsage2,
      amount: amount2,
      currentMonthReading: currentMonthReading2,
      key: '2',
      lastMonthReading: lastMonthReading2,
      monthlyUsage: monthlyUsage2,
      multiplier: multiplier2,
      name: defaultSubItemName.value,
      remark: '新增区域',
      unitPrice: unitPrice2,
    },
    // 合计行（只计算本月实际用量和账单金额）
    {
      actualUsage: totalActualUsage, // 本月实际用量合计
      amount: totalAmount, // 账单金额合计
      currentMonthReading: null,
      key: '3',
      lastMonthReading: null,
      monthlyUsage: null,
      multiplier: null,
      name: '合计',
      remark: '',
      unitPrice: null,
    },
  ];
});

// 暴露组件实例的方法和对象
defineExpose({
  close: () => {
    modalApi.close();
    emit('close');
  },
  modalApi,
  open: (data: any) => {
    modalApi.setData(data).open();
  },
});
</script>

<template>
  <Modal>
    <!-- 第一行信息：公司名称、项目名称、收款时间 -->
    <div class="mb-4 grid grid-cols-3 gap-4">
      <div class="rounded border p-3">
        <div class="text-gray-500">公司名称</div>
        <div class="font-medium">{{ record.companyName }}</div>
      </div>
      <div class="rounded border p-3">
        <div class="text-gray-500">项目名称</div>
        <div class="font-medium">{{ record.projectName }}</div>
      </div>
      <div class="rounded border p-3">
        <div class="text-gray-500">收款时间</div>
        <div class="font-medium">
          {{
            record.paymentTime
              ? formatDateTime(record.paymentTime.toString())
              : ''
          }}
        </div>
      </div>
    </div>

    <!-- 表格数据 -->
    <Table
      :columns="columns"
      :data-source="tableData"
      :pagination="false"
      :scroll="{ x: 1200, scrollToFirstRowOnChange: true }"
      bordered
      style="margin-bottom: 8px"
    />

    <!-- 底部按钮 -->
    <template #footer>
      <div class="flex justify-end">
        <Button type="primary" @click="handleClose">关闭</Button>
      </div>
    </template>
  </Modal>
</template>

<style lang="less" scoped>
// 确保表格单元格不会换行
:deep(.ant-table-cell) {
  padding: 8px;
  vertical-align: middle;
  white-space: nowrap; // 防止文本换行
}

// 确保模态窗口内容可以横向滚动
:deep(.bill-detail-modal) {
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
