<script lang="ts" setup>
import type { RentalManagementItem } from '../types';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message, Step, Steps } from 'ant-design-vue';
import dayjs from 'dayjs'; // 添加 dayjs 导入

import { useVbenForm } from '#/adapter/form';
import { createManage, updateManage } from '#/api/rental';
import { $t } from '#/locales';

import { useFactoryFormSchema, useParkFormSchema } from '../data';

const emit = defineEmits(['success']);

const currentTab = ref(0);

const formData = ref<RentalManagementItem>();
const getTitle = computed(() => {
  return formData.value?.factoryId
    ? $t('ui.actionTitle.edit', [$t('page.park.item')])
    : $t('ui.actionTitle.create', [$t('page.park.item')]);
});

const [ParkForm, parkFormApi] = useVbenForm({
  layout: 'vertical',
  schema: useParkFormSchema(),
  showDefaultActions: false,
});

const [FactoryForm, factoryFormApi] = useVbenForm({
  layout: 'vertical',
  schema: useFactoryFormSchema(),
  showDefaultActions: false,
});

// function resetForm() {
//   parkFormApi.resetForm();
//   parkFormApi.setValues(formData.value || {});
// }

const id = ref();
// 添加页面切换函数
function handlePrev() {
  if (currentTab.value > 0) {
    currentTab.value--;
  }
}

async function handleNext() {
  // 验证当前表单
  if (currentTab.value === 0) {
    const { valid } = await parkFormApi.validate();
    if (!valid) {
      message.warning('请完成园区信息表单的必填项');
      return;
    }
  } else if (currentTab.value === 1) {
    // 验证厂房信息表单
    const { valid } = await factoryFormApi.validate();
    if (!valid) {
      message.warning('请完成厂房信息表单的必填项');
      return;
    }
  }

  // 验证通过后，切换到下一步
  if (currentTab.value < 2) {
    currentTab.value++;
  } else {
    // 最后一页，提交表单
    modalApi.onConfirm();
  }
}

const [Modal, modalApi] = useVbenModal({
  // 或者使用class设置样式
  class: 'max-w-[90%] w-[1500px]',
  async onConfirm() {
    const { valid } = await parkFormApi.validate();
    if (valid) {
      modalApi.lock();
      const values = await parkFormApi.getValues();

      // 处理日期格式，确保使用本地时间
      if (values.createTime) {
        values.createTime = dayjs(values.createTime).format('YYYY-MM-DD');
      }

      try {
        if (id.value) {
          await updateManage(id.value, values);
          message.success({
            content: $t('ui.actionMessage.updateSuccess', [values.title]),
          });
        } else {
          await createManage(values);
          message.success({
            content: $t('ui.actionMessage.createSuccess', [values.title]),
          });
        }
        modalApi.close();
        emit('success');
      } catch (error) {
        console.error('操作失败:', error);
        message.error({
          content: id.value
            ? $t('ui.actionMessage.updateFailed', [values.title])
            : $t('ui.actionMessage.createFailed', [values.title]),
        });
      } finally {
        modalApi.lock(false);
      }
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<RentalManagementItem>();
      console.warn('打开表单，数据:', data);
      parkFormApi.resetForm();
      if (data && Object.keys(data).length > 0) {
        // 处理日期格式，将UTC时间转换为本地日期
        if (data.createTime) {
          data.createTime = dayjs(data.createTime).format('YYYY-MM-DD');
        }

        formData.value = data;
        id.value = data.factoryId;
        parkFormApi.setValues(data);
      } else {
        id.value = undefined;
        formData.value = undefined;
        // 不设置默认值
        parkFormApi.setValues({} as Partial<RentalManagementItem>);
      }
    }
  },
  // 添加以下两行来隐藏默认按钮
  showCancelButton: false,
  showConfirmButton: false,
});
</script>

<template>
  <Modal :title="getTitle">
    <div>
      <Steps :current="currentTab" class="steps w-full px-4">
        <Step title="园区信息" />
        <Step title="厂房信息" />
        <Step title="宿舍信息" />
      </Steps>
      <div class="p-5">
        <ParkForm v-show="currentTab === 0" />
        <!-- 这里可以添加其他表单组件 -->
        <FactoryForm v-show="currentTab === 1" />
        <div v-show="currentTab === 2">宿舍信息表单</div>
      </div>
    </div>
    <template #footer>
      <div class="flex w-full justify-between">
        <div>
          <Button v-if="currentTab > 0" @click="handlePrev"> 上一步 </Button>
        </div>
        <div>
          <Button v-if="currentTab < 2" type="primary" @click="handleNext">
            下一步
          </Button>
          <Button v-else type="primary" @click="modalApi.onConfirm()">
            提交
          </Button>
        </div>
      </div>
    </template>
  </Modal>
</template>
