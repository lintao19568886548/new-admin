<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Card, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getFactoryDetail } from '#/api/factory/factory';
import { $t } from '#/locales';

import { useFactoryFormSchema } from '../data';

// 添加emit定义，用于更新表单值
const emit = defineEmits(['success', 'refresh']);

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
  // 或者使用class设置样式
  class: 'max-w-[90%] w-[1200px]',
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
      <div class="p-5">
        <Card style="background-color: #fcfcfc">
          <FactoryForm style="margin: 2vh 2vw 0 0" />
        </Card>
      </div>
    </Modal>
  </div>
</template>
