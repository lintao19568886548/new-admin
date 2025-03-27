<script lang="ts" setup>
import { computed, reactive, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, DatePicker, Input, Popconfirm, Table } from 'ant-design-vue';
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
  [key: string]: any; // 其他可能的属性
  companyName: string; // 公司名称
  id: number;
  paymentTime: any; // 收款时间
  position: string; // 位置
  projectName: string; // 项目名称
}

/**
 * 表单配置接口
 */
export interface BillFormConfig {
  [key: string]: any; // 支持任意额外属性
  amountLabel?: string; // 金额标签（如"电费金额"或"水费金额"）
  itemsField?: string; // 账单项目字段名（如"electricityItems"或"waterItems"）
  modalClass?: string; // 模态窗口CSS类名
  modalTitle?: string; // 模态窗口标题
  readingLabel?: string; // 读数标签（如"电表数"或"水表数"）
  unitLabel?: string; // 单位标签（如"度"或"吨"）
  usageLabel?: string; // 用量标签（如"度数"或"用水量"）
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
const modalClass = computed(() => 'bill-form-modal max-w-[90%] w-auto');
const unitLabel = computed(() => config.value.unitLabel || '单位');
const usageLabel = computed(() => config.value.usageLabel || '用量');
const readingLabel = computed(() => config.value.readingLabel || '读数');
const amountLabel = computed(() => config.value.amountLabel || '金额');
const itemsField = computed(() => config.value.itemsField || 'items');

// 定义编辑数据类型
interface EditableDataType {
  [key: string]: BillItem;
}

// 修改模态窗口配置，添加取消按钮配置
const [Modal, modalApi] = useVbenModal({
  cancelText: '关闭',
  // 通过class控制弹窗宽度，使用Tailwind宽度类
  class: modalClass.value,
  footer: true,
  onCancel: () => {
    modalApi.close();
  },
  showConfirmButton: false, // 不显示确认按钮，只需要关闭按钮
  title: modalTitle.value,
});

// 关闭模态窗口的方法
function handleClose() {
  modalApi.close();
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

    // 在每次编辑数据变化时实时更新合计行
    updateTotalRowInRealtime();
  },
  { deep: true },
);

// 添加一个新的函数用于编辑过程中实时更新合计行
const updateTotalRowInRealtime = () => {
  // 找出非合计行
  const regularRows = dataSource.value.filter((item) => item.name !== '合计');

  // 获取所有编辑中的行
  const editingRows = Object.keys(editableData).map((key) => editableData[key]);

  // 创建一个临时数组，包含所有常规行的当前值
  const tempRows = [...regularRows];

  // 更新临时数组中对应正在编辑的行的值
  editingRows.forEach((editRow) => {
    if (!editRow) return;

    const index = tempRows.findIndex((row) => row.key === editRow.key);
    if (index !== -1) {
      // 替换为编辑中的值
      tempRows[index] = { ...editRow };
    }
  });

  // 计算合计值
  const totalActualUsage = tempRows.reduce(
    (sum, row) => sum + (Number(row.actualUsage) || 0),
    0,
  );
  const roundedTotalActualUsage = Math.round(totalActualUsage);

  const totalAmount = tempRows.reduce(
    (sum, row) => sum + (Number(row.amount) || 0),
    0,
  );

  // 查找合计行
  const totalRowIndex = dataSource.value.findIndex(
    (item) => item.name === '合计',
  );
  if (
    totalRowIndex !== -1 && // 更新现有合计行
    dataSource.value[totalRowIndex]
  ) {
    dataSource.value[totalRowIndex].actualUsage = roundedTotalActualUsage;
    dataSource.value[totalRowIndex].amount = totalAmount;
  }
};

const onDelete = (key: string) => {
  try {
    // 先检查是否存在该行
    const itemToDelete = dataSource.value.find((item) => item.key === key);
    if (!itemToDelete) {
      console.error('要删除的行不存在:', key);
      return;
    }

    // 过滤掉要删除的行
    dataSource.value = dataSource.value.filter((item) => item.key !== key);

    // 如果需要，可以在这里添加后端API调用
    // await api.deleteElectricityItem(key);

    // 更新合计行
    updateTotalRow();
  } catch (error) {
    console.error('删除行时出错:', error);
    // 可以添加用户提示
    // message.error('删除失败，请重试');
  }
};

// 更新合计行的函数
const updateTotalRow = () => {
  // 找出非合计行
  const regularRows = dataSource.value.filter((item) => item.name !== '合计');

  // 移除当前合计行
  dataSource.value = regularRows;

  // 计算合计值
  const totalActualUsage = regularRows.reduce(
    (sum, row) => sum + (Number(row.actualUsage) || 0),
    0,
  );
  // 合计行的实际度数也四舍五入为整数
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
    id: -1, // 使用特殊ID标识合计行
    key: 'total',
    lastMonthReading: 0,
    monthlyUsage: 0,
    multiplier: 1,
    name: '合计',
    remark: '',
    unitPrice: 0,
  };

  // 将合计行添加到末尾
  dataSource.value.push(updatedTotalRow);
};

// 修改handleAdd函数，添加新行时自动开启编辑模式
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

  // 先移除合计行
  const regularRows = dataSource.value.filter((item) => item.name !== '合计');
  // 添加新行
  regularRows.push(newData);
  // 更新dataSource
  dataSource.value = regularRows;
  // 更新合计行
  updateTotalRow();

  // 添加行后自动开启编辑模式
  setTimeout(() => {
    edit(newData.key);
  }, 0);
};

// 添加一个初始化函数，让所有非合计行自动进入编辑状态
const initEditModeForAllRows = () => {
  // 过滤掉合计行，只对普通行启用编辑模式
  const regularRows = dataSource.value.filter((item) => item.name !== '合计');
  regularRows.forEach((row) => {
    edit(row.key);
  });
};

// 底部保存按钮的处理函数
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

  // 关闭模态窗口
  modalApi.close();
};

// 暴露组件实例的方法和对象
defineExpose({
  close: () => {
    modalApi.close();
    emit('close');
  },
  modalApi,
  open: (data: any) => {
    modalApi.setData(data);
    initData(data);
    modalApi.open();
  },
});
</script>

<template>
  <Modal>
    <!-- 第一行信息：公司名称、项目名称、收款时间 - 始终可编辑 -->
    <div class="mb-4 grid grid-cols-3 gap-4">
      <div class="relative rounded border p-3">
        <div class="text-gray-500">公司名称</div>
        <Input v-model:value="billData.companyName" class="mt-1" />
      </div>
      <div class="relative rounded border p-3">
        <div class="text-gray-500">项目名称</div>
        <Input v-model:value="billData.projectName" class="mt-1" />
      </div>
      <div class="relative rounded border p-3">
        <div class="text-gray-500">收款时间</div>
        <DatePicker v-model:value="billData.paymentTime" class="mt-1" />
      </div>
    </div>

    <!-- 表格数据 -->
    <Table
      :columns="columns"
      :data-source="dataSource"
      :pagination="false"
      :scroll="{ x: 1200, scrollToFirstRowOnChange: true }"
      bordered
      style="margin-bottom: 8px"
    >
      <template #bodyCell="{ column, text, record }">
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
            ].includes(column.dataIndex) &&
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
                    ? (editableData[record.key] as any)[column.dataIndex]
                    : ''
                "
                @update:value="
                  (val) => {
                    if (
                      record.key &&
                      editableData[record.key] &&
                      column.dataIndex
                    ) {
                      (editableData[record.key] as any)[column.dataIndex] = val;
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
        <!-- 显示自动计算字段 -->
        <template
          v-else-if="
            column.dataIndex &&
            ['monthlyUsage', 'actualUsage', 'amount'].includes(column.dataIndex)
          "
        >
          <div>
            <template v-if="record.key && editableData[record.key]">
              <!-- 编辑模式下显示计算结果 -->
              <div v-if="column.dataIndex" class="calculated-cell">
                {{
                  column.dataIndex === 'amount'
                    ? Number(
                        record.key &&
                          editableData[record.key] &&
                          column.dataIndex
                          ? (editableData[record.key] as any)[
                              column.dataIndex
                            ] || 0
                          : 0,
                      ).toFixed(2)
                    : column.dataIndex === 'actualUsage'
                      ? Math.round(
                          record.key &&
                            editableData[record.key] &&
                            column.dataIndex
                            ? (editableData[record.key] as any)[
                                column.dataIndex
                              ] || 0
                            : 0,
                        )
                      : record.key &&
                          editableData[record.key] &&
                          column.dataIndex
                        ? (editableData[record.key] as any)[column.dataIndex]
                        : ''
                }}
              </div>
            </template>
            <template v-else>
              <!-- 非编辑模式显示计算结果 -->
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
        <template v-else-if="column.dataIndex === 'operation'">
          <div class="editable-row-operations">
            <Popconfirm
              v-if="record.name !== '合计'"
              title="确定删除此行?"
              @confirm="onDelete(record.key)"
            >
              <a class="no-select" style="color: #ff4d4f"> 删除 </a>
            </Popconfirm>
          </div>
        </template>
      </template>
    </Table>

    <!-- 底部按钮 -->
    <template #footer>
      <div class="flex w-full items-center justify-between">
        <div>
          <Button type="primary" class="editable-add-btn" @click="handleAdd">
            添加行
          </Button>
        </div>
        <div class="flex gap-2">
          <Button type="primary" @click="handleSave">保存</Button>
          <Button type="primary" @click="handleClose">关闭</Button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<style lang="less" scoped></style>
