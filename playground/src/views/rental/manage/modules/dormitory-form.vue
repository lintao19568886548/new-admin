<script setup lang="ts">
import type { Dormitory } from '../data';

import { computed, ref, watch } from 'vue';

import { useVbenForm, useVbenModal } from '@vben/common-ui';

import { Button, Card, Divider } from 'ant-design-vue';

import { $t } from '#/locales';

import { useDormitoryItemFormSchema } from '../data';

// 添加props定义，接收表单组件传递的属性
const props = defineProps({
  modelValue: {
    default: () => [],
    type: Array,
  },
});

// 添加emit定义，用于更新表单值
const emit = defineEmits(['update:modelValue']);

const data = ref<Dormitory[]>([]);

const getTitle = computed(() => {
  return currentEditIndex.value === null
    ? $t('ui.actionTitle.create', [$t('page.dormitory.item')])
    : $t('ui.actionTitle.edit', [$t('page.dormitory.item')]);
});

// 监听props.modelValue的变化，同步到factoryData
watch(
  () => props.modelValue,
  (val) => {
    if (val && Array.isArray(val) && val.length > 0) {
      data.value = [...val] as Dormitory[];
    }
  },
  { immediate: true },
);

const [Form, FormApi] = useVbenForm({
  layout: 'horizontal',
  schema: useDormitoryItemFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-3',
});

async function handleAddFactory() {
  // 重置表单
  FormApi.resetForm();
  // 重置当前编辑索引
  currentEditIndex.value = null;
  // 打开工厂表单Modal
  factoryModalApi.open();
}

// 添加编辑工厂的方法
async function handleEdit(index: number) {
  FormApi.setValues(data.value[index] || {});
  currentEditIndex.value = index;
  factoryModalApi.open();
}

// 添加当前编辑索引的ref
const currentEditIndex = ref<null | number>(null);

// 添加删除工厂的方法
function handleDeleteFactory(index: number) {
  data.value.splice(index, 1);
  // 更新modelValue
  emit('update:modelValue', data.value);
}

const [FactoryItemModal, factoryModalApi] = useVbenModal({
  class: 'max-w-[90%] w-auto',
  destroyOnClose: false,
  onCancel: () => {
    // 关闭Modal时重置当前编辑索引
    currentEditIndex.value = null;
    factoryModalApi.close();
    return false;
  },
  async onConfirm() {
    const { valid } = await FormApi.validate();
    if (valid) {
      factoryModalApi.lock();
      try {
        const values = await FormApi.getValues();

        if (currentEditIndex.value === null) {
          // 添加新数据
          data.value.push(values as Dormitory);
        } else {
          // 更新现有数据
          const originalData = data.value[currentEditIndex.value];
          data.value[currentEditIndex.value] = {
            ...originalData, // 保留原始数据
            ...values, // 覆盖表单中的字段
          } as Dormitory;
          currentEditIndex.value = null; // 重置编辑索引
        }

        // 更新modelValue
        emit('update:modelValue', data.value);

        factoryModalApi.close();
      } finally {
        factoryModalApi.lock(false);
      }
    }
  },
});
</script>
<template>
  <div class="w-full">
    <div class="mb-4 flex w-full justify-between">
      <div class="flex items-center gap-3">
        <div class="text-primary text-xl font-bold">
          {{ $t('page.dormitory.list') }}
        </div>
        <Button type="primary" @click="handleAddFactory()">
          {{ $t('page.dormitory.create') }}
        </Button>
      </div>
    </div>
    <Divider />
    <div v-show="data && data.length > 0" class="space-y-4">
      <div class="grid grid-cols-2 gap-6">
        <div
          v-for="(item, index) in data"
          :key="index"
          class="rounded-lg shadow-sm transition-shadow duration-300 hover:shadow-md"
        >
          <div class="flex-1">
            <Card
              class="hover:border-primary box-border border border-gray-200 shadow-sm transition-colors duration-300"
            >
              <div class="flex items-center justify-between p-2">
                <div class="flex items-center">
                  <span class="mr-2 text-lg font-bold">宿舍名称：</span>
                  <span class="text-lg">{{ item.dormitoryName }}</span>
                </div>
                <div class="flex gap-3">
                  <Button
                    type="primary"
                    size="middle"
                    @click="handleEdit(index)"
                  >
                    编辑
                  </Button>
                  <Button
                    type="primary"
                    danger
                    size="middle"
                    @click="handleDeleteFactory(index)"
                  >
                    删除
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
    <FactoryItemModal :title="getTitle">
      <Form />
    </FactoryItemModal>
  </div>
</template>
