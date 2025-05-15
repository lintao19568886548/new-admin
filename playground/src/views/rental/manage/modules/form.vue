<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, Card, message, Step, Steps } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createPark, updatePark } from '#/api/park';
import { getSystemParkDetail } from '#/api/system/park';
import { $t } from '#/locales';
import { useParkStore } from '#/store';

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

const id = ref<number>();

const parkStore = useParkStore();
// 添加页面切换函数

async function handleNext(step: number) {
  // 验证当前表单
  if (currentTab.value === 0) {
    const { valid } = await parkFormApi.validate();
    const apiValues = await parkFormApi.getValues(); // 使用 apiValues 避免与 onConfirm 中的 values 混淆
    if (!valid) {
      message.warning('请完成园区信息表单的必填项');
      return;
    }

    // 处理图片数据以符合 Prisma 嵌套写入的格式
    if (apiValues.images && Array.isArray(apiValues.images)) {
      const imageConnectInputs = apiValues.images
        .map((img: any) => {
          // 从新上传的图片或已存在的图片数据中获取 imgId
          const imgId = img.response?.data?.imgId || img.imgId;
          if (imgId) {
            // 此结构假设 Park.images 是到 ParkImage 的关联,
            // ParkImage 有一个 'image' 字段关联到 Image 模型。
            // 我们正在创建 ParkImage 记录，每个记录连接到一个已存在的 Image。
            return { image: { connect: { imgId: Number(imgId) } } };
          }
          return null;
        })
        .filter(Boolean); // 过滤掉无效的条目 (比如没有 imgId 的)

      apiValues.images = {
        create: imageConnectInputs,
        ...(id.value ? { deleteMany: {} } : {}), // 如果是更新，则添加 deleteMany
      };
    } else {
      // 如果没有提供图片
      apiValues.images = id.value ? { deleteMany: {} } : undefined; // 更新则删除所有关联，创建则为 undefined
    }

    const parkDataForApi = { ...apiValues };

    const park = id.value
      ? await updatePark(id.value, parkDataForApi)
      : await createPark(parkDataForApi);
    id.value = park.parkId;
    parkStore.parkId = park.parkId;
  }
  currentTab.value = step;
}

const [Modal, modalApi] = useVbenModal({
  // 或者使用class设置样式
  class: 'max-w-[90%] w-[1500px]',
  closeOnClickModal: false,
  async onConfirm() {
    const { valid } = await dormitoryFormApi.validate();
    if (valid) {
      modalApi.lock();
      const parkValues = await parkFormApi.getValues();
      const factoryValues = await factoryFormApi.getValues();
      const dormitoryValues = await dormitoryFormApi.getValues();
      if (factoryValues.factories?.length > 0) {
        factoryValues.factories.forEach((factory: any) => {
          factory.buildTime = factory.buildTime
            ? new Date(factory.buildTime).toISOString()
            : undefined;
        });
      }

      const values = {
        park: { ...parkValues },
        ...factoryValues,
        ...dormitoryValues,
      };

      try {
        if (id.value) {
          // await updateSystemPark(id.value, values);
          message.success({
            content: $t('ui.actionMessage.updateSuccess', [
              values.park.parkName,
            ]),
          });
        } else {
          // await createSystemPark(values);
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
      parkFormApi.resetForm();
      if (data && Object.keys(data).length > 0) {
        formData.value = data;
        id.value = data.parkId;
        const parkDetail = await getSystemParkDetail(data.parkId);
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
