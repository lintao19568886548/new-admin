<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemFeedbackApi } from '#/api/system/feedback';

import { Page, useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getSystemFeedbackList } from '#/api/system/feedback';

import { useColumns, useGridFormSchema } from './data';
import Detail from './modules/detail.vue';

const [DetailModal, detailModalApi] = useVbenModal({
  connectedComponent: Detail,
  destroyOnClose: true,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<SystemFeedbackApi.FeedbackItem>) {
  if (code === 'view') {
    detailModalApi.setData(row).open();
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    fieldMappingTime: [['createTime', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
    submitOnChange: false,
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: true,
      pageSize: 20,
      pageSizes: [10, 20, 50, 100],
    },
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          try {
            const formValues = (await gridApi.formApi?.getValues?.()) || {};
            const params: Record<string, any> = {
              currentPage: page?.currentPage || 1,
              pageSize: page?.pageSize || 20,
            };

            Object.entries(formValues).forEach(([key, value]) => {
              if (value !== undefined && value !== null && value !== '') {
                params[key] = value;
              }
            });

            return await getSystemFeedbackList(params);
          } catch (error) {
            console.error('获取反馈列表失败:', error);
            message.error('获取反馈列表失败');
            return {
              total: 0,
              items: [],
            };
          }
        },
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SystemFeedbackApi.FeedbackItem>,
});
</script>

<template>
  <Page auto-content-height>
    <DetailModal />
    <Grid table-title="意见反馈" />
  </Page>
</template>
