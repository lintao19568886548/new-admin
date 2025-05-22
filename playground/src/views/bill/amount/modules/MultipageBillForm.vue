<script lang="ts" setup>
import type { AmountBill } from '../data';

import type { Park } from '#/components/AreaSelector.vue';

import { computed, onMounted, reactive, ref, watch } from 'vue';

import { useVbenForm, useVbenModal } from '@vben/common-ui';

import {
  Button,
  Card,
  Descriptions, // 新增导入
  DescriptionsItem, // 新增导入
  message,
  Statistic,
  Steps,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { getTenantSelectList } from '#/api';
import {
  createAmountBill,
  getAmountBillDetail,
  updateAmountBill,
} from '#/api/bill';

import { useTenantFormSchema } from './BillBaseConfig';
import BillForm from './BillForm.vue';

/**
 * 多页账单表单配置接口
 */
export interface MultipageBillFormConfig {
  [key: string]: any;
  electricityConfig?: any;
  modalClass?: string;
  modalTitle?: string;
  waterConfig?: any;
}

// 组件属性定义
const props = defineProps<{
  config?: MultipageBillFormConfig;
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success', data: any): void;
}>();

// 提取配置值
const config = computed<MultipageBillFormConfig>(() => props.config || {});

// 设置默认值
const electricityConfig = computed(() => ({
  ...config.value.electricityConfig,
  modalClass: 'bill-form-modal billform-specific-dialog',
}));

const waterConfig = computed(() => ({
  ...config.value.waterConfig,
  modalClass: 'bill-form-modal billform-specific-dialog',
}));

// 当前激活的页签
const activeKey = ref(1);

// 表单引用
const eleFormRef = ref();
const waterFormRef = ref();

// 模态窗口参数
const modalProps = ref({
  class:
    config.value.modalClass ||
    'multipage-bill-form-modal max-w-[90%] w-[1000px]',
  closeOnClickModal: false,
  footer: true,
  onClosed: _handleClose,
  showCancelButton: false,
  showConfirmButton: false,
  title: config.value.modalTitle || '账单表单',
});

// 关闭处理函数
function _handleClose() {
  modalApi.close();
  emit('close');
}

// 创建模态窗口
const [Modal, modalApi] = useVbenModal(modalProps.value);

const [TenantForm, tenantFormApi] = useVbenForm({
  commonConfig: {
    // 所有表单项
    componentProps: {
      class: 'mb-1 w-full',
    },
  },
  handleValuesChange(values) {
    Object.assign(billData, values);
  },

  layout: 'horizontal',
  schema: useTenantFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-3',
});

// 账单数据
const billData = reactive<AmountBill>({
  // Initialize other fields from AmountBill as needed
  eleBills: [],
  eleFee: 0,
  factoryRent: 0,
  invoiceTax: 0,
  managementFee: 0,
  parkId: undefined, // Ensure parkId is part of AmountBill or handled
  projectName: '',
  receiptTime: dayjs().toISOString(), // Initialize as ISO string
  remark: '',
  serviceFee: 0,
  tenant: [], // For Cascader's v-model
  tenantId: undefined, // Add tenantId
  tenantName: '', // Will be derived from Cascader
  totalFee: 0,
  waterBills: [],
  waterFee: 0,
});

const tenantList = ref<Park[]>([]); // This is used for Cascader

// 在组件挂载时获取租户列表 (tenantList includes park info)
onMounted(async () => {
  tenantList.value = (await getTenantSelectList()) || [];
});

// 自动计算总金额
watch(
  [
    () => billData.eleFee,
    () => billData.waterFee,
    () => billData.factoryRent,
    () => billData.managementFee,
    () => billData.garbageFee,
    () => billData.serviceFee,
    () => billData.invoiceTax,
  ],
  () => {
    billData.totalFee =
      Number(billData.eleFee || 0) +
      Number(billData.waterFee || 0) +
      Number(billData.factoryRent || 0) +
      Number(billData.managementFee || 0) +
      Number(billData.garbageFee || 0) +
      Number(billData.serviceFee || 0) +
      Number(billData.invoiceTax || 0);
  },
);

watch([() => billData.serviceRate, () => billData.eleFee], () => {
  if (!billData.serviceRate) {
    billData.serviceFee = 0;
    return;
  }
  billData.serviceFee = billData.eleFee * (billData.serviceRate / 100);
});

watch([() => billData.garbageRate], () => {
  if (!billData.garbageRate) {
    billData.garbageFee = 0;
    return;
  }
  const waterBill = billData.waterBills?.find(
    (item) => item.meterName === '合计',
  );

  billData.garbageFee = waterBill.totalUsage * (billData.garbageRate / 100);
});

watch(
  [
    () => billData.waterTaxRate,
    () => billData.eleTaxRate,
    () => billData.rentTaxRate,
    () => billData.waterTax,
    () => billData.eleTax,
    () => billData.rentTax,
    () => billData.waterFee, // 也应作为依赖，因为在回调中读取
    () => billData.eleFee, // 也应作为依赖
    () => billData.factoryRent, // 也应作为依赖
  ],
  () => {
    const calculateItemTax = (
      fee: null | number | undefined,
      rate: null | number | undefined,
    ): number => {
      const numericFee = Number(fee);
      const numericRate = Number(rate);

      // 如果费用或税率无效 (NaN) 或为零，则该项税额为0
      if (
        Number.isNaN(numericFee) ||
        numericFee === 0 ||
        Number.isNaN(numericRate) ||
        numericRate === 0
      ) {
        return 0;
      }
      return numericFee * (numericRate / 100);
    };

    const waterInvoiceTax = calculateItemTax(
      billData.waterTax || billData.waterFee,
      billData.waterTaxRate,
    );
    const eleInvoiceTax = calculateItemTax(
      billData.eleTax || billData.eleFee,
      billData.eleTaxRate,
    );
    const rentInvoiceTax = calculateItemTax(
      billData.rentTax || billData.factoryRent,
      billData.rentTaxRate,
    );

    billData.invoiceTax = waterInvoiceTax + eleInvoiceTax + rentInvoiceTax;
  },
);

async function validate() {
  const errors = [];

  const { valid: tenantValid } = await tenantFormApi.validate();
  if (!tenantValid) {
    errors.push('请填写完整租户信息');
  }

  if (!billData.eleBills || billData.eleBills?.length === 0) {
    errors.push('请添加电费明细');
  }

  if (!billData.waterBills || billData.waterBills?.length === 0) {
    errors.push('请添加水费明细');
  }

  // 显示所有错误信息
  if (errors.length > 0) {
    errors.forEach((err) => message.warning(err));
    return false;
  }

  return true;
}

// 电费表单提交回调
function handleEleSuccess(data: any) {
  if (data) {
    // 计算电费合计
    billData.eleBills = data.eleBills || [];
    const item = data.eleBills.find((item: any) => item.meterName === '合计');
    billData.eleFee = item?.amount || 0;
  }
}

// 水费表单提交回调
function handleWaterSuccess(data: any) {
  if (data) {
    billData.waterBills = data.waterBills || [];

    // 计算水费合计
    const item = data.waterBills.find((item: any) => item.meterName === '合计');
    billData.waterFee = item?.amount || 0;
  }
}

// 保存总表单
async function handleSave() {
  // 验证必填字段
  if (!(await validate())) {
    return;
  }

  // 处理租户信息
  const tenantForm = await tenantFormApi.getValues();
  const {
    _divider,
    eleTax,
    eleTaxRate,
    rentTax,
    rentTaxRate,
    tenant,
    waterTax,
    waterTaxRate,
    ...tenantData
  } = tenantForm;
  const tenantSubmit = {
    ...tenantData,
    parkId: tenant[0],
    taxRate: JSON.stringify({
      eleTax,
      eleTaxRate,
      rentTax,
      rentTaxRate,
      waterTax,
      waterTaxRate,
    }),
    tenantId: tenant[1],
  };

  // 处理提交数据
  const saveData = {
    ...tenantSubmit,
    eleBills: billData.eleBills?.map((item: any) => {
      delete item.updateTime;
      item.receiptTime =
        item.receiptTime && item.receiptTime !== ''
          ? item.receiptTime
          : billData.receiptTime;
      return item;
    }),
    eleFee: Number(billData.eleFee) || 0,
    garbageFee: Number(billData.garbageFee) || 0,
    invoiceTax: Number(billData.invoiceTax) || 0,
    serviceFee: Number(billData.serviceFee) || 0,
    totalFee: Number(billData.totalFee) || 0,
    waterBills: billData.waterBills?.map((item: any) => {
      delete item.updateTime;
      item.receiptTime =
        item.receiptTime && item.receiptTime !== ''
          ? item.receiptTime
          : billData.receiptTime;
      return item;
    }),
    waterFee: Number(billData.waterFee) || 0,
  };

  // 提交数据
  await (billData.billId
    ? updateAmountBill(billData.billId, saveData)
    : createAmountBill(saveData));
  emit('success', { ...saveData });
  _handleClose();
}

// 初始化数据
async function initData(data: any, type: string) {
  if (!data) return;
  // 复制账单数据
  if (data.billId) {
    const billDetail = await getAmountBillDetail(data.billId);
    const tenantDetail = {
      ...billDetail,
      ...(billDetail.taxRate ? JSON.parse(billDetail.taxRate) : undefined),
      tenant: billDetail.tenantId
        ? [billDetail.parkId, billDetail.tenantId]
        : undefined,
    };
    tenantFormApi.setValues(tenantDetail);

    if (type === 'next') {
      const eleBills = billDetail.eleBills.map((item: any) => {
        return {
          meterName: item.meterName,
          multiplier: item.multiplier,
          previousReading: item.currentReading,
          unitPrice: item.unitPrice,
        };
      });
      const waterBills = billDetail.waterBills.map((item: any) => {
        return {
          meterName: item.meterName,
          multiplier: item.multiplier,
          previousReading: item.currentReading,
          unitPrice: item.unitPrice,
        };
      });
      const nextBillData: Partial<AmountBill> = {
        eleBills,
        waterBills,
      };
      Object.assign(billData, nextBillData);
    } else {
      Object.assign(billData, billDetail);
    }
  } else {
    // 重置表单数据
    const defaultReceiptTime = dayjs().toISOString();
    Object.keys(billData).forEach((key) => {
      if (key === 'receiptTime') {
        (billData as any)[key] = defaultReceiptTime;
      } else if (Array.isArray((billData as any)[key])) {
        (billData as any)[key] = [];
      } else if (typeof (billData as any)[key] === 'number') {
        (billData as any)[key] = 0;
      } else if (typeof (billData as any)[key] === 'string') {
        (billData as any)[key] = '';
      } else {
        (billData as any)[key] = undefined;
      }
    });
    delete billData.billId;
    delete billData.createTime;
    billData.eleFee = 0;
    billData.waterFee = 0;
    billData.totalFee = 0;
    billData.parkId = undefined;
    billData.tenantId = undefined;
    billData.tenantName = '';
    billData.projectName = '';
    billData.remark = '';
    billData.receiptTime = defaultReceiptTime;
    tenantFormApi.resetForm();
  }

  // 设置数据

  // 重置页签
  activeKey.value = 1;
}

// 暴露组件实例方法
defineExpose({
  close: () => {
    _handleClose();
  },
  modalApi,
  open: (data: any, type: string) => {
    // 更新模态窗口配置
    modalProps.value = {
      class:
        config.value.modalClass ||
        'multipage-bill-form-modal max-w-[90%] w-[900px]',
      closeOnClickModal: false,
      footer: true,
      onClosed: _handleClose,
      showCancelButton: false,
      showConfirmButton: false,
      title: config.value.modalTitle || '账单表单',
    };

    modalApi.setData(data);
    initData(data, type);
    modalApi.open();
  },
});
</script>

<template>
  <Modal>
    <Steps class="mb-6" :current="activeKey - 1">
      <Steps.Step @click="activeKey = 1" title="租户信息" />
      <Steps.Step @click="activeKey = 2" title="电费信息" />
      <Steps.Step @click="activeKey = 3" title="水费信息" />
      <Steps.Step @click="activeKey = 4" title="费用合计" />
    </Steps>

    <div class="tab-content">
      <!-- 租户信息 -->
      <div v-show="activeKey === 1" class="tab-pane">
        <div class="bill-items-container">
          <h3 class="mb-2 text-lg font-medium">租户基本信息</h3>
          <div class="info-text mb-2">请填写租户基本信息</div>
          <Card>
            <TenantForm />
          </Card>
        </div>
      </div>

      <!-- 电费表单 -->
      <div v-show="activeKey === 2" class="tab-pane">
        <BillForm
          ref="eleFormRef"
          :config="electricityConfig"
          class="hidden-form"
          @success="handleEleSuccess"
        />
        <div class="bill-items-container">
          <h3 class="mb-4 text-lg font-medium">电费明细</h3>
          <div class="info-text mb-2">请点击"打开电费表单"添加电费明细项</div>
          <Button
            type="primary"
            @click="
              eleFormRef?.open({
                eleBills: billData.eleBills,
                itemsField: 'eleBills',
              })
            "
          >
            打开电费表单
          </Button>
          <div v-if="billData.eleFee > 0" class="mt-4 text-green-600">
            已添加电费明细，合计金额：{{ billData.eleFee }}
            元
          </div>
        </div>
      </div>

      <!-- 水费表单 -->
      <div v-show="activeKey === 3" class="tab-pane">
        <BillForm
          ref="waterFormRef"
          :config="waterConfig"
          class="hidden-form"
          @success="handleWaterSuccess"
        />
        <div class="bill-items-container">
          <h3 class="mb-4 text-lg font-medium">水费明细</h3>
          <div class="info-text mb-2">请点击"打开水费表单"添加水费明细项</div>
          <Button
            type="primary"
            @click="
              waterFormRef?.open({
                waterBills: billData.waterBills,
                itemsField: 'waterBills',
              })
            "
          >
            打开水费表单
          </Button>
          <div v-if="billData.waterFee > 0" class="mt-4 text-green-600">
            已添加水费明细，合计金额：{{ billData.waterFee }} 元
          </div>
        </div>
      </div>

      <!-- 费用合计表单 -->
      <div v-show="activeKey === 4" class="tab-pane">
        <div class="bill-items-container">
          <h3 class="mb-4 text-lg font-medium">费用合计</h3>
          <div class="info-text mb-4">请核对金额是否正确</div>
          <Descriptions bordered>
            <DescriptionsItem
              v-if="billData.waterFee > 0"
              label="水费"
              :span="1"
            >
              <Statistic :value="billData.waterFee" :precision="2" prefix="¥" />
            </DescriptionsItem>
            <DescriptionsItem v-if="billData.eleFee > 0" label="电费">
              <Statistic :value="billData.eleFee" :precision="2" prefix="¥" />
            </DescriptionsItem>
            <DescriptionsItem v-if="billData.factoryRent > 0" label="厂房租金">
              <Statistic
                :value="billData.factoryRent"
                :precision="2"
                prefix="¥"
              />
            </DescriptionsItem>
            <DescriptionsItem
              v-if="billData.managementFee > 0"
              label="基本管理费"
            >
              <Statistic
                :value="billData.managementFee"
                :precision="2"
                prefix="¥"
              />
            </DescriptionsItem>
            <DescriptionsItem
              v-if="billData.garbageFee! > 0"
              label="垃圾处理费"
            >
              <Statistic
                :value="billData.garbageFee"
                :precision="2"
                prefix="¥"
              />
            </DescriptionsItem>
            <DescriptionsItem v-if="billData.serviceFee! > 0" label="服务费">
              <Statistic
                :value="billData.serviceFee"
                :precision="2"
                prefix="¥"
              />
            </DescriptionsItem>
            <DescriptionsItem v-if="billData.invoiceTax > 0" label="开票税金">
              <Statistic
                :value="billData.invoiceTax"
                :precision="2"
                prefix="¥"
              />
            </DescriptionsItem>
            <DescriptionsItem label="本月收费金额" :span="2">
              <Statistic :value="billData.totalFee" :precision="2" prefix="¥" />
            </DescriptionsItem>
          </Descriptions>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="footer-buttons">
        <div class="left-buttons">
          <Button v-if="activeKey > 1" @click="activeKey -= 1">
            <span>←</span> 上一页
          </Button>
          <div v-else class="placeholder-button"></div>
        </div>

        <div class="page-indicator">
          <span
            v-for="page in 4"
            :key="page"
            class="page-dot"
            :class="{ active: activeKey === page }"
          ></span>
          <span class="page-text">{{ activeKey }}/4</span>
        </div>

        <div class="right-buttons">
          <Button v-if="activeKey < 4" type="primary" @click="activeKey += 1">
            下一页 <span>→</span>
          </Button>
          <Button v-if="activeKey === 4" type="primary" @click="handleSave">
            保存
          </Button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<style lang="less" scoped>
.tab-content {
  min-height: 400px;

  .tab-pane {
    height: 100%;
  }
}

.bill-items-container {
  padding: 20px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  background-color: #fafafa;
}

.info-text {
  color: #666;
}

.bill-summary-form {
  padding: 20px;
}

.hidden-form {
  display: none;
}

// 底部按钮样式
.footer-buttons {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;

  .left-buttons,
  .right-buttons {
    display: flex;
    align-items: center;
    width: 100px;
  }

  .right-buttons {
    justify-content: flex-end;
  }

  .placeholder-button {
    width: 90px;
    height: 32px;
  }

  .page-indicator {
    display: flex;
    flex: 1;
    justify-content: center;
    align-items: center;

    .page-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin: 0 4px;
      border-radius: 50%;
      background-color: #e0e0e0;
      transition: all 0.3s;

      &.active {
        background-color: #1890ff;
        transform: scale(1.2);
      }
    }

    .page-text {
      margin-left: 8px;
      font-size: 14px;
      color: #666;
    }
  }
}
</style>
