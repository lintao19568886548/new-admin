<script lang="ts" setup>
import type { RentalManagementItem } from '../types';

import type { VbenFormSchema } from '#/adapter/form';

import { computed, h, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';
import dayjs from 'dayjs'; // 添加 dayjs 导入

import { useVbenForm } from '#/adapter/form';
import { createTenant, updateTenant } from '#/api/rental';
import { $t } from '#/locales';

import { useFormSchema } from '../data';
import { analyzeTenantImages, filesToDataUrls, fileToDataUrl } from '../llm';

const emit = defineEmits(['success']);
const formData = ref<RentalManagementItem>();
const formSchema = useFormSchema();
const llmLoading = ref(false);
const getTitle = computed(() => {
  return formData.value?.rentalTenantId
    ? $t('ui.actionTitle.edit', [$t('system.rental.tenant.item')])
    : $t('ui.actionTitle.create', [$t('system.rental.tenant.item')]);
});

enhanceImageFieldWithLlm(formSchema);

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: formSchema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-4',
});

function enhanceImageFieldWithLlm(schema: VbenFormSchema[]) {
  const imageField = schema.find((item) => item.fieldName === 'images');
  if (!imageField) return;

  const baseProps = imageField.componentProps;
  imageField.componentProps = (values, actions) => {
    const resolvedProps =
      typeof baseProps === 'function'
        ? baseProps(values, actions)
        : baseProps || {};
    const baseOnChange =
      typeof resolvedProps?.onChange === 'function'
        ? resolvedProps.onChange
        : undefined;

    return {
      ...resolvedProps,
      onChange: async (info: any) => {
        baseOnChange?.(info);
        await handleUploadLlm(info);
      },
    };
  };

  imageField.suffix = () =>
    h(
      Button,
      {
        class: 'ml-8',
        loading: llmLoading.value,
        onClick: () => handleManualLlm(),
        size: 'small',
        type: 'default',
      },
      () => '识别填表',
    );
}

async function handleUploadLlm(info: any) {
  if (!info?.file || info.file.status !== 'done') return;
  if (!info.file.originFileObj) return;

  try {
    const dataUrl = await fileToDataUrl(info.file.originFileObj);
    await analyzeAndFill([dataUrl]);
  } catch (error) {
    console.error('上传后自动识别失�?', error);
  }
}

async function handleManualLlm() {
  try {
    const values = await formApi?.getValues?.();
    const files = Array.isArray((values as any)?.images)
      ? (values as any).images
      : [];
    const dataUrls = await filesToDataUrls(files);
    if (dataUrls.length === 0) {
      message.warning('没有可识别的图片');
      return;
    }
    await analyzeAndFill(dataUrls);
  } catch (error) {
    console.error('手动识别失败:', error);
  }
}

function normalizeDateRange(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    const [start, end] = raw;
    return [start, end].filter(Boolean);
  }
  if (typeof raw === 'object') {
    return [raw.start, raw.end].filter(Boolean);
  }
  if (typeof raw === 'string') {
    const match = raw.match(/(20\d{2}-\d{2}-\d{2}).*?(20\d{2}-\d{2}-\d{2})/);
    if (match?.[1] && match?.[2]) return [match[1], match[2]];
    if (raw.trim()) return [raw.trim()];
  }
  return [];
}

function normalizeNumber(raw: any): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  const cleaned = String(raw).replaceAll(/[^\d.-]/g, '');
  const num = Number.parseFloat(cleaned);
  if (Number.isNaN(num)) return undefined;
  return num;
}

async function analyzeAndFill(dataUrls: string[]) {
  if (llmLoading.value) return;
  if (!dataUrls || dataUrls.length === 0) return;
  llmLoading.value = true;
  try {
    const result = await analyzeTenantImages(dataUrls);
    if (!result) {
      message.warning('未从图片中识别到信息');
      return;
    }

    const currentValues = (await formApi?.getValues?.()) || {};
    const patch: Record<string, any> = {};

    if (result.tenantName && !currentValues.tenantName) {
      patch.tenantName = result.tenantName.trim();
    }
    if (result.phoneNumber && !currentValues.phoneNumber) {
      patch.phoneNumber = result.phoneNumber.trim();
    }
    if (result.address && !currentValues.address) {
      patch.address = result.address.trim();
    }

    const dates = normalizeDateRange(result.contractDate);
    if (
      dates.length > 0 &&
      (!currentValues.contractDate || currentValues.contractDate.length === 0)
    ) {
      const [start, end] = dates;
      if (dates.length === 1 && start) {
        patch.contractDate = [start, start];
      } else if (start && end) {
        patch.contractDate = [start, end];
      }
    }

    const rentNumber = normalizeNumber(result.rent);
    const hasRent =
      currentValues.rent !== undefined &&
      currentValues.rent !== null &&
      currentValues.rent !== '';
    if (rentNumber !== undefined && !hasRent) {
      patch.rent = rentNumber;
    }

    const areaNumber = normalizeNumber(result.area);
    const hasArea =
      currentValues.area !== undefined &&
      currentValues.area !== null &&
      currentValues.area !== '';
    if (areaNumber !== undefined && !hasArea) {
      patch.area = areaNumber;
    }

    if (Object.keys(patch).length > 0) {
      formApi?.setValues?.(patch);
      message.success('已根据图片自动填充字段');
    } else {
      message.info('未找到需要更新的字段或字段已填写');
    }
  } catch (error: any) {
    console.error('图片识别失败:', error);
    const errorMessage = String(error?.message || error?.error || '');
    let errorTip = '图片识别失败，请稍后重试';
    if (errorMessage.includes('ALIYUN_BAILIAN_KEY')) {
      errorTip = '请先配置 ALIYUN_BAILIAN_KEY';
    } else if (errorMessage.toLowerCase().includes('timeout')) {
      errorTip = '图片识别超时，请稍后重试';
    }
    message.error(errorTip);
  } finally {
    llmLoading.value = false;
  }
}

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
      values.contractStart = new Date(values.contractDate[0]).toISOString();
      values.contractEnd = new Date(values.contractDate[1]).toISOString();
      delete values.contractDate;
    }
    if (values.increaseData) {
      // 确保 increaseData 是数组
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
        // 如果不是数组，设置为空数组的 JSON 字符串
        values.increaseData = '[]';
      }
    } else {
      // 如果不存在，设置为空数组的 JSON 字符串
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
