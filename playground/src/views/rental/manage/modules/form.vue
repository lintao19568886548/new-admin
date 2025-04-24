<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, Card, message, Step, Steps } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createSystemPark,
  getSystemParkDetail,
  updateSystemPark,
} from '#/api/system/park';
import { $t } from '#/locales';

import {
  useDormitoryFormSchema,
  useFactoryFormSchema,
  useParkFormSchema,
} from '../data';

// 添加emit定义，用于更新表单值
const emit = defineEmits(['success']);

const currentTab = ref(0);

const formData = ref();
const getTitle = computed(() => {
  return formData.value?.parkId
    ? $t('ui.actionTitle.edit', [$t('page.park.item')])
    : $t('ui.actionTitle.create', [$t('page.park.item')]);
});

const [ParkForm, parkFormApi] = useVbenForm({
  layout: 'horizontal',
  schema: useParkFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-2',
});

const [FactoryForm, factoryFormApi] = useVbenForm({
  layout: 'horizontal',
  schema: useFactoryFormSchema(),
  showDefaultActions: false,
});

const [DormitoryForm, dormitoryFormApi] = useVbenForm({
  layout: 'horizontal',
  schema: useDormitoryFormSchema(),
  showDefaultActions: false,
});

const id = ref();
// 添加页面切换函数

async function handleNext(step: number) {
  // 验证当前表单
  if (currentTab.value === 0) {
    const { valid } = await parkFormApi.validate();
    if (!valid) {
      message.warning('请完成园区信息表单的必填项');
      return;
    }
  }

  currentTab.value = step;
}

const [Modal, modalApi] = useVbenModal({
  // 或者使用class设置样式
  class: 'max-w-[90%] w-[1500px]',
  async onConfirm() {
    const { valid } = await dormitoryFormApi.validate();
    if (valid) {
      modalApi.lock();
      const parkValues = await parkFormApi.getValues();
      const factoryValues = await factoryFormApi.getValues();
      const dormitoryValues = await dormitoryFormApi.getValues();
      factoryValues.factories.forEach((factory: any) => {
        factory.buildTime = factory.buildTime
          ? new Date(factory.buildTime).toISOString()
          : undefined;
      });

      const values = {
        park: { ...parkValues },
        ...factoryValues,
        ...dormitoryValues,
      };

      console.warn('提交表单，数据:', values);

      try {
        if (id.value) {
          await updateSystemPark(id.value, values);
          message.success({
            content: $t('ui.actionMessage.updateSuccess', [
              values.park.parkName,
            ]),
          });
        } else {
          await createSystemPark(values);
          message.success({
            content: $t('ui.actionMessage.createSuccess', [
              values.park.parkName,
            ]),
          });
        }
        modalApi.close();
        emit('success');
      } catch (error) {
        console.error('操作失败:', error);
        message.error({
          content: id.value
            ? $t('ui.actionMessage.updateFailed', [values.park.parkName])
            : $t('ui.actionMessage.createFailed', [values.park.parkName]),
        });
      } finally {
        modalApi.lock(false);
      }
    }
  },
  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData();
      console.warn('打开表单，数据:', data);
      parkFormApi.resetForm();
      if (data && Object.keys(data).length > 0) {
        formData.value = data;
        id.value = data.parkId;
        const parkDetail = await getSystemParkDetail(data.parkId);
        console.warn('设置表单数据:', parkDetail);
        parkFormApi.setValues(parkDetail);
        factoryFormApi.setValues(parkDetail);
        dormitoryFormApi.setValues(parkDetail);
      } else {
        id.value = undefined;
        formData.value = undefined;
        // 不设置默认值
        parkFormApi.setValues({});
        factoryFormApi.setValues({});
        dormitoryFormApi.setValues({});
      }
    }
  },
  // 添加以下两行来隐藏默认按钮
  showCancelButton: false,
  showConfirmButton: false,
});
</script>

<template>
  <div>
    <Modal :title="getTitle">
      <div>
        <Steps :current="currentTab" class="steps w-full px-4">
          <Step title="园区信息" @click="handleNext(0)" />
          <Step title="厂房信息" @click="handleNext(1)" />
          <Step title="宿舍信息" @click="handleNext(2)" />
        </Steps>
        <div class="p-5">
          <Card style="background-color: #fcfcfc" v-show="currentTab === 0">
            <ParkForm style="margin: 2vh 2vw 0 0" />
          </Card>

          <Card style="background-color: #fcfcfc" v-show="currentTab === 1">
            <FactoryForm style="margin: 2vh 2vw 0 0" />
          </Card>

          <Card style="background-color: #fcfcfc" v-show="currentTab === 2">
            <DormitoryForm style="margin: 2vh 2vw 0 0" />
          </Card>
        </div>
      </div>
      <template #footer>
        <div class="flex w-full justify-between">
          <div>
            <Button v-if="currentTab > 0" @click="handleNext(currentTab - 1)">
              上一步
            </Button>
          </div>
          <div>
            <Button
              v-if="currentTab < 2"
              type="primary"
              @click="handleNext(currentTab + 1)"
            >
              下一步
            </Button>
            <Button v-else type="primary" @click="modalApi.onConfirm()">
              提交
            </Button>
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>
