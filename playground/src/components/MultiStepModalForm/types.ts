// 如果文件不存在，请创建
import type { VNode } from 'vue';

/**
 * 定义每个步骤的结构
 */
export interface StepConfig {
  content?: (() => VNode) | VNode; // 步骤内容 (可选, 优先使用插槽)
  description?: string; // 步骤描述 (可选)
  key: number | string; // 唯一标识符
  title: string; // 步骤标题
}

/**
 * MultiStepModalForm 组件的 Props 定义
 */
export interface MultiStepModalFormProps<T = any> {
  cancelText?: string; // 取消按钮文本 (默认 "取消")
  confirmText?: string; // 确认按钮文本 (默认 "提交")
  initialData?: T; // 表单初始数据 (可选)
  modalClass?: string; // 自定义模态框 CSS 类
  modalTitle?: string; // 模态框标题
  nextText?: string; // 下一步按钮文本 (默认 "下一步")
  prevText?: string; // 上一步按钮文本 (默认 "上一步")
  showCancelButton?: boolean; // 是否显示取消按钮 (默认 true)
  showFooter?: boolean; // 是否显示底部按钮区域 (默认 true)
  steps: StepConfig[]; // 步骤配置数组
  submitFn?: (formData: T) => Promise<any>; // 提交函数，返回 Promise
  validateStepFn?: (
    stepKey: number | string,
    formData: T,
  ) => boolean | Promise<boolean>; // 步骤切换前的验证函数 (可选)
}

/**
 * MultiStepModalForm 组件的 Emits 定义
 */
export interface MultiStepModalFormEmits<T = any> {
  (e: 'cancel' | 'close'): void; // 关闭或取消事件
  (e: 'success', result: any, formData: T): void; // 提交成功事件
  (e: 'update:activeKey', key: number | string): void; // 当前步骤变化事件
  (e: 'update:formData', data: T): void; // 表单数据变化事件
}

/**
 * 定义 MultiStepModalForm 组件的插槽
 */
export interface MultiStepModalFormSlots<T = any> {
  // 动态步骤插槽，key 为步骤的 key
  [key: `step-${number | string}`]: (props: { formData: T }) => any;
  // 其他可能的插槽...
  footer?: () => any;
}
