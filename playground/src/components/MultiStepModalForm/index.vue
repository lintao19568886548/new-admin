<script
  lang="ts"
  setup
  generic="T extends Record<string, any> = Record<string, any>"
>
import type { VNode } from 'vue';

import type {
  MultiStepModalFormEmits,
  MultiStepModalFormProps,
  MultiStepModalFormSlots,
  StepConfig,
} from './types';

import { computed, reactive, ref, useSlots, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message, Spin, Steps } from 'ant-design-vue';
import { cloneDeep } from 'lodash-es';

// --- Props and Emits ---
const props = withDefaults(defineProps<MultiStepModalFormProps<T>>(), {
  cancelText: '取消',
  confirmText: '提交',
  modalClass: 'multi-step-modal-form',
  modalTitle: '多步骤表单',
  nextText: '下一步',
  prevText: '上一步',
  showCancelButton: true,
  showFooter: true,
});

const emit = defineEmits<MultiStepModalFormEmits<T>>();

// 定义插槽，使用 MultiStepModalFormSlots 类型
defineSlots<MultiStepModalFormSlots<T>>();

// --- Modal Management ---
const modalProps = ref({
  class: props.modalClass,
  closeOnClickModal: false,
  closeOnPressEscape: false,
  footer: false, // 自定义页脚
  onCancel: handleCancel, // 使用自定义取消处理
  title: props.modalTitle,
});

const [Modal, modalApi] = useVbenModal(modalProps.value);

// --- State ---
const activeKey = ref<number | string>(props.steps?.[0]?.key ?? 1); // 当前激活的步骤 key
const formData = reactive<T>({} as T); // 表单数据
const isSubmitting = ref(false); // 是否正在提交
const slots = useSlots();

// --- Computed Properties ---
const currentStepIndex = computed(() => {
  return props.steps.findIndex((step) => step.key === activeKey.value);
});

const isFirstStep = computed(() => currentStepIndex.value === 0);
const isLastStep = computed(
  () => currentStepIndex.value === props.steps.length - 1,
);

// --- Watchers ---
// 监听 props.initialData 的变化来重置表单
watch(
  () => props.initialData,
  (newData) => {
    if (newData) {
      Object.assign(formData, cloneDeep(newData));
    } else {
      // 清空 formData
      Object.keys(formData).forEach((key) => {
        const typedKey = key as keyof typeof formData;
        delete formData[typedKey];
      });
    }
    // 重置到第一步
    activeKey.value = props.steps?.[0]?.key ?? 1;
  },
  { deep: true, immediate: true },
);

// 监听 formData 的变化并发出事件
watch(
  formData,
  (newData) => {
    // 修复: 传递 formData 的深拷贝并断言类型为 T
    emit('update:formData', cloneDeep(newData) as T);
  },
  { deep: true },
);

// 监听 activeKey 的变化并发出事件
watch(activeKey, (newKey) => {
  emit('update:activeKey', newKey);
});

// --- Methods ---
async function handleNext() {
  // 步骤切换前验证
  if (props.validateStepFn) {
    try {
      // 修复: 传递 formData 的深拷贝并断言类型为 T
      const isValid = await props.validateStepFn(
        activeKey.value,
        cloneDeep(formData) as T,
      );
      if (!isValid) {
        return; // 验证失败，停止切换
      }
    } catch (error) {
      console.error('Step validation error:', error);
      message.error('步骤验证失败');
      return;
    }
  }

  if (!isLastStep.value) {
    // 修复: 使用可选链安全访问 key
    const nextStepKey = props.steps[currentStepIndex.value + 1]?.key;
    if (nextStepKey === undefined) {
      console.warn('Could not determine next step key');
    } else {
      activeKey.value = nextStepKey;
    }
  }
}

function handlePrev() {
  if (!isFirstStep.value) {
    // 修复: 使用可选链安全访问 key
    const prevStepKey = props.steps[currentStepIndex.value - 1]?.key;
    if (prevStepKey === undefined) {
      console.warn('Could not determine previous step key');
    } else {
      activeKey.value = prevStepKey;
    }
  }
}

async function handleSubmit() {
  if (!props.submitFn) {
    console.warn('MultiStepModalForm: submitFn prop is not provided.');
    handleClose(); // 如果没有提交函数，直接关闭
    return;
  }

  // 最后一步的验证 (如果需要)
  if (props.validateStepFn) {
    try {
      // 修复: 传递 formData 的深拷贝并断言类型为 T
      const isValid = await props.validateStepFn(
        activeKey.value,
        cloneDeep(formData) as T,
      );
      if (!isValid) {
        return; // 验证失败，停止提交
      }
    } catch (error) {
      console.error('Final step validation error:', error);
      message.error('最终步骤验证失败');
      return;
    }
  }

  isSubmitting.value = true;
  try {
    // 修复: 传递 formData 的深拷贝并断言类型为 T
    const result = await props.submitFn(cloneDeep(formData) as T); // 提交克隆的数据
    message.success('提交成功');
    // 修复: 传递 formData 的深拷贝并断言类型为 T
    emit('success', result, cloneDeep(formData) as T);
    handleClose();
  } catch (error) {
    console.error('Form submission error:', error);
    message.error(
      `提交失败: ${error instanceof Error ? error.message : '未知错误'}`,
    );
  } finally {
    isSubmitting.value = false;
  }
}

function handleCancel() {
  emit('cancel');
  handleClose();
}

function handleClose() {
  modalApi.close();
  emit('close');
  // 可选：关闭时重置状态
  // activeKey.value = props.steps?.[0]?.key ?? 1;
  // Object.keys(formData).forEach(key => delete formData[key as keyof T]);
}

// --- Exposed API ---
function open(initialData?: T) {
  if (initialData) {
    Object.assign(formData, cloneDeep(initialData));
  } else {
    // 清空 formData
    Object.keys(formData).forEach((key) => {
      const typedKey = key as keyof typeof formData;
      delete formData[typedKey];
    });
  }
  activeKey.value = props.steps?.[0]?.key ?? 1; // 总是从第一步开始
  modalApi.open();
}

function close() {
  handleClose();
}

function getCurrentFormData(): T {
  return cloneDeep(formData) as T;
}

function setActiveKey(key: number | string) {
  if (props.steps.some((step) => step.key === key)) {
    activeKey.value = key;
  } else {
    console.warn(`Invalid step key: ${key}`);
  }
}

// 暴露给父组件的方法
defineExpose({
  close,
  getCurrentFormData,
  open,
  setActiveKey,
});

// --- Slot Rendering ---
// 辅助函数，用于渲染步骤内容（优先插槽，其次是 props.content）
function renderStepContent(step: StepConfig): null | VNode {
  const slotName = `step-${step.key}`;
  // 使用类型断言来处理动态插槽名称
  if (slots[slotName as keyof typeof slots]) {
    // 将 formData 传递给插槽
    const slotFn = slots[slotName as keyof typeof slots]!;
    // 显式传递类型化的 formData 对象
    const slotProps = { formData: formData as T };
    const slotNodes = slotFn(slotProps);
    return Array.isArray(slotNodes)
      ? (slotNodes[0] ?? null)
      : (slotNodes ?? null);
  }
  if (step.content) {
    return typeof step.content === 'function' ? step.content() : step.content;
  }
  return null; // 如果都没有，则不渲染内容
}
</script>

<template>
  <!-- 修复: 移除 @register 指令 -->
  <Modal>
    <Spin :spinning="isSubmitting">
      <div class="p-4">
        <!-- 步骤条 -->
        <Steps :current="currentStepIndex" :items="steps" size="small" />

        <!-- 步骤内容区域 -->
        <div class="mt-6 min-h-[200px]">
          <template v-for="step in steps" :key="step.key">
            <div v-show="activeKey === step.key">
              <!-- 渲染插槽或 props.content -->
              <!-- 确保 component :is 接收的是 VNode 或 null -->
              <component
                :is="renderStepContent(step)"
                v-if="renderStepContent(step)"
              />
            </div>
          </template>
        </div>
      </div>
    </Spin>
    <!-- 自定义页脚 -->
    <template v-if="props.showFooter" #footer>
      <div class="flex justify-end space-x-2 border-t border-gray-200 p-4">
        <Button v-if="props.showCancelButton" @click="handleCancel">
          {{ props.cancelText }}
        </Button>
        <Button v-if="!isFirstStep" @click="handlePrev">
          {{ props.prevText }}
        </Button>
        <Button v-if="!isLastStep" type="primary" @click="handleNext">
          {{ props.nextText }}
        </Button>
        <Button
          v-if="isLastStep"
          type="primary"
          :loading="isSubmitting"
          @click="handleSubmit"
        >
          {{ props.confirmText }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style lang="scss">
// 可以添加一些默认样式
.multi-step-modal-form {
  // 例如，限制最大宽度
  // max-width: 800px;
}
</style>
