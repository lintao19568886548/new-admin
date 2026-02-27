<script lang="ts" setup>
import type { AmountBill } from '../data';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import { Divider, message, Spin } from 'ant-design-vue';

import { getAmountBillDetail } from '#/api/bill';
import { $t } from '#/locales';

const billData = ref<AmountBill | null>(null);
const loading = ref(false);

const [Modal, modalApi] = useVbenModal({
  closable: true, // Replace maskClosable with closable
  draggable: false,
  footer: false, // 详情页面通常不需要底部操作按钮
  onOpenChange: async (isOpen) => {
    if (isOpen) {
      billData.value = null; // Clear previous data
      const data = modalApi.getData<AmountBill>();
      if (data && data.billId) {
        loading.value = true;
        try {
          const detail = await getAmountBillDetail(data.billId); // 假设存在此API
          billData.value = detail; // 假设API返回完整详情
        } catch (error) {
          console.error('获取账单详情失败:', error);
          message.error($t('ui.actionMessage.loadFailed', ['账单详情']));
        } finally {
          loading.value = false;
        }
      } else {
        message.warn('未提供账单ID，无法加载详情。');
      }
    } else {
      billData.value = null; // 关闭时清空数据
    }
  },
  // width: '95%', // Removed invalid property
});

const getModalTitle = computed(() => {
  return (
    $t('page.bill.amount.detail', '账单详情') +
    (billData.value?.tenantName ? ` - ${billData.value.tenantName}` : '')
  );
});

// 暴露 open 方法给父组件调用
function open(data: AmountBill) {
  modalApi.setData(data);
  modalApi.open();
}

defineExpose({ open });

// Helper to render fee with currency
const formatFee = (value?: number | string) => {
  if (!value) return '0.00 元';
  const num = Number(value);
  return Number.isNaN(num) ? '0.00 元' : `${num.toFixed(2)} 元`;
};
</script>

<template>
  <Modal
    :title="getModalTitle"
    :body-style="{ padding: '16px' }"
    wrap-class-name="mobile-detail-modal-wrap"
  >
    <Spin :spinning="loading">
      <div v-if="billData" class="bill-detail-content space-y-3">
        <h3 class="mb-4 text-center text-lg font-semibold">基本信息</h3>
        <div class="grid grid-cols-1 gap-2 text-sm">
          <p>
            <span class="font-medium">租户名称:</span> {{ billData.tenantName }}
          </p>
          <p v-if="billData.projectName">
            <span class="font-medium">项目名称:</span>
            {{ billData.projectName }}
          </p>
          <p v-if="billData.receiptTime">
            <!-- Re-add v-if here -->
            <span class="font-medium">收款时间:</span>
            {{ formatDateTime(billData.receiptTime) }}
          </p>
          <p>
            <span class="font-medium">备注:</span> {{ billData.remark || '无' }}
          </p>
        </div>

        <Divider orientation="left">费用合计</Divider>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <p>
            <span class="font-medium">电费合计:</span>
            {{ formatFee(billData.eleFee) }}
          </p>
          <p>
            <span class="font-medium">水费合计:</span>
            {{ formatFee(billData.waterFee) }}
          </p>
          <p>
            <span class="font-medium">厂房租金:</span>
            {{ formatFee(billData.factoryRent) }}
          </p>
          <p>
            <span class="font-medium">基本管理费:</span>
            {{ formatFee(billData.managementFee) }}
          </p>
          <p>
            <span class="font-medium">垃圾管理费:</span>
            {{ formatFee(billData.garbageFee) }}
          </p>
          <p>
            <span class="font-medium">服务费:</span>
            {{ formatFee(billData.serviceFee) }}
          </p>
          <p>
            <span class="font-medium">开票税金:</span>
            {{ formatFee(billData.invoiceTax) }}
          </p>
          <p>
            <span class="text-base font-medium text-red-500">总费用:</span>
            <span class="text-base font-bold text-red-500">{{
              formatFee(billData.totalFee)
            }}</span>
          </p>
          <p v-if="billData.penaltyFee">
            <span class="font-medium text-orange-500">滞纳金:</span>
            <span class="font-bold text-orange-500">{{
              formatFee(billData.penaltyFee)
            }}</span>
          </p>
        </div>

        <!-- 针对 eleBills 和 waterBills 的简化展示，如果需要 -->
        <template v-if="billData.eleBills && billData.eleBills.length > 0">
          <Divider orientation="left">电费明细</Divider>
          <div class="space-y-2">
            <div
              v-for="(ele, index) in billData.eleBills"
              :key="index"
              class="rounded-md bg-gray-50 p-2 dark:bg-gray-800"
            >
              <p class="font-medium">表计名称: {{ ele.meterName }}</p>
              <p>
                读数: {{ ele.previousReading }} ->
                {{ ele.currentReading }} (用量: {{ ele.monthlyUsage }})
              </p>
              <p>
                单价: {{ ele.unitPrice }} 元/度 | 金额:
                {{ formatFee(ele.amount) }}
              </p>
            </div>
          </div>
        </template>

        <template v-if="billData.waterBills && billData.waterBills.length > 0">
          <Divider orientation="left">水费明细</Divider>
          <div class="space-y-2">
            <div
              v-for="(water, index) in billData.waterBills"
              :key="index"
              class="rounded-md bg-gray-50 p-2 dark:bg-gray-800"
            >
              <p class="font-medium">表计名称: {{ water.meterName }}</p>
              <p>
                读数: {{ water.previousReading }} ->
                {{ water.currentReading }} (用量: {{ water.monthlyUsage }})
              </p>
              <p>
                单价: {{ water.unitPrice }} 元/吨 | 金额:
                {{ formatFee(water.amount) }}
              </p>
            </div>
          </div>
        </template>
      </div>
      <div v-else-if="!loading" class="p-8 text-center text-gray-500">
        无法加载账单详情。
      </div>
    </Spin>
  </Modal>
</template>

<style lang="less" scoped>
.mobile-detail-modal-wrap {
  .ant-modal-content {
    padding: 0; // Content has its own padding
  }
  .ant-modal-body {
    padding: 16px;
  }
}
.bill-detail-content {
  // Custom styling for detail content
  h3 {
    color: var(--primary-color);
  }
  .ant-divider-inner-text {
    font-size: 0.85rem;
    color: var(--text-color-secondary);
  }
}
</style>
