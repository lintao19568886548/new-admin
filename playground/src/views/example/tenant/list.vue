<script lang="ts" setup>
import { ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createTenant,
  deleteTenant,
  getTenantList,
  updateTenant,
} from '#/api/rental';
import AreaSelector from '#/components/AreaSelector.vue';
import CrudForm from '#/components/CrudForm.vue';
import { useCrud } from '#/hooks/useCrud';
import { $t } from '#/locales';

import { useColumns, useFormSchema, useGridFormSchema } from './data';

// 当前选中的区域
const currentPark = ref();

const areaSelectorRef = ref();

// 使用通用CRUD钩子
const { FormModal, handleFormSubmit, onActionClick, onCreate } = useCrud({
  createApi: createTenant,
  // 使用类型断言解决参数类型不匹配问题
  deleteApi: ((id: number | string) => deleteTenant(Number(id))) as (
    id: number | string,
  ) => Promise<any>,
  entityName: $t('system.rental.tenant.item'),
  formComponent: CrudForm,
  idField: 'rentalTenantId',
  nameField: 'tenantName',
  refreshCallback: () => gridApi.query(),
  // 使用类型断言解决参数类型不匹配问题
  updateApi: ((id: number | string, data: any) =>
    updateTenant(Number(id), data)) as (
    id: number | string,
    data: any,
  ) => Promise<any>,
});

// 表格API引用
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
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
      pageSizes: [10, 20, 30, 50, 100],
    },
    proxyConfig: {
      ajax: {
        query: async ({
          page,
        }: {
          page: { currentPage?: number; pageSize?: number };
        }) => {
          try {
            const formValues = (await gridApi.formApi?.getValues?.()) || {};
            // 明确定义params的类型
            const params: Record<string, any> = {};

            Object.keys(formValues).forEach((key) => {
              if (
                formValues[key] !== undefined &&
                formValues[key] !== null &&
                formValues[key] !== ''
              ) {
                params[key] = formValues[key];
              }
            });
            // 添加区域参数
            params.currentPark = currentPark.value
              ? currentPark.value.parkId
              : -1;

            params.currentPage = page?.currentPage || 1;
            params.pageSize = page?.pageSize || 20;

            console.warn('处理后的查询参数:', params);

            const result = await getTenantList(params);

            return {
              currentPage: result.currentPage || 1,
              pageSize: result.pageSize || 20,
              total: result.total || 0,
              items: result.items || [],
            };
          } catch (error) {
            console.error('获取租户列表失败:', error);
            return {
              currentPage: 1,
              pageSize: 20,
              total: 0,
              items: [],
            };
          }
        },
      },
    },
    rowConfig: {
      keyField: 'rentalTenantId',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: { code: 'query' },
      search: true,
      zoom: true,
    },
  },
});

// 刷新表格数据
function refreshGrid() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <FormModal
      :schema="useFormSchema()"
      :entity-name="$t('system.rental.tenant.item')"
      id-field="rentalTenantId"
      :date-fields="['contractDate', 'increaseDate']"
      :handle-submit="handleFormSubmit"
      @success="refreshGrid"
    />
    <Grid :table-title="$t('system.rental.tenant.list')">
      <template #toolbar-actions>
        <!-- 区域选择下拉菜单 -->
        <AreaSelector
          :default-park="currentPark"
          :refresh-callback="refreshGrid"
          @change="(park) => (currentPark = park)"
          ref="areaSelectorRef"
        />
      </template>
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.rental.tenant.item')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
