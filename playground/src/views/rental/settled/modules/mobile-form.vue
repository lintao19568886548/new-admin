<script lang="ts" setup>
import type { Factory, FloorItem } from '../types';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue';
import {
  Button,
  Card,
  Collapse,
  CollapsePanel,
  Divider,
  Empty,
  message,
  Popconfirm,
  Space,
} from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createSettledFactory,
  getFactoryDetail,
  updateFactory,
} from '#/api/factory/factory';
import { $t } from '#/locales';

// 导入表单配置
import { useFactoryItemFormSchema, useFloorFormSchema } from '../data';

const emit = defineEmits<{
  success: [];
}>();

// 表单数据
const formData = ref<any>();
const factoryData = ref<Factory[]>([{ floors: [] }]);
const currentFloorIndex = ref<null | number>(null);
const isFloorFormVisible = ref(false);
const activeKey = ref<string[]>(['1']);
// 保存厂房表单临时数据
const tempFactoryFormData = ref<any>(null);

// 标题计算属性
const getTitle = computed(() => {
  return formData.value?.factoryId
    ? $t('ui.actionTitle.edit', ['入驻厂房'])
    : $t('ui.actionTitle.create', ['入驻厂房']);
});

// 厂房表单配置
const [FactoryForm, factoryFormApi] = useVbenForm({
  commonConfig: {
    formItemClass: 'mobile-form-item',
  },
  layout: 'vertical',
  schema: useFactoryItemFormSchema().filter(
    (item) => item.fieldName !== 'floors',
  ),
  showDefaultActions: false,
  wrapperClass: 'gap-4',
});

// 楼层表单配置
const [FloorForm, floorFormApi] = useVbenForm({
  commonConfig: {
    formItemClass: 'mobile-form-item',
  },
  layout: 'vertical',
  schema: useFloorFormSchema(),
  showDefaultActions: false,
});

// 原始的厂房保存函数
async function saveFactoryData() {
  const { valid } = await factoryFormApi.validate();
  if (!valid) return;

  modalApi.lock();
  try {
    const factoryValues = await factoryFormApi.getValues();

    // 添加楼层数据
    factoryValues.floors = factoryData.value[0]?.floors || [];

    // 处理日期格式
    if (factoryValues.buildTime) {
      factoryValues.buildTime = new Date(factoryValues.buildTime).toISOString();
    }

    // 设置为入驻厂房
    factoryValues.isOwn = false;

    if (formData.value?.factoryId) {
      const requestData = {
        ...factoryValues,
        floors: factoryValues.floors.map((floor: any) => ({
          ...floor,
          imageUrls: undefined,
          imgUrl: undefined,
        })),
      };
      // 更新厂房
      await updateFactory(formData.value.factoryId, requestData);
      message.success('更新入驻厂房成功');
    } else {
      // 创建厂房
      await createSettledFactory(factoryValues);
      message.success('创建入驻厂房成功');
    }

    modalApi.close();
    emit('success');
  } catch (error) {
    console.error('操作失败:', error);
    message.error(
      formData.value?.factoryId ? '更新入驻厂房失败' : '创建入驻厂房失败',
    );
  } finally {
    modalApi.unlock();
  }
}

// 模态框配置
const [Modal, modalApi] = useVbenModal({
  class: 'mobile-factory-modal',
  closeOnClickModal: false,
  onCancel() {
    if (isFloorFormVisible.value) {
      // 楼层表单显示时，执行楼层取消
      cancelEditFloor();
    } else {
      // 厂房表单显示时，正常关闭模态框
      modalApi.close();
    }
  },
  async onConfirm() {
    isFloorFormVisible.value ? await saveFloorData() : await saveFactoryData();
  },
  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<any>();
      resetAllForms();

      if (data && Object.keys(data).length > 0) {
        formData.value = data;

        // 设置厂房数据，包含楼层信息
        if (data.factoryId) {
          try {
            // 获取厂房详情数据
            const response = await getFactoryDetail(data.factoryId);

            // 判断API返回格式：可能是 response.data 或直接是 response
            let factoryDetail;
            if (response && response.data) {
              // 标准格式：{data: factoryObject}
              factoryDetail = response.data;
            } else if (response && response.factoryId) {
              // 直接返回厂房对象
              factoryDetail = response;
            } else {
              throw new Error('API返回数据格式不正确');
            }

            // 验证厂房数据是否有效
            if (
              !factoryDetail ||
              typeof factoryDetail !== 'object' ||
              !factoryDetail.factoryId
            ) {
              throw new Error('厂房数据格式错误或缺少必要字段');
            }

            // 设置厂房数据，包含楼层信息
            factoryData.value = [
              {
                ...factoryDetail,
                floors: factoryDetail.floors || [],
              },
            ];

            // 设置厂房表单数据（不包含楼层字段）
            const factoryFormData = { ...factoryDetail };
            delete factoryFormData.floors; // 移除楼层字段，因为楼层由单独组件管理
            await factoryFormApi.setValues(factoryFormData);
          } catch (error) {
            console.error('获取厂房详情失败:', error);
            message.error('获取厂房详情失败');
            // 如果获取失败，使用传入的基本数据
            factoryData.value = [
              {
                ...data,
                floors: data.floors || [],
              },
            ];

            const factoryFormData = { ...data };
            delete factoryFormData.floors;
            await factoryFormApi.setValues(factoryFormData);
          }
        }
      } else {
        formData.value = undefined;
        factoryData.value = [{ floors: [] }];
      }
    }
  },
  showCancelButton: true,
  showConfirmButton: true,
});

// 重置所有表单
function resetAllForms() {
  factoryFormApi.resetForm();
  floorFormApi.resetForm();
  isFloorFormVisible.value = false;
  currentFloorIndex.value = null;
}

// 添加楼层
function handleAddFloor() {
  // 保存当前厂房表单数据
  factoryFormApi.getValues().then((values) => {
    tempFactoryFormData.value = values;
  });

  currentFloorIndex.value = null;
  floorFormApi.resetForm();

  const floorCount = factoryData.value[0]?.floors?.length || 0;
  floorFormApi.setValues({
    description: '',
    floorHeight: 0,
    floorName: `${floorCount + 1}层`,
    loadBearing: 0,
    rentPrice: 0,
    status: '空闲',
    totalArea: 0,
    usedArea: 0,
  });
  isFloorFormVisible.value = true;
}

// 编辑楼层
function handleEditFloor(index: number) {
  // 保存当前厂房表单数据
  factoryFormApi.getValues().then((values) => {
    tempFactoryFormData.value = values;
  });

  const floor = factoryData.value[0]?.floors?.[index];
  if (!floor) return;

  currentFloorIndex.value = index;
  floorFormApi.resetForm();
  floorFormApi.setValues(floor);
  isFloorFormVisible.value = true;
}

// 删除楼层
function handleDeleteFloor(index: number) {
  if (!factoryData.value[0]?.floors) return;

  factoryData.value[0].floors.splice(index, 1);
}

// 保存楼层数据
async function saveFloorData() {
  const { valid } = await floorFormApi.validate();
  if (!valid) return;

  const values = (await floorFormApi.getValues()) as FloorItem;

  // 处理图片数据
  values.images =
    values.images && Array.isArray(values.images)
      ? values.images
          .map((image: any) => {
            if (image?.response?.data) {
              const response = image.response.data;
              return {
                imgId: response.imgId,
                name: response.name,
                url: response.url,
              };
            } else if (image?.imgId && image?.url) {
              return {
                imgId: image.imgId,
                name: image.name || image.url.split('/').pop() || '',
                url: image.url,
              };
            }
            return null;
          })
          .filter((img: any) => img !== null)
      : [];

  // 确保厂房和楼层数组存在
  if (!factoryData.value[0]) {
    factoryData.value[0] = { floors: [] };
  }
  if (!factoryData.value[0].floors) {
    factoryData.value[0].floors = [];
  }

  if (currentFloorIndex.value === null) {
    // 添加新楼层
    factoryData.value[0].floors.push(values);
  } else {
    // 更新现有楼层
    factoryData.value[0].floors[currentFloorIndex.value] = values;
  }

  // 隐藏楼层表单，回到厂房表单
  isFloorFormVisible.value = false;
  currentFloorIndex.value = null;

  // 恢复厂房表单数据
  if (tempFactoryFormData.value) {
    await factoryFormApi.setValues(tempFactoryFormData.value);
    tempFactoryFormData.value = null;
  }
}

// 取消编辑楼层
function cancelEditFloor() {
  isFloorFormVisible.value = false;
  currentFloorIndex.value = null;

  // 恢复厂房表单数据
  if (tempFactoryFormData.value) {
    factoryFormApi.setValues(tempFactoryFormData.value);
    tempFactoryFormData.value = null;
  }
}

// 重置表单
async function resetForm() {
  factoryFormApi.resetForm();
  if (formData.value) {
    await factoryFormApi.setValues(formData.value);
  }
}
</script>

<template>
  <Modal :title="getTitle">
    <div class="mobile-form-container">
      <!-- 厂房表单 -->
      <div v-if="!isFloorFormVisible">
        <div class="factory-form-section">
          <FactoryForm />
        </div>

        <!-- 楼层管理部分 -->
        <Divider class="section-divider">楼层管理</Divider>

        <div class="floor-actions">
          <Button type="primary" @click="handleAddFloor" class="add-floor-btn">
            <PlusOutlined />添加楼层
          </Button>
        </div>

        <!-- 楼层列表 -->
        <div v-if="factoryData[0]?.floors?.length" class="floor-list mt-2">
          <Collapse v-model:active-key="activeKey" class="floor-collapse">
            <CollapsePanel key="1" header="楼层列表">
              <div
                v-for="(floor, index) in factoryData[0]?.floors"
                :key="index"
                class="floor-item"
              >
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
                        @confirm="handleDeleteFloor(index)"
                      >
                        <Button
                          type="link"
                          danger
                          size="small"
                          class="delete-btn"
                        >
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
            </CollapsePanel>
          </Collapse>
        </div>
        <div v-else class="empty-floors">
          <Empty description="暂无楼层数据" />
        </div>
      </div>

      <!-- 楼层表单 -->
      <div v-else class="floor-form-container">
        <FloorForm />
      </div>
    </div>

    <template #prepend-footer>
      <div v-if="!isFloorFormVisible" class="mobile-form-footer">
        <Button type="default" @click="resetForm" class="reset-btn">
          {{ $t('common.reset') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>
