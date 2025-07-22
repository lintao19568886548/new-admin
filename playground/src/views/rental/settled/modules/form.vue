<script lang="ts" setup>
import type { Factory, FloorItem } from '../types';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createSettledFactory,
  getFactoryDetail,
  updateFactory,
} from '#/api/factory/factory';
import { $t } from '#/locales';

// 导入表单配置和楼层组件
import { useFactoryItemFormSchema } from '../data';
import FloorFormComponent from './floor-form.vue';

const emit = defineEmits<{
  success: [];
}>();

// 表单数据
const formData = ref<any>();
const factoryData = ref<Factory[]>([{ floors: [] }]);

// 标题计算属性
const getTitle = computed(() => {
  return formData.value?.factoryId
    ? $t('ui.actionTitle.edit', ['入驻厂房'])
    : $t('ui.actionTitle.create', ['入驻厂房']);
});

// 厂房表单配置
const [FactoryForm, factoryFormApi] = useVbenForm({
  commonConfig: {
    formItemClass: 'mobile-form-item',
  },
  layout: 'vertical',
  schema: useFactoryItemFormSchema().filter(
    (item) => item.fieldName !== 'floors',
  ),
  showDefaultActions: false,
  wrapperClass: 'gap-4',
});

// 原始的厂房保存函数
async function saveFactoryData() {
  const { valid } = await factoryFormApi.validate();
  if (!valid) return;

  modalApi.lock();
  try {
    const factoryValues = await factoryFormApi.getValues();

    // 添加楼层数据
    factoryValues.floors = factoryData.value[0]?.floors || [];

    // 处理日期格式
    if (factoryValues.buildTime) {
      factoryValues.buildTime = new Date(factoryValues.buildTime).toISOString();
    }

    // 设置为入驻厂房
    factoryValues.isOwn = false;

    if (formData.value?.factoryId) {
      const requestData = {
        ...factoryValues,
        floors: factoryValues.floors.map((floor: any) => ({
          ...floor,
          imageUrls: undefined,
          imgUrl: undefined,
        })),
      };
      // 更新厂房
      await updateFactory(formData.value.factoryId, requestData);
      message.success('更新入驻厂房成功');
    } else {
      // 创建厂房
      await createSettledFactory(factoryValues);
      message.success('创建入驻厂房成功');
    }

    modalApi.close();
    emit('success');
  } catch (error) {
    console.error('操作失败:', error);
    message.error(
      formData.value?.factoryId ? '更新入驻厂房失败' : '创建入驻厂房失败',
    );
  } finally {
    modalApi.unlock();
  }
}

// 模态框配置
const [Modal, modalApi] = useVbenModal({
  class: 'mobile-factory-modal',
  closeOnClickModal: false,
  async onCancel() {
    // 检查是否有楼层表单正在编辑
    if (floorFormRef.value?.isFormVisible?.()) {
      // 如果楼层表单可见，执行楼层取消操作
      floorFormRef.value.cancelEdit();
      return; // 阻止模态框关闭
    }
    // 楼层表单不可见或未初始化时，允许模态框关闭
    modalApi.close();
  },
  async onConfirm() {
    // 检查是否有楼层表单正在编辑
    // 根据楼层表单是否可见决定执行相应的保存操作
    await (floorFormRef.value?.isFormVisible?.()
      ? floorFormRef.value.saveFloorData()
      : saveFactoryData());
  },
  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<any>();
      resetAllForms();

      if (data && Object.keys(data).length > 0) {
        formData.value = data;

        // 设置厂房数据，包含楼层信息
        if (data.factoryId) {
          try {
            // 获取厂房详情数据
            const response = await getFactoryDetail(data.factoryId);

            // 判断API返回格式：可能是 response.data 或直接是 response
            let factoryDetail;
            if (response && response.data) {
              // 标准格式：{data: factoryObject}
              factoryDetail = response.data;
            } else if (response && response.factoryId) {
              // 直接返回厂房对象
              factoryDetail = response;
            } else {
              throw new Error('API返回数据格式不正确');
            }

            // 验证厂房数据是否有效
            if (
              !factoryDetail ||
              typeof factoryDetail !== 'object' ||
              !factoryDetail.factoryId
            ) {
              throw new Error('厂房数据格式错误或缺少必要字段');
            }

            // 设置厂房数据，包含楼层信息
            factoryData.value = [
              {
                ...factoryDetail,
                floors: factoryDetail.floors || [],
              },
            ];

            // 设置厂房表单数据（不包含楼层字段）
            const factoryFormData = { ...factoryDetail };
            delete factoryFormData.floors; // 移除楼层字段，因为楼层由单独组件管理
            await factoryFormApi.setValues(factoryFormData);
          } catch (error) {
            console.error('获取厂房详情失败:', error);
            message.error('获取厂房详情失败');
            // 如果获取失败，使用传入的基本数据
            factoryData.value = [
              {
                ...data,
                floors: data.floors || [],
              },
            ];

            const factoryFormData = { ...data };
            delete factoryFormData.floors;
            await factoryFormApi.setValues(factoryFormData);
          }
        }
      } else {
        formData.value = undefined;
        factoryData.value = [{ floors: [] }];
      }
    }
  },
  showCancelButton: true,
  showConfirmButton: true,
});

// 重置所有表单
function resetAllForms() {
  factoryFormApi.resetForm();
}

// 楼层表单组件引用
const floorFormRef = ref();

// 楼层数据的计算属性，用于 v-model
const floorsModel = computed({
  get() {
    return factoryData.value[0]?.floors || [];
  },
  set(value: FloorItem[]) {
    if (!factoryData.value[0]) {
      factoryData.value[0] = { floors: [] };
    }
    factoryData.value[0].floors = value;
  },
});

// 处理楼层数据更新
function handleFloorsUpdate(floors: FloorItem[]) {
  if (!factoryData.value[0]) {
    factoryData.value[0] = { floors: [] };
  }
  factoryData.value[0].floors = floors;
}

// 重置表单
async function resetForm() {
  factoryFormApi.resetForm();
  if (formData.value) {
    await factoryFormApi.setValues(formData.value);
  }
}
</script>

<template>
  <Modal :title="getTitle">
    <div class="mobile-form-container">
      <!-- 厂房表单 -->
      <div class="factory-form-section">
        <FactoryForm />
      </div>

      <!-- 楼层管理组件 -->
      <FloorFormComponent
        ref="floorFormRef"
        v-model="floorsModel"
        @update:model-value="handleFloorsUpdate"
      />
    </div>

    <template #prepend-footer>
      <div class="mobile-form-footer">
        <Button type="default" @click="resetForm" class="reset-btn">
          {{ $t('common.reset') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
/* 底部操作区域 */
.mobile-form-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-start;
  padding: 16px 0;
}

.reset-btn {
  border-radius: 8px;
  transition: all 0.3s ease;
}

.reset-btn:hover {
  box-shadow: 0 2px 4px rgb(0 0 0 / 10%);
  transform: translateY(-1px);
}
</style>
