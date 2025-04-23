<script setup lang="ts">
import type { FloorItem } from '../data';

import { defineEmits, defineProps, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message, Popconfirm } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { $t } from '#/locales';

// 添加props定义，接收表单组件传递的属性
const props = defineProps({
  modelValue: {
    default: () => [],
    type: Array,
  },
});

// 添加emit定义，用于更新表单值
const emit = defineEmits(['update:modelValue']);

const floorData = ref<FloorItem[]>([]);

// 初始化时，如果有传入的modelValue，则使用它
watch(
  () => props.modelValue,
  (val) => {
    if (val && Array.isArray(val) && val.length > 0) {
      floorData.value = [...val] as FloorItem[];
      // 更新表格数据
      gridApi.setGridOptions({
        data: [...floorData.value],
      });
    }
  },
  { immediate: true },
);

const onConfirm = () => {
  // 将当前楼层数据更新到modelValue
  emit('update:modelValue', floorData.value);
  floorModalApi.close();
};

const onReset = () => {
  floorData.value = [];
  emit('update:modelValue', floorData.value);
};

// 修改 handleAddFloor 函数
async function handleAddFloor() {
  // 如果 modelValue 中有数据，则使用它
  if (
    props.modelValue &&
    Array.isArray(props.modelValue) &&
    props.modelValue.length > 0
  ) {
    floorData.value = [...props.modelValue] as FloorItem[];
    // 更新表格数据
    gridApi.setGridOptions({
      data: [...floorData.value],
    });
  }

  // 打开楼层表单Modal
  floorModalApi.open();
}

// 修改 addFloorData 函数，添加日志以便调试
const addFloorData = () => {
  // 获取当前楼层数量，用于生成新楼层的名称
  const currentFloorCount = floorData.value.length;
  // 这里添加新增行的逻辑
  floorData.value.push({
    description: '',
    floorHeight: '0',
    floorName: `${currentFloorCount + 1}层`,
    loadBearing: '0',
    rentPrice: '0',
    status: '空闲',
    totalArea: '0',
    usedArea: '0',
  });

  // 同时更新modelValue
  emit('update:modelValue', floorData.value);
};

// 创建楼层表单的Modal
const [FloorModal, floorModalApi] = useVbenModal({
  class: 'max-w-[90%] w-auto',
  destroyOnClose: false,
  onCancel: () => {
    floorModalApi.close();
    return false;
  },
  title: $t('page.factory.addFloor'),
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      { field: 'floorName', title: '层数', width: 80 },
      {
        editRender: { name: 'input' },
        field: 'floorHeight',
        title: '层高',
      },
      {
        editRender: { name: 'input' },
        field: 'loadBearing',
        title: '承重',
      },
      {
        editRender: { name: 'input' },
        field: 'rentPrice',
        title: '租金',
      },
      {
        editRender: { name: 'input' },
        field: 'totalArea',
        title: '总面积',
      },
      {
        editRender: { name: 'input' },
        field: 'usedArea',
        title: '已用面积',
      },
      {
        editRender: { name: 'input' },
        field: 'status',
        title: '状态',
      },
      {
        editRender: { name: 'input' },
        field: 'description',
        title: '描述',
      },
      {
        fixed: 'right', // 固定在右侧，可选
        slots: { default: 'actions' }, // 使用名为 'actions' 的插槽
        title: '操作',
        width: 150, // 调整宽度以容纳按钮
      },
    ],
    data: floorData.value,
    editConfig: {
      mode: 'cell',
      trigger: 'click',
    }, // 设置一个固定高度，防止溢出
    pagerConfig: {
      enabled: false,
    },
    showOverflow: true,
  },
});

// 监听 floorData 变化，更新表格数据
watch(
  floorData,
  (newVal) => {
    gridApi.setGridOptions({
      data: [...newVal],
    });
  },
  { deep: true },
);

const handleDelete = (rowIndex: number) => {
  floorData.value.splice(rowIndex, 1);
  // 重新生成层数名称，如果需要的话（可选）
  floorData.value.forEach((item, index) => {
    // 简单示例：如果 floorName 是自动生成的 'x层' 格式
    if (/^\d+层$/.test(item.floorName)) {
      item.floorName = `${index + 1}层`;
    }
  });
};

// --- 上传图片处理函数 (占位) ---
const handleUploadImage = (row: FloorItem, rowIndex: number) => {
  console.warn('触发上传图片，行数据:', row, '行索引:', rowIndex);
  // 在这里实现打开图片上传Modal或调用上传组件的逻辑
  // 例如：uploadModalApi.open({ floorId: row.id, rowIndex: rowIndex });
  message.info(`准备为 ${row.floorName} 上传图片（功能待实现）`);
  // 上传成功后，可能需要更新 floorData.value[rowIndex] 中的图片字段
  // 例如: floorData.value[rowIndex].imageUrl = 'path/to/image.jpg';
  // 并可能需要 emit('update:modelValue', floorData.value);
};
</script>
<template>
  <div>
    <Button type="primary" @click="handleAddFloor">
      {{ $t('page.factory.addFloor') }}
    </Button>
    <div
      v-show="props.modelValue && props.modelValue.length > 0"
      class="ml-2 inline-block text-green-500"
    >
      已添加 {{ props.modelValue.length }} 层数据
    </div>
    <FloorModal>
      <Grid>
        <template #actions="{ row, rowIndex }">
          <div class="flex items-center justify-center gap-2">
            <Button
              type="link"
              size="small"
              @click="handleUploadImage(row, rowIndex)"
            >
              上传
            </Button>
            <Popconfirm title="确认删除" @confirm="handleDelete(rowIndex)">
              <Button type="link" danger size="small"> 删除 </Button>
            </Popconfirm>
          </div>
        </template>
      </Grid>
      <template #footer>
        <div class="flex w-full justify-between">
          <div class="flex gap-3">
            <Button type="primary" @click="addFloorData"> 添加一行 </Button>
            <Button type="primary" @click="onReset()"> 重置 </Button>
          </div>
          <div class="flex gap-2">
            <Button @click="floorModalApi.close()">取消</Button>
            <Button type="primary" @click="onConfirm()"> 确认 </Button>
          </div>
        </div>
      </template>
    </FloorModal>
  </div>
</template>
