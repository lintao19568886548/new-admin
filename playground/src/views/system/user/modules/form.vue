<script lang="ts" setup>
import type { SystemUserApi } from '#/api';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message, Select } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getParkList } from '#/api/park';
import { createSystemUser, updateSystemUser } from '#/api/system/user';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<null | SystemUserApi.SystemUser>(null);
const parkOptions = ref<Array<{ label: string; value: number }>>([]);
const isEdit = computed(() => Boolean(formData.value?.id));

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

async function loadParkOptions() {
  try {
    const result = await getParkList();
    let parks: any[] = [];
    if (Array.isArray(result)) {
      parks = result;
    } else if (Array.isArray((result as any)?.items)) {
      parks = (result as any).items;
    }
    parkOptions.value = parks
      .map((park: any) => ({
        label: String(park.parkName || ''),
        value: Number(park.parkId),
      }))
      .filter(
        (park: { label: string; value: number }) =>
          park.label && Number.isInteger(park.value),
      );
  } catch (error) {
    console.error('加载园区列表失败:', error);
    message.error('加载园区列表失败');
  }
}

function resetForm() {
  formApi.resetForm();
  formApi.setValues(formData.value || { status: 1 });
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    const values = await formApi.getValues<Record<string, any>>();
    const payload: Record<string, any> = {
      parkIds: normalizeIdList(values.parkIds),
      phone: values.phone || '',
      realName: values.realName,
      roleIds: Array.isArray(values.roleIds) ? values.roleIds : [],
      status: Number(values.status ?? 1),
      username: values.username,
    };

    if (!isEdit.value && !String(values.password || '').trim()) {
      message.error('新增账号时密码不能为空');
      return;
    }

    if (String(values.password || '').trim()) {
      payload.password = String(values.password);
    }

    modalApi.lock();
    try {
      await (isEdit.value && formData.value?.id
        ? updateSystemUser(Number(formData.value.id), payload)
        : createSystemUser({
            ...payload,
            password: String(values.password),
          }));

      modalApi.close();
      emit('success');
    } catch (error) {
      console.error('保存账号失败:', error);
    } finally {
      modalApi.lock(false);
    }
  },
  onOpenChange(open) {
    if (!open) {
      return;
    }

    const data = modalApi.getData<SystemUserApi.SystemUser>();
    formData.value = data || null;
    formApi.resetForm();
    loadParkOptions();

    formApi.updateSchema([
      {
        componentProps: {
          disabled: Boolean(data?.id),
          placeholder: '请输入账号',
        },
        fieldName: 'username',
      },
      {
        componentProps: {
          placeholder: data?.id ? '留空则不修改密码' : '请输入密码',
        },
        fieldName: 'password',
        label: data?.id ? '密码（留空不修改）' : '密码',
      },
    ]);

    if (data) {
      formApi.setValues({
        parkIds: normalizeIdList(data.parkIds),
        phone: data.phone || '',
        realName: data.realName || '',
        roleIds: data.roleIds || [],
        status: Number(data.status ?? 1),
        username: data.username || '',
      });
    } else {
      formApi.setValues({
        parkIds: [],
        status: 1,
      });
    }
  },
});
</script>

<template>
  <Modal :title="title">
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
