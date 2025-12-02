<script lang="ts" setup>
import type { RentalManagementItem } from '../types';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';
import dayjs from 'dayjs'; // 添加 dayjs 导入

import { useVbenForm } from '#/adapter/form';
import { createTenant, updateTenant } from '#/api/rental';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<RentalManagementItem>();
const getTitle = computed(() => {
  return formData.value?.rentalTenantId
    ? $t('ui.actionTitle.edit', [$t('system.rental.tenant.item')])
    : $t('ui.actionTitle.create', [$t('system.rental.tenant.item')]);
});

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: useFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-4',
});

function mapImagesToFileList(
  images?: RentalManagementItem['images'] | string[],
) {
  if (!images || !Array.isArray(images)) return [];
  return images
    .map((item, index) => {
      if (!item) return null;
      if (typeof item === 'string') {
        return {
          name: `image-${index}`,
          status: 'done',
          uid: `existing-string-${index}`,
          url: item,
        };
      }
      if (
        (item as any).status &&
        ((item as any).url || (item as any).thumbUrl)
      ) {
        return item as any;
      }
      const url = (item as any).url;
      if (!url) return null;
      const imgId = (item as any).imgId;
      return {
        imgId,
        name: `image-${imgId ?? index}`,
        status: 'done',
        uid: `existing-${imgId ?? index}`,
        url,
      };
    })
    .filter(Boolean);
}

function buildImagePayload(files: any[], isUpdate: boolean) {
  if (!files || files.length === 0) {
    return isUpdate ? { deleteMany: {} } : undefined;
  }

  const createInputs = files
    .map((file) => {
      const rawImgId =
        file?.imgId ??
        file?.response?.data?.imgId ??
        file?.originFileObj?.imgId ??
        file?.response?.data?.id;
      const imgId = Number(rawImgId);
      if (!imgId || Number.isNaN(imgId)) {
        return null;
      }
      return { image: { connect: { imgId } } };
    })
    .filter(Boolean);

  if (createInputs.length === 0) {
    return isUpdate ? { deleteMany: {} } : undefined;
  }

  return {
    create: createInputs,
    ...(isUpdate ? { deleteMany: {} } : {}),
  };
}

function transformToFormValues(data?: RentalManagementItem) {
  if (!data) {
    return {
      images: [],
      increaseData: [],
      status: '当期',
    } as Partial<RentalManagementItem>;
  }

  const values: Record<string, any> = { ...data };

  if (values.contractStart && values.contractEnd) {
    values.contractDate = [
      dayjs(values.contractStart).format('YYYY-MM-DD'),
      dayjs(values.contractEnd).format('YYYY-MM-DD'),
    ];
  }

  if (values.increaseData) {
    try {
      let increaseFrom =
        typeof values.increaseData === 'string'
          ? JSON.parse(values.increaseData)
          : values.increaseData;

      if (!Array.isArray(increaseFrom)) {
        increaseFrom = [];
      }

      values.increaseData = increaseFrom;
    } catch (error) {
      console.error('处理增租数据失败:', error);
      values.increaseData = [];
    }
  } else {
    values.increaseData = [];
  }

  values.images = mapImagesToFileList(values.images);
  return values;
}

function resetForm() {
  formApi.resetForm();
  formApi.setValues(transformToFormValues(formData.value));
}

const id = ref();
const [Modal, modalApi] = useVbenModal({
  class: 'w-[90%] md:w-[70%] lg:w-[60%]',
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();

    // 处理日期格式，确保使用本地时间
    if (values.contractDate) {
      values.contractStart = new Date(values.contractDate[0]).toISOString(); // 转换为ISO字符串，确保正确的时间格式
      values.contractEnd = new Date(values.contractDate[1]).toISOString(); // 转换为ISO字符串，确保正确的时间格式
      delete values.contractDate;
    }
    if (values.increaseData) {
      // 确保increaseData是数组
      if (Array.isArray(values.increaseData)) {
        const increaseData = [];
        for (const item of values.increaseData) {
          if (item.date && item.rate) {
            increaseData.push({
              date: item.date,
              rate: item.rate,
            });
          }
        }
        values.increaseData = JSON.stringify(increaseData);
      } else {
        // 如果不是数组，设置为空数组的JSON字符串
        values.increaseData = '[]';
      }
    } else {
      // 如果不存在，设置为空数组的JSON字符串
      values.increaseData = '[]';
    }

    const files = Array.isArray((values as any).images)
      ? (values as any).images
      : [];
    const imagePayload = buildImagePayload(files, Boolean(id.value));
    if (imagePayload) {
      (values as any).images = imagePayload;
    } else {
      delete (values as any).images;
    }

    modalApi.lock();

    try {
      if (id.value) {
        await updateTenant(id.value, values);
        message.success({
          content: $t('ui.actionMessage.updateSuccess', [values.tenantName]),
        });
      } else {
        await createTenant(values);
        message.success({
          content: $t('ui.actionMessage.createSuccess', [values.tenantName]),
        });
      }
      emit('success');
      modalApi.close();
    } catch (error) {
      console.error('操作失败:', error);
      message.error({
        content: $t('ui.actionMessage.operationFailed', [values.tenantName]),
      });
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<RentalManagementItem>();
      formApi.resetForm();
      if (data && Object.keys(data).length > 0) {
        const values = transformToFormValues(data);

        formData.value = { ...data };
        id.value = data.rentalTenantId;

        setTimeout(() => {
          formApi.setValues(values);
        }, 100);
      } else {
        id.value = undefined;
        formData.value = undefined;
        formApi.setValues(transformToFormValues());
      }
    }
  },
});
</script>

<template>
  <Modal :title="getTitle">
    <Form class="mx-4" />
    <template #prepend-footer>
      <div class="flex-auto">
        <Button type="primary" danger @click="resetForm">
          {{ $t('common.reset') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>
