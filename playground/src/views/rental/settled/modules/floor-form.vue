<script setup lang="ts">
import type { FloorItem } from '../data';

import { defineEmits, nextTick, ref, watch } from 'vue';

import { useVbenForm } from '@vben/common-ui';

import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue';
import {
  Button,
  Card,
  Divider,
  Empty,
  Popconfirm,
  Space,
} from 'ant-design-vue';

import { useFloorFormSchema } from '../data';

// 添加props定义，接收表单组件传递的属性
const props = defineProps({
  modelValue: {
    default: () => [],
    type: Array,
  },
});

// 添加emit定义，用于更新表单值和通知编辑状态变化
const emit = defineEmits([
  'update:modelValue',
  'editStatusChange',
  'save',
  'cancel',
]);

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
  // 通知父组件进入编辑状态，禁用外层按钮
  emit('editStatusChange', false);

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
  // 通知父组件进入编辑状态，禁用外层按钮
  emit('editStatusChange', false);

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

  // 隐藏表单
  isFormVisible.value = false;
  // 重置编辑索引
  currentEditIndex.value = null;
  // 通知父组件退出编辑状态，启用外层按钮
  emit('editStatusChange', true);
}
// 取消编辑
function cancelEdit() {
  isFormVisible.value = false;
  // 通知父组件退出编辑状态，启用外层按钮
  emit('editStatusChange', true);
}

// 删除楼层
const handleDelete = (rowIndex: number) => {
  floorData.value.splice(rowIndex, 1);
  emit('update:modelValue', floorData.value);
};

// 暴露给外部的方法
defineExpose({
  cancelEdit,
  isFormVisible: () => isFormVisible.value,
  saveFloorData,
});
</script>

<template>
  <div class="w-full">
    <!-- 楼层管理部分 -->
    <Divider class="section-divider">楼层管理</Divider>

    <div class="floor-actions">
      <Button type="primary" @click="handleAddFloor" class="add-floor-btn">
        <PlusOutlined />添加楼层
      </Button>
    </div>

    <!-- 表单区域 - 直接在页面上显示，不使用Modal -->
    <div
      v-if="isFormVisible"
      ref="formContainerRef"
      class="floor-form-container mb-4"
    >
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-lg font-medium">
          {{ currentEditIndex === null ? '添加楼层' : '编辑楼层' }}
        </h3>
      </div>
      <div>
        <FloorForm />
      </div>
    </div>

    <!-- 楼层列表 -->
    <div v-if="floorData.length > 0 && !isFormVisible" class="floor-list mt-2">
      <div v-for="(floor, index) in floorData" :key="index" class="floor-item">
        <Card size="small" :title="floor.floorName" class="floor-card">
          <template #extra>
            <Space>
              <Button
                type="link"
                size="small"
                @click="handleEditFloor(index)"
                class="edit-btn"
              >
                <EditOutlined />
              </Button>
              <Popconfirm
                title="确认删除该楼层?"
                @confirm="handleDelete(index)"
              >
                <Button type="link" danger size="small" class="delete-btn">
                  <DeleteOutlined />
                </Button>
              </Popconfirm>
            </Space>
          </template>

          <div class="floor-info">
            <div class="floor-info-item">
              <span class="label">层高:</span>
              <span class="value">{{ floor.floorHeight }}m</span>
            </div>
            <div class="floor-info-item">
              <span class="label">总面积:</span>
              <span class="value">{{ floor.totalArea }}m²</span>
            </div>
            <div class="floor-info-item">
              <span class="label">已用面积:</span>
              <span class="value">{{ floor.usedArea }}m²</span>
            </div>
            <div class="floor-info-item">
              <span class="label">承重:</span>
              <span class="value">{{ floor.loadBearing }}吨</span>
            </div>
            <div class="floor-info-item">
              <span class="label">租金:</span>
              <span class="value">{{ floor.rentPrice }}元/m²·月</span>
            </div>
            <div class="floor-info-item">
              <span class="label">状态:</span>
              <span class="value">{{ floor.status }}</span>
            </div>
          </div>
          <div v-if="floor.description" class="floor-description">
            <span class="label">描述:</span>
            <span class="value">{{ floor.description }}</span>
          </div>
        </Card>
      </div>
    </div>
    <div v-else-if="!isFormVisible" class="empty-floors">
      <Empty description="暂无楼层数据" />
    </div>
  </div>
</template>

<style scoped>
/* 响应式设计 */
@media (max-width: 768px) {
  .floor-info {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .floor-info-item {
    padding: 6px 8px;
  }

  .floor-card .ant-card-body {
    padding: 16px;
  }
}

@media (max-width: 480px) {
  .floor-info {
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .floor-info-item {
    padding: 4px 6px;
  }

  .floor-info-item .value {
    overflow: hidden;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .floor-info-item .label {
    min-width: 50px;
    font-size: 12px;
  }
}

.floor-management {
  margin-top: 24px;
}

.section-divider {
  margin: 24px 0 16px;
  font-weight: 600;
  color: #1f2937;
}

.floor-actions {
  margin-bottom: 16px;
}

.add-floor-btn {
  border-radius: 8px;
  box-shadow: 0 2px 4px rgb(59 130 246 / 15%);
  transition: all 0.3s ease;
}

.add-floor-btn:hover {
  box-shadow: 0 4px 8px rgb(59 130 246 / 25%);
  transform: translateY(-1px);
}

/* 楼层列表样式 */
.floor-list {
  margin-top: 16px;
}

.floor-item {
  margin-bottom: 16px;
}

.floor-item:last-child {
  margin-bottom: 0;
}

/* 楼层卡片样式优化 */
.floor-card {
  overflow: hidden;
  background: linear-gradient(135deg, #fff 0%, #f8fafc 100%);
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 4%);
  transition: all 0.3s ease;
}

.floor-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
  transform: translateY(-2px);
}

.floor-card .ant-card-head {
  padding: 12px 16px;
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  border-bottom: 1px solid #e2e8f0;
  border-radius: 12px 12px 0 0;
}

.floor-card .ant-card-head-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.floor-card .ant-card-body {
  padding: 20px;
}

/* 楼层信息项样式优化 */
.floor-info {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.floor-info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.floor-info-item:hover {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-color: #93c5fd;
  transform: translateY(-1px);
}

.floor-info-item .label {
  min-width: 50px;
  margin-right: 2px;
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
}

.floor-info-item .value {
  flex: 1;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 楼层描述样式 */
.floor-description {
  padding: 16px;
  margin-top: 16px;
  background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%);
  border: 1px solid #fbbf24;
  border-radius: 8px;
}

.floor-description .label {
  margin-right: 8px;
  font-weight: 500;
  color: #92400e;
}

.floor-description .value {
  line-height: 1.5;
  color: #78350f;
}

/* 操作按钮样式 */
.edit-btn {
  color: #3b82f6;
  transition: all 0.2s ease;
}

.edit-btn:hover {
  color: #1d4ed8;
  transform: scale(1.1);
}

.delete-btn {
  color: #ef4444;
  transition: all 0.2s ease;
}

.delete-btn:hover {
  color: #dc2626;
  transform: scale(1.1);
}

/* 空状态样式 */
.empty-floors {
  padding: 40px 20px;
  margin-top: 16px;
  text-align: center;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 2px dashed #cbd5e1;
  border-radius: 12px;
}

/* 楼层表单容器 */
.floor-form-container {
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 6%);
}
</style>
