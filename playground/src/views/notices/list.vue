<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { NoticeItem } from '#/api/notices';

import { Page } from '@vben/common-ui';

import { Tag, Typography } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getNoticeList } from '#/api/notices';

const { Link: TypographyLink } = Typography;

function formatPublishDate(value: string) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  const d = dayjs(s, 'YYYYMMDDHHmmss', true);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : s;
}

const gridFormSchema: VbenFormSchema[] = [
  {
    component: 'Input',
    componentProps: {
      allowClear: true,
      placeholder: '标题/单位/分类',
    },
    fieldName: 'keyword',
    label: '关键字',
  },
];

const columns: VxeTableGridOptions<NoticeItem>['columns'] = [
  {
    field: 'title',
    fixed: 'left',
    minWidth: 520,
    showOverflow: true,
    slots: { default: 'title_cell' },
    title: '标题',
  },
  {
    field: 'category',
    minWidth: 140,
    slots: { default: 'category_cell' },
    title: '分类',
  },
  {
    field: 'projectType',
    minWidth: 220,
    slots: { default: 'projectType_cell' },
    title: '项目类型',
  },
  {
    field: 'owner',
    minWidth: 260,
    showOverflow: true,
    title: '业主/单位',
  },
  {
    field: 'date',
    formatter: ({ cellValue }) => formatPublishDate(String(cellValue ?? '')),
    minWidth: 180,
    title: '发布时间',
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    handleReset: async () => {
      await gridApi.formApi?.resetForm();
      refreshGrid();
    },
    schema: gridFormSchema,
    submitOnChange: false,
  },
  gridOptions: {
    border: true,
    columns,
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: true,
      pageSize: 20,
      pageSizes: [10, 20, 50, 100, 200],
    },
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          const formValues = (await gridApi.formApi?.getValues?.()) || {};
          const params = {
            currentPage: page?.currentPage || 1,
            keyword: String(formValues.keyword ?? '').trim() || undefined,
            pageSize: page?.pageSize || 20,
          };
          return await getNoticeList(params);
        },
      },
    },
    rowConfig: {
      keyField: 'noticeId',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<NoticeItem>,
});

function refreshGrid() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <Grid table-title="招标信息">
      <template #title_cell="{ row }">
        <TypographyLink
          :href="row.link"
          rel="noopener noreferrer"
          target="_blank"
          :title="row.title"
        >
          {{ row.title }}
        </TypographyLink>
      </template>

      <template #category_cell="{ row }">
        <Tag color="geekblue">{{ row.category }}</Tag>
      </template>

      <template #projectType_cell="{ row }">
        <Tag color="purple">{{ row.projectType }}</Tag>
      </template>
    </Grid>
  </Page>
</template>
