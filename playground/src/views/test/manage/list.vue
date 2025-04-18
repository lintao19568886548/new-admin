<script lang="ts" setup>
import type { RentalManagementItem } from './types';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { StepConfig } from '#/components/MultiStepModalForm/types';

import { ref } from 'vue'; // Import h for potential VNode rendering if needed

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

// Import Ant Design components needed for the form steps
import {
  Form as AForm, // Alias Ant Design Form to avoid conflict
  FormItem as AFormItem,
  Button,
  Input,
  InputNumber,
  message,
  Textarea,
} from 'ant-design-vue';
// Helper to deep clone data for the form
import { cloneDeep } from 'lodash-es'; // Ensure dayjs is imported

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getParkList } from '#/api/park'; // Import park list API
// Import API functions and other utilities
import {
  createManage,
  deleteManage,
  getManageList,
  updateManage,
} from '#/api/rental'; // Add create/update
import AreaSelector from '#/components/AreaSelector.vue';
// Import the new MultiStepModalForm component
import MultiStepModalForm from '#/components/MultiStepModalForm/index.vue';
import { $t } from '#/locales';

// Import column/schema definitions (we'll use parts of useFormSchema)
import { useColumns, useGridFormSchema } from './data';

// Remove the old modal setup
// const [FormModal, formModalApi] = useVbenModal({ ... });

// --- New MultiStepModalForm Setup ---
const multiStepFormRef = ref(); // Ref for the new component
const isEditMode = ref(false); // To track if editing or creating
const currentEditingId = ref<null | number>(null); // Store ID when editing

// Define the steps for the rental form
const rentalSteps: StepConfig[] = [
  {
    description: '厂房名称、地址和园区',
    key: 1,
    title: '基本信息',
  },
  {
    description: '总面积、可用面积和租金',
    key: 2,
    title: '面积与价格',
  },
  {
    description: '联系方式和详细描述',
    key: 3,
    title: '联系人与描述',
  },
];

// Get the base schema definition (we'll use it within steps)
// 移除未使用的 formSchema 和 findSchemaItem
// const formSchema = useFormSchema();
// const findSchemaItem = (fieldName: keyof RentalManagementItem) => {
//   return formSchema.find((item) => item.fieldName === fieldName);
// };

// Submit function for the multi-step form
async function handleRentalSubmit(
  formData: RentalManagementItem,
): Promise<any> {
  // Prepare data (e.g., handle dates if necessary, though not in this specific form)
  const dataToSubmit = { ...formData };

  try {
    if (isEditMode.value && currentEditingId.value !== null) {
      // Update existing item
      await updateManage(currentEditingId.value, dataToSubmit);
      message.success(
        $t('ui.actionMessage.updateSuccess', [dataToSubmit.factoryName || '']),
      );
    } else {
      // Create new item
      await createManage(dataToSubmit);
      message.success(
        $t('ui.actionMessage.createSuccess', [dataToSubmit.factoryName || '']),
      );
    }
    return { success: true }; // Indicate success
  } catch (error) {
    console.error('Rental form submission error:', error);
    const action = isEditMode.value ? 'update' : 'create';
    message.error(
      $t(`ui.actionMessage.${action}Failed`, [dataToSubmit.factoryName || '']),
    );
    throw error; // Re-throw to indicate failure in the modal
  }
}

// Optional: Step validation function
function validateRentalStep(
  stepKey: number | string,
  formData: RentalManagementItem,
): boolean {
  switch (stepKey) {
    case 1: {
      // Validate Basic Info
      if (!formData.factoryName) {
        message.warning('请输入厂房名称');
        return false;
      }
      if (!formData.address) {
        message.warning('请输入地址');
        return false;
      }
      // parkId is optional via ApiSelect with allowClear
      break;
    }
    case 2: {
      // Validate Area & Price
      if (
        formData.area === undefined ||
        formData.area === null ||
        formData.area < 0
      ) {
        message.warning('请输入有效的总面积');
        return false;
      }
      if (
        formData.availableArea === undefined ||
        formData.availableArea === null ||
        formData.availableArea < 0
      ) {
        message.warning('请输入有效的可用面积');
        return false;
      }
      if (
        formData.rentPrice === undefined ||
        formData.rentPrice === null ||
        formData.rentPrice < 0
      ) {
        message.warning('请输入有效的租金价格');
        return false;
      }
      break;
    }
    case 3: {
      // Validate Contact & Description
      if (!formData.contact) {
        message.warning('请输入联系人信息');
        return false;
      }
      // Description is optional
      break;
    }
  }
  return true; // Step is valid
}

// --- End MultiStepModalForm Setup ---

/**
 * 编辑租赁项目
 * @param row
 */
function onEdit(row: RentalManagementItem) {
  isEditMode.value = true;
  currentEditingId.value = row.factoryId;
  // Pass a deep clone to avoid modifying the grid data directly
  multiStepFormRef.value?.open(cloneDeep(row));
}

/**
 * 创建新租赁项目
 */
function onCreate() {
  isEditMode.value = false;
  currentEditingId.value = null;
  // Open with empty/default data
  const defaultData: Partial<RentalManagementItem> = {
    // Set any defaults if needed
    area: 0,
    availableArea: 0,
    rentPrice: 0,
  };
  multiStepFormRef.value?.open(defaultData);
}

/**
 * 删除租赁项目
 * @param row
 */
function onDelete(row: RentalManagementItem) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.factoryName]),
    duration: 0,
    key: 'action_process_msg',
  });

  deleteManage(row.factoryId)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.factoryName]),
        key: 'action_process_msg',
      });
      refreshGrid();
    })
    .catch((error) => {
      console.error('删除租户失败:', error);
      message.error({
        content: $t('ui.actionMessage.deleteFailed', [row.factoryName]),
        key: 'action_process_msg',
      });
    });
}

/**
 * 查看租赁项目详情
 * @param row
 */
function onView(row: RentalManagementItem) {
  // 可以跳转到详情页面
  window.open(`/rental/detail/${row.factoryId}`, '_blank');
}

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({
  code,
  row,
}: OnActionClickParams<RentalManagementItem>) {
  switch (code) {
    case 'delete': {
      onDelete(row);
      break;
    }
    case 'edit': {
      onEdit(row);
      break;
    }
    case 'view': {
      onView(row);
      break;
    }
  }
}

// 当前选中的区域
const currentPark = ref();
const parkSelectorRef = ref();

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    handleReset: async () => {
      // 先重置表单
      await gridApi.formApi?.resetForm();

      // 手动重置所有MultiSelect组件
      const defaultValues = {
        area: ['equal', undefined, undefined],
        availableArea: ['equal', undefined, undefined],
        rentPrice: ['equal', undefined, undefined],
      };

      // 设置默认值
      Object.entries(defaultValues).forEach(([key, value]) => {
        gridApi.formApi?.setFieldValue(key, value);
      });

      // 刷新表格
      refreshGrid();
    },
    schema: useGridFormSchema(), // Grid search form schema remains the same
    submitOnChange: false,
  },
  gridOptions: {
    columns: useColumns(onActionClick), // Grid columns remain the same
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: true,
      pageSize: 20,
      pageSizes: [10, 20, 30, 50, 100],
    },
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          try {
            const formValues = (await gridApi.formApi?.getValues?.()) || {};
            const params: Record<string, any> = {};
            Object.keys(formValues).forEach((key) => {
              const value = formValues[key];
              // Handle MultiSelect data format
              if (
                Array.isArray(value) &&
                ['area', 'availableArea', 'rentPrice'].includes(key)
              ) {
                if (value[0] === 'between') {
                  if (
                    value[1] !== undefined &&
                    value[1] !== null &&
                    value[1] !== ''
                  )
                    params[`${key}Min`] = value[1];
                  if (
                    value[2] !== undefined &&
                    value[2] !== null &&
                    value[2] !== ''
                  )
                    params[`${key}Max`] = value[2];
                } else if (
                  value[0] === 'equal' &&
                  value[1] !== undefined &&
                  value[1] !== null &&
                  value[1] !== ''
                )
                  params[key] = value[1];
              } else if (
                value !== undefined &&
                value !== null &&
                value !== ''
              ) {
                params[key] = value;
              }
            });

            params.parkId = currentPark.value?.parkId; // Use parkId if selected

            params.currentPage = page?.currentPage || 1;
            params.pageSize = page?.pageSize || 20;

            console.warn('处理后的查询参数:', params);
            const result = await getManageList(params);
            return {
              page: { total: result.total || 0 },
              // Ensure the backend returns total and list/items
              result: result.items || [],
            };
          } catch (error) {
            console.error('获取租赁列表失败:', error);
            message.error('获取租赁列表失败');
            return { page: { total: 0 }, result: [] };
          }
        },
      },
    },
    rowConfig: {
      keyField: 'factoryId',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions,
});

/**
 * 刷新表格
 */
function refreshGrid() {
  gridApi.query();
}

/**
 * 表单操作成功回调 (Now handled by MultiStepModalForm's @success)
 */
function onFormSuccess() {
  refreshGrid();
}
</script>

<template>
  <Page auto-content-height>
    <!-- Replace FormModal with MultiStepModalForm -->
    <MultiStepModalForm
      ref="multiStepFormRef"
      :steps="rentalSteps"
      :submit-fn="handleRentalSubmit"
      :validate-step-fn="validateRentalStep"
      :modal-title="isEditMode ? '编辑租赁信息' : '新增租赁信息'"
      @success="onFormSuccess"
      confirm-text="保存"
    >
      <!-- Step 1: Basic Info -->
      <!-- 修复: 为 formData 添加显式类型 -->
      <template #step-1="{ formData }: { formData: RentalManagementItem }">
        <AForm layout="vertical" class="p-4">
          <AFormItem label="厂房名称" required>
            <Input
              v-model:value="formData.factoryName"
              placeholder="请输入厂房名称"
            />
          </AFormItem>
          <AFormItem label="地址" required>
            <Input
              v-model:value="formData.address"
              placeholder="请输入详细地址"
            />
          </AFormItem>
          <AFormItem label="所属园区">
            <ApiSelect
              v-model:value="formData.parkId"
              :api="getParkList"
              label-field="parkName"
              value-field="parkId"
              placeholder="请选择所属园区"
              allow-clear
              class="w-full"
            />
          </AFormItem>
        </AForm>
      </template>

      <!-- Step 2: Area & Price -->
      <!-- 修复: 为 formData 添加显式类型 -->
      <template #step-2="{ formData }: { formData: RentalManagementItem }">
        <AForm layout="vertical" class="p-4">
          <AFormItem label="总面积 (m²)" required>
            <InputNumber
              v-model:value="formData.area"
              placeholder="请输入总面积"
              min="0"
              style="width: 100%"
            />
          </AFormItem>
          <AFormItem label="可用面积 (m²)" required>
            <InputNumber
              v-model:value="formData.availableArea"
              placeholder="请输入可用面积"
              min="0"
              style="width: 100%"
            />
          </AFormItem>
          <AFormItem label="租金价格 (元/月)" required>
            <InputNumber
              v-model:value="formData.rentPrice"
              placeholder="请输入租金"
              min="0"
              style="width: 100%"
            />
          </AFormItem>
        </AForm>
      </template>

      <!-- Step 3: Contact & Description -->
      <!-- 修复: 为 formData 添加显式类型 -->
      <template #step-3="{ formData }: { formData: RentalManagementItem }">
        <AForm layout="vertical" class="p-4">
          <AFormItem label="联系人/方式" required>
            <Input
              v-model:value="formData.contact"
              placeholder="请输入联系人或联系方式"
            />
          </AFormItem>
          <AFormItem label="详细描述">
            <Textarea
              v-model:value="formData.description"
              placeholder="请输入详细描述信息 (可选)"
              :rows="4"
              show-count
              :maxlength="300"
            />
          </AFormItem>
        </AForm>
      </template>
    </MultiStepModalForm>

    <!-- Grid remains the same -->
    <Grid :table-title="$t('system.rental.list')">
      <template #toolbar-actions>
        <!-- 区域选择下拉菜单 -->
        <AreaSelector
          :default-park="currentPark"
          :refresh-callback="refreshGrid"
          @change="(park) => (currentPark = park)"
          ref="parkSelectorRef"
        />
      </template>
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.rental.name')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
