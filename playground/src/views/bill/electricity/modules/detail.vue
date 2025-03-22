<script lang="ts" setup>
import type { ElectricityItem } from '../data';

import { computed } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import { Button, Table } from 'ant-design-vue';

// 修改模态窗口配置，添加取消按钮配置
const [Modal, modalApi] = useVbenModal({
  cancelText: '关闭',
  // 通过class控制弹窗宽度，使用Tailwind宽度类
  class: 'w-[1200px]', // 设置宽度为1200px
  footer: true,
  onCancel: () => {
    modalApi.close();
  },
  showConfirmButton: false, // 不显示确认按钮，只需要关闭按钮
  title: '电费账单详情',
});

const record = computed<ElectricityItem>(() => modalApi.getData() || {});

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
  },
  {
    dataIndex: 'lastMonthReading',
    key: 'lastMonthReading',
    title: '上月电表数',
  },
  {
    dataIndex: 'currentMonthReading',
    key: 'currentMonthReading',
    title: '本月电表数',
  },
  {
    dataIndex: 'monthlyUsage',
    key: 'monthlyUsage',
    title: '本月度数',
  },
  {
    dataIndex: 'multiplier',
    key: 'multiplier',
    title: '倍数',
  },
  {
    dataIndex: 'actualUsage',
    key: 'actualUsage',
    title: '本月实际度数',
  },
  {
    dataIndex: 'unitPrice',
    key: 'unitPrice',
    title: '单价(元/度)',
  },
  {
    dataIndex: 'amount',
    key: 'amount',
    render: (text: any) => (text ? Number.parseFloat(text).toFixed(2) : '0.00'),
    title: '电费金额(元)',
  },
  {
    dataIndex: 'remark',
    key: 'remark',
    title: '备注',
  },
];

// 创建表格数据源
const tableData = computed(() => {
  if (!record.value) return [];

  // 第一行数据计算
  const lastMonthReading1 = record.value.lastMonthReading || 0;
  const currentMonthReading1 = record.value.currentMonthReading || 0;
  const monthlyUsage1 = currentMonthReading1 - lastMonthReading1;
  const multiplier1 = record.value.multiplier || 1;
  const actualUsage1 = monthlyUsage1 * multiplier1; // 本月实际度数 = 本月度数 * 倍数
  const unitPrice1 = record.value.unitPrice || 0;
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
      name: record.value.name || '主楼电费',
      remark: record.value.remark || '无',
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
        <div class="font-medium">{{ formatDateTime(record.paymentTime) }}</div>
      </div>
    </div>

    <!-- 表格数据 -->
    <Table :columns="columns" :data-source="tableData" bordered />

    <!-- 底部按钮 -->
    <template #footer>
      <div class="flex justify-end">
        <Button type="primary" @click="handleClose">关闭</Button>
      </div>
    </template>
  </Modal>
</template>
