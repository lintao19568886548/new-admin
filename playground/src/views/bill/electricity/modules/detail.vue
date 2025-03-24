<script lang="ts" setup>
import type { ElectricityBill, ElectricityItem } from '../data';

import { computed } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import { Button, Table } from 'ant-design-vue';

// 修改模态窗口配置，添加取消按钮配置
const [Modal, modalApi] = useVbenModal({
  cancelText: '关闭',
  // 通过class控制弹窗宽度，使用Tailwind宽度类
  class: 'electricity-bill-detail-modal max-w-[90%] w-auto', // 允许响应式宽度
  footer: true,
  onCancel: () => {
    modalApi.close();
  },
  showConfirmButton: false, // 不显示确认按钮，只需要关闭按钮
  title: '电费账单详情',
});

const record = computed<ElectricityBill>(() => modalApi.getData() || {});

// 获取第一个电费项目的数据
const firstElectricityItem = computed<ElectricityItem>(() => {
  const defaultItem: ElectricityItem = {
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

  if (
    !record.value.electricityItems ||
    record.value.electricityItems.length === 0
  ) {
    return defaultItem;
  }
  return record.value.electricityItems[0] || defaultItem;
});

// 关闭模态窗口的方法
function handleClose() {
  modalApi.close();
}

// 表格列配置
const columns = [
  {
    dataIndex: 'name',
    key: 'name',
    title: '名称',
    width: 150,
  },
  {
    dataIndex: 'lastMonthReading',
    key: 'lastMonthReading',
    title: '上月电表数',
    width: 120,
  },
  {
    dataIndex: 'currentMonthReading',
    key: 'currentMonthReading',
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
    dataIndex: 'actualUsage',
    key: 'actualUsage',
    title: '本月实际度数',
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
    dataIndex: 'remark',
    key: 'remark',
    title: '备注',
    width: 160,
  },
];

// 创建表格数据源
const tableData = computed(() => {
  if (!record.value) return [];

  // 第一行数据计算
  const lastMonthReading1 = firstElectricityItem.value.lastMonthReading || 0;
  const currentMonthReading1 =
    firstElectricityItem.value.currentMonthReading || 0;
  const monthlyUsage1 = currentMonthReading1 - lastMonthReading1;
  const multiplier1 = firstElectricityItem.value.multiplier || 1;
  const actualUsage1 = monthlyUsage1 * multiplier1; // 本月实际度数 = 本月度数 * 倍数
  const unitPrice1 = firstElectricityItem.value.unitPrice || 0;
  const amount1 = actualUsage1 * unitPrice1; // 电费金额 = 本月实际度数 * 单价

  // 第二行示例数据
  const lastMonthReading2 = 2000;
  const currentMonthReading2 = 2400;
  const monthlyUsage2 = currentMonthReading2 - lastMonthReading2;
  const multiplier2 = 1.2;
  const actualUsage2 = monthlyUsage2 * multiplier2; // 本月实际度数 = 本月度数 * 倍数
  const unitPrice2 = 0.6;
  const amount2 = actualUsage2 * unitPrice2; // 电费金额 = 本月实际度数 * 单价

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
      name: firstElectricityItem.value.name || '主楼电费',
      remark: firstElectricityItem.value.remark || '无',
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
      name: '附楼电费',
      remark: '新增区域',
      unitPrice: unitPrice2,
    },
    // 合计行（只计算本月实际度数和电费金额）
    {
      actualUsage: totalActualUsage, // 本月实际度数合计
      amount: totalAmount, // 电费金额合计
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
:deep(.electricity-bill-detail-modal) {
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
