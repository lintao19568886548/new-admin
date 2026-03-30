<script setup lang="ts">
import type { FloorItem } from '../data';

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { useVbenForm } from '@vben/common-ui';

import { Button, Empty, Popconfirm } from 'ant-design-vue';

import { useParkStore } from '#/store';

import { useFloorFormSchema } from '../data';

const props = defineProps({
  modelValue: {
    default: () => [],
    type: Array,
  },
});

const emit = defineEmits(['update:modelValue']);

const store = useParkStore();
const floorData = ref<FloorItem[]>([]);
const isMobileViewport = ref(false);
const currentEditIndex = ref<null | number>(null);
const isFormVisible = ref(false);
const formContainerRef = ref<HTMLDivElement | null>(null);

watch(
  () => props.modelValue,
  (val) => {
    floorData.value = Array.isArray(val) ? ([...val] as FloorItem[]) : [];
  },
  { immediate: true },
);

const [FloorForm, floorFormApi] = useVbenForm({
  layout: 'horizontal',
  schema: useFloorFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-4',
});

function updateViewport() {
  isMobileViewport.value = window.innerWidth < 768;
  floorFormApi.setState({
    layout: isMobileViewport.value ? 'vertical' : 'horizontal',
    wrapperClass: isMobileViewport.value ? 'grid-cols-1' : 'grid-cols-4',
  });
}

async function scrollToForm() {
  await nextTick();
  formContainerRef.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

async function handleAddFloor() {
  currentEditIndex.value = null;
  floorFormApi.resetForm();
  floorFormApi.setValues({
    description: '',
    floorHeight: '0',
    floorName: `${floorData.value.length + 1}层`,
    loadBearing: '0',
    rentPrice: '0',
    status: '空闲',
    totalArea: '0',
    usedArea: '0',
  });
  isFormVisible.value = true;
  store.buttonStatus = false;
  await scrollToForm();
}

async function handleEditFloor(rowIndex: number) {
  floorFormApi.resetForm();
  floorFormApi.setValues(floorData.value[rowIndex] || {});
  currentEditIndex.value = rowIndex;
  isFormVisible.value = true;
  store.buttonStatus = false;
  await scrollToForm();
}

async function saveFloorData() {
  const { valid } = await floorFormApi.validate();
  if (!valid) {
    return;
  }

  const values = (await floorFormApi.getValues()) as FloorItem;
  const updatedFloorData = [...floorData.value];
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
    updatedFloorData.push(values);
  } else {
    updatedFloorData[currentEditIndex.value] = values;
  }

  floorData.value = updatedFloorData;
  emit('update:modelValue', updatedFloorData);
  store.buttonStatus = true;
  isFormVisible.value = false;
  currentEditIndex.value = null;
}

function cancelEdit() {
  isFormVisible.value = false;
  store.buttonStatus = true;
}

function handleDelete(rowIndex: number) {
  floorData.value.splice(rowIndex, 1);
  emit('update:modelValue', floorData.value);
}

onMounted(() => {
  updateViewport();
  window.addEventListener('resize', updateViewport);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewport);
});
</script>

<template>
  <div class="floor-module">
    <div class="floor-header">
      <Button
        type="primary"
        @click="handleAddFloor"
        :size="isMobileViewport ? 'large' : 'middle'"
      >
        添加楼层
      </Button>
    </div>

    <div v-if="isFormVisible" ref="formContainerRef" class="floor-form">
      <div class="floor-form__title">
        {{ currentEditIndex === null ? '添加楼层' : '编辑楼层' }}
      </div>
      <FloorForm />
      <div class="floor-form__actions">
        <Button
          @click="cancelEdit"
          :block="isMobileViewport"
          :size="isMobileViewport ? 'large' : 'middle'"
        >
          取消
        </Button>
        <Button
          type="primary"
          @click="saveFloorData"
          :block="isMobileViewport"
          :size="isMobileViewport ? 'large' : 'middle'"
        >
          保存
        </Button>
      </div>
    </div>

    <div v-else-if="floorData.length > 0" class="floor-list">
      <div v-for="(floor, index) in floorData" :key="index" class="floor-card">
        <div class="floor-card__header">
          <div class="floor-card__title">{{ floor.floorName }}</div>
          <div class="floor-card__tools">
            <Button type="link" size="small" @click="handleEditFloor(index)">
              编辑
            </Button>
            <Popconfirm title="确认删除" @confirm="handleDelete(index)">
              <Button type="link" danger size="small">删除</Button>
            </Popconfirm>
          </div>
        </div>
        <div class="floor-card__meta">
          <div>层高：{{ floor.floorHeight }} m</div>
          <div>承重：{{ floor.loadBearing }} 吨</div>
          <div>租金：{{ floor.rentPrice }} 元/m²·月</div>
          <div>总面积：{{ floor.totalArea }} m²</div>
          <div>已用面积：{{ floor.usedArea }} m²</div>
          <div>状态：{{ floor.status }}</div>
        </div>
        <div v-if="floor.description" class="floor-card__desc">
          描述：{{ floor.description }}
        </div>
      </div>
    </div>

    <Empty v-else description="暂无楼层数据，请先添加" />
  </div>
</template>

<style scoped>
.floor-module {
  width: 100%;
}

.floor-header {
  margin-bottom: 12px;
}

.floor-form {
  padding: 12px;
  margin-bottom: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgb(0 0 0 / 8%);
}

.floor-form__title {
  margin-bottom: 10px;
  font-size: 16px;
  font-weight: 600;
}

.floor-form__actions {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  margin-top: 12px;
}

.floor-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.floor-card {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.floor-card__header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.floor-card__title {
  font-size: 15px;
  font-weight: 600;
}

.floor-card__tools {
  display: flex;
  align-items: center;
}

.floor-card__meta {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  color: rgb(0 0 0 / 65%);
}

.floor-card__desc {
  margin-top: 8px;
}

@media (width >= 768px) {
  .floor-list {
    grid-template-columns: 1fr 1fr;
  }
}

@media (width < 768px) {
  .floor-form__actions {
    grid-template-columns: 1fr;
  }
}
</style>
