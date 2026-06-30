<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteAccessBrand, getAccessBrandList } from '#/api/access/brand';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

function onCreate() {
  formModalApi.setData({ enabled: true, isDefault: false }).open();
}

function onEdit(row: Record<string, any>) {
  formModalApi.setData({ ...row }).open();
}

async function onDelete(row: Record<string, any>) {
  message.loading({
    content: `正在删除 ${row.brandName}`,
    duration: 0,
    key: 'access_brand_action',
  });

  try {
    await deleteAccessBrand(row.accessBrandId);
    message.success({
      content: `已删除 ${row.brandName}`,
      key: 'access_brand_action',
    });
    refreshGrid();
  } catch (error) {
    console.error('删除门禁品牌失败:', error);
    message.error({
      content: '删除门禁品牌失败',
      key: 'access_brand_action',
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
    schema: useGridFormSchema(),
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
          return await getAccessBrandList({
            ...formData,
            currentPage: page?.currentPage || 1,
            pageSize: page?.pageSize || 20,
          });
        },
      },
    },
    rowConfig: {
      keyField: 'accessBrandId',
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
    <Grid table-title="门禁品牌管理">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          新增门禁品牌
        </Button>
      </template>
    </Grid>
  </Page>
</template>
