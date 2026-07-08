<script lang="ts" setup>
import type { SystemUserApi } from '#/api';

import { computed, nextTick, onBeforeUnmount, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message, Select } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createSystemUser, updateSystemUser } from '#/api/system/user';
import { $t } from '#/locales';

import {
  getAccountPasswordInputProps,
  getAccountUsernameInputProps,
  getParkOptions,
  useFormSchema,
} from '../data';

const emit = defineEmits<{
  success: [
    payload: { id: null | number; mode: 'create' | 'edit'; username: string },
  ];
}>();
const formData = ref<null | SystemUserApi.SystemUser>(null);
const parkOptions = ref<Array<{ label: string; value: number }>>([]);
const isEdit = computed(() => Boolean(formData.value?.id));
let clearCreateFormTimers: Array<ReturnType<typeof setTimeout>> = [];
let openSequence = 0;

const title = computed(() => {
  return isEdit.value
    ? $t('ui.actionTitle.edit', [$t('system.user.name')])
    : $t('ui.actionTitle.create', [$t('system.user.name')]);
});

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: useFormSchema(),
  showDefaultActions: false,
});

function normalizeIdList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [
    ...new Set(
      value.map(Number).filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
}

function clearScheduledCreateFormReset() {
  clearCreateFormTimers.forEach((timer) => clearTimeout(timer));
  clearCreateFormTimers = [];
}

function getCreateFormValues() {
  return {
    accountName: '',
    accountSecret: '',
    parkIds: [],
    phone: '',
    realName: '',
    roleIds: [],
    status: 1,
  };
}

function getEditFormValues(data: SystemUserApi.SystemUser) {
  return {
    accountName: data.username || '',
    accountSecret: '',
    parkIds: normalizeIdList(data.parkIds),
    phone: data.phone || '',
    realName: data.realName || '',
    roleIds: data.roleIds || [],
    status: Number(data.status ?? 1),
  };
}

function clearCreateFormValues(sequence: number) {
  if (sequence !== openSequence || isEdit.value) {
    return;
  }
  formApi.setValues(getCreateFormValues());
}

function scheduleCreateFormClear(sequence: number) {
  clearScheduledCreateFormReset();
  void nextTick(() => {
    clearCreateFormValues(sequence);
    clearCreateFormTimers = [80, 300, 800, 2000].map((delay) =>
      setTimeout(() => clearCreateFormValues(sequence), delay),
    );
  });
}

async function loadParkOptions() {
  try {
    parkOptions.value = await getParkOptions();
  } catch (error) {
    console.error('加载园区列表失败:', error);
    message.error('加载园区列表失败');
  }
}

function resetForm() {
  formApi.resetForm();
  formApi.setValues(
    formData.value ? getEditFormValues(formData.value) : getCreateFormValues(),
  );
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    const values = await formApi.getValues<Record<string, any>>();
    const accountName = String(values.accountName || '').trim();
    const accountSecret = String(values.accountSecret || '').trim();
    const payload: Record<string, any> = {
      parkIds: normalizeIdList(values.parkIds),
      phone: values.phone || '',
      realName: values.realName,
      roleIds: Array.isArray(values.roleIds) ? values.roleIds : [],
      status: Number(values.status ?? 1),
      username: accountName,
    };

    if (!isEdit.value && !accountSecret) {
      message.error('新增账号时密码不能为空');
      return;
    }

    if (accountSecret) {
      payload.password = accountSecret;
    }

    modalApi.lock();
    try {
      const result = await (isEdit.value && formData.value?.id
        ? updateSystemUser(Number(formData.value.id), payload)
        : createSystemUser({
            ...payload,
            password: accountSecret,
          }));
      const resultData = result as undefined | { id?: number | string };
      const mode = isEdit.value ? 'edit' : 'create';

      modalApi.close();
      message.success(mode === 'create' ? '账号添加成功' : '账号保存成功');
      emit('success', {
        id: resultData?.id
          ? Number(resultData.id)
          : (formData.value?.id ?? null),
        mode,
        username: accountName,
      });
    } catch (error) {
      console.error('保存账号失败:', error);
    } finally {
      modalApi.lock(false);
    }
  },
  onOpenChange(open) {
    openSequence += 1;
    clearScheduledCreateFormReset();
    if (!open) {
      return;
    }

    const sequence = openSequence;
    const data = modalApi.getData<SystemUserApi.SystemUser>();
    formData.value = data || null;
    formApi.resetForm();
    loadParkOptions();
    const inputNameSuffix = `_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;

    formApi.updateSchema([
      {
        componentProps: {
          ...getAccountUsernameInputProps('请输入账号', inputNameSuffix),
          disabled: Boolean(data?.id),
        },
        fieldName: 'accountName',
      },
      {
        componentProps: getAccountPasswordInputProps(
          data?.id ? '留空则不修改密码' : '请输入密码',
          inputNameSuffix,
        ),
        fieldName: 'accountSecret',
        label: data?.id ? '密码（留空不修改）' : '密码',
      },
    ]);

    if (data) {
      formApi.setValues(getEditFormValues(data));
    } else {
      formApi.setValues(getCreateFormValues());
      scheduleCreateFormClear(sequence);
    }
  },
});

onBeforeUnmount(() => {
  clearScheduledCreateFormReset();
});
</script>

<template>
  <Modal :title="title">
    <div aria-hidden="true" class="system-user-autofill-decoys">
      <input autocomplete="username" name="username" tabindex="-1" />
      <input autocomplete="current-password" name="password" tabindex="-1" />
    </div>
    <Form class="mx-4">
      <template #parkIds="slotProps">
        <Select
          :filter-option="
            (input, option) =>
              String(option?.label || '')
                .toLowerCase()
                .includes(String(input).toLowerCase())
          "
          :options="parkOptions"
          :value="normalizeIdList(slotProps.modelValue)"
          allow-clear
          class="w-full"
          mode="multiple"
          option-filter-prop="label"
          placeholder="输入搜索或下拉选择可管理园区"
          show-search
          @change="
            (value) => formApi.setFieldValue('parkIds', normalizeIdList(value))
          "
        />
        <div class="mt-1 text-xs text-gray-400">
          可直接输入园区名称过滤，也可以展开下拉多选；保存时会自动去重。
        </div>
      </template>
    </Form>
    <template #prepend-footer>
      <div class="flex-auto">
        <Button type="primary" danger @click="resetForm">
          {{ $t('common.reset') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.system-user-autofill-decoys {
  position: fixed;
  width: 1px;
  height: 1px;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  transform: translate(-9999px, -9999px);
}
</style>
