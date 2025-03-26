<script lang="ts" setup>
import { computed, nextTick, reactive, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import {
  Button,
  DatePicker,
  Input,
  InputNumber,
  message,
  Steps,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import BillForm from './BillForm.vue';

/**
 * 多页账单表单配置接口
 */
export interface MultipageBillFormConfig {
  [key: string]: any; // 支持任意额外属性
  electricityConfig?: any; // 电费配置
  modalClass?: string; // 模态窗口CSS类名
  modalTitle?: string; // 模态窗口标题
  waterConfig?: any; // 水费配置
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
const electricityConfig = computed(() => config.value.electricityConfig || {});
const waterConfig = computed(() => config.value.waterConfig || {});

// 当前激活的页签
const activeKey = ref('1');

// 电费表单和水费表单引用
const electricityFormRef = ref();
const waterFormRef = ref();

// 创建引用来存储模态窗口参数
const modalProps = ref({
  class:
    config.value.modalClass || 'multipage-bill-form-modal max-w-[90%] w-auto',
  closeOnClickModal: false, // 防止点击模态窗口外部关闭
  closeOnPressEscape: false, // 防止ESC键关闭
  footer: true,
  onCancel: _handleClose,
  showCancelButton: false, // 不显示取消按钮
  showConfirmButton: false, // 不显示确认按钮
  title: config.value.modalTitle || '账单表单',
});

// 修改模态窗口配置
const [Modal, modalApi] = useVbenModal(modalProps.value);

// 关闭处理函数
function _handleClose() {
  modalApi.close();
  emit('close');
}

// 账单数据
const billData = reactive({
  billMonth: dayjs().format('YYYY-MM'), // 默认为当前年月
  companyName: '',
  electricityBillId: 0,
  electricityItems: [],
  electricityTotal: 0,
  factoryRent: 0,
  id: 0,
  invoiceTax: 0,
  managementFee: 0,
  otherItems: [],
  paymentTime: dayjs(),
  projectName: '',
  serviceFee: 0,
  totalAmount: 0,
  waterBillId: 0,
  waterItems: [],
  waterTotal: 0,
});

// 提交的电费数据和水费数据
const electricityData = ref(null);
const waterData = ref(null);

// 自动计算总金额
watch(
  [
    () => billData.electricityTotal,
    () => billData.waterTotal,
    () => billData.factoryRent,
    () => billData.managementFee,
    () => billData.serviceFee,
    () => billData.invoiceTax,
  ],
  () => {
    // 计算本月收费金额合计
    billData.totalAmount =
      Number(billData.electricityTotal || 0) +
      Number(billData.waterTotal || 0) +
      Number(billData.factoryRent || 0) +
      Number(billData.managementFee || 0) +
      Number(billData.serviceFee || 0) +
      Number(billData.invoiceTax || 0);
  },
);

// 下一页方法
function handleNext() {
  const key = Number(activeKey.value);

  // 在跳转前验证当前页的数据
  switch (key) {
    case 1: {
      // 验证租户信息
      if (!billData.companyName || !billData.projectName) {
        message.warning('请填写公司名称和项目名称');
        return;
      }

      break;
    }
    case 2: {
      // 验证电费表单
      electricityFormRef.value?.modalApi.getData();

      break;
    }
    case 3: {
      // 验证水费表单
      waterFormRef.value?.modalApi.getData();

      break;
    }
    // No default
  }

  if (key < 4) {
    activeKey.value = String(key + 1);
  }
}

// 上一页方法
function handlePrev() {
  const key = Number(activeKey.value);
  if (key > 1) {
    activeKey.value = String(key - 1);
  }
}

// 电费表单提交回调
function handleElectricitySuccess(data: any) {
  // 保存电费数据
  electricityData.value = data;

  // 更新总表单数据
  if (data) {
    billData.companyName = data.companyName || billData.companyName;
    billData.projectName = data.projectName || billData.projectName;
    billData.paymentTime = data.paymentTime || billData.paymentTime;
    billData.electricityItems = data.electricityItems || [];

    // 计算电费合计
    let total = 0;
    if (Array.isArray(data.electricityItems)) {
      // 过滤掉合计行
      const items = data.electricityItems.filter(
        (item: any) => item.name !== '合计',
      );
      total = items.reduce(
        (sum: number, item: any) => sum + (Number(item.amount) || 0),
        0,
      );
    }
    billData.electricityTotal = total;
  }
}

// 水费表单提交回调
function handleWaterSuccess(data: any) {
  // 保存水费数据
  waterData.value = data;

  // 更新总表单数据
  if (data) {
    billData.waterItems = data.waterItems || [];

    // 计算水费合计
    let total = 0;
    if (Array.isArray(data.waterItems)) {
      // 过滤掉合计行
      const items = data.waterItems.filter((item: any) => item.name !== '合计');
      total = items.reduce(
        (sum: number, item: any) => sum + (Number(item.amount) || 0),
        0,
      );
    }
    billData.waterTotal = total;
  }
}

// 保存总表单
function handleSave() {
  // 验证必填字段
  if (!billData.companyName || !billData.projectName) {
    message.warning('请填写完整的公司名称和项目名称');
    return;
  }

  // 校验账单明细
  if (
    billData.electricityItems.length === 0 &&
    billData.waterItems.length === 0
  ) {
    message.warning('请至少添加一项电费或水费明细');
    return;
  }

  // 提交数据
  const submitData = { ...billData };

  // 提交账单
  emit('success', submitData);

  // 关闭模态框
  _handleClose();
}

// 初始化数据
function initData(data: any) {
  if (!data) return;

  // 重置表单数据
  Object.assign(billData, {
    billMonth: dayjs().format('YYYY-MM'),
    companyName: '',
    electricityBillId: 0,
    electricityItems: [],
    electricityTotal: 0,
    factoryRent: 0,
    id: 0,
    invoiceTax: 0,
    managementFee: 0,
    otherItems: [],
    paymentTime: dayjs(),
    projectName: '',
    serviceFee: 0,
    totalAmount: 0,
    waterBillId: 0,
    waterItems: [],
    waterTotal: 0,
  });

  // 复制账单数据
  if (data) {
    Object.assign(billData, data);
  }

  // 初始化电费表单和水费表单
  nextTick(() => {
    // 准备电费数据
    const electricityBillData = {
      companyName: billData.companyName,
      electricityItems: billData.electricityItems || [],
      paymentTime: billData.paymentTime,
      projectName: billData.projectName,
    };

    // 准备水费数据
    const waterBillData = {
      companyName: billData.companyName,
      paymentTime: billData.paymentTime,
      projectName: billData.projectName,
      waterItems: billData.waterItems || [],
    };

    // 打开电费表单和水费表单
    if (electricityFormRef.value) {
      electricityFormRef.value.modalApi.setData(electricityBillData);
    }

    if (waterFormRef.value) {
      waterFormRef.value.modalApi.setData(waterBillData);
    }
  });

  // 重置页签
  activeKey.value = '1';
}

// 暴露组件实例的方法和对象
defineExpose({
  close: () => {
    _handleClose();
  },
  modalApi,
  open: (data: any) => {
    // 更新模态窗口配置
    modalProps.value = {
      class:
        config.value.modalClass ||
        'multipage-bill-form-modal max-w-[90%] w-auto',
      closeOnClickModal: false,
      closeOnPressEscape: false,
      footer: true,
      onCancel: _handleClose,
      showCancelButton: false,
      showConfirmButton: false,
      title: config.value.modalTitle || '账单表单',
    };

    // 重新设置关闭前拦截
    (modalApi as any).onBeforeClose = () => {
      return false; // 阻止除了右上角X之外的所有关闭方式
    };

    // 设置数据并打开
    modalApi.setData(data);
    initData(data);
    modalApi.open();
  },
});
</script>

<template>
  <Modal>
    <!-- 步骤条 -->
    <Steps class="mb-6" :current="Number(activeKey) - 1">
      <Steps.Step title="租户信息" />
      <Steps.Step title="电费信息" />
      <Steps.Step title="水费信息" />
      <Steps.Step title="费用合计" />
    </Steps>

    <!-- 页签内容 -->
    <div class="tab-content">
      <!-- 租户信息 -->
      <div v-show="activeKey === '1'" class="tab-pane">
        <div class="bill-items-container">
          <h3 class="mb-4 text-lg font-medium">租户基本信息</h3>
          <div class="info-text mb-4">
            请填写完整的租户基本信息，包括公司名称、项目名称和收款时间
          </div>

          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div
              class="relative rounded border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div class="mb-2 text-gray-500">公司名称</div>
              <Input
                v-model:value="billData.companyName"
                class="mt-1"
                placeholder="请输入公司名称"
              />
            </div>
            <div
              class="relative rounded border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div class="mb-2 text-gray-500">项目名称</div>
              <Input
                v-model:value="billData.projectName"
                class="mt-1"
                placeholder="请输入项目名称"
              />
            </div>
            <div
              class="relative rounded border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div class="mb-2 text-gray-500">收款时间</div>
              <DatePicker
                v-model:value="billData.paymentTime"
                class="mt-1 w-full"
                format="YYYY-MM-DD"
                placeholder="请选择收款时间"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 电费表单 -->
      <div v-show="activeKey === '2'" class="tab-pane">
        <BillForm
          ref="electricityFormRef"
          :config="electricityConfig"
          class="hidden-form"
          @success="handleElectricitySuccess"
        />
        <div class="bill-items-container">
          <h3 class="mb-4 text-lg font-medium">电费明细</h3>
          <div class="info-text mb-2">请点击"打开电费表单"添加电费明细项</div>
          <Button
            type="primary"
            @click="
              electricityFormRef?.open({
                companyName: billData.companyName,
                projectName: billData.projectName,
                paymentTime: billData.paymentTime,
                electricityItems: billData.electricityItems,
              })
            "
          >
            打开电费表单
          </Button>
          <div v-if="billData.electricityTotal > 0" class="mt-4">
            <div class="text-green-600">
              已添加电费明细，合计金额：{{
                billData.electricityTotal.toFixed(2)
              }}
              元
            </div>
          </div>
        </div>
      </div>

      <!-- 水费表单 -->
      <div v-show="activeKey === '3'" class="tab-pane">
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
                companyName: billData.companyName,
                projectName: billData.projectName,
                paymentTime: billData.paymentTime,
                waterItems: billData.waterItems,
              })
            "
          >
            打开水费表单
          </Button>
          <div v-if="billData.waterTotal > 0" class="mt-4">
            <div class="text-green-600">
              已添加水费明细，合计金额：{{ billData.waterTotal.toFixed(2) }} 元
            </div>
          </div>
        </div>
      </div>

      <!-- 费用合计表单 -->
      <div v-show="activeKey === '4'" class="tab-pane">
        <div class="bill-summary-form">
          <h3 class="mb-4 text-lg font-medium">费用合计</h3>

          <div class="mb-6 grid grid-cols-2 gap-4">
            <div class="rounded border p-3">
              <div class="text-gray-500">电费合计</div>
              <InputNumber
                v-model:value="billData.electricityTotal"
                :disabled="true"
                class="mt-1 w-full"
                :precision="2"
                addon-after="元"
              />
            </div>

            <div class="rounded border p-3">
              <div class="text-gray-500">水费合计</div>
              <InputNumber
                v-model:value="billData.waterTotal"
                :disabled="true"
                class="mt-1 w-full"
                :precision="2"
                addon-after="元"
              />
            </div>

            <div class="rounded border p-3">
              <div class="text-gray-500">厂房租金</div>
              <InputNumber
                v-model:value="billData.factoryRent"
                class="mt-1 w-full"
                :precision="2"
                addon-after="元"
              />
            </div>

            <div class="rounded border p-3">
              <div class="text-gray-500">基本管理费</div>
              <InputNumber
                v-model:value="billData.managementFee"
                class="mt-1 w-full"
                :precision="2"
                addon-after="元"
              />
            </div>

            <div class="rounded border p-3">
              <div class="text-gray-500">服务费</div>
              <InputNumber
                v-model:value="billData.serviceFee"
                class="mt-1 w-full"
                :precision="2"
                addon-after="元"
              />
            </div>

            <div class="rounded border p-3">
              <div class="text-gray-500">开票税金</div>
              <InputNumber
                v-model:value="billData.invoiceTax"
                class="mt-1 w-full"
                :precision="2"
                addon-after="元"
              />
            </div>

            <div class="col-span-2 rounded border bg-green-50 p-3">
              <div class="font-medium text-gray-700">本月收费金额合计</div>
              <InputNumber
                v-model:value="billData.totalAmount"
                :disabled="true"
                class="mt-1 w-full"
                :precision="2"
                addon-after="元"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部按钮 -->
    <template #footer>
      <div class="footer-buttons">
        <div class="left-buttons">
          <Button
            v-if="Number(activeKey) > 1"
            class="prev-button"
            @click="handlePrev"
          >
            <span class="button-icon">←</span> 上一页
          </Button>
          <div v-else class="placeholder-button"></div>
        </div>

        <div class="page-indicator">
          <span
            v-for="page in 4"
            :key="page"
            class="page-dot"
            :class="[{ active: Number(activeKey) === page }]"
          ></span>
          <span class="page-text">{{ activeKey }}/4</span>
        </div>

        <div class="right-buttons">
          <Button
            v-if="Number(activeKey) < 4"
            type="primary"
            class="next-button"
            @click="handleNext"
          >
            下一页 <span class="button-icon">→</span>
          </Button>
          <Button
            v-if="Number(activeKey) === 4"
            type="primary"
            class="save-button"
            @click="handleSave"
          >
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
    width: 100px; // 固定宽度，确保中间部分居中
  }

  .right-buttons {
    justify-content: flex-end; // 右侧按钮靠右对齐
  }

  .placeholder-button {
    width: 90px; // 与按钮宽度相同
    height: 32px; // 与按钮高度相同
  }

  .button-icon {
    display: inline-block;
    margin: 0 2px;
  }

  .next-button,
  .prev-button {
    min-width: 90px;
    transition: all 0.3s;

    &:hover {
      transform: translateY(-2px);
    }
  }

  .save-button {
    min-width: 90px;
    font-weight: 500;
    transition: all 0.3s;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }
  }

  .page-indicator {
    display: flex;
    flex: 1;
    justify-content: center; // 确保水平居中
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

// 添加 passive wheel 相关样式
:deep(.ant-table-wrapper) {
  overflow-x: auto;
  scroll-behavior: smooth;
}

// 确保模态窗口内容可以横向滚动
:deep(.multipage-bill-form-modal) {
  .ant-table-wrapper {
    overflow-x: auto;
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
