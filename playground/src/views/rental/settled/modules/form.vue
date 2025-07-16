<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Card, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getFactoryDetail } from '#/api/factory/factory';
import { usePlatform } from '#/hooks/usePlatform';
import { $t } from '#/locales';

import { useFactoryFormSchema } from '../data';

// 添加emit定义，用于更新表单值
const emit = defineEmits(['success', 'refresh']);

// 使用 usePlatform Hook 获取平台信息
const { isNativePlatform } = usePlatform();

const formData = ref();
const getTitle = computed(() => {
  return formData.value?.factoryId
    ? $t('ui.actionTitle.edit', ['入驻厂房'])
    : $t('ui.actionTitle.create', ['入驻厂房']);
});

const [FactoryForm, factoryFormApi] = useVbenForm({
  layout: 'horizontal',
  schema: useFactoryFormSchema(),
  showDefaultActions: false,
});

const id = ref<number>();

const [Modal, modalApi] = useVbenModal({
  // 移动端优化：使用响应式宽度设置
  class: 'mobile-factory-modal',
  closeOnClickModal: false,
  async onConfirm() {
    modalApi.close();
    emit('refresh');
    // const { valid } = await factoryFormApi.validate();
    // if (valid) {
    //   modalApi.lock();
    //   const factoryValues = await factoryFormApi.getValues();
    //   // 处理厂房数据中的建造时间
    //   if (factoryValues.factories?.length > 0) {
    //     factoryValues.factories.forEach((factory: any) => {
    //       factory.buildTime = factory.buildTime
    //         ? new Date(factory.buildTime).toISOString()
    //         : undefined;
    //       // 设置为非自有厂房（入驻厂房）
    //       factory.isOwn = false;
    //     });
    //   }
    //   try {
    //     if (id.value) {
    //       // 更新入驻厂房
    //       if (factoryValues.factories?.length > 0) {
    //         const factory = factoryValues.factories[0];
    //         await updateFactory(id.value, factory);
    //       }
    //       message.success({
    //         content: '更新入驻厂房成功',
    //       });
    //     } else {
    //       // 创建入驻厂房
    //       if (factoryValues.factories?.length > 0) {
    //         for (const factory of factoryValues.factories) {
    //           await createSettledFactory(factory);
    //         }
    //       }
    //       message.success({
    //         content: '创建入驻厂房成功',
    //       });
    //     }
    //     modalApi.close();
    //     emit('success');
    //   } catch (error) {
    //     console.error('操作失败:', error);
    //     message.error({
    //       content: id.value ? '更新入驻厂房失败' : '创建入驻厂房失败',
    //     });
    //   } finally {
    //     modalApi.lock(false);
    //   }
    // }
  },
  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData();
      factoryFormApi.resetForm();
      if (data && Object.keys(data).length > 0) {
        formData.value = data;
        id.value = data.factoryId;

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

          // 设置表单数据，包装成factories数组格式
          const formValues = {
            factories: [factoryDetail],
          };

          factoryFormApi.setValues(formValues);
        } catch (error) {
          console.error('获取厂房详情失败:', error);
          message.error('获取厂房详情失败');
          // 如果获取失败，使用传入的基本数据
          factoryFormApi.setValues(data);
        }
      } else {
        id.value = undefined;
        formData.value = undefined;
        // 重置表单
        factoryFormApi.setValues({});
      }
    }
  },
  // 添加以下两行来隐藏默认按钮
  showCancelButton: false,
  // showConfirmButton: false,
});
</script>

<template>
  <div>
    <Modal :title="getTitle">
      <div v-if="!isNativePlatform" class="p-5">
        <Card style="background-color: #fcfcfc">
          <FactoryForm style="margin: 2vh 2vw 0 0" />
        </Card>
      </div>
      <div v-else class="modal-content">
        <Card class="form-card">
          <FactoryForm class="factory-form" />
        </Card>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
/* 移动端适配 */
@media (max-width: 768px) {
  :deep(.mobile-factory-modal) {
    top: 20px !important;
    width: 98% !important;
    max-width: none !important;
    margin: 8px !important;
  }

  :deep(.mobile-factory-modal .ant-modal-content) {
    overflow: hidden !important;
    border-radius: 12px !important;
  }

  :deep(.mobile-factory-modal .ant-modal-header) {
    padding: 16px 20px !important;
    border-bottom: 1px solid #f0f0f0 !important;
  }

  :deep(.mobile-factory-modal .ant-modal-title) {
    font-size: 18px !important;
    font-weight: 600 !important;
  }

  :deep(.mobile-factory-modal .ant-modal-body) {
    max-height: calc(100vh - 120px) !important;
    padding: 0 !important;
    overflow-y: auto !important;
  }

  :deep(.mobile-factory-modal .ant-modal-footer) {
    padding: 12px 20px !important;
    text-align: center !important;
    border-top: 1px solid #f0f0f0 !important;
  }

  :deep(.mobile-factory-modal .ant-modal-footer .ant-btn) {
    min-width: 80px !important;
    height: 40px !important;
    font-size: 15px !important;
    border-radius: 6px !important;
  }
}

@media (max-width: 768px) {
  .modal-content {
    padding: 16px;
  }
}

@media (max-width: 768px) {
  .form-card {
    background-color: #fff;
    border: none;
    border-radius: 0;
    box-shadow: none;
  }
}

@media (max-width: 768px) {
  .factory-form {
    margin: 0;
  }

  /* 优化表单项在移动端的显示 */
  :deep(.factory-form .ant-form-item) {
    margin-bottom: 16px;
  }

  :deep(.factory-form .ant-form-item-label) {
    padding-bottom: 4px;
  }

  :deep(.factory-form .ant-form-item-label > label) {
    font-size: 14px;
    font-weight: 500;
  }

  :deep(.factory-form .ant-input) {
    height: 44px;
    font-size: 16px;
    border-radius: 6px;
  }

  :deep(.factory-form .ant-select) {
    font-size: 16px;
  }

  :deep(.factory-form .ant-select-selector) {
    height: 44px !important;
    border-radius: 6px !important;
  }

  :deep(.factory-form .ant-select-selection-item) {
    font-size: 16px;
    line-height: 42px !important;
  }

  :deep(.factory-form .ant-picker) {
    height: 44px;
    font-size: 16px;
    border-radius: 6px;
  }

  :deep(.factory-form .ant-input-number) {
    width: 100%;
    height: 44px;
    font-size: 16px;
    border-radius: 6px;
  }

  :deep(.factory-form .ant-input-number-input) {
    height: 42px;
    font-size: 16px;
  }
}

:deep(.mobile-factory-modal) {
  width: 95% !important;
  max-width: 1200px !important;
  margin: 0 auto !important;
}

.modal-content {
  padding: 20px;
}

.form-card {
  background-color: #fcfcfc;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  box-shadow: none;
}

.factory-form {
  margin: 2vh 2vw 0 0;
}

/* 移动端模态框样式优化 */
</style>
