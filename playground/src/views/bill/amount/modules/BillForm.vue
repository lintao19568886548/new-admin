<script lang="ts" setup>
import type { BaseBillItem } from './BillBaseConfig';

import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  createUniver,
  defaultTheme,
  FUniver,
  LocaleType,
  merge,
  Univer,
} from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/presets/preset-sheets-core';
import UniverPresetSheetsCoreZhCN from '@univerjs/presets/preset-sheets-core/locales/zh-CN';
import { Button, message, Modal } from 'ant-design-vue';

import '@univerjs/presets/lib/styles/preset-sheets-core.css';

interface BillItem extends BaseBillItem {
  [key: string]: any; // 添加索引签名，允许使用字符串索引访问属性
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

// 控制modal显示/隐藏的状态
const visible = ref(false);

const originData = ref();
const dataSource = ref<BillItem[]>([]);

// Univer相关实例
const container = ref<HTMLElement | null>(null);
let univerInstance: Univer;
let univerAPI: FUniver;

// 表格列标题设置
const columns = [
  { field: 'meterName', title: '名称', width: 150 },
  { field: 'previousReading', title: `上月${readingLabel.value}`, width: 100 },
  { field: 'currentReading', title: `本月${readingLabel.value}`, width: 100 },
  { field: 'monthlyUsage', title: `本月${usageLabel.value}`, width: 100 },
  { field: 'multiplier', title: '倍数', width: 70 },
  { field: 'totalUsage', title: `本月实际${usageLabel.value}`, width: 120 },
  { field: 'unitPrice', title: `单价(元/${unitLabel.value})`, width: 120 },
  { field: 'amount', title: `${amountLabel.value}(元)`, width: 120 },
  { field: 'remark', title: '备注', width: 100 },
];

// 定义默认数据模板
const templates = {
  ele: [
    { meterName: '' },
    { meterName: '' },
    { meterName: '' },
    { meterName: '合计' },
  ],
  water: [
    { meterName: '' },
    { meterName: '' },
    { meterName: '' },
    { meterName: '合计' },
  ],
};

// 定义getContainer函数
const getModalContainer = () => document.body;

// 更新表格数据
function updateTableData() {
  if (!univerAPI) {
    console.warn('Univer API not initialized');
    return;
  }

  try {
    const workbook = univerAPI.getActiveWorkbook();
    if (!workbook) {
      console.warn('Workbook not found');
      return;
    }

    const worksheet = workbook.getActiveSheet();
    if (!worksheet) {
      console.warn('Worksheet not found');
      return;
    }

    // 清空现有数据（保留标题行）
    try {
      // 获取使用范围 - 使用getUsedRange的替代方法
      // 通过搜索最后一行来实现
      let lastRow = 1;
      for (let row = 2; row < 1000; row++) {
        const range = worksheet.getRange(`A${row}:A${row}`);
        const value = range.getValues();
        if (!value || !value[0] || !value[0][0]) {
          lastRow = row - 1;
          break;
        }
        if (row === 999) {
          lastRow = 999;
        }
      }

      if (lastRow > 1) {
        // 清除数据（A2到最后一行的所有列）
        worksheet.getRange(`A2:I${lastRow}`).clear();
      }
    } catch (error) {
      console.warn('Error clearing range:', error);
    }

    // 设置新数据
    try {
      if (dataSource.value && dataSource.value.length > 0) {
        // 过滤掉传入数据中已存在的合计行
        const filteredDataSource = dataSource.value.filter(
          (item) => item.meterName !== '合计',
        );

        const rowValues = filteredDataSource.map((item) => {
          return columns.map((col) => {
            const value = item[col.field];
            // 格式化金额显示
            if (col.field === 'amount' && value) {
              return Number.parseFloat(value.toString()).toFixed(2);
            }
            // 格式化用量显示
            if (
              (col.field === 'monthlyUsage' || col.field === 'totalUsage') &&
              value
            ) {
              return Number.parseFloat(value.toString()).toFixed(2);
            }
            return value;
          });
        });

        if (rowValues.length > 0) {
          // 设置单元格值
          const dataRange = worksheet.getRange(`A2:I${1 + rowValues.length}`);
          dataRange.setValues(rowValues);

          // 设置公式和对齐方式 (基于过滤后的数据)
          for (let i = 0; i < filteredDataSource.length; i++) {
            const rowIndex = i + 2; // Univer 行号从 1 开始，数据从第 2 行开始
            try {
              // 设置公式 D=C-B
              worksheet
                .getRange(`D${rowIndex}`)
                .setFormula(`=C${rowIndex}-B${rowIndex}`);

              // 使用 setTimeout 确保后续公式在下一个事件循环中执行
              setTimeout(() => {
                try {
                  if (!univerAPI.getActiveWorkbook()?.getActiveSheet()) return;
                  // 设置公式 F=D*E
                  worksheet
                    .getRange(`F${rowIndex}`)
                    .setFormula(`=D${rowIndex}*E${rowIndex}`);
                  // 设置公式 H=F*G
                  worksheet
                    .getRange(`H${rowIndex}`)
                    .setFormula(`=F${rowIndex}*G${rowIndex}`);
                } catch (error) {
                  console.error('Error setting subsequent formulas:', error);
                }
              }, 0);
            } catch (formulaError) {
              console.warn(
                `Failed to set formula for row ${rowIndex}:`,
                formulaError,
              );
            }
          }

          // 添加合计行 (基于过滤后的数据计算)
          const dataRowCount = filteredDataSource.length;
          if (dataRowCount > 0) {
            const firstDataRow = 2;
            const lastDataRow = firstDataRow + dataRowCount - 1;
            const totalRowIndex = lastDataRow + 1;
            try {
              // 设置"合计"文本
              worksheet.getRange(`A${totalRowIndex}`).setValue('合计');

              // 设置 F 列合计公式
              worksheet
                .getRange(`F${totalRowIndex}`)
                .setFormula(`=SUM(F${firstDataRow}:F${lastDataRow - 1})`);

              // 设置 H 列合计公式
              worksheet
                .getRange(`H${totalRowIndex}`)
                .setFormula(`=SUM(H${firstDataRow}:H${lastDataRow})`);

              // 设置合计行文本加粗
              worksheet.getRange(`A${totalRowIndex}:I${totalRowIndex}`);
            } catch (totalError) {
              console.warn(
                `Failed to set total row formulas/style at row ${totalRowIndex}:`,
                totalError,
              );
            }
          }

          try {
            // 设置数据和合计行居中对齐 (包括公式列)
            const rangeEndRow =
              dataRowCount > 0
                ? 1 + filteredDataSource.length + 1
                : 1 + filteredDataSource.length; // 如果有数据，包含合计行
            const fullDataRange = worksheet.getRange(`A2:I${rangeEndRow}`);
            fullDataRange.setHorizontalAlignment('center');
            fullDataRange.setVerticalAlignment('middle');
          } catch (alignError) {
            console.warn(
              'Failed to set alignment for full data range including total row',
              alignError,
            );
          }

          // 刷新视图 - 尝试使用文档中的方法
          try {
            // 先选择一个单元格，然后再激活工作表，触发视图刷新
            worksheet.getRange('A1').activate();
          } catch (refreshError) {
            console.warn('Failed to refresh worksheet view:', refreshError);
          }
        }
      }
    } catch (error) {
      console.error('Error setting values or formulas:', error);
    }
  } catch (error) {
    console.error('Error updating table data:', error);
  }
}

// 初始化表格标题和设置表头样式
function initTableHeader(worksheet: any) {
  // 初始化表格标题
  const headerValues = columns.map((col) => col.title);
  const headerRange = worksheet.getRange('A1:I1');
  headerRange.setValues([headerValues]);

  // 设置表头样式 - 设置粗体和居中对齐
  try {
    headerRange.setHorizontalAlignment('center');
    headerRange.setVerticalAlignment('middle');
  } catch (error) {
    console.warn('Failed to set header formatting:', error);
  }
}

// 初始化Univer实例
function initUniver() {
  if (!container.value) {
    console.warn('Container element not found');
    return;
  }

  // 清空容器内容，避免之前的实例残留
  try {
    container.value.innerHTML = '';
  } catch (error) {
    console.error('Error clearing container:', error);
  }

  try {
    // 确保之前的实例被正确释放
    if (univerInstance) {
      try {
        univerInstance.dispose();
        univerAPI.dispose();
      } catch (error) {
        console.warn('Error disposing existing Univer instance:', error);
      }
    }

    // 使用延迟初始化，确保DOM已经准备好
    setTimeout(() => {
      try {
        const result = createUniver({
          locale: LocaleType.ZH_CN,
          locales: {
            [LocaleType.ZH_CN]: merge({}, UniverPresetSheetsCoreZhCN),
          },
          presets: [
            UniverSheetsCorePreset({
              container: container.value as HTMLElement,
            }),
          ],
          theme: defaultTheme,
        });

        univerInstance = result.univer;
        univerAPI = result.univerAPI;

        if (!univerAPI) {
          console.error('Failed to initialize Univer API');
          return;
        }

        // 创建工作表
        const workbook = univerAPI.createWorkbook({ name: '账单详情' });
        if (!workbook) {
          console.error('Failed to create workbook');
          return;
        }

        const worksheet = workbook.getActiveSheet();
        if (!worksheet) {
          console.error('Failed to get active sheet');
          return;
        }

        // 初始化表格标题
        initTableHeader(worksheet);

        // 设置列宽
        columns.forEach((col, index) => {
          if (worksheet.setColumnWidth) {
            try {
              worksheet.setColumnWidth(index, col.width);
            } catch (error) {
              console.warn(
                `Failed to set column width for column ${index}:`,
                error,
              );
            }
          }
        });

        // 注册单元格编辑事件
        registerEditEvent();

        // 初始化完成后更新表格数据
        updateTableData();
      } catch (error) {
        console.error('Error in delayed Univer initialization:', error);
      }
    }, 100); // 延迟100ms确保DOM已更新
  } catch (error) {
    console.error('Error initializing Univer:', error);
  }
}

// 初始化数据
function initData(data: any) {
  // 根据数据类型选择模板
  if (
    data?.itemsField === 'eleBills' &&
    (!data?.eleBills || data?.eleBills?.length === 0)
  ) {
    dataSource.value = templates.ele;
    return;
  }
  if (
    data?.itemsField === 'waterBills' &&
    (!data?.waterBills || data?.waterBills?.length === 0)
  ) {
    dataSource.value = templates.water;
    return;
  }
  // 复制账单基础信息
  dataSource.value = {
    ...data, // 保留原始数据中的其他字段
    receiptTime: data.receiptTime || null,
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

  // 更新表格
  nextTick(() => {
    updateTableData();
  });
}

// 保存修改后的数据
function handleSave() {
  try {
    if (!univerAPI) {
      message.error('Univer API 未初始化');
      return;
    }

    const workbook = univerAPI.getActiveWorkbook();
    if (!workbook) {
      message.error('无法获取工作簿');
      return;
    }

    const worksheet = workbook.getActiveSheet();
    if (!worksheet) {
      message.error('无法获取工作表');
      return;
    }

    // 获取工作表中的所有数据（从第二行开始，跳过标题行）
    const lastRow = worksheet.getLastRow();
    if (lastRow < 2) {
      // 如果没有数据行，直接使用原始的 dataSource (如果需要)
      // 或者可以根据业务逻辑清空或传递空数组
      emit('success', []);
      handleClose();
      message.success('保存成功（无数据）');
      return;
    }

    const range = worksheet.getRange(`A2:I${lastRow + 1}`);
    const values = range.getValues(); // 获取二维数组形式的值
    if (!values || values.length === 0) {
      emit('success', []);
      handleClose();
      message.success('保存成功（无数据）');
      return;
    }

    // 将二维数组转换为对象数组
    const updatedData = values
      .map((row) => {
        const rowData: Record<string, any> = {};
        columns.forEach((col, index) => {
          const value = row[index];
          // 根据字段类型进行转换
          if (col.field === 'meterName') {
            rowData[col.field] = String(value || '');
            return;
          }
          rowData[col.field] = [
            'amount',
            'currentReading',
            'monthlyUsage',
            'multiplier',
            'previousReading',
            'totalUsage',
            'unitPrice',
          ].includes(col.field)
            ? Number(value) || 0
            : value;
        });
        return rowData;
      })
      .filter((item) => {
        const meterName = String(item.meterName || '').trim();
        return meterName && meterName !== '合计';
      });

    // 触发成功事件并传递从 Univer 读取并转换后的数据
    emit('success', updatedData);

    // 关闭模态框
    handleClose();

    // 显示成功消息
    message.success('保存成功');
  } catch (error) {
    console.error('保存数据失败:', error);
    message.error(`保存数据失败: ${error}`);
  }
}

// 处理关闭模态框
function handleClose() {
  try {
    // 首先关闭模态框，防止后续操作影响用户体验
    visible.value = false;

    try {
      // 安全地释放Univer实例及相关资源 (立即执行)
      if (univerInstance) {
        try {
          univerInstance.dispose();
        } catch (error) {
          console.warn('Error disposing Univer instance:', error);
        }
      }
      // univerAPI 似乎也需要 dispose，但有时会报错，谨慎处理
      // if (univerAPI) {
      //   try {
      //     univerAPI.dispose();
      //   } catch (error) {
      //     console.warn('Error disposing Univer API:', error);
      //   }
      // }

      // 重置数据
      dataSource.value = [];

      // 触发关闭事件
      emit('close');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  } catch (error) {
    console.error('Error during modal close:', error);
    // 确保即使出错，模态框也能关闭
    visible.value = false;
  }
}

// 打开模态框
async function handleOpen(data: any) {
  try {
    // 首先设置模态框为可见
    visible.value = true;

    // 重置状态 (移除这里的 dispose, 依赖 handleClose 和 onBeforeUnmount)

    // 设置数据
    if (data) {
      initData(data);
    } else {
      dataSource.value = [];
    }

    // 等待DOM更新
    await nextTick();

    // 使用延迟初始化，确保DOM已完全渲染
    setTimeout(() => {
      // 检查Modal是否仍然可见
      if (!visible.value) {
        return;
      }
      try {
        // 初始化Univer表格
        initUniver();
      } catch (error) {
        console.error('Error in delayed initialization:', error);
        message.error('初始化表格失败');
      }
    }, 300);
  } catch (error) {
    console.error('Error opening modal:', error);
    message.error('加载数据失败');
  }
}

// 组件挂载完成后初始化Univer
onMounted(() => {
  // 不在这里初始化，而是在Modal打开时初始化
});

// 组件销毁前释放Univer资源
onBeforeUnmount(() => {
  if (univerInstance) {
    univerInstance.dispose();
    univerAPI.dispose();
  }
});

// 创建一个类似modalApi的接口，保持与原来组件的兼容性
const modalApi = {
  close: handleClose,
  closeModal: () => {
    handleClose();
  },
  getData: () => dataSource.value,
  openModal: (data?: any) => {
    handleOpen(data);
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
    modalApi.openModal(data);
  },
});

function registerEditEvent() {
  if (
    !univerAPI ||
    !univerAPI.addEvent ||
    !univerAPI.Event ||
    !univerAPI.Event.SheetEditEnded
  ) {
    console.warn('Cannot register edit event: API not fully initialized');
    return;
  }

  try {
    univerAPI.addEvent(univerAPI.Event.SheetSkeletonChanged, (params: any) => {
      if (params?.payload?.id === 'sheet.mutation.insert-row') {
        console.warn(params);
        try {
          // 从事件参数中提取信息
          const startRow = params.payload.params.range.startRow;
          const endRow = params.payload.params.range.endRow;
          // 检查并为新行添加公式
          const worksheet = univerAPI.getActiveWorkbook()?.getActiveSheet();

          if (worksheet) {
            for (let i = startRow; i <= endRow; i++) {
              const rowIndex = i + 1; // Univer 行号从1开始
              const meterNameRange = worksheet.getRange(`A${rowIndex}`);
              const meterName = meterNameRange.getValue();
              // 如果不是合计行，则添加公式
              if (meterName !== '合计') {
                try {
                  // 使用 setTimeout 确保后续公式在下一个事件循环中执行
                  setTimeout(() => {
                    try {
                      if (!univerAPI.getActiveWorkbook()?.getActiveSheet())
                        return;
                      // 设置公式 D=C-B
                      worksheet
                        .getRange(`D${rowIndex}`)
                        .setFormula(`=C${rowIndex}-B${rowIndex}`);
                      // 设置公式 F=D*E
                      worksheet
                        .getRange(`F${rowIndex}`)
                        .setFormula(`=D${rowIndex}*E${rowIndex}`);
                      // 设置公式 H=F*G
                      worksheet
                        .getRange(`H${rowIndex}`)
                        .setFormula(`=F${rowIndex}*G${rowIndex}`);
                    } catch (error) {
                      console.error(
                        `Error setting subsequent formulas for row ${rowIndex}:`,
                        error,
                      );
                    }
                  });
                } catch (formulaError) {
                  console.warn(
                    `Failed to set formula for row ${rowIndex}:`,
                    formulaError,
                  );
                }
              }
            }
            setTimeout(() => {
              // 设置 F 列合计公式
              worksheet
                .getRange(`F${endRow + 2}`)
                .setFormula(`=SUM(F2:F${endRow})`);

              // 设置 H 列合计公式
              worksheet
                .getRange(`H${endRow + 2}`)
                .setFormula(`=SUM(H2:H${endRow + 1})`);
            });
          }
        } catch (error) {
          console.error('Error handling sheet edit event:', error);
        }
      }
    });
  } catch (error) {
    console.error('Error adding sheet edit event listener:', error);
  }
}
</script>

<template>
  <Modal
    :body-style="{ maxHeight: '80vh', overflow: 'auto' }"
    :title="modalTitle"
    :open="visible"
    :width="1500"
    :mask-closable="false"
    :get-container="getModalContainer"
    :z-index="2000"
    :destroy-on-close="true"
    @cancel="handleClose"
  >
    <Page>
      <div
        ref="container"
        class="univer-container"
        style="width: 100%; height: 60vh"
      ></div>
    </Page>
    <template #footer>
      <div class="flex w-full items-center justify-end">
        <div class="flex gap-2">
          <Button type="primary" @click="handleSave">保存</Button>
          <Button @click="handleClose">关闭</Button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<style lang="less">
/* 全局样式，确保Univer元素显示在Modal之上 */
.univer-overlay,
.univer-popup,
.univer-dropdown,
.univer-menu,
.univer-contextmenu,
.univer-tooltip,
.univer-float-wrapper,
[class*='univer-'] {
  z-index: 2000 !important;
}

/* Univer容器样式 */
.univer-container {
  position: relative;
  z-index: 1001;
}
</style>
