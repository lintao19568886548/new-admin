<script lang="ts" setup>
import type { AmountBill } from '../data';

import type { Park } from '#/components/AreaSelector.vue';

import { computed, onMounted, reactive, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import {
  Button,
  Cascader,
  DatePicker,
  Input,
  InputNumber,
  message,
  Steps,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { getTenantSelectList } from '#/api';
import {
  createAmountBill,
  getAmountBillDetail,
  updateAmountBill,
} from '#/api/bill';
// 添加园区API导入

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
  cascaderData.value = [];
  modalApi.close();
  emit('close');
}

// 创建模态窗口
const [Modal, modalApi] = useVbenModal(modalProps.value);

const cascaderData = ref<any[]>([]);

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
    () => billData.serviceFee,
    () => billData.invoiceTax,
  ],
  () => {
    billData.totalFee =
      Number(billData.eleFee || 0) +
      Number(billData.waterFee || 0) +
      Number(billData.factoryRent || 0) +
      Number(billData.managementFee || 0) +
      Number(billData.serviceFee || 0) +
      Number(billData.invoiceTax || 0);
  },
);

function validate() {
  const errors = [];

  if (!cascaderData.value || !billData.projectName || !billData.receiptTime) {
    errors.push('请选择完整的园区和租户信息');
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
    billData.eleBills = data.eleBills || [];
    // 计算电费合计

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
  if (!validate()) {
    return;
  }
  // 校验费用项
  const saveData = {
    ...billData,
    eleBills: billData.eleBills?.map((item: any) => {
      delete item.updateTime;
      delete item.createTime;
      item.receiptTime =
        item.receiptTime && item.receiptTime !== ''
          ? item.receiptTime
          : billData.receiptTime;
      return item;
    }),
    eleFee: Number(billData.eleFee) || 0,
    factoryRent: Number(billData.factoryRent) || 0,
    invoiceTax: Number(billData.invoiceTax) || 0,
    managementFee: Number(billData.managementFee) || 0,
    parkId: cascaderData.value[0],
    serviceFee: Number(billData.serviceFee) || 0,
    tenantId: cascaderData.value[1],
    totalFee: Number(billData.totalFee) || 0,
    waterBills: billData.waterBills?.map((item: any) => {
      delete item.updateTime;
      delete item.createTime;
      item.receiptTime =
        item.receiptTime && item.receiptTime !== ''
          ? item.receiptTime
          : billData.receiptTime;
      return item;
    }),
    waterFee: Number(billData.waterFee) || 0,
  };
  // console.log('billData.tenant', billData.tenant);
  // 提交数据
  await (saveData.billId
    ? updateAmountBill(saveData)
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
    cascaderData.value = [billDetail.parkId, billDetail.tenantId];
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
        // Use Partial for type safety
        eleBills,
        factoryRent: billDetail.factoryRent,
        managementFee: billDetail.managementFee,
        parkId: billDetail.parkId,
        projectName: billDetail.projectName,
        receiptTime: dayjs(billDetail.receiptTime)
          .add(1, 'month')
          .toISOString(),
        tenantId: billDetail.tenantId, // Carry over tenantId
        waterBills,
      };
      Object.assign(billData, nextBillData);
    } else {
      Object.assign(billData, billDetail);
      // Ensure tenant is set after assigning billDetail
      // billData.tenant =
      //   typeof billDetail.parkId === 'number' &&
      //   typeof billDetail.tenantId === 'number'
      //     ? [billDetail.parkId, billDetail.tenantId]
      //     : [];
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
    // Explicitly set defaults for crucial fields after generic reset
    billData.billId = undefined;
    billData.createTime = undefined;
    billData.eleFee = 0;
    billData.waterFee = 0;
    billData.totalFee = 0;
    billData.parkId = undefined;
    billData.tenantId = undefined;
    billData.tenantName = '';
    billData.projectName = '';
    billData.remark = '';
    billData.receiptTime = defaultReceiptTime;
  }

  // // 初始化子表单
  // nextTick(() => {
  //   // 准备电费数据
  //   const eleBillData = {
  //     eleBills: billData.eleBills || [],
  //   };

  //   // 准备水费数据
  //   const waterBillData = {
  //     waterBills: billData.waterBills || [],
  //   };

  //   // 设置子表单数据
  //   if (eleFormRef.value) {
  //     eleFormRef.value.modalApi.setData(eleBillData);
  //   }

  //   if (waterFormRef.value) {
  //     waterFormRef.value.modalApi.setData(waterBillData);
  //   }
  // });

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

    // 设置数据并打开
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
          <h3 class="mb-4 text-lg font-medium">租户基本信息</h3>
          <div class="info-text mb-4">
            请填写完整的租户基本信息，包括公司名称、项目名称和收款时间
          </div>

          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <!-- 4. Replace Tenant Name Input with Cascader -->
            <div class="rounded border bg-white p-4 shadow-sm">
              <div class="text-gray-500">选择租户</div>
              <Cascader
                v-model:value="cascaderData"
                :options="tenantList"
                expand-trigger="hover"
                class="mt-1 w-full"
                placeholder="请选择租户"
                :show-search="true"
              />
            </div>
            <div class="rounded border bg-white p-4 shadow-sm">
              <div class="text-gray-500">项目名称</div>
              <Input
                v-model:value="billData.projectName"
                class="mt-1"
                placeholder="请输入项目名称"
              />
            </div>
            <div class="rounded border bg-white p-4 shadow-sm">
              <div class="text-gray-500">收款时间</div>
              <DatePicker
                v-model:value="billData.receiptTime"
                class="mt-1 w-full"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
                placeholder="请选择收款时间"
              />
            </div>
          </div>
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
        <div class="bill-summary-form">
          <h3 class="mb-4 text-lg font-medium">费用合计</h3>

          <div class="mb-6 grid grid-cols-2 gap-4">
            <div class="rounded border p-3">
              <div class="text-gray-500">电费合计</div>
              <InputNumber
                v-model:value="billData.eleFee"
                :disabled="true"
                class="mt-1 w-full"
                :precision="2"
                addon-after="元"
                :controls="false"
              />
            </div>

            <div class="rounded border p-3">
              <div class="text-gray-500">水费合计</div>
              <InputNumber
                v-model:value="billData.waterFee"
                :disabled="true"
                class="mt-1 w-full"
                :precision="2"
                addon-after="元"
                :controls="false"
              />
            </div>

            <div class="rounded border p-3">
              <div class="text-gray-500">厂房租金</div>
              <InputNumber
                v-model:value="billData.factoryRent"
                class="mt-1 w-full"
                :precision="2"
                addon-after="元"
                :controls="false"
              />
            </div>
            <div class="rounded border p-3">
              <div class="text-gray-500">基本管理费</div>
              <InputNumber
                v-model:value="billData.managementFee"
                class="mt-1 w-full"
                :precision="2"
                addon-after="元"
                :controls="false"
              />
            </div>

            <div class="rounded border p-3">
              <div class="text-gray-500">服务费</div>
              <InputNumber
                v-model:value="billData.serviceFee"
                class="mt-1 w-full"
                :precision="2"
                addon-after="元"
                :controls="false"
              />
            </div>

            <div class="rounded border p-3">
              <div class="text-gray-500">开票税金</div>
              <InputNumber
                v-model:value="billData.invoiceTax"
                class="mt-1 w-full"
                :precision="2"
                addon-after="元"
                :controls="false"
              />
            </div>

            <div class="col-span-2 rounded border bg-green-50 p-3">
              <div class="font-medium text-gray-700">本月收费金额合计</div>
              <InputNumber
                v-model:value="billData.totalFee"
                :disabled="true"
                class="mt-1 w-full"
                :precision="2"
                addon-after="元"
                :controls="false"
              />
            </div>
          </div>
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
