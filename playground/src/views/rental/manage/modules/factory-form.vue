<script setup lang="ts">
import type { Factory } from '../data';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { useVbenForm, useVbenModal } from '@vben/common-ui';

import { Button, Card, Empty, message, Popconfirm } from 'ant-design-vue';

import { createOwnFactory, deleteFactory, updateFactory } from '#/api/factory';
import { $t } from '#/locales';
import { useParkStore } from '#/store';

import { useFactoryItemFormSchema } from '../data';

const props = defineProps({
  modelValue: {
    default: () => [],
    type: Array,
  },
});

const emit = defineEmits(['update:modelValue']);

const store = useParkStore();
const factoryData = ref<Factory[]>([]);
const isMobileViewport = ref(false);
const currentEditIndex = ref<null | number>(null);

const getTitle = computed(() => {
  return currentEditIndex.value === null
    ? $t('ui.actionTitle.create', [$t('page.factory.item')])
    : $t('ui.actionTitle.edit', [$t('page.factory.item')]);
});

watch(
  () => props.modelValue,
  (val) => {
    factoryData.value = Array.isArray(val) ? ([...val] as Factory[]) : [];
  },
  { immediate: true },
);

const [FactoryItemForm, factoryItemFormApi] = useVbenForm({
  layout: 'horizontal',
  schema: useFactoryItemFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-2',
});

function updateViewport() {
  isMobileViewport.value = window.innerWidth < 768;
  factoryItemFormApi.setState({
    layout: isMobileViewport.value ? 'vertical' : 'horizontal',
    wrapperClass: isMobileViewport.value ? 'grid-cols-1' : 'grid-cols-2',
  });
}

function openFactoryModal() {
  factoryModalApi.setState({
    class: isMobileViewport.value
      ? 'max-w-[100vw] w-[100vw]'
      : 'max-w-[90%] w-[1200px]',
    fullscreen: isMobileViewport.value,
  });
  factoryModalApi.open();
}

function handleAddFactory() {
  factoryItemFormApi.resetForm();
  currentEditIndex.value = null;
  openFactoryModal();
}

function handleEditFactory(index: number) {
  factoryItemFormApi.setValues(factoryData.value[index] || {});
  currentEditIndex.value = index;
  openFactoryModal();
}

async function handleDeleteFactory(index: number) {
  const currentFactory = factoryData.value[index];
  try {
    if (currentFactory?.factoryId) {
      await deleteFactory(currentFactory.factoryId);
    }
    factoryData.value.splice(index, 1);
    emit('update:modelValue', factoryData.value);
    message.success('删除成功');
  } catch (error) {
    console.error('删除厂房失败:', error);
    message.error('删除失败，请稍后重试');
  }
}

const [FactoryItemModal, factoryModalApi] = useVbenModal({
  closeOnClickModal: false,
  destroyOnClose: false,
  fullscreenButton: false,
  onClosed: () => {
    currentEditIndex.value = null;
    store.buttonStatus = true;
  },
  async onConfirm() {
    const { valid } = await factoryItemFormApi.validate();
    if (!valid) {
      return;
    }

    factoryModalApi.lock();
    try {
      const values = await factoryItemFormApi.getValues();
      if (values.buildTime) {
        values.buildTime = new Date(values.buildTime).toISOString();
      }

      if (currentEditIndex.value === null) {
        if (!store.parkId) {
          message.error('园区ID缺失，无法新增厂房');
          return;
        }
        const factory = await createOwnFactory({
          parkId: store.parkId,
          ...values,
        });
        factoryData.value.push(factory);
      } else {
        const currentFactory = factoryData.value[currentEditIndex.value];
        if (currentFactory?.factoryId) {
          const factory = await updateFactory(currentFactory.factoryId, values);
          factoryData.value[currentEditIndex.value] = factory;
        }
        currentEditIndex.value = null;
      }
      emit('update:modelValue', factoryData.value);
      factoryModalApi.close();
    } finally {
      factoryModalApi.lock(false);
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
  <div class="factory-module">
    <div class="module-header">
      <div class="module-title">{{ $t('page.factory.list') }}</div>
      <Button
        type="primary"
        @click="handleAddFactory"
        :size="isMobileViewport ? 'large' : 'middle'"
      >
        {{ $t('page.factory.create') }}
      </Button>
    </div>

    <div v-if="factoryData.length > 0" class="factory-list">
      <Card
        v-for="(factory, index) in factoryData"
        :key="factory.factoryId || index"
        class="factory-card"
        :bordered="false"
      >
        <div class="factory-card__top">
          <div class="factory-card__name">
            {{ factory.factoryName || '未命名厂房' }}
          </div>
        </div>
        <div class="factory-card__meta">
          <div>地址：{{ factory.address || '暂无' }}</div>
          <div>联系人：{{ factory.contact || '暂无' }}</div>
          <div>面积：{{ factory.area || 0 }} m²</div>
        </div>
        <div class="factory-card__actions">
          <Button
            block
            :size="isMobileViewport ? 'large' : 'middle'"
            @click="handleEditFactory(index)"
          >
            编辑
          </Button>
          <Popconfirm title="确认删除" @confirm="handleDeleteFactory(index)">
            <Button danger block :size="isMobileViewport ? 'large' : 'middle'">
              删除
            </Button>
          </Popconfirm>
        </div>
      </Card>
    </div>
    <Empty v-else description="暂无厂房，请先新增" />

    <FactoryItemModal :title="getTitle">
      <FactoryItemForm />
      <template #footer>
        <div class="footer-actions">
          <Button
            v-show="store.buttonStatus"
            @click="factoryModalApi.onCancel()"
            :block="isMobileViewport"
            :size="isMobileViewport ? 'large' : 'middle'"
          >
            取消
          </Button>
          <Button
            v-show="store.buttonStatus"
            type="primary"
            @click="factoryModalApi.onConfirm()"
            :block="isMobileViewport"
            :size="isMobileViewport ? 'large' : 'middle'"
          >
            确定
          </Button>
        </div>
      </template>
    </FactoryItemModal>
  </div>
</template>

<style scoped>
.factory-module {
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

.factory-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.factory-card {
  border-radius: 10px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.factory-card__top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.factory-card__name {
  font-size: 15px;
  font-weight: 600;
}

.factory-card__meta {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  margin-bottom: 12px;
  color: rgb(0 0 0 / 65%);
}

.factory-card__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.footer-actions {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  width: 100%;
}

@media (width >= 768px) {
  .factory-list {
    grid-template-columns: 1fr 1fr;
  }
}

@media (width < 768px) {
  .footer-actions {
    grid-template-columns: 1fr;
  }
}
</style>
