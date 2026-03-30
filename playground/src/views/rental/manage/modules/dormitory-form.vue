<script setup lang="ts">
import type { Dormitory } from '../data';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { useVbenForm, useVbenModal } from '@vben/common-ui';

import { Button, Card, Empty, message, Popconfirm } from 'ant-design-vue';

import {
  createDormitory,
  deleteDormitory,
  updateDormitory,
} from '#/api/dormitory';
import { $t } from '#/locales';
import { useParkStore } from '#/store';

import { useDormitoryItemFormSchema } from '../data';

const props = defineProps({
  modelValue: {
    default: () => [],
    type: Array,
  },
});

const emit = defineEmits(['update:modelValue']);

const data = ref<Dormitory[]>([]);
const parkStore = useParkStore();
const isMobileViewport = ref(false);
const currentEditIndex = ref<null | number>(null);

const getTitle = computed(() => {
  return currentEditIndex.value === null
    ? $t('ui.actionTitle.create', [$t('page.dormitory.item')])
    : $t('ui.actionTitle.edit', [$t('page.dormitory.item')]);
});

watch(
  () => props.modelValue,
  (val) => {
    data.value = Array.isArray(val) ? ([...val] as Dormitory[]) : [];
  },
  { immediate: true },
);

const [Form, formApi] = useVbenForm({
  layout: 'horizontal',
  schema: useDormitoryItemFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-3',
});

function updateViewport() {
  isMobileViewport.value = window.innerWidth < 768;
  formApi.setState({
    layout: isMobileViewport.value ? 'vertical' : 'horizontal',
    wrapperClass: isMobileViewport.value ? 'grid-cols-1' : 'grid-cols-3',
  });
}

function openDormitoryModal() {
  dormitoryModalApi.setState({
    class: isMobileViewport.value
      ? 'max-w-[100vw] w-[100vw]'
      : 'max-w-[90%] w-[1200px]',
    fullscreen: isMobileViewport.value,
  });
  dormitoryModalApi.open();
}

function handleAddDormitory() {
  formApi.resetForm();
  currentEditIndex.value = null;
  openDormitoryModal();
}

function handleEdit(index: number) {
  formApi.setValues(data.value[index] || {});
  currentEditIndex.value = index;
  openDormitoryModal();
}

async function handleDeleteDormitory(index: number) {
  const currentDormitory = data.value[index];
  try {
    if (currentDormitory?.dormitoryId) {
      await deleteDormitory(currentDormitory.dormitoryId);
    }
    data.value.splice(index, 1);
    emit('update:modelValue', data.value);
    message.success('删除成功');
  } catch (error) {
    console.error('删除宿舍失败:', error);
    message.error('删除失败，请稍后重试');
  }
}

const [DormitoryItemModal, dormitoryModalApi] = useVbenModal({
  closeOnClickModal: false,
  destroyOnClose: false,
  fullscreenButton: false,
  onCancel: () => {
    currentEditIndex.value = null;
    dormitoryModalApi.close();
    return false;
  },
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    dormitoryModalApi.lock();
    try {
      const values = await formApi.getValues();

      values.images =
        values.images && Array.isArray(values.images)
          ? values.images
              .map((image: any) => {
                if (image.response?.data) {
                  const response = image.response.data;
                  return {
                    imgId: response.imgId,
                    name: response.name,
                    url: response.url,
                  };
                }
                if (image.imgId && image.url) {
                  return {
                    imgId: image.imgId,
                    name: image.name || image.url.split('/').pop() || '',
                    url: image.url,
                  };
                }
                return null;
              })
              .filter((img) => img !== null)
          : [];

      if (currentEditIndex.value === null) {
        const dormitory = await createDormitory({
          parkId: parkStore.parkId,
          ...values,
        });
        data.value.push(dormitory);
      } else {
        const originalData = data.value[currentEditIndex.value];
        if (originalData?.dormitoryId) {
          const dormitory = await updateDormitory(
            originalData.dormitoryId,
            values,
          );
          data.value[currentEditIndex.value] = dormitory;
        }
        currentEditIndex.value = null;
      }

      emit('update:modelValue', data.value);
      dormitoryModalApi.close();
    } finally {
      dormitoryModalApi.lock(false);
    }
  },
});

onMounted(() => {
  updateViewport();
  window.addEventListener('resize', updateViewport);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewport);
});
</script>

<template>
  <div class="dormitory-module">
    <div class="module-header">
      <div class="module-title">{{ $t('page.dormitory.list') }}</div>
      <Button
        type="primary"
        @click="handleAddDormitory"
        :size="isMobileViewport ? 'large' : 'middle'"
      >
        {{ $t('page.dormitory.create') }}
      </Button>
    </div>

    <div v-if="data.length > 0" class="dormitory-list">
      <Card
        v-for="(item, index) in data"
        :key="item.dormitoryId || index"
        class="dormitory-card"
        :bordered="false"
      >
        <div class="dormitory-card__name">
          {{ item.dormitoryName || '未命名宿舍' }}
        </div>
        <div class="dormitory-card__meta">
          <div>总层数：{{ item.floorCount || 0 }} 层</div>
          <div>总房间：{{ item.totalRooms || 0 }} 间</div>
          <div>单间面积：{{ item.roomArea || 0 }} m²</div>
        </div>
        <div class="dormitory-card__actions">
          <Button
            block
            :size="isMobileViewport ? 'large' : 'middle'"
            @click="handleEdit(index)"
          >
            编辑
          </Button>
          <Popconfirm title="确认删除" @confirm="handleDeleteDormitory(index)">
            <Button danger block :size="isMobileViewport ? 'large' : 'middle'">
              删除
            </Button>
          </Popconfirm>
        </div>
      </Card>
    </div>
    <Empty v-else description="暂无宿舍，请先新增" />

    <DormitoryItemModal :title="getTitle">
      <Form />
    </DormitoryItemModal>
  </div>
</template>

<style scoped>
.dormitory-module {
  width: 100%;
}

.module-header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.module-title {
  font-size: 16px;
  font-weight: 600;
}

.dormitory-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.dormitory-card {
  border-radius: 10px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.dormitory-card__name {
  margin-bottom: 8px;
  font-size: 15px;
  font-weight: 600;
}

.dormitory-card__meta {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  margin-bottom: 12px;
  color: rgb(0 0 0 / 65%);
}

.dormitory-card__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

@media (width >= 768px) {
  .dormitory-list {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
