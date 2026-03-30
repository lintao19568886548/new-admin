<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

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

const emit = defineEmits(['success']);

const currentTab = ref(0);
const isMobileViewport = ref(false);
const stepTitles = ['园区信息', '厂房信息', '宿舍信息'];

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

function updateViewport() {
  isMobileViewport.value = window.innerWidth < 768;
  syncFormLayout();
}

function syncFormLayout() {
  const layout = isMobileViewport.value ? 'vertical' : 'horizontal';
  const wrapperClass = isMobileViewport.value ? 'grid-cols-1' : 'grid-cols-2';
  parkFormApi.setState({ layout, wrapperClass });
  factoryFormApi.setState({ layout });
  dormitoryFormApi.setState({ layout });
}

async function handleNext(step: number) {
  // 验证当前表单
  if (currentTab.value === 0) {
    const { valid } = await parkFormApi.validate();
    const apiValues = await parkFormApi.getValues(); // 使用 apiValues 避免与 onConfirm 中的 values 混淆
    if (!valid) {
      message.warning('请完成园区信息表单的必填项');
      return;
    }

    if (apiValues.images && Array.isArray(apiValues.images)) {
      const imageConnectInputs = apiValues.images
        .map((img: any) => {
          const imgId = img.response?.data?.imgId || img.imgId;
          if (imgId) {
            return { image: { connect: { imgId: Number(imgId) } } };
          }
          return null;
        })
        .filter(Boolean);

      apiValues.images = {
        create: imageConnectInputs,
        ...(id.value ? { deleteMany: {} } : {}),
      };
    } else {
      apiValues.images = id.value ? { deleteMany: {} } : undefined;
    }

    const parkDataForApi = { ...apiValues };

    const park = id.value
      ? await updatePark(id.value, parkDataForApi)
      : await createPark(parkDataForApi);

    // 操作成功后，强制刷新store中的园区列表数据
    await parkStore.fetchParkList(true);
    id.value = park.parkId;
    parkStore.parkId = park.parkId;
  }
  currentTab.value = step;
}

const [Modal, modalApi] = useVbenModal({
  closeOnClickModal: false,
  fullscreenButton: false,
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
          message.success({
            content: $t('ui.actionMessage.updateSuccess', [
              values.park.parkName,
            ]),
          });
        } else {
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
      modalApi.setState({
        class: isMobileViewport.value
          ? 'max-w-[100vw] w-[100vw]'
          : 'max-w-[90%] w-[1500px]',
        fullscreen: isMobileViewport.value,
      });
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
        parkFormApi.setValues({});
        factoryFormApi.setValues({});
        dormitoryFormApi.setValues({});
      }
    }
  },
  showCancelButton: false,
  showConfirmButton: false,
});

onMounted(() => {
  updateViewport();
  syncFormLayout();
  window.addEventListener('resize', updateViewport);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewport);
});
</script>

<template>
  <div class="manage-form-modal">
    <Modal :title="getTitle">
      <div class="modal-content">
        <Steps
          :current="currentTab"
          class="steps w-full px-2"
          :size="isMobileViewport ? 'small' : 'default'"
        >
          <Step
            v-for="(stepTitle, stepIndex) in stepTitles"
            :key="stepTitle"
            :title="stepTitle"
            @click="handleNext(stepIndex)"
          />
        </Steps>
        <div class="step-caption">当前步骤：{{ stepTitles[currentTab] }}</div>
        <div :class="isMobileViewport ? 'p-3' : 'p-5'">
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
        <div class="footer-actions">
          <div>
            <Button
              v-if="currentTab > 0"
              @click="handleNext(currentTab - 1)"
              :block="isMobileViewport"
              :size="isMobileViewport ? 'large' : 'middle'"
            >
              上一步
            </Button>
          </div>
          <div>
            <Button
              v-if="currentTab < 2"
              type="primary"
              @click="handleNext(currentTab + 1)"
              :block="isMobileViewport"
              :size="isMobileViewport ? 'large' : 'middle'"
            >
              下一步
            </Button>
            <Button
              v-else
              type="primary"
              @click="modalApi.onConfirm()"
              :block="isMobileViewport"
              :size="isMobileViewport ? 'large' : 'middle'"
            >
              提交
            </Button>
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.steps {
  padding-bottom: 4px;
  margin-bottom: 6px;
  overflow-x: auto;
}

.step-caption {
  margin-bottom: 8px;
  font-size: 13px;
  color: rgb(0 0 0 / 65%);
}

.footer-actions {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  width: 100%;
}

@media (width < 768px) {
  .modal-content {
    min-height: calc(100vh - 146px);
  }

  .footer-actions {
    grid-template-columns: 1fr;
  }
}
</style>
