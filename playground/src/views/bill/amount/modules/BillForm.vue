<script lang="ts" setup>
import type { BaseBillItem } from './BillBaseConfig';

import { computed, reactive, ref, watch } from 'vue';

import { Button, Input, Modal, Popconfirm, Table } from 'ant-design-vue';
import dayjs from 'dayjs';
import { cloneDeep } from 'lodash-es';

interface BillItem extends BaseBillItem {
  _isAmountEdited?: boolean;
  _isMonthlyUsageEdited?: boolean;
  _isTotalUsageEdited?: boolean;
  _key: string;
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

// 定义编辑数据类型
interface EditableDataType {
  [key: string]: BillItem;
}

// 添加一个用于生成唯一ID的函数
const generateUniqueId = (() => {
  let id = 0;
  return () => `row-${++id}`;
})();

// 关闭模态窗口的方法
function handleClose() {
  visible.value = false;
  emit('close');
}

// 表格列配置
const columns = computed(() => [
  {
    dataIndex: 'meterName',
    key: 'meterName',
    title: '名称',
    width: 150,
  },
  {
    dataIndex: 'previousReading',
    key: 'previousReading',
    title: `上月${readingLabel.value}`,
    width: 100,
  },
  {
    dataIndex: 'currentReading',
    key: 'currentReading',
    title: `本月${readingLabel.value}`,
    width: 100,
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
    width: 70,
  },
  {
    dataIndex: 'totalUsage',
    key: 'totalUsage',
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
    width: 120,
  },
  {
    dataIndex: 'operation',
    key: 'operation',
    title: '操作',
    width: 80,
  },
]);

const dataSource = ref<BillItem[]>([
  {
    _key: generateUniqueId(),
    amount: 0,
    currentReading: 0,
    meterName: '',
    monthlyUsage: 0,
    multiplier: 1,
    previousReading: 0,
    receiptTime: '',
    remark: '',
    totalUsage: 0,
    unitPrice: 0,
  },
  // 添加默认的合计行
  {
    _key: 'total-row',
    amount: 0,
    currentReading: 0,
    meterName: '合计',
    monthlyUsage: 0,
    multiplier: 1,
    previousReading: 0,
    receiptTime: '',
    remark: '',
    totalUsage: 0,
    unitPrice: 0,
  },
]);

// 初始化数据
function initData(data: any) {
  if (!data) return;

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
    // 使用提供的项目数据
    const regularItems = items.map((item: any) => ({
      ...item,
      _key: item.key || generateUniqueId(),
    }));

    dataSource.value = [...regularItems];
    // 初始计算合计
    updateTotalRow();
  } else {
    // 如果没有项目数据，则使用默认的空行和合计行
    dataSource.value = [
      {
        _key: generateUniqueId(),
        amount: 0,
        currentReading: 0,
        meterName: '',
        monthlyUsage: 0,
        multiplier: 1,
        previousReading: 0,
        receiptTime: '',
        remark: '',
        totalUsage: 0,
        unitPrice: 0,
      },
      {
        _key: 'total-row',
        amount: 0,
        currentReading: 0,
        meterName: '合计',
        monthlyUsage: 0,
        multiplier: 1,
        previousReading: 0,
        receiptTime: '',
        remark: '',
        totalUsage: 0,
        unitPrice: 0,
      },
    ];
  }

  // 初始化编辑模式
  setTimeout(() => {
    initEditModeForAllRows();
  }, 0);
}

const editableData = reactive<EditableDataType>({});

// 修改edit函数，移除Proxy相关代码
const edit = (key: string) => {
  const foundItem = dataSource.value.find((item) => key === item._key);
  if (foundItem) {
    editableData[key] = cloneDeep(foundItem);
    // 初始化编辑标记
    editableData[key]._isMonthlyUsageEdited = false;
    editableData[key]._isTotalUsageEdited = false;
    editableData[key]._isAmountEdited = false;
  }
};

// 添加对编辑数据的监听;
watch(
  editableData,
  () => {
    // 遍历所有正在编辑的行
    Object.keys(editableData).forEach((key) => {
      const editingRow = editableData[key];
      if (!editingRow) return;

      // 将输入的值转换为数字
      const previousReading = Number(editingRow.previousReading) || 0;
      const currentReading = Number(editingRow.currentReading) || 0;
      const multiplier = Number(editingRow.multiplier) || 1;
      const unitPrice = Number(editingRow.unitPrice) || 0;
      const manualMonthlyUsage = Number(editingRow.monthlyUsage) || 0;
      const manualTotalUsage = Number(editingRow.totalUsage) || 0;

      // 根据输入情况自动计算相关字段
      // 1. 如果修改了上月读数或本月读数，自动计算本月度数(除非本月度数已手动修改)
      if (
        !editingRow._isMonthlyUsageEdited &&
        (previousReading > 0 || currentReading > 0)
      ) {
        editingRow.monthlyUsage = Number(
          (currentReading - previousReading).toFixed(2),
        );
      }

      // 2. 如果修改了本月度数或倍数，自动计算本月实际度数(除非本月实际度数已手动修改)
      if (!editingRow._isTotalUsageEdited) {
        editingRow.totalUsage = Number(
          (manualMonthlyUsage * multiplier).toFixed(2),
        );
      }

      // 3. 如果修改了本月实际度数或单价，自动计算金额(除非金额已手动修改)
      if (!editingRow._isAmountEdited) {
        editingRow.amount = Number((manualTotalUsage * unitPrice).toFixed(2));
      }

      // 自动保存到数据源
      const target = dataSource.value.find((item) => key === item._key);
      if (target) {
        Object.assign(target, editingRow);
      }
    });

    // 更新合计行
    updateTotalRow();
  },
  { deep: true },
);

const onDelete = (key: string) => {
  dataSource.value = dataSource.value.filter((item) => item._key !== key);
  updateTotalRow();
};

// 更新合计行的函数
const updateTotalRow = () => {
  // 找出非合计行
  const regularRows = dataSource.value.filter(
    (item) => item.meterName !== '合计',
  );

  // 使用for循环计算totalUsage，排除包含"公共"的行
  let totalUsage = 0;
  for (const row of regularRows) {
    // 如果行名称包含"公共"，不计入totalUsage合计
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
  const existingTotalRow = dataSource.value.find(
    (item) => item.meterName === '合计',
  );

  if (existingTotalRow) {
    // 如果存在合计行，只更新需要计算的值，保留其他属性
    existingTotalRow.amount = roundedTotalAmount;
    existingTotalRow.totalUsage = roundedTotalUsage;

    // 确保更新后的数据源包含更新后的合计行
    dataSource.value = [...regularRows, existingTotalRow];
  } else {
    // 如果不存在合计行，创建一个新的
    const newTotalRow: BillItem = {
      _key: 'total-row',
      amount: roundedTotalAmount,
      currentReading: 0,
      meterName: '合计',
      monthlyUsage: 0,
      multiplier: 1,
      previousReading: 0,
      receiptTime: '',
      remark: '',
      totalUsage: roundedTotalUsage,
      unitPrice: 0,
    };

    // 添加新的合计行
    dataSource.value = [...regularRows, newTotalRow];
  }
};

// 添加新行
const handleAdd = () => {
  const newData: any = {
    _key: generateUniqueId(),
    amount: 0,
    currentReading: 0,
    meterName: '',
    monthlyUsage: 0,
    multiplier: 1,
    previousReading: 0,
    receiptTime: '',
    remark: '',
    totalUsage: 0,
    unitPrice: 0,
  };

  // 只有在数据源中存在billId时才添加此属性
  if (dataSource.value?.[0]?.billId) {
    newData.billId = dataSource.value[0].billId;
  }

  // 添加新行并更新合计
  const regularRows = dataSource.value.filter(
    (item) => item.meterName !== '合计',
  );
  regularRows.push(newData);
  dataSource.value = regularRows;
  updateTotalRow();

  // 添加行后自动开启编辑模式
  setTimeout(() => {
    edit(newData._key);
  }, 0);
};

// 让所有非合计行自动进入编辑状态
const initEditModeForAllRows = () => {
  dataSource.value
    .filter((item) => item.meterName !== '合计')
    .forEach((row) => {
      edit(row._key);
    });
};

// 保存按钮的处理函数
const handleSave = () => {
  // 不再过滤掉合计行，保留所有行
  const regularItems = dataSource.value
    // .filter((item) => item.meterName !== '合计')  // 移除此行，不再过滤合计行
    .map((item) => {
      // 创建一个新对象，排除不需要发送到后端的字段
      const {
        _isAmountEdited,
        _isMonthlyUsageEdited,
        _isTotalUsageEdited,
        _key,
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
  // 触发成功事件，将数据传递回父组件
  emit('success', saveData);
  handleClose();
};

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
    visible.value = true;
  },
});
</script>

<template>
  <Modal
    :body-style="{ maxHeight: '80vh', overflow: 'auto' }"
    :title="modalTitle"
    :open="visible"
    :width="1500"
    @cancel="handleClose"
  >
    <Table
      :columns="columns"
      :data-source="dataSource"
      :pagination="false"
      :scroll="{ x: 1200, scrollToFirstRowOnChange: true }"
      bordered
      style="margin-bottom: 8px"
    >
      <template #bodyCell="{ column, text, record }">
        <!-- 可编辑字段 - 仅显示非合计行可编辑 -->
        <template
          v-if="
            column.dataIndex &&
            [
              'meterName',
              'previousReading',
              'currentReading',
              'multiplier',
              'unitPrice',
              'remark',
              'monthlyUsage',
              'totalUsage',
              'amount',
            ].includes(String(column.dataIndex)) &&
            record.meterName !== '合计'
          "
        >
          <div class="editable-cell">
            <div
              v-if="record._key && editableData[record._key]"
              style="width: 100%"
            >
              <Input
                v-if="column.dataIndex"
                :value="
                  record._key && editableData[record._key] && column.dataIndex
                    ? column.dataIndex === 'amount' ||
                      column.dataIndex === 'monthlyUsage'
                      ? Number(
                          (editableData[record._key] as any)[
                            String(column.dataIndex)
                          ] || 0,
                        )
                      : (editableData[record._key] as any)[
                          String(column.dataIndex)
                        ]
                    : ''
                "
                @update:value="
                  (val) => {
                    if (
                      record._key &&
                      editableData[record._key] &&
                      column.dataIndex
                    ) {
                      // 更新标记状态
                      const key = record._key;
                      const field = String(column.dataIndex);

                      // 设置编辑标记
                      if (field === 'monthlyUsage') {
                        (editableData[key] as any)._isMonthlyUsageEdited = true;
                      } else if (field === 'totalUsage') {
                        (editableData[key] as any)._isTotalUsageEdited = true;
                      } else if (field === 'amount') {
                        (editableData[key] as any)._isAmountEdited = true;
                      }

                      // 更新值
                      (editableData[key] as any)[field] = [
                        'amount',
                        'totalUsage',
                        'monthlyUsage',
                      ].includes(field)
                        ? Number(val)
                        : val;
                    }
                  }
                "
                class="cell-input"
              />
            </div>
            <template v-else>
              {{
                column.dataIndex === 'amount' ||
                column.dataIndex === 'monthlyUsage' ||
                column.dataIndex === 'totalUsage'
                  ? text
                    ? Number.parseFloat(text).toFixed(2)
                    : '0.00'
                  : text
              }}
            </template>
          </div>
        </template>

        <!-- 合计行的显示 -->
        <template v-else-if="column.dataIndex && record.meterName === '合计'">
          <template
            v-if="
              ['meterName', 'totalUsage', 'amount'].includes(
                String(column.dataIndex),
              )
            "
          >
            <Input
              :value="
                column.dataIndex === 'amount' ||
                column.dataIndex === 'totalUsage'
                  ? text
                    ? Number.parseFloat(text).toFixed(2)
                    : '0.00'
                  : text
              "
              class="calculated-cell"
            />
          </template>
          <!-- 其他列显示为空 -->
          <template v-else>
            <div></div>
          </template>
        </template>

        <!-- 操作列 -->
        <template v-else-if="column.dataIndex === 'operation'">
          <div class="editable-row-operations">
            <Popconfirm
              v-if="record.meterName !== '合计'"
              title="确定删除此行?"
              @confirm="onDelete(record._key)"
            >
              <a class="no-select" style="color: #ff4d4f">删除</a>
            </Popconfirm>
          </div>
        </template>
      </template>
    </Table>

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

<style lang="less" scoped>
.bill-form-modal {
  min-width: 800px !important;
}

/* Ant Design表格样式增强 */
:deep(.ant-table-wrapper) {
  overflow-x: auto !important;
}

:deep(.ant-table-body) {
  overflow-x: auto !important;

  &::-webkit-scrollbar {
    height: 8px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: #d9d9d9;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-track {
    background-color: #f1f1f1;
  }
}

/* 编辑单元格样式 */
.editable-cell {
  position: relative;

  .cell-input {
    width: 100%;
  }
}

.calculated-cell {
  padding: 5px 8px;
  border-radius: 4px;
  width: 100%;

  // 禁用状态下的文本颜色保持黑色
  &:disabled {
    color: rgba(0, 0, 0, 0.85) !important;
  }

  // 移除禁用状态下的背景颜色变化
  &.ant-input-disabled {
    background-color: #f9f9f9 !important;
    cursor: default;
  }
}
</style>
