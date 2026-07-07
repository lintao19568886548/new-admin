<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { AmountBill } from '../data';

import { computed, h, nextTick, reactive, ref, shallowRef, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import {
  Alert,
  Modal as AntModal,
  Button,
  DatePicker,
  Input,
  message,
  Skeleton,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  checkAmountBillDuplicate,
  createAmountBill,
  getAmountBillDetail,
  updateAmountBill,
} from '#/api/bill';

import { getAmountBillProjectPeriodError } from '../project-period';
import {
  AMOUNT_BILL_AI_SPLIT_MODE_LABEL,
  checkAmountBillReconciliation,
  checkAmountBillRiskWarnings,
} from '../risk-control';

/**
 * 多页账单表单配置接口
 */
export interface MultipageBillFormConfig {
  [key: string]: any;
  modalClass?: string;
  modalTitle?: string;
}

// 组件属性定义
const props = defineProps<{
  config?: MultipageBillFormConfig;
  parkOptions?: any[];
  tenantOptions?: any[];
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success', data: any): void;
}>();

const isSheetReady = ref(false);
const sheetRenderKey = ref(0);
const univerSheetComponent = shallowRef();

const receiptTimeStr = ref<string>('');
const receiptTimeDayjs = ref<Dayjs | null>(null);
const aiImportReview = ref(false);
const aiReviewBills = ref<AmountBill[]>([]);
const activeAiReviewIndex = ref(0);

// 提取配置值
const config = computed<MultipageBillFormConfig>(() => props.config || {});

const univerSheet = ref<null | {
  dispose: () => void;
  getData: () => Partial<AmountBill>;
  setReceiptTime: (value: null | string) => void;
}>(null);

function isMobileViewport() {
  return window.innerWidth < 768;
}

async function ensureUniverSheetReady() {
  if (!univerSheetComponent.value) {
    const [module] = await Promise.all([
      import('./UniverSheet.vue'),
      import('@univerjs/presets/lib/styles/preset-sheets-core.css'),
    ]);
    univerSheetComponent.value = module.default;
  }
}

// 模态窗口参数
const modalProps = ref({
  class:
    config.value.modalClass ||
    'multipage-bill-form-modal max-w-[90%] w-[1000px]',
  closeOnClickModal: false,
  closeOnPressEscape: false,
  footer: true,
  onClosed: _handleClose,
  showCancelButton: true,
  showConfirmButton: false,
  title: config.value.modalTitle || '账单详情',
});

function shouldKeepCurrentMonthValuesForNextMonth(
  item: Record<string, { originalText: string; value: any }>,
) {
  const meterName = String(
    item.meterName?.originalText ?? item.meterName?.value ?? '',
  );
  return ['公共', '公摊', '电梯用电'].some((keyword) =>
    meterName.includes(keyword),
  );
}

/**
 * 转换水电费项目为下个月的数据格式
 * @param itemsJson - 包含项目数组的JSON字符串
 * @returns 转换后并重新序列化为JSON的字符串
 */
function transformItemsForNextMonth(itemsJson: string | undefined): string {
  if (!itemsJson) {
    return '[]';
  }
  try {
    const items = JSON.parse(itemsJson) as Record<
      string,
      { originalText: string; value: any }
    >[];

    if (!items || items.length === 0) {
      return '[]';
    }
    const newItems = items.map((item) => {
      if (shouldKeepCurrentMonthValuesForNextMonth(item)) {
        return { ...item };
      }

      // 只保留生成新账单所需的基础数据，并重置计算值
      const newItem: Record<string, any> = {
        meterName: item.meterName,
        multiplier: item.multiplier,
        unitPrice: item.unitPrice,
      };

      const prevReading = item.previousReading;
      const currentReading = item.currentReading;

      // 将本月读数赋值给上月读数
      newItem.previousReading = {
        ...prevReading,
        originalText: String(currentReading?.value || 0),
        value: currentReading?.value || 0,
      };
      // 本月读数清零
      newItem.currentReading = {
        ...currentReading,
        originalText: '0',
        value: 0,
      };
      return newItem;
    });
    return JSON.stringify(newItems);
  } catch (error) {
    console.error('Failed to parse or transform items for next month:', error);
    return '[]';
  }
}

function syncReceiptTime(dateStr: null | string) {
  const d = dateStr ? dayjs(dateStr) : null;
  const formatted = d?.isValid() ? d.format('YYYY-MM-DD') : null;
  receiptTimeStr.value = formatted || '';
  receiptTimeDayjs.value = formatted ? dayjs(formatted) : null;
  univerSheet.value?.setReceiptTime(formatted);
}

function onReceiptTextBlur() {
  syncReceiptTime(receiptTimeStr.value.trim() || null);
}

function onReceiptTextChange(e: Event) {
  // allow-clear fires a change event with empty value; blur doesn't fire for clear button
  if (
    (e.target as HTMLInputElement | null)?.value === '' &&
    !receiptTimeStr.value
  ) {
    syncReceiptTime(null);
  }
}

function onReceiptDatePickerChange(date: Dayjs | null | string) {
  const d = typeof date === 'string' ? dayjs(date) : date;
  syncReceiptTime(d?.isValid() ? d.format('YYYY-MM-DD') : null);
}

function onSyncToday() {
  syncReceiptTime(dayjs().format('YYYY-MM-DD'));
}

watch(isSheetReady, (ready) => {
  if (ready) {
    const rt = billData.receiptTime;
    const d = rt ? dayjs(rt) : null;
    receiptTimeStr.value = d?.isValid() ? d.format('YYYY-MM-DD') : '';
    receiptTimeDayjs.value = d?.isValid() ? d : null;
  } else {
    receiptTimeStr.value = '';
    receiptTimeDayjs.value = null;
  }
});

// 关闭处理函数
function _handleClose() {
  delete billData.billId;
  receiptTimeStr.value = '';
  receiptTimeDayjs.value = null;
  aiImportReview.value = false;
  aiReviewBills.value = [];
  activeAiReviewIndex.value = 0;
  univerSheet.value?.dispose();
  modalApi.close();
  emit('close');
}

// 创建模态窗口
const [Modal, modalApi] = useVbenModal(modalProps.value);

// 账单数据
const billData = reactive<AmountBill>({
  eleFee: 0,
  factoryRent: 0,
  garbageFee: 0,
  invoiceTax: 0,
  managementFee: 0,
  serviceFee: 0,
  totalFee: 0,
  waterFee: 0,
});

interface MultipageBillOpenOptions {
  aiImportReview?: boolean;
  aiReviewBills?: AmountBill[];
  isNextMonth?: boolean;
}

const activeAiReviewBill = computed(() => {
  return aiReviewBills.value[activeAiReviewIndex.value];
});
const reconciliationResult = computed(() =>
  checkAmountBillReconciliation(billData),
);
const riskWarnings = computed(() => checkAmountBillRiskWarnings(billData));
const aiImportParkStatus = computed(() => {
  if (!aiImportReview.value) {
    return null;
  }

  return billData.parkId
    ? {
        message: '园区已匹配',
        status: 'success' as const,
      }
    : {
        message: '园区未匹配，请在表格顶部“园区”单元格选择正确园区',
        status: 'error' as const,
      };
});
const aiImportAuditIssues = computed(() => {
  if (!aiImportReview.value) {
    return [];
  }

  return [
    ...(aiImportParkStatus.value?.status === 'error'
      ? [
          {
            message: aiImportParkStatus.value.message,
            severity: 'error' as const,
          },
        ]
      : []),
    ...reconciliationResult.value.issues.map((issue) => ({
      message: issue.message,
      severity: issue.severity,
    })),
    ...riskWarnings.value.map((issue) => ({
      message: issue.message,
      severity: issue.severity,
    })),
  ];
});

function getParkName(parkId?: number) {
  if (!parkId) return '';
  const park = props.parkOptions?.find(
    (item) => Number(item.parkId) === parkId,
  );
  return String(park?.parkName || '');
}

function getAiReviewBillTitle(bill: AmountBill, index: number) {
  return (
    getParkName(bill.parkId) ||
    bill.projectName ||
    bill.tenantName ||
    `园区账单 ${index + 1}`
  );
}

function formatReviewAmount(value?: number | string) {
  const amount = Number(value || 0);
  return `${(Number.isFinite(amount) ? amount : 0).toFixed(2)} 元`;
}

function resetBillData(data: AmountBill) {
  Object.keys(billData).forEach((key) => {
    delete (billData as any)[key];
  });
  Object.assign(billData, {
    ...data,
    receiptTime: data.receiptTime || undefined,
  });
}

function syncActiveReviewBillFromSheet() {
  if (!aiImportReview.value) return;
  const currentBill = aiReviewBills.value[activeAiReviewIndex.value];
  if (!currentBill) return;
  const univerData = univerSheet.value?.getData();
  if (univerData) {
    Object.assign(currentBill, billData, univerData);
    Object.assign(billData, univerData);
  }
}

function confirmAiReviewSave() {
  return new Promise<boolean>((resolve) => {
    AntModal.confirm({
      cancelText: '返回核对',
      centered: true,
      content:
        'AI 导入结果可能存在识别误差。请确认已手动核对园区、租户、项目、金额、水电明细和收款信息后再保存。',
      okText: '已核对，确认保存',
      onCancel: () => resolve(false),
      onOk: () => resolve(true),
      title: '请先手动核对账单',
    });
  });
}

function normalizeReceiptFields(data: Partial<AmountBill>) {
  const receiptAmount = Number(data.receiptAmount) || 0;

  if (!Number.isFinite(receiptAmount) || receiptAmount < 0) {
    throw new Error('收款金额不能为负数');
  }

  if (receiptAmount === 0) {
    return {
      receiptAmount: 0,
      receiptTime: null,
    };
  }

  if (!data.receiptTime) {
    throw new Error('已填写收款金额时，必须填写收款时间');
  }

  return {
    receiptAmount,
    receiptTime: data.receiptTime,
  };
}

function validateBillFields(
  data: Partial<AmountBill>,
  options: { aiImport?: boolean } = {},
) {
  if (!String(data.projectName || '').trim()) {
    throw new Error('项目名称不能为空');
  }
  const projectPeriodError = getAmountBillProjectPeriodError(data.projectName);
  if (projectPeriodError) {
    throw new Error(projectPeriodError);
  }

  if (!data.tenantId && !String(data.tenantName || '').trim()) {
    throw new Error('租户不能为空');
  }

  const totalFee = Number(data.totalFee || 0);
  if (!Number.isFinite(totalFee) || totalFee <= 0) {
    throw new Error('本月收费金额必须大于0');
  }

  if (options.aiImport && !data.parkId) {
    throw new Error('AI导入账单园区不能为空，请选择园区后再保存');
  }
}

function buildAmountBillSaveData(
  data: Partial<AmountBill>,
  options: { aiImport?: boolean } = {},
) {
  validateBillFields(data, options);
  const receiptFields = normalizeReceiptFields(data);

  return {
    eleBills: data.eleBills,
    eleFee: Number(data.eleFee) || 0,
    eleItem: data.eleItem,
    extraProjectItem: data.extraProjectItem,
    factoryRent: Number(data.factoryRent) || 0,
    garbageFee: Number(data.garbageFee) || 0,
    invoiceTax: Number(data.invoiceTax) || 0,
    managementFee: Number(data.managementFee) || 0,
    parkId: data.parkId,
    penaltyFee: Number(data.penaltyFee) || 0,
    privateBankAccount: data.privateBankAccount,
    projectName: data.projectName,
    publicBankAccount: data.publicBankAccount,
    receiptAmount: receiptFields.receiptAmount,
    receiptTime: receiptFields.receiptTime,
    remark: data.remark,
    serviceFee: Number(data.serviceFee) || 0,
    tenantId: data.tenantId,
    tenantName: data.tenantName,
    totalFee: Number(data.totalFee) || 0,
    waterBills: data.waterBills,
    waterFee: Number(data.waterFee) || 0,
    waterItem: data.waterItem,
    ...(options.aiImport ? { source: 'ai-import' } : {}),
  };
}

function confirmWarning(messageText: string) {
  return new Promise<boolean>((resolve) => {
    AntModal.confirm({
      cancelText: '返回核对',
      content: () =>
        messageText.split('\n').map((line) => h('div', { key: line }, line)),
      okText: '继续保存',
      onCancel: () => resolve(false),
      onOk: () => resolve(true),
      title: '账单风险提醒',
    });
  });
}

function getBillRiskWarnings(data: Partial<AmountBill>) {
  return [
    ...checkAmountBillReconciliation(data).warnings,
    ...checkAmountBillRiskWarnings(data),
  ];
}

async function ensureDuplicateCheckPassed(
  data: Partial<AmountBill>,
  saveData: Record<string, unknown>,
) {
  if (data.billId || !saveData.parkId) {
    return true;
  }

  let result: any;
  try {
    result = await checkAmountBillDuplicate({
      billId: data.billId,
      parkId: saveData.parkId,
      projectName: saveData.projectName,
      tenantId: saveData.tenantId,
      tenantName: saveData.tenantName,
      totalFee: saveData.totalFee,
    });
  } catch (error) {
    message.error(
      error instanceof Error ? error.message : '重复账单检查失败，请重试',
    );
    return false;
  }

  if (result?.hasExactDuplicate) {
    message.error('疑似重复账单：园区、租户、项目和金额完全一致，已禁止保存');
    return false;
  }

  if (result?.hasSimilarDuplicate) {
    return await confirmWarning(
      '存在同园区、同租户、同项目的历史账单，请确认是否继续新增。',
    );
  }

  return true;
}

async function ensureBillRisksConfirmed(data: Partial<AmountBill>) {
  const warnings = getBillRiskWarnings(data);
  if (warnings.length === 0) {
    return true;
  }

  return await confirmWarning(
    warnings.map((issue) => `- ${issue.message}`).join('\n'),
  );
}

async function saveSingleBill(data: AmountBill) {
  const saveData = buildAmountBillSaveData(data);
  if (!(await ensureDuplicateCheckPassed(data, saveData))) {
    return null;
  }

  if (!(await ensureBillRisksConfirmed(data))) {
    return null;
  }

  await (data.billId
    ? updateAmountBill(data.billId, saveData)
    : createAmountBill(saveData));
  return saveData;
}

async function handleAiReviewSave() {
  syncActiveReviewBillFromSheet();
  const reviewBills =
    aiReviewBills.value.length > 0 ? aiReviewBills.value : [{ ...billData }];
  const saveItems = [];

  for (const [index, bill] of reviewBills.entries()) {
    try {
      const reconciliation = checkAmountBillReconciliation(bill);
      if (reconciliation.errors.length > 0) {
        const title = getAiReviewBillTitle(bill, index);
        await switchAiReviewBill(index);
        message.error(
          `${title}：${reconciliation.errors[0]?.message || '金额勾稽失败'}`,
        );
        return;
      }

      saveItems.push({
        bill,
        saveData: buildAmountBillSaveData(bill, { aiImport: true }),
      });
    } catch (error) {
      const title = getAiReviewBillTitle(bill, index);
      await switchAiReviewBill(index);
      message.warning(
        `${title}：${error instanceof Error ? error.message : '请检查账单信息'}`,
      );
      return;
    }
  }

  for (const [index, item] of saveItems.entries()) {
    if (!(await ensureDuplicateCheckPassed(item.bill, item.saveData))) {
      await switchAiReviewBill(index);
      return;
    }
  }

  const confirmed = await confirmAiReviewSave();
  if (!confirmed) {
    return;
  }

  const warningMessages = saveItems.flatMap((item, index) => {
    const title = getAiReviewBillTitle(item.bill, index);
    return getBillRiskWarnings(item.bill).map(
      (issue) => `${title}：${issue.message}`,
    );
  });
  if (
    warningMessages.length > 0 &&
    !(await confirmWarning(
      warningMessages.map((item) => `- ${item}`).join('\n'),
    ))
  ) {
    return;
  }

  try {
    for (const item of saveItems) {
      await (item.bill.billId
        ? updateAmountBill(item.bill.billId, item.saveData)
        : createAmountBill(item.saveData));
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败，请重试');
    return;
  }

  emit('success', {
    savedCount: saveItems.length,
    savedItems: saveItems.map((item) => item.saveData),
  });
  _handleClose();
}

// 保存总表单
async function handleSave() {
  // 从Univer表格中提取水电费明细数据
  const univerData = univerSheet.value?.getData();
  if (univerData) {
    Object.assign(billData, univerData);
  } else {
    message.warning('无法获取账单数据，请重试');
    return;
  }

  if (aiImportReview.value) {
    await handleAiReviewSave();
    return;
  }

  // 提交数据
  try {
    const saveData = await saveSingleBill(billData);
    if (!saveData) {
      return;
    }
    emit('success', { ...saveData });
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败，请重试');
    return;
  }
  _handleClose();
}

async function switchAiReviewBill(index: number) {
  if (index === activeAiReviewIndex.value || !aiReviewBills.value[index]) {
    return;
  }

  syncActiveReviewBillFromSheet();
  activeAiReviewIndex.value = index;
  univerSheet.value?.dispose();
  isSheetReady.value = false;
  resetBillData(aiReviewBills.value[index]);
  sheetRenderKey.value += 1;
  await nextTick();
  isSheetReady.value = true;
}

async function open(data: AmountBill, options?: MultipageBillOpenOptions) {
  if (isMobileViewport()) {
    message.warning('手机端请使用移动端账单编辑入口');
    return;
  }
  modalApi.open();
  isSheetReady.value = false;
  sheetRenderKey.value += 1;
  aiImportReview.value = Boolean(options?.aiImportReview);
  aiReviewBills.value =
    options?.aiImportReview && Array.isArray(options.aiReviewBills)
      ? options.aiReviewBills.map((bill) => ({ ...bill }))
      : [];
  activeAiReviewIndex.value = 0;
  await ensureUniverSheetReady();
  // 重置数据
  if (data.billId) {
    const detail = await getAmountBillDetail(data.billId);

    if (options?.isNextMonth) {
      // 生成下月账单
      detail.eleItem = transformItemsForNextMonth(detail.eleItem);
      detail.waterItem = transformItemsForNextMonth(detail.waterItem);
      // 清理ID和特定字段，为新账单做准备
      delete detail.billId;
      detail.receiptAmount = 0;
      detail.receiptTime = undefined;
      detail.penaltyFee = 0;
      detail.remark = '';
    }

    resetBillData(detail);
  } else {
    resetBillData(aiReviewBills.value[0] || data);
  }
  isSheetReady.value = true;
}
defineExpose({ open });
</script>

<template>
  <Modal>
    <div class="bill-items-container">
      <h3 class="mb-4 text-lg font-medium">
        {{ aiImportReview ? 'AI导入账单核对' : '账单详情' }}
      </h3>
      <div v-if="aiImportReview" class="ai-review-panel">
        <div class="ai-review-header">
          <div>
            <div class="ai-review-title">AI导入结果</div>
            <div class="ai-review-desc">
              已按{{ AMOUNT_BILL_AI_SPLIT_MODE_LABEL }}拆出
              {{ aiReviewBills.length }} 份账单，请逐一核对后保存
            </div>
          </div>
          <div class="ai-review-count">
            {{ activeAiReviewIndex + 1 }} / {{ aiReviewBills.length }}
          </div>
        </div>
        <div class="ai-review-list">
          <button
            v-for="(bill, index) in aiReviewBills"
            :key="index"
            type="button"
            class="ai-review-item"
            :class="{ 'is-active': index === activeAiReviewIndex }"
            @click="switchAiReviewBill(index)"
          >
            <span class="ai-review-item-title">
              {{ getAiReviewBillTitle(bill, index) }}
            </span>
            <span class="ai-review-item-meta">
              {{ bill.tenantName || '未识别租户' }} ·
              {{ bill.projectName || '未识别项目' }}
            </span>
            <span class="ai-review-item-amount">
              {{ formatReviewAmount(bill.totalFee) }}
            </span>
          </button>
        </div>
        <div v-if="activeAiReviewBill" class="ai-review-current">
          当前核对：{{
            getAiReviewBillTitle(activeAiReviewBill, activeAiReviewIndex)
          }}
        </div>
        <div class="ai-audit-panel">
          <div class="ai-audit-header">
            <div class="ai-audit-title">
              当前账单审核
              <Tag color="blue">{{ AMOUNT_BILL_AI_SPLIT_MODE_LABEL }}</Tag>
            </div>
            <Tag
              :color="
                reconciliationResult.status === 'error'
                  ? 'red'
                  : reconciliationResult.status === 'warning'
                    ? 'orange'
                    : 'green'
              "
            >
              {{
                reconciliationResult.status === 'error'
                  ? '勾稽错误'
                  : reconciliationResult.status === 'warning'
                    ? '勾稽提醒'
                    : '勾稽通过'
              }}
            </Tag>
          </div>
          <div class="ai-audit-tags">
            <Tag
              :color="aiImportParkStatus?.status === 'error' ? 'red' : 'green'"
            >
              {{ aiImportParkStatus?.message }}
            </Tag>
            <Tag>租户：{{ billData.tenantName || '未识别' }}</Tag>
            <Tag>项目：{{ billData.projectName || '未识别' }}</Tag>
          </div>
          <Alert
            v-if="aiImportAuditIssues.length > 0"
            :type="
              aiImportAuditIssues.some((issue) => issue.severity === 'error')
                ? 'error'
                : 'warning'
            "
            show-icon
          >
            <template #message>
              <div class="ai-audit-issue-list">
                <div
                  v-for="issue in aiImportAuditIssues"
                  :key="issue.message"
                  class="ai-audit-issue"
                >
                  {{ issue.message }}
                </div>
              </div>
            </template>
          </Alert>
        </div>
      </div>
      <div class="receipt-time-bar mb-3 flex items-center gap-2">
        <span class="shrink-0 text-sm font-medium">收款时间：</span>
        <Input
          v-model:value="receiptTimeStr"
          allow-clear
          placeholder="手动输入（如 2025-06-01）"
          style="width: 175px"
          @blur="onReceiptTextBlur"
          @change="onReceiptTextChange"
          @press-enter="onReceiptTextBlur"
        />
        <DatePicker
          :value="receiptTimeDayjs || undefined"
          format="YYYY-MM-DD"
          placeholder="选择日期"
          style="width: 150px"
          @change="onReceiptDatePickerChange"
        />
        <Button @click="onSyncToday">同步今日</Button>
      </div>

      <div v-if="!isSheetReady" class="sheet-loading-placeholder">
        <Skeleton active :paragraph="{ rows: 10 }" />
      </div>
      <component
        :is="univerSheetComponent"
        v-if="isSheetReady"
        :key="sheetRenderKey"
        ref="univerSheet"
        :bill-data="billData"
        :park-options="props.parkOptions"
        :tenant-options="props.tenantOptions"
      />
    </div>

    <template #footer>
      <div class="footer-buttons">
        <Button @click="_handleClose">取消</Button>
        <Button type="primary" @click="handleSave">保存</Button>
      </div>
    </template>
  </Modal>
</template>

<style lang="less" scoped>
.bill-items-container {
  padding: 10px 20px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  background-color: #fafafa;
}

.sheet-loading-placeholder {
  width: 100%;
  height: 60vh;
  padding: 20px;
}

.ai-review-panel {
  padding: 12px;
  margin-bottom: 12px;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
}

.ai-review-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.ai-review-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.ai-review-desc {
  margin-top: 2px;
  font-size: 13px;
  color: #6b7280;
}

.ai-review-count {
  flex-shrink: 0;
  padding: 2px 8px;
  font-size: 13px;
  font-weight: 600;
  color: #1677ff;
  background: #e6f4ff;
  border-radius: 4px;
}

.ai-review-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
}

.ai-review-item {
  display: grid;
  gap: 4px;
  min-height: 86px;
  padding: 10px;
  text-align: left;
  cursor: pointer;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.ai-review-item:hover,
.ai-review-item.is-active {
  border-color: #1677ff;
}

.ai-review-item.is-active {
  background: #f0f7ff;
}

.ai-review-item-title {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-review-item-meta {
  overflow: hidden;
  font-size: 12px;
  color: #6b7280;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-review-item-amount {
  font-size: 13px;
  font-weight: 600;
  color: #b45309;
}

.ai-review-current {
  margin-top: 10px;
  font-size: 13px;
  color: #374151;
}

.ai-audit-panel {
  padding: 10px 12px;
  margin-top: 10px;
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 6px;
}

.ai-audit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.ai-audit-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}

.ai-audit-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.ai-audit-issue-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-audit-issue {
  line-height: 1.45;
}

// 底部按钮样式
.footer-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}
</style>
