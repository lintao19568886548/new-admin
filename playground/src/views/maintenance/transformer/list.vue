<script lang="ts" setup>
import type { RentalManagementItem } from './types';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { h, ref } from 'vue';
import VuePdfEmbed from 'vue-pdf-embed'; // 引入 vue-pdf-embed

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

// 当前选中的区域
const currentArea = ref({
  key: 'all',
  value: '全部区域',
});

const parkSelectorRef = ref();

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

/**
 * 编辑租赁项目
 * @param row
 */
function onEdit(row: RentalManagementItem) {
  formModalApi.setData(row).open();
}

/**
 * 创建新租赁项目
 */
function onCreate() {
  formModalApi.setData(null).open();
}

/**
 * 删除租赁项目
 * @param row
 */
function onDelete(row: RentalManagementItem) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.title]),
    duration: 0,
    key: 'action_process_msg',
  });

  // 模拟API请求
  setTimeout(() => {
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.title]),
      key: 'action_process_msg',
    });
    refreshGrid();
  }, 1000);
}

function onView(row: RentalManagementItem) {
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
              source: `/transformer/${row.id}.pdf`,
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

/**
 * 表格操作按钮的回调函数
 */
function onActionClick({
  code,
  row,
}: OnActionClickParams<RentalManagementItem>) {
  switch (code) {
    case 'delete': {
      onDelete(row);
      break;
    }
    case 'edit': {
      onEdit(row);
      break;
    }
    case 'view': {
      onView(row);
      break;
    }
  }
}

// 模拟的数据
const rentalItems = [
  {
    address: '北京市朝阳区建国路88号',
    contact: '张先生 13800138000',
    createTime: '2021-04-01',
    id: 1,
    remark: '定期维护中',
    specifications: '500KVA',
    status: '正常',
    title: '1号主变压器',
    updateTime: '2021-04-01',
  },
  {
    address: '上海市徐汇区淮海路100号',
    contact: '李女士 13900139000',
    createTime: '2021-04-02',
    id: 2,
    remark: '计划性检修',
    specifications: '800KVA',
    status: '维护',
    title: '2号变压器',
    updateTime: '2021-04-02',
  },
  {
    address: '广州市天河区体育西路123号',
    contact: '王先生 13700137000',
    createTime: '2021-04-03',
    id: 3,
    remark: '运行良好',
    specifications: '300KVA',
    status: '正常',
    title: '3号变压器',
    updateTime: '2021-04-03',
  },
  {
    address: '深圳市南山区科技园456号',
    contact: '刘女士 13600136000',
    createTime: '2021-04-04',
    id: 4,
    remark: '需要检修',
    specifications: '1000KVA',
    status: '异常',
    title: '4号变压器',
    updateTime: '2021-04-04',
  },
  {
    address: '成都市武侯区人民南路789号',
    contact: '赵先生 13500135000',
    createTime: '2021-04-05',
    id: 5,
    remark: '新安装设备',
    specifications: '630KVA',
    status: '正常',
    title: '5号变压器',
    updateTime: '2021-04-05',
  },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true, // 添加这一行，使查询表单默认收起
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async () => {
          // 模拟API请求返回数据
          return {
            page: {
              pageSize: 20,
              total: rentalItems.length,
            },
            items: rentalItems,
          };
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
  } as VxeTableGridOptions,
});

/**
 * 刷新表格
 */
function refreshGrid() {
  gridApi.query();
}
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="refreshGrid" />
    <Grid :table-title="$t('system.maintenance.transformer.list')">
      <template #toolbar-actions>
        <!-- 区域选择下拉菜单 -->
        <AreaSelector
          :default-area="currentArea"
          :refresh-callback="refreshGrid"
          @change="(area) => (currentArea = area)"
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
      </template>
    </Grid>
  </Page>
</template>
