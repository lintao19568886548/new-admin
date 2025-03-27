<script lang="ts" setup>
import { computed, reactive, ref, watch } from 'vue';

import { Button, Input, Modal, Popconfirm, Table } from 'ant-design-vue';
import dayjs from 'dayjs';
import { cloneDeep } from 'lodash-es';

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
  [key: string]: any;
  companyName: string;
  id: number;
  paymentTime: any;
  position: string;
  projectName: string;
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

// 关闭模态窗口的方法
function handleClose() {
  visible.value = false;
  emit('close');
}

// 表格列配置
const columns = computed(() => [
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
  {
    dataIndex: 'operation',
    key: 'operation',
    title: '操作',
    width: 80,
  },
]);

const dataSource = ref<BillItem[]>([
  {
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
  },
  // 添加默认的合计行
  {
    actualUsage: 0,
    amount: 0,
    currentMonthReading: 0,
    id: 1,
    key: 'total',
    lastMonthReading: 0,
    monthlyUsage: 0,
    multiplier: 1,
    name: '合计',
    remark: '',
    unitPrice: 0,
  },
]);

const billData = ref<Bill>({
  companyName: '',
  id: 0,
  paymentTime: ref(dayjs()),
  position: '',
  projectName: '',
});

// 初始化数据
function initData(data: any) {
  if (!data) return;

  // 复制账单基础信息
  billData.value = {
    companyName: data.companyName || '',
    id: data.id || 0,
    paymentTime: data.paymentTime || ref(dayjs()),
    position: data.position || '',
    projectName: data.projectName || '',
    ...data, // 保留原始数据中的其他字段
  };

  // 获取账单项目数据
  const items: any[] = data[itemsField.value] || [];

  if (items.length > 0) {
    // 使用提供的项目数据
    const regularItems = items.map((item: any, index: number) => ({
      ...item,
      key: item.key || String(index + 1),
    }));

    // 添加合计行
    const totalRow: BillItem = {
      actualUsage: 0,
      amount: 0,
      currentMonthReading: 0,
      id: -1,
      key: 'total',
      lastMonthReading: 0,
      monthlyUsage: 0,
      multiplier: 1,
      name: '合计',
      remark: '',
      unitPrice: 0,
    };

    dataSource.value = [...regularItems, totalRow];
    // 初始计算合计
    updateTotalRow();
  }

  // 初始化编辑模式
  setTimeout(() => {
    initEditModeForAllRows();
  }, 0);
}

const count = computed(() => dataSource.value.length + 1);
const editableData = reactive<EditableDataType>({});

// 修改edit函数，移除Proxy相关代码
const edit = (key: string) => {
  const foundItem = dataSource.value.find((item) => key === item.key);
  if (foundItem) {
    editableData[key] = cloneDeep(foundItem);
  }
};

// 添加对编辑数据的监听
watch(
  editableData,
  () => {
    // 遍历所有正在编辑的行
    Object.keys(editableData).forEach((key) => {
      const editingRow = editableData[key];
      if (!editingRow) return;

      // 计算本月度数
      const lastMonthReading = Number(editingRow.lastMonthReading) || 0;
      const currentMonthReading = Number(editingRow.currentMonthReading) || 0;
      editingRow.monthlyUsage = currentMonthReading - lastMonthReading;

      // 计算本月实际度数，四舍五入为整数
      const multiplier = Number(editingRow.multiplier) || 1;
      editingRow.actualUsage = Math.round(editingRow.monthlyUsage * multiplier);

      // 计算电费金额
      const unitPrice = Number(editingRow.unitPrice) || 0;
      editingRow.amount = editingRow.actualUsage * unitPrice;

      // 自动保存到数据源
      const target = dataSource.value.find((item) => key === item.key);
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
  dataSource.value = dataSource.value.filter((item) => item.key !== key);
  updateTotalRow();
};

// 更新合计行的函数
const updateTotalRow = () => {
  // 找出非合计行
  const regularRows = dataSource.value.filter((item) => item.name !== '合计');

  // 计算合计值
  const totalActualUsage = regularRows.reduce(
    (sum, row) => sum + (Number(row.actualUsage) || 0),
    0,
  );
  const roundedTotalActualUsage = Math.round(totalActualUsage);

  const totalAmount = regularRows.reduce(
    (sum, row) => sum + (Number(row.amount) || 0),
    0,
  );

  // 创建新的合计行
  const updatedTotalRow: BillItem = {
    actualUsage: roundedTotalActualUsage,
    amount: totalAmount,
    currentMonthReading: 0,
    id: -1,
    key: 'total',
    lastMonthReading: 0,
    monthlyUsage: 0,
    multiplier: 1,
    name: '合计',
    remark: '',
    unitPrice: 0,
  };

  // 更新数据源，移除原合计行，添加新合计行
  dataSource.value = [...regularRows, updatedTotalRow];
};

// 添加新行
const handleAdd = () => {
  const newData = {
    actualUsage: 0,
    amount: 0,
    currentMonthReading: 0,
    id: 0,
    key: `${count.value}`,
    lastMonthReading: 0,
    monthlyUsage: 0,
    multiplier: 1,
    name: '',
    remark: '',
    unitPrice: 0,
  };

  // 添加新行并更新合计
  const regularRows = dataSource.value.filter((item) => item.name !== '合计');
  regularRows.push(newData);
  dataSource.value = regularRows;
  updateTotalRow();

  // 添加行后自动开启编辑模式
  setTimeout(() => {
    edit(newData.key);
  }, 0);
};

// 让所有非合计行自动进入编辑状态
const initEditModeForAllRows = () => {
  dataSource.value
    .filter((item) => item.name !== '合计')
    .forEach((row) => {
      edit(row.key);
    });
};

// 保存按钮的处理函数
const handleSave = () => {
  // 过滤掉合计行
  const regularItems = dataSource.value.filter((item) => item.name !== '合计');

  // 准备保存的数据
  const saveData = {
    ...billData.value,
    [itemsField.value]: regularItems,
  };

  // 触发成功事件，将数据传递回父组件
  emit('success', saveData);
  handleClose();
};

// 创建一个类似modalApi的接口，保持与原来组件的兼容性
const modalApi = {
  close: handleClose,
  getData: () => billData.value,
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
    style="margin-top: 100px"
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
        <!-- 可编辑字段 -->
        <template
          v-if="
            column.dataIndex &&
            [
              'name',
              'lastMonthReading',
              'currentMonthReading',
              'multiplier',
              'unitPrice',
              'remark',
            ].includes(String(column.dataIndex)) &&
            record.name !== '合计'
          "
        >
          <div class="editable-cell">
            <div
              v-if="record.key && editableData[record.key]"
              style="width: 100%"
            >
              <Input
                v-if="column.dataIndex"
                :value="
                  record.key && editableData[record.key] && column.dataIndex
                    ? (editableData[record.key] as any)[
                        String(column.dataIndex)
                      ]
                    : ''
                "
                @update:value="
                  (val) => {
                    if (
                      record.key &&
                      editableData[record.key] &&
                      column.dataIndex
                    ) {
                      (editableData[record.key] as any)[
                        String(column.dataIndex)
                      ] = val;
                    }
                  }
                "
                class="cell-input"
              />
            </div>
            <template v-else>
              {{ text }}
            </template>
          </div>
        </template>

        <!-- 自动计算字段 -->
        <template
          v-else-if="
            column.dataIndex &&
            ['monthlyUsage', 'actualUsage', 'amount'].includes(
              String(column.dataIndex),
            )
          "
        >
          <div>
            <template v-if="record.key && editableData[record.key]">
              <div v-if="column.dataIndex" class="calculated-cell">
                {{
                  column.dataIndex === 'amount'
                    ? Number(
                        record.key &&
                          editableData[record.key] &&
                          column.dataIndex
                          ? (editableData[record.key] as any)[
                              String(column.dataIndex)
                            ] || 0
                          : 0,
                      ).toFixed(2)
                    : column.dataIndex === 'actualUsage'
                      ? Math.round(
                          record.key &&
                            editableData[record.key] &&
                            column.dataIndex
                            ? (editableData[record.key] as any)[
                                String(column.dataIndex)
                              ] || 0
                            : 0,
                        )
                      : record.key &&
                          editableData[record.key] &&
                          column.dataIndex
                        ? (editableData[record.key] as any)[
                            String(column.dataIndex)
                          ]
                        : ''
                }}
              </div>
            </template>
            <template v-else>
              {{
                column.dataIndex === 'amount'
                  ? text
                    ? Number.parseFloat(text).toFixed(2)
                    : '0.00'
                  : column.dataIndex === 'actualUsage'
                    ? Math.round(text || 0)
                    : text
              }}
            </template>
          </div>
        </template>

        <!-- 操作列 -->
        <template v-else-if="column.dataIndex === 'operation'">
          <div class="editable-row-operations">
            <Popconfirm
              v-if="record.name !== '合计'"
              title="确定删除此行?"
              @confirm="onDelete(record.key)"
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
  background-color: #f9f9f9;
  border-radius: 4px;
}
</style>
