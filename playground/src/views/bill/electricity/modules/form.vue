<script lang="ts" setup>
import type { ElectricityBill, ElectricityItem } from '../data';

import { computed, reactive, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, DatePicker, Input, Popconfirm, Table } from 'ant-design-vue';
import dayjs from 'dayjs';
import { cloneDeep } from 'lodash-es';

// 定义editableData的类型
interface EditableDataType {
  [key: string]: ElectricityItem;
}

// 修改模态窗口配置，添加取消按钮配置
const [Modal, modalApi] = useVbenModal({
  cancelText: '关闭',
  // 通过class控制弹窗宽度，使用Tailwind宽度类
  class: 'electricity-bill-modal max-w-[90%] w-auto', // 允许响应式宽度
  footer: true,
  onCancel: () => {
    modalApi.close();
  },
  showConfirmButton: false, // 不显示确认按钮，只需要关闭按钮
  title: '电费账单详情',
});

// 关闭模态窗口的方法
function handleClose() {
  modalApi.close();
}

// 表格列配置
const columns = [
  {
    dataIndex: 'name' as string,
    key: 'name',
    title: '名称',
    width: 150,
  },
  {
    dataIndex: 'lastMonthReading' as string,
    key: 'lastMonthReading',
    title: '上月电表数',
    width: 120,
  },
  {
    dataIndex: 'currentMonthReading' as string,
    key: 'currentMonthReading',
    title: '本月电表数',
    width: 120,
  },
  {
    dataIndex: 'monthlyUsage' as string,
    key: 'monthlyUsage',
    title: '本月度数',
    width: 100,
  },
  {
    dataIndex: 'multiplier' as string,
    key: 'multiplier',
    title: '倍数',
    width: 80,
  },
  {
    dataIndex: 'actualUsage' as string,
    key: 'actualUsage',
    title: '本月实际度数',
    width: 120,
  },
  {
    dataIndex: 'unitPrice' as string,
    key: 'unitPrice',
    title: '单价(元/度)',
    width: 120,
  },
  {
    dataIndex: 'amount' as string,
    key: 'amount',
    render: (text: any) => (text ? Number.parseFloat(text).toFixed(2) : '0.00'),
    title: '电费金额(元)',
    width: 120,
  },
  {
    dataIndex: 'remark' as string,
    key: 'remark',
    title: '备注',
    width: 160,
  },
  {
    dataIndex: 'operation' as string,
    key: 'operation',
    title: '操作',
    width: 80,
  },
];

const dataSource = ref<ElectricityItem[]>([
  {
    actualUsage: 0, // 本月实际度数
    amount: 0, // 电费金额（元）
    currentMonthReading: 0, // 本月电表数
    id: 0,
    key: '1',
    lastMonthReading: 0, // 上月电表数
    monthlyUsage: 0, // 本月度数
    multiplier: 1, // 倍数
    name: '', // 名称
    remark: '', // 备注
    unitPrice: 0, // 单价元/度
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

const billData = ref<ElectricityBill>({
  companyName: '示例公司一',
  electricityItems: dataSource.value,
  id: 0,
  paymentTime: ref(dayjs()),
  position: '广东',
  projectName: '项目A',
});

const count = computed(() => dataSource.value.length + 1);
const editableData = reactive<EditableDataType>({});

// 修改edit函数，移除Proxy相关代码
const edit = (key: string) => {
  const foundItem = dataSource.value.find((item) => key === item.key);
  if (foundItem) {
    (editableData as Record<string, ElectricityItem>)[key] =
      cloneDeep(foundItem);
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

    // 可能需要重新计算合计行
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
  const updatedTotalRow: ElectricityItem = {
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
    actualUsage: 0, // 本月实际度数
    amount: 0, // 电费金额（元）
    companyName: '', // 公司名称
    currentMonthReading: 0, // 本月电表数
    id: 0,
    key: `${count.value}`,
    lastMonthReading: 0, // 上月电表数
    monthlyUsage: 0, // 本月度数 (将自动计算)
    multiplier: 1, // 倍数
    name: '', // 名称
    paymentTime: '', // 收款时间
    projectName: '', // 项目名称
    remark: '', // 备注
    unitPrice: 0, // 单价元/度
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

// 在组件挂载时初始化编辑状态
setTimeout(() => {
  initEditModeForAllRows();
}, 0);

// 底部保存按钮的处理函数
const handleSave = () => {
  // 实际应用中可能需要调用API保存数据
  // 使用允许的console方法
  console.warn('保存账单数据:', {
    billData: billData.value,
    dataSource: dataSource.value.filter((item) => item.name !== '合计'),
  });

  // 可以在这里添加保存成功的提示或其他逻辑
  // message.success('保存成功');
};
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
            ].includes(column.dataIndex as string) &&
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
            ['monthlyUsage', 'actualUsage', 'amount'].includes(
              column.dataIndex as string,
            )
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

<style lang="less" scoped>
.editable-row-operations a {
  margin-right: 8px;
}

// 修复编辑单元格样式
.editable-cell {
  position: relative;

  .cell-input {
    width: 100%; // 改为100%宽度以适应单元格
    margin: 0; // 移除外边距
    padding: 2px 4px; // 减小内边距
    box-sizing: border-box; // 确保盒模型包含内边距和边框
  }
}

// 确保表格单元格不会因为编辑状态而改变大小
:deep(.ant-table-cell) {
  padding: 8px;
  vertical-align: middle;
  overflow: visible; // 改为visible，允许编辑控件显示
  position: relative; // 添加相对定位
  white-space: nowrap; // 防止文本换行
}

// 编辑状态下的单元格样式
:deep(.ant-table-cell-fix-left),
:deep(.ant-table-cell-fix-right) {
  z-index: 2; // 确保固定列在编辑时不被其他内容覆盖
}

// 限制输入框在单元格内的显示
:deep(.ant-input-number),
:deep(.ant-input) {
  width: 100%;
  max-width: 100%;
}

// 添加计算字段样式
.calculated-cell {
  padding: 5px;
  background-color: #f9f9f9;
  border-radius: 2px;
  color: #1890ff;
}

// 禁止操作栏文本选择
.no-select {
  user-select: none;
  -webkit-user-select: none; /* Safari */
  -moz-user-select: none; /* Firefox */
  -ms-user-select: none; /* IE10+/Edge */
}

// 确保模态窗口内容可以横向滚动
:deep(.electricity-bill-modal) {
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
