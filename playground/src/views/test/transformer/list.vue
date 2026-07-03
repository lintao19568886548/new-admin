<script lang="ts" setup>
import type { TransformerItem } from './types';

import { defineAsyncComponent, h, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
// 导入API函数
import {
  createTransformer,
  deleteTransformer,
  getTransformerList,
  updateTransformer,
} from '#/api/maintenance/transformer';
import AreaSelector from '#/components/AreaSelector.vue';
import CrudForm from '#/components/CrudForm.vue';
import { useCrud } from '#/hooks/useCrud';
import { $t } from '#/locales';

import { useColumns, useFormSchema, useGridFormSchema } from './data';

const VuePdfEmbed = defineAsyncComponent(() => import('vue-pdf-embed'));

// 当前选中的区域
const currentPark = ref();
const parkSelectorRef = ref();

// 使用通用CRUD钩子
const {
  FormModal,
  handleFormSubmit,
  onActionClick: baseActionClick,
  onCreate,
} = useCrud({
  createApi: createTransformer,
  // 删除不支持的 customActions 属性
  deleteApi: ((transformerId: number | string) =>
    deleteTransformer(Number(transformerId))) as (
    transformerId: number | string,
  ) => Promise<any>,
  entityName: $t('system.maintenance.transformer.name'),
  formComponent: CrudForm,
  idField: 'transformerId',
  nameField: 'title',
  refreshCallback: () => onRefresh(),
  updateApi: ((transformerId: number | string, data: any) =>
    updateTransformer(Number(transformerId), data)) as (
    transformerId: number | string,
    data: any,
  ) => Promise<any>,
});

// 自定义操作点击处理函数，包装原始的 onActionClick
function onActionClick(params: any) {
  const { code, row } = params;

  // 处理查看操作
  if (code === 'view') {
    onView(row);
    return;
  }

  // 其他操作交给基础的 onActionClick 处理
  baseActionClick(params);
}

// 自定义查看详情
function onView(row: TransformerItem) {
  // 创建一个响应式变量来存储缩放比例
  const scale = ref(window.innerWidth <= 768 ? 2 : 1.5);

  // 创建一个更新函数，用于强制更新DOM
  const updateTransform = (value: number) => {
    scale.value = value;
    // 找到PDF容器并更新样式
    const pdfContainer = document.querySelector('.pdf-container');
    if (pdfContainer) {
      // 将Element类型转换为HTMLElement类型，因为HTMLElement有style属性
      (pdfContainer as HTMLElement).style.transform = `scale(${value})`;
    }
  };

  // 使用模态框展示PDF，使用 vue-pdf-embed 组件
  Modal.info({
    bodyStyle: {
      height:
        window.innerWidth <= 768 ? 'calc(90vh - 50px)' : 'calc(90vh - 50px)',
      margin: 0,
      overflow: 'auto',
      padding: 0,
    },
    centered: true,
    closable: true,
    content: h(
      'div',
      {
        style: `
          width: 100%; 
          height: 100%; 
          display: flex;
          justify-content: flex-start;
          align-items: flex-start;
          overflow: visible;
          padding: 0;
        `,
      },
      [
        h(
          'div',
          {
            class: 'pdf-container',
            style: `
              transform: scale(${scale.value});
              transform-origin: left top;
              margin-bottom: 100%;
              width: 100%;
              overflow: visible;
            `,
          },
          [
            h(VuePdfEmbed, {
              onLoaded: (pdf) => {
                console.warn('PDF加载成功', pdf);
              },
              'onLoading-failed': (error) => {
                console.error('PDF加载错误:', error);
                message.error('PDF文件加载失败，请检查文件格式或路径');
              },
              source: `/transformer/${row.transformerId}.pdf`,
              width:
                window.innerWidth <= 768
                  ? window.innerWidth * 0.9
                  : window.innerWidth * 0.5,
            }),
          ],
        ),
      ],
    ),
    footer: h(
      'div',
      {
        style: `
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          background-color: #fff;
          border-top: 1px solid #f0f0f0;
          z-index: 10;
        `,
      },
      [
        // 左侧添加滑动条
        h('div', { style: 'display: flex; align-items: center;' }, [
          h('span', { style: 'margin-right: 8px;' }, '缩放:'),
          h('input', {
            max: 5,
            min: 0.5,
            onInput: (e) => {
              if (e && e.target) {
                const target = e.target as HTMLInputElement;
                const value = Number.parseFloat(target.value);
                // 使用DOM操作直接更新样式
                updateTransform(value);

                // 更新百分比显示
                const percentElement = document.querySelector('.scale-percent');
                if (percentElement) {
                  percentElement.textContent = `${(value * 100).toFixed(0)}%`;
                }
              }
            },
            step: 0.1,
            style: 'width: 150px;',
            type: 'range',
            value: scale.value,
          }),
          h(
            'span',
            {
              class: 'scale-percent',
              style: 'margin-left: 8px;',
            },
            `${(scale.value * 100).toFixed(0)}%`,
          ),
        ]),
        // 右侧关闭按钮
        h(
          Button,
          {
            onClick: () => {
              Modal.destroyAll();
            },
            type: 'primary',
          },
          '关闭',
        ),
      ],
    ),
    maskClosable: true,
    title: `${row.title}详情文档`,
    width: window.innerWidth <= 768 ? '100%' : '90%',
    wrapClassName: 'pdf-modal-wrapper',
  });
}

// 表格API引用
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    fieldMappingTime: [['checkTime', ['startTime', 'endTime']]],
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
          page: { currentPage: number; pageSize: number };
        }) => {
          try {
            const formValues = (await gridApi.formApi?.getValues?.()) || {};
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

            // 处理日期范围
            if (params.startTime && params.endTime) {
              params.startTime = `${params.startTime} 00:00:00`;
              params.endTime = `${params.endTime} 23:59:59`;
            }

            // 添加区域参数
            if (currentPark.value && currentPark.value.parkId !== -1) {
              params.parkId = currentPark.value.parkId;
            }

            params.currentPage = page?.currentPage || 1;
            params.pageSize = page?.pageSize || 20;

            console.warn('处理后的查询参数:', params);

            const result = await getTransformerList(params);

            return {
              currentPage: result.currentPage || 1,
              pageSize: result.pageSize || 20,
              total: result.total || 0,
              items: result.items || [],
            };
          } catch (error) {
            console.error('获取变压器数据失败:', error);
            message.error('获取变压器列表失败');
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
      keyField: 'transformerId',
    },
    scrollX: {
      enabled: true,
    },
    scrollY: {
      enabled: true,
    },
    showOverflow: true,
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
function onRefresh() {
  gridApi.query();
}

// 搜索处理函数
function onSearch(params: any) {
  console.warn('触发搜索，原始参数:', params);

  // 检查参数格式
  let searchParams = params;

  // 如果params是事件对象，尝试从中提取表单数据
  if (params && params.form) {
    searchParams = params.form;
  } else if (params && params.$event && params.$event.form) {
    searchParams = params.$event.form;
  } else if (params && params.data) {
    searchParams = params.data;
  } else if (!params || typeof params !== 'object') {
    searchParams = {};
  }

  console.warn('处理后的搜索参数对象:', searchParams);

  // 清理空值参数
  const cleanParams: Record<string, any> = {};
  if (searchParams && typeof searchParams === 'object') {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== null && value !== undefined && value !== '') {
        cleanParams[key] = value;
      }
    }
  }

  console.warn('清理后的搜索参数:', cleanParams);

  // 使用表单数据进行查询
  gridApi.query({
    form: cleanParams,
  });
}
</script>

<template>
  <Page auto-content-height>
    <FormModal
      :schema="useFormSchema()"
      :entity-name="$t('system.maintenance.transformer.name')"
      id-field="transformerId"
      :date-fields="['checkTime']"
      :handle-submit="handleFormSubmit"
      @success="onRefresh"
    />
    <Grid
      :table-title="$t('system.maintenance.transformer.list')"
      @search="onSearch"
      @form-submit="onSearch"
    >
      <template #toolbar-actions>
        <!-- 区域选择下拉菜单 -->
        <AreaSelector
          :default-area="currentPark"
          :refresh-callback="onRefresh"
          @change="(park) => (currentPark = park)"
          ref="parkSelectorRef"
        />
      </template>
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{
            $t('ui.actionTitle.create', [
              $t('system.maintenance.transformer.name'),
            ])
          }}
        </Button>

        <!-- 添加自定义按钮 -->
        <Button class="ml-2" type="default" @click="onRefresh">
          刷新数据
        </Button>
      </template>
    </Grid>
  </Page>
</template>
