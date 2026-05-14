<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { PublicOpportunityItem, RadarCollectTask } from '#/api/investment';

import { computed, h, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { ReloadOutlined } from '@ant-design/icons-vue';
import {
  Alert,
  Upload as AUpload,
  Button,
  Card,
  Form,
  Input,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getEffectivePublicOpportunityList,
  getPublicOpportunityDetail,
  getRadarCollectTask,
  getRadarLeadList,
  importRadarLeads,
  importRadarLeadsFile,
  runRadarCollect,
} from '#/api/investment';

import { useColumns, useGridFormSchema } from './data';
import OpportunityDetailDrawer from './opportunity-detail-drawer.vue';

defineOptions({ name: 'InvestmentRadarList' });

const router = useRouter();
const activeTab = ref<'leads' | 'publicOpportunities'>('leads');
const importModalOpen = ref(false);
const importModalMode = ref<'json' | 'result'>('json');
const importJsonText = ref('');
const collectTask = ref<null | RadarCollectTask>(null);
const collectPolling = ref(false);
const publicOpportunityLoading = ref(false);
const publicOpportunityDetailLoading = ref(false);
const publicOpportunityDetailOpen = ref(false);
const publicOpportunityLoadError = ref('');
const publicOpportunityItems = ref<PublicOpportunityItem[]>([]);
const currentPublicOpportunity = ref<null | PublicOpportunityItem>(null);
let collectTaskTimer: number | undefined;
const importFailItems = ref<
  Array<{
    enterpriseName?: null | string;
    error: string;
    index?: number;
    rawData?: Record<string, unknown>;
    rowNumber?: number;
  }>
>([]);
const importPlaceholder =
  '请输入 JSON 数组，例如：[{"enterpriseName":"某企业","phoneNumber":"13800138000","parkId":1}]';
const csvTemplateHeaders = [
  'enterpriseName',
  'phoneNumber',
  'contactName',
  'parkId',
  'intentArea',
  'address',
  'sourceKey',
];
const importFailColumns = [
  {
    customRender: ({ record }: { record: any }) =>
      record.rowNumber ?? (Number(record.index) || 0) + 1,
    dataIndex: 'rowNumber',
    key: 'rowNumber',
    title: '行号',
    width: 90,
  },
  {
    customRender: ({ record }: { record: any }) =>
      record.enterpriseName || record.rawData?.enterpriseName || '-',
    dataIndex: 'enterpriseName',
    key: 'enterpriseName',
    title: '企业名称',
    width: 180,
  },
  {
    dataIndex: 'error',
    key: 'error',
    title: '失败原因',
  },
  {
    customRender: ({ record }: { record: any }) =>
      JSON.stringify(record.rawData || {}),
    dataIndex: 'rawData',
    key: 'rawData',
    title: '原始行数据',
  },
];
const collectStatusText: Record<RadarCollectTask['status'], string> = {
  FAILED: '失败',
  PENDING: '处理中',
  RUNNING: '处理中',
  SUCCESS: '成功',
};
const opportunityTypeOptions = [
  { label: '全部', value: '' },
  { label: '需求机会', value: 'DEMAND' },
  { label: '房源机会', value: 'SUPPLY' },
];
const opportunityTypeMeta: Record<
  PublicOpportunityItem['opportunityType'],
  { color: string; label: string }
> = {
  DEMAND: { color: 'blue', label: '需求' },
  SUPPLY: { color: 'green', label: '房源' },
};
const publicOpportunitySearch = ref({
  city: '',
  keyword: '',
  opportunityType: '',
  sourceSite: '',
});
const publicOpportunityPagination = ref({
  current: 1,
  pageSize: 20,
  total: 0,
});
const publicOpportunityTableLocale = {
  emptyText: '暂无公开机会数据',
};

const collectStatusClass = computed(() => {
  if (collectTask.value?.status === 'SUCCESS') {
    return 'text-green-600';
  }
  if (collectTask.value?.status === 'FAILED') {
    return 'text-red-600';
  }
  return 'text-primary';
});

function isCollectTaskFinished(status?: RadarCollectTask['status']) {
  return status === 'FAILED' || status === 'SUCCESS';
}

function formatDuration(durationMs?: null | number) {
  if (durationMs === null || durationMs === undefined) {
    return '-';
  }
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  return `${(durationMs / 1000).toFixed(1)}s`;
}

const shanghaiDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
});

function formatPublishedDate(value?: null | string) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const parts: Record<string, string> = {};
  for (const part of shanghaiDateFormatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      parts[part.type] = part.value;
    }
  }

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatArea(record: PublicOpportunityItem) {
  if (
    record.areaText &&
    record.areaSqm !== null &&
    record.areaSqm !== undefined
  ) {
    return `${record.areaText} / ${Number(record.areaSqm).toLocaleString()} ㎡`;
  }
  if (record.areaText) {
    return record.areaText;
  }
  if (record.areaSqm !== null && record.areaSqm !== undefined) {
    return `${Number(record.areaSqm).toLocaleString()} ㎡`;
  }
  return '-';
}

function formatRegion(record: PublicOpportunityItem) {
  return [record.city, record.district].filter(Boolean).join(' / ') || '-';
}

function formatContact(record: PublicOpportunityItem) {
  return (
    [record.contactName, record.phoneNumber].filter(Boolean).join(' ') || '-'
  );
}

function getOpportunityTypeMeta(
  type: PublicOpportunityItem['opportunityType'],
) {
  return opportunityTypeMeta[type] || { color: 'default', label: type };
}

function openOpportunitySourceUrl(record: PublicOpportunityItem) {
  window.open(record.sourceUrl, '_blank', 'noopener,noreferrer');
}

function clearCollectTaskTimer() {
  if (collectTaskTimer) {
    window.clearTimeout(collectTaskTimer);
    collectTaskTimer = undefined;
  }
}

async function refreshCollectTask(taskId: string) {
  const task = await getRadarCollectTask(taskId);
  collectTask.value = task;
  return task;
}

function scheduleCollectTaskPolling(taskId: string) {
  clearCollectTaskTimer();
  collectTaskTimer = window.setTimeout(async () => {
    try {
      const task = await refreshCollectTask(taskId);
      if (isCollectTaskFinished(task.status)) {
        collectPolling.value = false;
        message.success({
          content:
            task.status === 'SUCCESS'
              ? `同步完成，新增 ${task.created} 条，更新 ${task.updated} 条，跳过 ${task.skipped} 条`
              : `同步失败：${task.errorReason || '未知错误'}`,
          key: 'radar_sync',
        });
        if (task.status === 'SUCCESS') {
          gridApi.query();
        }
        return;
      }
      scheduleCollectTaskPolling(taskId);
    } catch (error) {
      collectPolling.value = false;
      console.error('查询智能招商采集任务失败:', error);
      message.error({
        content: '查询智能招商采集任务失败',
        key: 'radar_sync',
      });
    }
  }, 1500);
}

function escapeCsvCell(value: unknown) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csvText = rows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\n');
  const blob = new Blob([`\uFEFF${csvText}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadImportTemplate() {
  downloadCsv('智能招商雷达导入模板.csv', [
    csvTemplateHeaders,
    [
      '示例企业',
      '13800138000',
      '张经理',
      '14',
      '800',
      '示例地址',
      'manual-demo-001',
    ],
  ]);
}

function downloadFailItems() {
  if (importFailItems.value.length === 0) {
    message.warning('暂无失败项可导出');
    return;
  }

  downloadCsv('智能招商雷达导入失败项.csv', [
    ['rowNumber', 'enterpriseName', 'error', 'rawData'],
    ...importFailItems.value.map((item) => [
      item.rowNumber ?? (Number(item.index) || 0) + 1,
      item.enterpriseName || item.rawData?.enterpriseName || '',
      item.error,
      JSON.stringify(item.rawData || {}),
    ]),
  ]);
}

function goToDashboard() {
  router.push('/investment/radar-dashboard');
}

function goToTasks() {
  router.push('/investment/radar-tasks');
}

function handleImportModalOk() {
  if (importModalMode.value === 'result') {
    importModalOpen.value = false;
    return;
  }

  void submitImportJson();
}

async function submitImportJson() {
  const raw = importJsonText.value.trim();
  if (!raw) {
    message.warning('请输入 JSON 数组');
    return;
  }

  let items: any[] = [];

  try {
    const parsed = JSON.parse(raw);
    items = Array.isArray(parsed) ? parsed : parsed.items;
  } catch {
    message.error('JSON 格式不正确');
    return;
  }

  if (!Array.isArray(items)) {
    message.error('导入内容必须是数组或 { items: [] }');
    return;
  }

  message.loading({
    content: '正在导入潜客...',
    duration: 0,
    key: 'radar_import',
  });

  try {
    const result = await importRadarLeads({ items });
    importFailItems.value = result.failItems || [];
    message.success({
      content: `导入完成，成功 ${result.success} 条，失败 ${importFailItems.value.length} 条`,
      key: 'radar_import',
    });
    if (importFailItems.value.length > 0) {
      importModalMode.value = 'result';
      importModalOpen.value = true;
    } else {
      importModalOpen.value = false;
      importJsonText.value = '';
    }
    gridApi.query();
  } catch (error) {
    console.error('导入智能招商潜客失败:', error);
    message.error({
      content: '导入智能招商潜客失败',
      key: 'radar_import',
    });
  }
}

async function handleImportFileBeforeUpload(file: File) {
  message.loading({
    content: `正在导入文件 ${file.name}...`,
    duration: 0,
    key: 'radar_import_file',
  });

  try {
    const formData = new FormData();
    formData.append('file', file);
    const result = await importRadarLeadsFile(formData);
    importFailItems.value = result.failItems || [];
    message.success({
      content: `文件导入完成，成功 ${result.success} 条，失败 ${importFailItems.value.length} 条`,
      key: 'radar_import_file',
    });
    if (importFailItems.value.length > 0) {
      importModalMode.value = 'result';
      importModalOpen.value = true;
    }
    gridApi.query();
  } catch (error) {
    console.error('上传导入潜客文件失败:', error);
    message.error({
      content: '上传导入潜客文件失败',
      key: 'radar_import_file',
    });
  }

  return false;
}

async function syncRadarLeads() {
  if (collectPolling.value) {
    return;
  }

  clearCollectTaskTimer();
  collectTask.value = null;
  collectPolling.value = true;
  message.loading({
    content: '正在创建采集任务...',
    duration: 0,
    key: 'radar_sync',
  });

  try {
    const result = await runRadarCollect();
    collectTask.value = result.task;
    message.success({
      content: `采集任务已创建：${result.taskId}`,
      key: 'radar_sync',
    });
    scheduleCollectTaskPolling(result.taskId);
  } catch (error) {
    collectPolling.value = false;
    console.error('同步智能招商潜客失败:', error);
    message.error({
      content: '同步智能招商潜客失败',
      key: 'radar_sync',
    });
  }
}

function buildPublicOpportunityQuery() {
  return {
    city: publicOpportunitySearch.value.city || undefined,
    currentPage: publicOpportunityPagination.value.current,
    keyword: publicOpportunitySearch.value.keyword || undefined,
    opportunityType: publicOpportunitySearch.value.opportunityType || undefined,
    pageSize: publicOpportunityPagination.value.pageSize,
    sourceSite: publicOpportunitySearch.value.sourceSite || undefined,
  };
}

async function loadPublicOpportunities() {
  publicOpportunityLoading.value = true;
  publicOpportunityLoadError.value = '';
  try {
    const result = await getEffectivePublicOpportunityList(
      buildPublicOpportunityQuery(),
    );
    const effectiveItems = result.items.filter(
      (item) => item.opportunityStatus === 'EFFECTIVE',
    );
    publicOpportunityItems.value = effectiveItems;
    publicOpportunityPagination.value.total = result.total;
  } catch (error) {
    console.error('获取公开有效机会失败:', error);
    publicOpportunityItems.value = [];
    publicOpportunityPagination.value.total = 0;
    publicOpportunityLoadError.value =
      '公开机会数据加载失败，请检查相关接口是否已接入。';
  } finally {
    publicOpportunityLoading.value = false;
  }
}

function searchPublicOpportunities() {
  publicOpportunityPagination.value.current = 1;
  void loadPublicOpportunities();
}

function resetPublicOpportunitySearch() {
  publicOpportunitySearch.value = {
    city: '',
    keyword: '',
    opportunityType: '',
    sourceSite: '',
  };
  searchPublicOpportunities();
}

function handlePublicOpportunityTableChange(page: any) {
  publicOpportunityPagination.value.current = page.current || 1;
  publicOpportunityPagination.value.pageSize = page.pageSize || 20;
  void loadPublicOpportunities();
}

async function openPublicOpportunityDetail(record: PublicOpportunityItem) {
  publicOpportunityDetailOpen.value = true;
  publicOpportunityDetailLoading.value = true;
  currentPublicOpportunity.value = record;
  try {
    currentPublicOpportunity.value = await getPublicOpportunityDetail(
      record.opportunityId,
    );
  } catch (error) {
    console.error('获取公开机会详情失败:', error);
    message.error('获取公开机会详情失败');
  } finally {
    publicOpportunityDetailLoading.value = false;
  }
}

function handlePublicOpportunityDetailOpen(value: boolean) {
  publicOpportunityDetailOpen.value = value;
}

function handleTabChange(key: number | string) {
  activeTab.value = key as typeof activeTab.value;
  if (
    activeTab.value === 'publicOpportunities' &&
    publicOpportunityItems.value.length === 0
  ) {
    void loadPublicOpportunities();
  }
}

onBeforeUnmount(() => {
  clearCollectTaskTimer();
});

function onActionClick({ code, row }: OnActionClickParams<any>) {
  if (code === '查看') {
    router.push(`/investment/radar/${row.leadId}`);
  }
}

const publicOpportunityColumns: TableColumnsType<PublicOpportunityItem> = [
  {
    customRender: ({ record }: { record: PublicOpportunityItem }) => {
      const meta = getOpportunityTypeMeta(record.opportunityType);
      return h(Tag, { color: meta.color }, () => meta.label);
    },
    dataIndex: 'opportunityType',
    key: 'opportunityType',
    title: '类型',
    width: 90,
  },
  {
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      h('div', { class: 'public-opportunity-title-cell' }, [
        h('div', { class: 'public-opportunity-title' }, record.title || '-'),
        h('div', { class: 'public-opportunity-source' }, record.sourceUrl),
      ]),
    dataIndex: 'title',
    key: 'title',
    title: '标题',
    width: 320,
  },
  {
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      formatRegion(record),
    dataIndex: 'city',
    key: 'city',
    title: '城市 / 区域',
    width: 140,
  },
  {
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      formatArea(record),
    dataIndex: 'areaText',
    key: 'areaText',
    title: '面积',
    width: 120,
  },
  {
    customRender: ({ text }: { text?: null | string }) => text || '-',
    dataIndex: 'priceText',
    key: 'priceText',
    title: '价格 / 预算',
    width: 130,
  },
  {
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      formatContact(record),
    dataIndex: 'phoneNumber',
    key: 'phoneNumber',
    title: '联系人 / 电话',
    width: 160,
  },
  {
    customRender: ({ text }: { text?: null | string }) =>
      formatPublishedDate(text),
    dataIndex: 'publishedAt',
    key: 'publishedAt',
    title: '发布时间',
    width: 120,
  },
  {
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      record.publishedAgeLabel || '-',
    dataIndex: 'publishedAgeLabel',
    key: 'publishedAgeLabel',
    title: '时效',
    width: 130,
  },
  {
    customRender: ({ text }: { text?: null | number }) =>
      text === null || text === undefined ? '-' : text,
    dataIndex: 'score',
    key: 'score',
    title: '分数',
    width: 90,
  },
  {
    customRender: ({ text }: { text?: null | string }) => text || '-',
    dataIndex: 'sourceSite',
    key: 'sourceSite',
    title: '来源',
    width: 110,
  },
  {
    customRender: ({ record }: { record: PublicOpportunityItem }) =>
      h(Space, {}, () => [
        h(
          Button,
          {
            onClick: () => void openPublicOpportunityDetail(record),
            size: 'small',
            type: 'link',
          },
          () => '查看详情',
        ),
        h(
          Button,
          {
            onClick: () => openOpportunitySourceUrl(record),
            size: 'small',
            type: 'link',
          },
          () => '原网页',
        ),
      ]),
    fixed: 'right',
    key: 'operation',
    title: '操作',
    width: 160,
  },
];

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
    proxyConfig: {
      ajax: {
        query: async (page) => {
          const formData = (await gridApi.formApi?.getValues?.()) || {};
          return await getRadarLeadList({
            ...formData,
            currentPage: page.page?.currentPage || 1,
            pageSize: page.page?.pageSize || 20,
          });
        },
      },
    },
    rowConfig: {
      keyField: 'leadId',
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
</script>

<template>
  <Page auto-content-height content-class="radar-page-content">
    <Tabs class="radar-tabs" :active-key="activeTab" @change="handleTabChange">
      <Tabs.TabPane key="leads" tab="原有雷达线索">
        <div class="radar-leads-pane">
          <Grid class="radar-leads-grid" table-title="智能招商潜客列表">
            <template #toolbar-tools>
              <Space>
                <Button @click="goToDashboard">查看看板</Button>
                <Button @click="goToTasks">触达任务</Button>
                <Button @click="downloadImportTemplate">下载模板</Button>
                <Button
                  @click="
                    importModalMode = 'json';
                    importModalOpen = true;
                    importFailItems = [];
                  "
                >
                  手工导入
                </Button>
                <AUpload
                  :before-upload="handleImportFileBeforeUpload"
                  :show-upload-list="false"
                  accept=".csv,.xlsx"
                >
                  <Button>上传 CSV/XLSX</Button>
                </AUpload>
                <Button
                  type="primary"
                  :disabled="collectPolling"
                  :loading="collectPolling"
                  @click="syncRadarLeads"
                >
                  <ReloadOutlined />
                  同步潜客
                </Button>
              </Space>
            </template>
          </Grid>

          <div
            v-if="collectTask"
            class="bg-card border-border mb-4 rounded-md border px-4 py-3 text-sm"
          >
            <Space wrap>
              <span>
                任务状态：
                <span :class="collectStatusClass">
                  {{ collectStatusText[collectTask.status] }}
                </span>
              </span>
              <span>新增 {{ collectTask.created }} 条</span>
              <span>更新 {{ collectTask.updated }} 条</span>
              <span>跳过 {{ collectTask.skipped }} 条</span>
              <span>耗时 {{ formatDuration(collectTask.durationMs) }}</span>
              <span v-if="collectTask.errorReason" class="text-red-600">
                错误原因：{{ collectTask.errorReason }}
              </span>
            </Space>
          </div>
        </div>
      </Tabs.TabPane>

      <Tabs.TabPane key="publicOpportunities" tab="公开有效机会">
        <div class="radar-public-pane">
          <Alert
            v-if="publicOpportunityLoadError"
            :message="publicOpportunityLoadError"
            show-icon
            type="warning"
          />

          <Card class="public-opportunity-panel" title="查询条件">
            <Form layout="inline">
              <Form.Item label="机会类型">
                <Select
                  v-model:value="publicOpportunitySearch.opportunityType"
                  class="w-36"
                  :options="opportunityTypeOptions"
                />
              </Form.Item>
              <Form.Item label="城市">
                <Input
                  v-model:value="publicOpportunitySearch.city"
                  allow-clear
                  class="w-32"
                  placeholder="惠州"
                  @press-enter="searchPublicOpportunities"
                />
              </Form.Item>
              <Form.Item label="来源">
                <Input
                  v-model:value="publicOpportunitySearch.sourceSite"
                  allow-clear
                  class="w-32"
                  placeholder="99cfw"
                  @press-enter="searchPublicOpportunities"
                />
              </Form.Item>
              <Form.Item label="关键词">
                <Input
                  v-model:value="publicOpportunitySearch.keyword"
                  allow-clear
                  class="w-64"
                  placeholder="标题 / 联系人 / 来源 URL"
                  @press-enter="searchPublicOpportunities"
                />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" @click="searchPublicOpportunities">
                    查询
                  </Button>
                  <Button @click="resetPublicOpportunitySearch">重置</Button>
                  <Button
                    :loading="publicOpportunityLoading"
                    @click="loadPublicOpportunities"
                  >
                    刷新数据
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>

          <Card title="最新公开机会列表">
            <Table
              :columns="publicOpportunityColumns"
              :data-source="publicOpportunityItems"
              :loading="publicOpportunityLoading"
              :locale="publicOpportunityTableLocale"
              :pagination="publicOpportunityPagination"
              :scroll="{ x: 1400 }"
              row-key="opportunityId"
              size="small"
              @change="handlePublicOpportunityTableChange"
            />
          </Card>
        </div>
      </Tabs.TabPane>
    </Tabs>

    <Modal
      v-model:open="importModalOpen"
      :ok-text="importModalMode === 'result' ? '关闭' : '确定'"
      :title="importModalMode === 'result' ? '导入失败项' : '手工导入潜客'"
      width="720px"
      @ok="handleImportModalOk"
    >
      <Input.TextArea
        v-if="importModalMode === 'json'"
        v-model:value="importJsonText"
        :auto-size="{ minRows: 12, maxRows: 20 }"
        :placeholder="importPlaceholder"
      />
      <div v-if="importModalMode === 'json'" class="text-text-secondary mt-2">
        文件上传支持 CSV 和 XLSX，XLSX 默认读取第一张工作表。
      </div>
      <Table
        v-if="importFailItems.length > 0"
        class="mt-4"
        :columns="importFailColumns"
        :data-source="importFailItems"
        :pagination="false"
        row-key="rowNumber"
        size="small"
      />
      <template #footer>
        <Space>
          <Button v-if="importFailItems.length > 0" @click="downloadFailItems">
            导出失败项
          </Button>
          <Button @click="importModalOpen = false">关闭</Button>
          <Button
            v-if="importModalMode !== 'result'"
            type="primary"
            @click="handleImportModalOk"
          >
            确定
          </Button>
        </Space>
      </template>
    </Modal>

    <OpportunityDetailDrawer
      :item="currentPublicOpportunity"
      :loading="publicOpportunityDetailLoading"
      :open="publicOpportunityDetailOpen"
      title="公开有效机会详情"
      @open-source="openOpportunitySourceUrl"
      @update:open="handlePublicOpportunityDetailOpen"
    />
  </Page>
</template>

<style lang="less" scoped>
:deep(.radar-page-content) {
  min-height: 0;
  overflow-y: hidden !important;
}

.radar-tabs {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

:deep(.radar-tabs .ant-tabs-content-holder) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

:deep(.radar-tabs .ant-tabs-content) {
  height: 100%;
  min-height: 0;
}

:deep(.radar-tabs .ant-tabs-tabpane) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.radar-leads-pane,
.radar-public-pane {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.radar-leads-grid {
  flex: 1;
  min-height: 0;
}

.radar-public-pane {
  overflow: auto;
}

.public-opportunity-panel {
  flex: none;
}

.public-opportunity-title {
  font-weight: 500;
}

.public-opportunity-source {
  max-width: 280px;
  overflow: hidden;
  color: var(--ant-color-text-description);
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
