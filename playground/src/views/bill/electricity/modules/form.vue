<script lang="ts" setup>
import type { DataNode } from 'ant-design-vue/es/tree';

import type { Recordable } from '@vben/types';

import type { SystemRoleApi } from '#/api/system/role';

import { computed, reactive, ref, watch } from 'vue';

import { useVbenDrawer, useVbenModal, VbenTree } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, Spin } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenForm } from '#/adapter/form';
import { getMenuList } from '#/api/system/menu';
import { createRole, updateRole } from '#/api/system/role';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);

const formData = ref<SystemRoleApi.SystemRole>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const permissions = ref<DataNode[]>([]);
const loadingPermissions = ref(false);

const id = ref();
const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();
    drawerApi.lock();
    (id.value ? updateRole(id.value, values) : createRole(values))
      .then(() => {
        emit('success');
        drawerApi.close();
      })
      .catch(() => {
        drawerApi.unlock();
      });
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<SystemRoleApi.SystemRole>();
      formApi.resetForm();
      if (data) {
        formData.value = data;
        id.value = data.id;
        formApi.setValues(data);
      } else {
        id.value = undefined;
      }

      if (permissions.value.length === 0) {
        loadPermissions();
      }
    }
  },
});

async function loadPermissions() {
  loadingPermissions.value = true;
  try {
    const res = await getMenuList();
    permissions.value = res as unknown as DataNode[];
  } finally {
    loadingPermissions.value = false;
  }
}

const getDrawerTitle = computed(() => {
  return formData.value?.id
    ? $t('common.edit', $t('system.role.name'))
    : $t('common.create', $t('system.role.name'));
});

function getNodeClass(node: Recordable<any>) {
  const classes: string[] = [];
  if (node.value?.type === 'button') {
    classes.push('inline-flex');
    if (node.index % 3 >= 1) {
      classes.push('!pl-0');
    }
  }

  return classes.join(' ');
}

// 添加一个预览状态变量
const previewMode = ref(false);
const calculationHistory = reactive([]);

// 优化电表读数变化监听，记录历史计算结果
watch(
  () => [
    formApi.form.values?.lastMonthReading,
    formApi.form.values?.currentMonthReading,
    formApi.form.values?.multiplier,
    formApi.form.values?.unitPrice,
  ],
  ([lastReading, currentReading, multiplier, unitPrice], oldValues) => {
    if (lastReading !== null && currentReading !== null) {
      const monthlyUsage = currentReading - lastReading;
      formApi.setFieldValue('monthlyUsage', monthlyUsage);

      if (multiplier !== null) {
        const actualUsage = monthlyUsage * multiplier;
        formApi.setFieldValue('actualUsage', actualUsage);

        if (unitPrice !== null) {
          const amount = Number.parseFloat(
            (actualUsage * unitPrice).toFixed(2),
          );
          formApi.setFieldValue('amount', amount);

          // 记录计算历史
          if (oldValues && oldValues[0] !== null) {
            const historyItem = {
              actualUsage,
              amount,
              currentReading,
              lastReading,
              monthlyUsage,
              multiplier,
              time: new Date().toLocaleTimeString(),
              unitPrice,
            };
            calculationHistory.push(historyItem as never);
          }
        }
      }
    }
  },
  { deep: true },
);

// 添加表单验证函数
function validateForm() {
  const values = formApi.form.values;
  let isValid = true;
  let errorMessage = '';

  if (values.currentMonthReading < values.lastMonthReading) {
    isValid = false;
    errorMessage = '本月电表数不能小于上月电表数';
  }

  return { errorMessage, isValid };
}

// 切换预览模式
function togglePreview() {
  previewMode.value = !previewMode.value;
}

// 修改确认提交逻辑
async function handleConfirm() {
  const { valid } = await formApi.validate();
  if (valid) {
    const customValidation = validateForm();
    if (!customValidation.isValid) {
      // 显示自定义错误消息
      console.error(customValidation.errorMessage);
      return;
    }

    modalApi.lock();
    try {
      // 模拟API请求
      await new Promise((resolve) => setTimeout(resolve, 1000));
      modalApi.close();
      emit('success');
    } finally {
      modalApi.lock(false);
    }
  }
}

function resetForm() {
  formApi.resetForm();
  formApi.setValues(formData.value || {});
}

const [Modal, modalApi] = useVbenModal({
  cancelText: '取消',
  onCancel() {
    modalApi.close();
  },
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (valid) {
      const customValidation = validateForm();
      if (!customValidation.isValid) {
        // 显示自定义错误消息
        console.error(customValidation.errorMessage);
        return;
      }

      modalApi.lock();
      try {
        // 模拟API请求
        await new Promise((resolve) => setTimeout(resolve, 1000));
        modalApi.close();
        emit('success');
      } finally {
        modalApi.lock(false);
      }
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData();
      formApi.resetForm();
      if (data) {
        // 确保日期字段正确处理
        if (data.paymentTime && typeof data.paymentTime === 'string') {
          data.paymentTime = dayjs(data.paymentTime).toDate();
        }
        formData.value = data as any; // 添加类型断言以解决类型错误
        formApi.setValues(data);
      } else {
        formData.value = undefined;
        // 设置默认收款时间为当天
        formApi.setFieldValue('paymentTime', new Date());
      }
    }
  },
  showCancelButton: true,
  showConfirmButton: true,
});

// 添加到 watch 函数中或创建新的 watch
watch(
  () => formApi.form.values?.paymentTime,
  (newValue) => {
    if (newValue && typeof newValue === 'string') {
      // 确保日期值是日期对象而非字符串
      formApi.setFieldValue('paymentTime', dayjs(newValue).toDate());
    }
  },
);
</script>

<template>
  <Drawer :title="getDrawerTitle">
    <Form>
      <template #permissions="slotProps">
        <Spin :spinning="loadingPermissions">
          <VbenTree
            :tree-data="permissions"
            multiple
            bordered
            :default-expanded-level="2"
            :get-node-class="getNodeClass"
            v-bind="slotProps"
            value-field="id"
            label-field="meta.title"
            icon-field="meta.icon"
          >
            <template #node="{ value }">
              <IconifyIcon v-if="value.meta.icon" :icon="value.meta.icon" />
              {{ $t(value.meta.title) }}
            </template>
          </VbenTree>
        </Spin>
      </template>
    </Form>
  </Drawer>
  <Modal :title="getDrawerTitle">
    <div v-if="!previewMode">
      <Form class="mx-4" />
    </div>
    <div v-else class="mx-4">
      <!-- 预览模式 -->
      <div class="mb-4 grid grid-cols-2 gap-4">
        <div class="rounded border p-3">
          <div class="text-gray-500">公司名称</div>
          <div class="font-medium">{{ formApi.form.values?.companyName }}</div>
        </div>
        <div class="rounded border p-3">
          <div class="text-gray-500">项目名称</div>
          <div class="font-medium">{{ formApi.form.values?.projectName }}</div>
        </div>
        <!-- 其他字段预览 -->
        <div class="rounded border p-3">
          <div class="text-gray-500">上月电表数</div>
          <div class="font-medium">
            {{ formApi.form.values?.lastMonthReading }}
          </div>
        </div>
        <div class="rounded border p-3">
          <div class="text-gray-500">本月电表数</div>
          <div class="font-medium">
            {{ formApi.form.values?.currentMonthReading }}
          </div>
        </div>
        <div class="rounded border p-3">
          <div class="text-gray-500">本月度数</div>
          <div class="font-medium">{{ formApi.form.values?.monthlyUsage }}</div>
        </div>
        <div class="rounded border p-3">
          <div class="text-gray-500">倍数</div>
          <div class="font-medium">{{ formApi.form.values?.multiplier }}</div>
        </div>
        <div class="rounded border p-3">
          <div class="text-gray-500">本月实际度数</div>
          <div class="font-medium">{{ formApi.form.values?.actualUsage }}</div>
        </div>
        <div class="rounded border p-3">
          <div class="text-gray-500">单价(元/度)</div>
          <div class="font-medium">{{ formApi.form.values?.unitPrice }}</div>
        </div>
        <div class="rounded border p-3">
          <div class="text-gray-500">电费金额(元)</div>
          <div class="font-medium">{{ formApi.form.values?.amount }}</div>
        </div>
      </div>
    </div>

    <template #prepend-footer>
      <div class="flex-auto">
        <Button type="primary" danger @click="resetForm">
          {{ $t('common.reset') }}
        </Button>
        <Button type="dashed" class="ml-2" @click="togglePreview">
          {{ previewMode ? '编辑模式' : '预览' }}
        </Button>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end">
        <Button @click="modalApi.close()">取消</Button>
        <Button type="primary" class="ml-2" @click="handleConfirm">确认</Button>
      </div>
    </template>
  </Modal>
</template>

<style lang="css" scoped>
:deep(.ant-tree-title) {
  .tree-actions {
    display: none;
    margin-left: 20px;
  }
}

:deep(.ant-tree-title:hover) {
  .tree-actions {
    display: flex;
    flex: auto;
    justify-content: flex-end;
    margin-left: 20px;
  }
}
</style>
