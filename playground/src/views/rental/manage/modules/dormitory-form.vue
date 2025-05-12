<script setup lang="ts">
import type { Dormitory } from '../data';

import { computed, ref, watch } from 'vue';

import { useVbenForm, useVbenModal } from '@vben/common-ui';

import { Button, Card, Divider, Popconfirm } from 'ant-design-vue';

import {
  createDormitory,
  deleteDormitory,
  updateDormitory,
} from '#/api/dormitory';
import { $t } from '#/locales';
import { useParkStore } from '#/store';

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
const parkStore = useParkStore();
const getTitle = computed(() => {
  return currentEditIndex.value === null
    ? $t('ui.actionTitle.create', [$t('page.dormitory.item')])
    : $t('ui.actionTitle.edit', [$t('page.dormitory.item')]);
});

// 监听props.modelValue的变化，同步到dormitoryData
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

async function handleAddDormitory() {
  // 重置表单
  FormApi.resetForm();
  // 重置当前编辑索引
  currentEditIndex.value = null;
  // 打开工厂表单Modal
  dormitoryModalApi.open();
}

// 添加编辑工厂的方法
async function handleEdit(index: number) {
  FormApi.setValues(data.value[index] || {});
  currentEditIndex.value = index;
  dormitoryModalApi.open();
}

// 添加当前编辑索引的ref
const currentEditIndex = ref<null | number>(null);

// 添加删除工厂的方法
async function handleDeleteDormitory(index: number) {
  const currentFactory = data.value[index];
  if (currentFactory?.dormitoryId) {
    await deleteDormitory(currentFactory?.dormitoryId);
    data.value.splice(index, 1);
  }
  // 更新modelValue
  emit('update:modelValue', data.value);
}

const [DormitoryItemModal, dormitoryModalApi] = useVbenModal({
  class: 'max-w-[90%] w-auto',
  destroyOnClose: false,
  onCancel: () => {
    // 关闭Modal时重置当前编辑索引
    currentEditIndex.value = null;
    dormitoryModalApi.close();
    return false;
  },
  async onConfirm() {
    const { valid } = await FormApi.validate();
    if (valid) {
      dormitoryModalApi.lock();
      try {
        const values = await FormApi.getValues();

        values.images =
          values.images && Array.isArray(values.images)
            ? values.images
                .map((image: any) => {
                  // 检查是否是新上传的图片（Ant Design Upload组件返回的结构）
                  if (image.response?.data) {
                    const response = image.response.data;
                    return {
                      imgId: response.imgId,
                      name: response.name,
                      url: response.url,
                    };
                  }
                  // 检查是否是已存在的图片（从后端获取的结构）
                  else if (image.imgId && image.url) {
                    return {
                      imgId: image.imgId,
                      name: image.name || image.url.split('/').pop() || '', // 如果没有name，尝试从url提取
                      url: image.url,
                    };
                  }
                  // 如果数据结构不符合预期，可以选择忽略或记录错误
                  console.warn('无法识别的图片数据结构:', image);
                  return null; // 返回 null 或其他标记，以便后续过滤
                })
                .filter((img) => img !== null) // 过滤掉无法处理的项
            : [];

        if (currentEditIndex.value === null) {
          // 添加新数据
          const dormitory = await createDormitory({
            parkId: parkStore.parkId,
            ...values,
          });
          data.value.push(dormitory);
        } else {
          // 更新现有数据
          const originalData = data.value[currentEditIndex.value];
          if (originalData?.dormitoryId) {
            const dormitory = await updateDormitory(
              originalData.dormitoryId,
              values,
            );
            data.value[currentEditIndex.value] = dormitory;
          }
          currentEditIndex.value = null; // 重置编辑索引
        }

        // 更新modelValue
        emit('update:modelValue', data.value);

        dormitoryModalApi.close();
      } finally {
        dormitoryModalApi.lock(false);
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
        <Button type="primary" @click="handleAddDormitory()">
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
                  <Popconfirm
                    title="确认删除"
                    @confirm="handleDeleteDormitory(index)"
                  >
                    <Button type="primary" danger size="middle"> 删除 </Button>
                  </Popconfirm>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
    <DormitoryItemModal :title="getTitle">
      <Form />
    </DormitoryItemModal>
  </div>
</template>
