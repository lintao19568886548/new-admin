<script setup lang="ts">
import type { FloorItem } from '../data';

import { defineEmits, nextTick, ref, watch } from 'vue'; // 导入 nextTick

import { useVbenForm } from '@vben/common-ui';

import { Button, Popconfirm } from 'ant-design-vue';

import { useButtonStore } from '#/store';

import { useFloorFormSchema } from '../data';

// 添加props定义，接收表单组件传递的属性
const props = defineProps({
  modelValue: {
    default: () => [],
    type: Array,
  },
});

// 添加emit定义，用于更新表单值
const emit = defineEmits(['update:modelValue']);

const buttonStore = useButtonStore();
const floorData = ref<FloorItem[]>([]);

// 初始化时，如果有传入的modelValue，则使用它
watch(
  () => props.modelValue,
  (val) => {
    if (val && Array.isArray(val) && val.length > 0) {
      floorData.value = [...val] as FloorItem[];
    }
  },
  { immediate: true },
);

// 当前正在编辑的楼层索引
const currentEditIndex = ref<null | number>(null);
const currentData = ref<FloorItem>();
const isFormVisible = ref(false);

// 使用表单API
const [FloorForm, floorFormApi] = useVbenForm({
  layout: 'horizontal',
  schema: useFloorFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-4',
});

// 添加新楼层
const formContainerRef = ref<HTMLDivElement | null>(null); // 创建模板引用 ref

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
  buttonStore.showButton(false);

  // 等待 DOM 更新后滚动
  await nextTick();
  formContainerRef.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

// 编辑楼层
async function handleEditFloor(rowIndex: number) {
  currentData.value = floorData.value[rowIndex];
  floorFormApi.resetForm();
  floorFormApi.setValues(floorData.value[rowIndex] || {});
  currentEditIndex.value = rowIndex;
  isFormVisible.value = true;
  buttonStore.showButton(false);

  // 等待 DOM 更新后滚动
  await nextTick();
  formContainerRef.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

// 保存楼层数据
async function saveFloorData() {
  const { valid } = await floorFormApi.validate();
  if (!valid) return;

  const values = (await floorFormApi.getValues()) as FloorItem; // 获取表单值并断言类型

  // 创建一个新的数组副本用于修改和emit
  const updatedFloorData = [...floorData.value];
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
    // 添加新楼层
    updatedFloorData.push(values);
  } else {
    // 更新现有楼层
    updatedFloorData[currentEditIndex.value] = values;
  }

  // 更新本地 floorData ref (如果需要立即反映在当前组件的列表)
  floorData.value = updatedFloorData;
  // Emit 更新后的完整楼层数据
  emit('update:modelValue', updatedFloorData);
  buttonStore.showButton(true);

  // 隐藏表单
  isFormVisible.value = false;
  // 重置编辑索引
  currentEditIndex.value = null;
}
// 取消编辑
function cancelEdit() {
  isFormVisible.value = false;
  buttonStore.showButton(true);
}

// 删除楼层
const handleDelete = (rowIndex: number) => {
  floorData.value.splice(rowIndex, 1);
  emit('update:modelValue', floorData.value);
};
</script>

<template>
  <div class="w-full">
    <div class="mb-4 flex justify-between">
      <div>
        <Button type="primary" @click="handleAddFloor">添加楼层</Button>
      </div>
    </div>

    <!-- 表单区域 - 直接在页面上显示，不使用Modal -->
    <div
      v-if="isFormVisible"
      ref="formContainerRef"
      class="mb-4 rounded border border-gray-200 p-4 shadow-sm"
    >
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-lg font-medium">
          {{ currentEditIndex === null ? '添加楼层' : '编辑楼层' }}
        </h3>
      </div>
      <div>
        <FloorForm />
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <Button @click="cancelEdit">取消</Button>
        <Button type="primary" @click="saveFloorData">保存</Button>
      </div>
    </div>

    <!-- 楼层列表 - 添加v-if条件，当表单显示时不显示列表 -->
    <div v-if="floorData.length > 0 && !isFormVisible" class="mb-4">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="(floor, index) in floorData"
          :key="index"
          class="rounded border border-gray-200 p-4 shadow-sm"
        >
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-lg font-medium">{{ floor.floorName }}</h3>
            <div class="flex items-center gap-2">
              <Button type="link" size="small" @click="handleEditFloor(index)">
                编辑
              </Button>
              <Popconfirm title="确认删除" @confirm="handleDelete(index)">
                <Button type="link" danger size="small"> 删除 </Button>
              </Popconfirm>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span class="font-medium">层高:</span> {{ floor.floorHeight }}
            </div>
            <div>
              <span class="font-medium">承重:</span> {{ floor.loadBearing }}
            </div>
            <div>
              <span class="font-medium">租金:</span> {{ floor.rentPrice }}
            </div>
            <div>
              <span class="font-medium">总面积:</span> {{ floor.totalArea }}
            </div>
            <div>
              <span class="font-medium">已用面积:</span> {{ floor.usedArea }}
            </div>
            <div><span class="font-medium">状态:</span> {{ floor.status }}</div>
          </div>
          <div v-if="floor.description" class="mt-2 text-sm">
            <span class="font-medium">描述:</span> {{ floor.description }}
          </div>
        </div>
      </div>
    </div>
    <div
      v-else-if="!isFormVisible"
      class="mb-4 rounded border border-dashed border-gray-300 p-8 text-center text-gray-500"
    >
      暂无楼层数据，请点击"添加楼层"按钮添加
    </div>
  </div>
</template>
