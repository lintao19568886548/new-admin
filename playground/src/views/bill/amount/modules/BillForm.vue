<script lang="ts" setup>
import type { BaseBillItem } from './BillBaseConfig';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { computed, nextTick, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Modal } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';

interface BillItem extends BaseBillItem {
  _id?: number;
  _isAmountEdited?: boolean;
  _isMonthlyUsageEdited?: boolean;
  _isTotalUsageEdited?: boolean;
  _X_ROW_KEY?: string;
}

/**
 * 表单配置接口
 */
export interface BillFormConfig {
  [key: string]: any;
  amountLabel?: string;
  itemsField?: string;
  modalClass?: string;
  modalTitle?: string;
  readingLabel?: string;
  unitLabel?: string;
  usageLabel?: string;
}

// 组件属性定义
const props = defineProps<{
  config?: BillFormConfig;
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success', data: any): void;
}>();

// 提取配置值
const config = computed<BillFormConfig>(() => props.config || {});

// 设置默认值
const modalTitle = computed(() => config.value.modalTitle || '账单详情');
const unitLabel = computed(() => config.value.unitLabel || '单位');
const usageLabel = computed(() => config.value.usageLabel || '用量');
const readingLabel = computed(() => config.value.readingLabel || '读数');
const amountLabel = computed(() => config.value.amountLabel || '金额');
const itemsField = computed(() => config.value.itemsField || 'items');

// 控制modal显示/隐藏的状态
const visible = ref(false);

const originData = ref();

const numEditRender = reactive({
  events: {
    blur: () => {
      setTimeout(() => {
        enableDarg.value = true;
      }, 50);
    },
    change: ({ column, row }: any) => {
      switch (column.field) {
        case 'amount': {
          row._isAmountEdited = true;

          break;
        }
        case 'monthlyUsage': {
          row._isMonthlyUsageEdited = true;

          break;
        }
        case 'totalUsage': {
          row._isTotalUsageEdited = true;

          break;
        }
        // No default
      }
      updateCalculatedFields(row);
    },
    focus: () => {
      enableDarg.value = false;
    },
  },
  immediate: true,
  name: 'input',
});

const strEditRender = reactive({
  events: {
    blur: () => {
      setTimeout(() => {
        enableDarg.value = true;
      }, 50);
    },
    change: ({ row }: any) => {
      dataSource.value[row._id] = row;
    },
    focus: () => {
      enableDarg.value = false;
    },
  },
  immediate: true,
  name: 'input',
});

const enableDarg = ref(true);

// 表格列配置
const columns = [
  {
    editRender: strEditRender,
    field: 'meterName',
    minWidth: 150,
    title: '名称',
  },
  {
    editRender: numEditRender,
    field: 'previousReading',
    minWidth: 100,
    title: `上月${readingLabel.value}`,
  },
  {
    editRender: numEditRender,
    field: 'currentReading',
    minWidth: 100,
    title: `本月${readingLabel.value}`,
  },
  {
    editRender: numEditRender,
    field: 'monthlyUsage',
    minWidth: 100,
    title: `本月${usageLabel.value}`,
  },
  {
    editRender: numEditRender,
    field: 'multiplier',
    minWidth: 70,
    title: '倍数',
  },
  {
    editRender: numEditRender,
    field: 'totalUsage',
    minWidth: 120,
    title: `本月实际${usageLabel.value}`,
  },
  {
    editRender: numEditRender,
    field: 'unitPrice',
    minWidth: 120,
    title: `单价(元/${unitLabel.value})`,
  },
  {
    editRender: numEditRender,
    field: 'amount',
    formatter: ({ cellValue }: any) =>
      cellValue ? Number.parseFloat(cellValue).toFixed(2) : '    ',
    minWidth: 120,
    title: `${amountLabel.value}(元)`,
  },
  {
    editRender: strEditRender,
    field: 'remark',
    minWidth: 100,
    title: '备注',
  },
];

const dataSource = ref<BillItem[]>([]);
// 定义默认数据模板
const templates = {
  ele: [
    { meterName: '尖' },
    { meterName: '峰' },
    { meterName: '平' },
    { meterName: '谷' },
    { meterName: '办公室用电' },
    { meterName: '宿舍热水电表' },
    { meterName: '宿舍用电' },
    { meterName: '公共用电' },
    { meterName: '' },
    { meterName: '' },
    { meterName: '合计' },
  ],
  water: [
    { meterName: '厂房用水' },
    { meterName: '办公室用水' },
    { meterName: '宿舍用水（冷水）' },
    { meterName: '宿舍用水（热水）' },
    { meterName: '公共用水' },
    { meterName: '' },
    { meterName: '' },
    { meterName: '' },
    { meterName: '合计' },
  ],
};

// 初始化数据
function initData(data: any) {
  // 根据数据类型选择模板
  if (data?.eleBills?.length === 0) {
    dataSource.value = templates.ele;
    return;
  }
  if (data?.waterBills?.length === 0) {
    dataSource.value = templates.water;
    return;
  }
  // 复制账单基础信息
  dataSource.value = {
    receiptTime: data.receiptTime || ref(dayjs()),
    ...data, // 保留原始数据中的其他字段
  };

  // 获取账单项目数据 - 自动检测字段名
  let items: any[] = [];
  if (data.eleBills && Array.isArray(data.eleBills)) {
    items = data.eleBills;
  } else if (data.waterBills && Array.isArray(data.waterBills)) {
    items = data.waterBills;
  } else if (data.items && Array.isArray(data.items)) {
    items = data.items;
  } else {
    items = [];
  }
  if (items.length > 0) {
    dataSource.value = [...items];
    originData.value = [...items];
  }
}

// 更新计算字段的函数
function updateCalculatedFields(row: any) {
  // 确保不是在合计行上进行计算
  if (row.meterName === '合计') {
    return;
  }

  // 强制转换为数字类型
  const prevReading = Number(row.previousReading) || 0;
  const currReading = Number(row.currentReading) || 0;
  const multiplier = Number(row.multiplier) || 1; // 默认为1
  const unitPriceVal = Number(row.unitPrice) || 0;
  // 确保数据类型一致性
  row.previousReading = prevReading;
  row.currentReading = currReading;
  row.multiplier = multiplier;
  row.unitPrice = unitPriceVal;

  // 检查是否是通过编辑 monthlyUsage 字段触发的更新
  const isMonthlyUsageEdited = row._isMonthlyUsageEdited;
  // 检查是否是通过编辑 totalUsage 字段触发的更新
  const isTotalUsageEdited = row._isTotalUsageEdited;
  // 检查是否是通过编辑 amount 字段触发的更新
  const isAmountEdited = row._isAmountEdited;

  // 如果用户没有手动编辑 monthlyUsage，则根据读数计算
  if (isMonthlyUsageEdited) {
    // 用户手动编辑了 monthlyUsage，保留用户输入的值
    row.monthlyUsage = Number(row.monthlyUsage) || 0;
  } else {
    // 计算月用量: 本月读数 - 上月读数
    const monthlyUsageVal = currReading - prevReading;
    row.monthlyUsage = Number.parseFloat(monthlyUsageVal.toFixed(2));
  }

  // 处理 totalUsage 字段
  if (isTotalUsageEdited) {
    // 用户手动编辑了 totalUsage，保留用户输入的值
    row.totalUsage = Number(row.totalUsage) || 0;
  } else {
    // 计算总用量: 月用量 * 倍数
    const totalUsageVal = row.monthlyUsage * multiplier;
    row.totalUsage = Number.parseFloat(totalUsageVal.toFixed(2));
  }

  // 处理 amount 字段
  if (isAmountEdited) {
    // 用户手动编辑了 amount，保留用户输入的值
    row.amount = Number(row.amount) || 0;
  } else {
    // 计算金额: 总用量 * 单价
    const amountVal = row.totalUsage * unitPriceVal;
    row.amount = Number.parseFloat(amountVal.toFixed(2));
  }

  dataSource.value[row._id] = row;
  // 更新合计行并刷新表格
  updateTotalRow();
}

// 添加新行
const handleAdd = () => {
  const newData: any = {
    meterName: '',
  };

  // 只有在数据源中存在billId时才添加此属性
  if (dataSource.value?.[0]?.billId) {
    newData.billId = dataSource.value[0].billId;
  }

  dataSource.value.splice(-1, 0, newData);
  refreshGrid();
};

// 保存按钮的处理函数
const handleSave = () => {
  // 不再过滤掉合计行，保留所有行
  const regularItems = dataSource.value
    .filter((item) => item.meterName !== '')
    .map((item) => {
      // 创建一个新对象，排除不需要发送到后端的字段
      const {
        _id,
        _isAmountEdited,
        _isMonthlyUsageEdited,
        _isTotalUsageEdited,
        _X_ROW_KEY,
        ...rest
      } = item;

      // 确保数值字段为数字类型
      const regularItem = {
        ...rest,
        amount: Number(rest.amount) || 0,
        currentReading: Number(rest.currentReading) || 0,
        monthlyUsage: Number(rest.monthlyUsage) || 0,
        multiplier: Number(rest.multiplier) || 1,
        previousReading: Number(rest.previousReading) || 0,
        totalUsage: Number(rest.totalUsage) || 0,
        unitPrice: Number(rest.unitPrice) || 0,
      };

      return regularItem;
    });

  // 准备保存的数据
  const saveData = {
    [`${itemsField.value}Bills`]: regularItems,
  };

  // 使用nextTick确保DOM更新完成后再关闭
  // nextTick(() => { // Removed nextTick
  // 触发成功事件，将数据传递回父组件
  emit('success', saveData);
  handleClose();
  // }); // Removed nextTick
};

// 关闭模态窗口的方法
function handleClose() {
  visible.value = false;
  // 延迟刷新表格，避免闪烁
  emit('close');
}

// 更新合计行的函数 - 优化实现
function updateTotalRow() {
  // 找出非合计行
  const regularRows = dataSource.value.filter(
    (item) => item.meterName !== '合计' && item.meterName !== '',
  );

  // 使用for循环计算totalUsage，排除包含"公共"的行
  let totalUsage = 0;
  for (const row of regularRows) {
    if (row.meterName && row.meterName.includes('公共')) {
      continue;
    }
    totalUsage += Number(row.totalUsage) || 0;
  }

  const roundedTotalUsage = Number(totalUsage.toFixed(2));

  // 使用for循环计算总金额
  let totalAmount = 0;
  for (const row of regularRows) {
    totalAmount += Number(row.amount) || 0;
  }
  const roundedTotalAmount = Number(totalAmount.toFixed(2));

  // 查找现有的合计行
  dataSource.value.forEach((item) => {
    if (item.meterName === '合计') {
      item.amount = roundedTotalAmount;
      item.totalUsage = roundedTotalUsage;
    }
  });
  refreshGrid();
}

// 创建一个类似modalApi的接口，保持与原来组件的兼容性
const modalApi = {
  close: handleClose,
  getData: () => dataSource.value,
  open: () => {
    visible.value = true;
  },
  setData: (data: any) => {
    initData(data);
  },
};

// 暴露组件实例的方法和对象
defineExpose({
  close: handleClose,
  modalApi,
  open: (data: any) => {
    modalApi.setData(data);
    refreshGrid();
    visible.value = true;
  },
});

/**
 * 刷新表格
 */
function refreshGrid() {
  if (!gridApi.grid.commitProxy) {
    return;
  }
  gridApi.query();
}

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    // 添加缓存配置，减少重渲染
    border: true,
    columns,
    editConfig: {
      mode: 'cell',
      trigger: 'click',
    },
    height: window.innerHeight * 0.6,
    keepSource: true,

    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        query: async () => {
          // 为数据源添加有序ID
          return dataSource.value.map((item, index) => {
            return {
              ...item,
              _id: index,
            };
          });
        },
      },
    },
    rowConfig: {
      drag: true,
      isHover: true,
    },
    // 优化行拖拽配置
    rowDragConfig: {
      // 添加拖拽结束方法
      dragEndMethod: ({ newRow, oldRow }) => {
        const result = gridApi.grid.getData();
        const element = result.splice(oldRow._id, 1)[0];

        result.splice(newRow._id, 0, element);

        // 使用nextTick确保DOM更新完成后再刷新表格
        nextTick(() => {
          // Removed nextTick
          // 更新数据源
          dataSource.value = result;
          // 延迟更新合计行和刷新表格，避免闪烁
          setTimeout(() => {
            refreshGrid();
          }, 10);
        }); // Removed nextTick

        return true;
      },
      dragStartMethod: ({ row }) => {
        if (row.meterName === '合计') {
          return false;
        }
        return enableDarg.value;
      },
      showGuidesStatus: true,
      trigger: 'row',
    },
    showOverflow: true,
  } as VxeTableGridOptions,
});
</script>

<template>
  <Modal
    :body-style="{ maxHeight: '80vh', overflow: 'auto' }"
    :title="modalTitle"
    :open="visible"
    :width="1500"
    :mask-closable="false"
    @cancel="handleClose"
  >
    <Page>
      <Grid />
    </Page>
    <template #footer>
      <div class="flex w-full items-center justify-between">
        <Button type="primary" class="editable-add-btn" @click="handleAdd">
          添加行
        </Button>
        <div class="flex gap-2">
          <Button type="primary" @click="handleSave">保存</Button>
          <Button @click="handleClose">关闭</Button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<style lang="less" scoped></style>
