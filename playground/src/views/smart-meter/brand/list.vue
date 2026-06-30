<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { MeterType } from '#/api/smart-meter';

import { computed } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteMeterBrand, getMeterBrandList } from '#/api/smart-meter';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const props = withDefaults(
  defineProps<{
    meterType?: MeterType;
  }>(),
  {
    meterType: 'electric',
  },
);

const pageLabel = computed(() =>
  props.meterType === 'water' ? '水表品牌' : '电表品牌',
);

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

function onCreate() {
  formModalApi
    .setData({ enabled: true, isDefault: false, meterType: props.meterType })
    .open();
}

function onEdit(row: Record<string, any>) {
  formModalApi.setData({ ...row, meterType: props.meterType }).open();
}

async function onDelete(row: Record<string, any>) {
  message.loading({
    content: `正在删除 ${row.brandName}`,
    duration: 0,
    key: 'meter_brand_action',
  });

  try {
    await deleteMeterBrand(row.meterBrandId);
    message.success({
      content: `已删除 ${row.brandName}`,
      key: 'meter_brand_action',
    });
    refreshGrid();
  } catch (error) {
    console.error('删除水电表品牌失败:', error);
    message.error({
      content: '删除水电表品牌失败',
      key: 'meter_brand_action',
    });
  }
}

function onActionClick({ code, row }: OnActionClickParams) {
  switch (code) {
    case 'delete': {
      onDelete(row);
      break;
    }
    case 'edit': {
      onEdit(row);
      break;
    }
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    schema: useGridFormSchema(props.meterType),
  },
  gridOptions: {
    border: true,
    columns: useColumns(onActionClick),
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
          const formData = (await gridApi.formApi?.getValues?.()) || {};
          return await getMeterBrandList({
            ...formData,
            currentPage: page?.currentPage || 1,
            meterType: props.meterType,
            pageSize: page?.pageSize || 20,
          });
        },
      },
    },
    rowConfig: {
      keyField: 'meterBrandId',
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

function refreshGrid() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="refreshGrid" />
    <Grid :table-title="`${pageLabel}管理`">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          新增{{ pageLabel }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
