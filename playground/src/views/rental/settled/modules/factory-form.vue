<script setup lang="ts">
import type { Factory } from '../data';

import { computed, ref, watch } from 'vue';

import { useVbenForm, useVbenModal } from '@vben/common-ui';

import { Button, Card, Divider, Popconfirm } from 'ant-design-vue';

import {
  createSettledFactory,
  deleteFactory,
  updateFactory,
} from '#/api/factory';
import { $t } from '#/locales';

import { useFactoryItemFormSchema } from '../data';

// 添加props定义，接收表单组件传递的属性
const props = defineProps({
  modelValue: {
    default: () => [],
    type: Array,
  },
});

// 添加emit定义，用于更新表单值
const emit = defineEmits(['update:modelValue']);

// 移除 store 引用，因为入驻厂房页面不需要园区状态管理
// 添加按钮状态控制，用于在楼层编辑时禁用外层确定按钮
const buttonStatus = ref(true);

const factoryData = ref<Factory[]>([]);

const getTitle = computed(() => {
  return currentEditIndex.value === null
    ? $t('ui.actionTitle.create', [$t('page.factory.item')])
    : $t('ui.actionTitle.edit', [$t('page.factory.item')]);
});

/**
 * 处理楼层编辑状态变化
 * @param status - 按钮状态，true为启用，false为禁用
 */
function handleFloorEditStatusChange(status: boolean) {
  buttonStatus.value = status;
}

// 监听props.modelValue的变化，同步到factoryData
watch(
  () => props.modelValue,
  (val) => {
    // 确保val是数组，如果不是则设为空数组
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

async function handleAddFactory() {
  // 重置表单
  factoryItemFormApi.resetForm();
  // 重置当前编辑索引
  currentEditIndex.value = null;
  // 打开工厂表单Modal
  factoryModalApi.open();
}

// 添加编辑工厂的方法
async function handleEditFactory(index: number) {
  factoryItemFormApi.setValues(factoryData.value[index] || {});
  currentEditIndex.value = index;
  factoryModalApi.open();
}

// 添加当前编辑索引的ref
const currentEditIndex = ref<null | number>(null);

// 添加删除工厂的方法
async function handleDeleteFactory(index: number) {
  const currentFactory = factoryData.value[index];
  if (currentFactory?.factoryId) {
    await deleteFactory(currentFactory?.factoryId);
    factoryData.value.splice(index, 1);
  }
  // 更新modelValue
  emit('update:modelValue', factoryData.value);
}

const [FactoryItemModal, factoryModalApi] = useVbenModal({
  class: 'max-w-[90%] w-auto',
  closeOnClickModal: false,
  destroyOnClose: false,
  onClosed: () => {
    // 关闭Modal时重置当前编辑索引
    currentEditIndex.value = null;
    // 重置按钮状态
    buttonStatus.value = true;
  },
  async onConfirm() {
    const { valid } = await factoryItemFormApi.validate();
    if (valid) {
      factoryModalApi.lock();
      try {
        const values = await factoryItemFormApi.getValues();
        if (values.buildTime) {
          values.buildTime = new Date(values.buildTime).toISOString();
        }

        if (currentEditIndex.value === null) {
          // 创建入驻厂房，不需要 parkId
          const factory = await createSettledFactory({
            ...values,
          }); // 使用入驻厂房API
          factoryData.value.push(factory);
        } else {
          // 更新现有工厂数据 - 保留原始数据中的其他字段
          const currentFactory = factoryData.value[currentEditIndex.value];

          // 清除多余字段
          const requestData = {
            ...values,
            floors: values.floors.map((floor: any) => ({
              ...floor,
              imageUrls: undefined,
              imgUrl: undefined,
            })),
          };
          if (currentFactory?.factoryId) {
            const factory = await updateFactory(
              currentFactory.factoryId,
              requestData,
            );
            factoryData.value[currentEditIndex.value] = factory;
          }
          currentEditIndex.value = null; // 重置编辑索引
        }
        // 更新modelValue
        // console.log('factoryData.value', factoryData.value);
        emit('update:modelValue', factoryData.value);
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
          {{ $t('page.factory.list') }}
        </div>
        <Button type="primary" @click="handleAddFactory()">
          {{ $t('page.factory.create') }}
        </Button>
      </div>
    </div>
    <Divider />
    <div v-if="factoryData && factoryData.length > 0" class="space-y-4">
      <div class="grid grid-cols-2 gap-6">
        <div
          v-for="(factory, index) in factoryData"
          :key="factory?.factoryId || index"
          class="rounded-lg shadow-sm transition-shadow duration-300 hover:shadow-md"
        >
          <div v-if="factory" class="flex-1">
            <Card
              class="hover:border-primary box-border border border-gray-200 shadow-sm transition-colors duration-300"
            >
              <div class="flex items-center justify-between p-2">
                <div class="flex items-center">
                  <span class="mr-2 text-lg font-bold">厂房名称： </span>
                  <span class="text-lg">{{
                    factory?.factoryName || '未命名厂房'
                  }}</span>
                </div>
                <div class="flex gap-3">
                  <Button
                    type="primary"
                    size="middle"
                    @click="handleEditFactory(index)"
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="确认删除"
                    @confirm="handleDeleteFactory(index)"
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
    <div v-else class="py-8 text-center text-gray-500">
      暂无厂房数据，请点击上方按钮添加厂房
    </div>
    <FactoryItemModal :title="getTitle">
      <FactoryItemForm @edit-status-change="handleFloorEditStatusChange" />
      <template #footer>
        <Button v-show="buttonStatus" @click="factoryModalApi.onCancel()">
          取消
        </Button>
        <Button
          v-show="buttonStatus"
          type="primary"
          @click="factoryModalApi.onConfirm()"
        >
          确定
        </Button>
      </template>
    </FactoryItemModal>
  </div>
</template>
