<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type {
  OutreachTemplate,
  OutreachTemplatePayload,
  OutreachTemplateStatsRow,
  OutreachTemplateVersion,
} from '#/api/investment';

import { computed, h, ref, watch } from 'vue';

import { formatDateTime } from '@vben/utils';

import {
  AutoComplete,
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  approveOutreachTemplate,
  createOutreachTemplate,
  disableOutreachTemplate,
  enableOutreachTemplate,
  getOutreachTemplateList,
  getOutreachTemplateStats,
  getOutreachTemplateVersions,
  previewOutreachTemplate,
  rejectOutreachTemplate,
  submitOutreachTemplateApproval,
  updateOutreachTemplate,
} from '#/api/investment';

import {
  searchableDropdownProps,
  useSearchHistory,
} from '../../search-history';

const props = defineProps<{
  mobile?: boolean;
  open: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

const drawerOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
});

const loading = ref(false);
const saving = ref(false);
const actionLoadingId = ref<null | number>(null);
const modalOpen = ref(false);
const previewModalOpen = ref(false);
const versionDrawerOpen = ref(false);
const editingTemplate = ref<null | OutreachTemplate>(null);
const previewContent = ref('');
const templates = ref<OutreachTemplate[]>([]);
const templateStats = ref<OutreachTemplateStatsRow[]>([]);
const templateVersions = ref<OutreachTemplateVersion[]>([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);
const versionLoading = ref(false);

const searchForm = ref({
  approvalStatus: 'ALL' as string | undefined,
  channel: undefined as string | undefined,
  enabled: 'ALL' as string | undefined,
  keyword: '',
  taskType: undefined as string | undefined,
});
const keywordSearchHistory = useSearchHistory(
  'radar.outreach-template.keyword',
);
const keywordOptions = keywordSearchHistory.options();

const templateForm = ref<OutreachTemplatePayload>({
  channel: 'SMS',
  content: '',
  placeholderJson: ['companyName', 'parkName', 'intentArea'],
  priorityLevel: 'A',
  taskType: 'OUTREACH',
  templateCode: '',
  templateName: '',
});

const channelOptions = [
  { label: '短信', value: 'SMS' },
  { label: '电话', value: 'CALL' },
  { label: '微信', value: 'WECHAT' },
  { label: '邮件', value: 'EMAIL' },
  { label: '拜访', value: 'VISIT' },
];

const enabledOptions = [
  { label: '全部', value: 'ALL' },
  { label: '启用', value: '1' },
  { label: '停用', value: '0' },
];

const approvalStatusOptions = [
  { label: '全部', value: 'ALL' },
  { label: '待审批', value: 'PENDING_APPROVAL' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' },
];

const priorityOptions = [
  { label: 'A 级', value: 'A' },
  { label: 'B 级', value: 'B' },
  { label: 'C 级', value: 'C' },
];

const taskTypeOptions = [
  { label: '外呼触达', value: 'OUTREACH' },
  { label: '跟进', value: 'FOLLOW_UP' },
  { label: '预约拜访', value: 'VISIT' },
];

const tableLocale = {
  emptyText: '暂无触达模板',
};

function formatTime(value?: null | string) {
  return value ? formatDateTime(value) : '-';
}

function getChannelLabel(channel?: null | string) {
  return channelOptions.find((item) => item.value === channel)?.label || '-';
}

function getTaskTypeLabel(taskType?: null | string) {
  return taskTypeOptions.find((item) => item.value === taskType)?.label || '-';
}

function getApprovalLabel(status?: null | string) {
  return (
    approvalStatusOptions.find((item) => item.value === status)?.label ||
    status ||
    '-'
  );
}

function getApprovalColor(status?: null | string) {
  if (status === 'APPROVED') {
    return 'green';
  }
  if (status === 'PENDING_APPROVAL') {
    return 'gold';
  }
  if (status === 'REJECTED') {
    return 'red';
  }
  return 'default';
}

function normalizePlaceholderText(value?: string[]) {
  return Array.isArray(value) && value.length > 0 ? value.join(', ') : '-';
}

function getTemplateStats(record: OutreachTemplate) {
  return templateStats.value.find(
    (item) => item.templateCode === record.templateCode,
  );
}

function buildParams() {
  return {
    approvalStatus: searchForm.value.approvalStatus,
    channel: searchForm.value.channel,
    currentPage: currentPage.value,
    enabled: searchForm.value.enabled,
    keyword: searchForm.value.keyword || undefined,
    pageSize: pageSize.value,
    taskType: searchForm.value.taskType,
  };
}

async function loadTemplates() {
  loading.value = true;
  try {
    const [result, statsResult] = await Promise.all([
      getOutreachTemplateList(buildParams()),
      getOutreachTemplateStats(),
    ]);
    templates.value = Array.isArray(result.items) ? result.items : [];
    templateStats.value = Array.isArray(statsResult.items)
      ? statsResult.items
      : [];
    total.value =
      typeof result.total === 'number'
        ? result.total
        : result.page?.total || Math.max(templates.value.length, 0);
  } catch (error) {
    console.error('加载触达模板失败:', error);
    templates.value = [];
    total.value = 0;
    message.error('触达模板加载失败');
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  keywordSearchHistory.add(searchForm.value.keyword);
  currentPage.value = 1;
  void loadTemplates();
}

function handleReset() {
  searchForm.value = {
    approvalStatus: 'ALL',
    channel: undefined,
    enabled: 'ALL',
    keyword: '',
    taskType: undefined,
  };
  handleSearch();
}

function handleTableChange(page: { current?: number; pageSize?: number }) {
  currentPage.value = page.current || 1;
  pageSize.value = page.pageSize || 10;
  void loadTemplates();
}

function openCreateModal() {
  editingTemplate.value = null;
  templateForm.value = {
    channel: 'SMS',
    content: '',
    placeholderJson: ['companyName', 'parkName', 'intentArea'],
    priorityLevel: 'A',
    taskType: 'OUTREACH',
    templateCode: '',
    templateName: '',
  };
  modalOpen.value = true;
}

function openEditModal(record: OutreachTemplate) {
  editingTemplate.value = record;
  templateForm.value = {
    channel: record.channel,
    content: record.content,
    placeholderJson: record.placeholderJson || [],
    priorityLevel: record.priorityLevel,
    taskType: record.taskType,
    templateCode: record.templateCode,
    templateName: record.templateName,
  };
  modalOpen.value = true;
}

async function submitTemplate() {
  const payload = {
    ...templateForm.value,
    placeholderJson: Array.isArray(templateForm.value.placeholderJson)
      ? templateForm.value.placeholderJson
      : [],
  };
  if (!payload.templateCode.trim() || !payload.templateName.trim()) {
    message.warning('请填写模板编码和名称');
    return;
  }
  if (!payload.content.trim()) {
    message.warning('请填写模板内容');
    return;
  }

  saving.value = true;
  try {
    if (editingTemplate.value) {
      await updateOutreachTemplate(editingTemplate.value.templateId, payload);
      message.success('触达模板已更新');
    } else {
      await createOutreachTemplate(payload);
      message.success('触达模板已创建');
    }
    modalOpen.value = false;
    await loadTemplates();
  } catch (error) {
    console.error('保存触达模板失败:', error);
    message.error('保存触达模板失败');
  } finally {
    saving.value = false;
  }
}

async function toggleTemplate(record: OutreachTemplate) {
  const templateId = Number(record.templateId || 0);
  if (templateId <= 0 || actionLoadingId.value) {
    return;
  }
  actionLoadingId.value = templateId;
  try {
    if (record.enabled) {
      await disableOutreachTemplate(templateId);
      message.success('触达模板已停用');
    } else {
      await enableOutreachTemplate(templateId);
      message.success('触达模板已启用');
    }
    await loadTemplates();
  } catch (error) {
    console.error('切换触达模板状态失败:', error);
    message.error('切换模板状态失败');
  } finally {
    actionLoadingId.value = null;
  }
}

async function handleTemplateApprovalAction(
  record: OutreachTemplate,
  action: 'approve' | 'reject' | 'submit',
) {
  const templateId = Number(record.templateId || 0);
  if (templateId <= 0 || actionLoadingId.value) {
    return;
  }

  actionLoadingId.value = templateId;
  try {
    if (action === 'approve') {
      await approveOutreachTemplate(templateId);
      message.success('模板审批已通过');
    } else if (action === 'reject') {
      await rejectOutreachTemplate(templateId);
      message.success('模板已驳回');
    } else {
      await submitOutreachTemplateApproval(templateId);
      message.success('模板已提交审批');
    }
    await loadTemplates();
  } catch (error) {
    console.error('处理模板审批失败:', error);
    message.error('处理模板审批失败');
  } finally {
    actionLoadingId.value = null;
  }
}

async function openPreviewModal(record: OutreachTemplate) {
  try {
    const result = await previewOutreachTemplate({
      channel: record.channel,
      content: record.content,
      placeholderJson: record.placeholderJson || [],
      priorityLevel: record.priorityLevel,
      taskType: record.taskType,
      templateCode: record.templateCode,
      templateName: record.templateName,
    });
    previewContent.value = result.content;
    previewModalOpen.value = true;
  } catch (error) {
    console.error('预览触达模板失败:', error);
    message.error('预览触达模板失败');
  }
}

async function openVersionDrawer(record: OutreachTemplate) {
  const templateId = Number(record.templateId || 0);
  if (templateId <= 0) {
    return;
  }

  versionDrawerOpen.value = true;
  versionLoading.value = true;
  templateVersions.value = [];
  try {
    const result = await getOutreachTemplateVersions(templateId);
    templateVersions.value = Array.isArray(result.items) ? result.items : [];
  } catch (error) {
    console.error('加载模板版本失败:', error);
    message.error('加载模板版本失败');
  } finally {
    versionLoading.value = false;
  }
}

function renderTemplateInfo(record: OutreachTemplate) {
  return h('div', { class: 'leading-6' }, [
    h('div', { class: 'truncate font-medium' }, record.templateName || '-'),
    h(
      'div',
      { class: 'text-text-secondary truncate text-xs' },
      record.templateCode || '-',
    ),
  ]);
}

function renderTemplateTags(record: OutreachTemplate) {
  return h(Space, { size: 4, wrap: true }, () => [
    h(Tag, { color: record.enabled ? 'green' : 'default' }, () =>
      record.enabled ? '启用' : '停用',
    ),
    h(Tag, { color: getApprovalColor(record.approvalStatus) }, () =>
      getApprovalLabel(record.approvalStatus),
    ),
    h(Tag, { color: 'default' }, () => `V${record.versionNo || 1}`),
    h(Tag, { color: 'blue' }, () => getTaskTypeLabel(record.taskType)),
    h(Tag, { color: 'purple' }, () => getChannelLabel(record.channel)),
    h(Tag, { color: 'orange' }, () => `${record.priorityLevel || '-'} 级`),
  ]);
}

function renderStats(record: OutreachTemplate) {
  const stats = getTemplateStats(record);
  if (!stats) {
    return '-';
  }

  return h('div', { class: 'leading-6 text-left' }, [
    h('div', `总任务 ${stats.totalTasks} / 已发 ${stats.sentTasks}`),
    h(
      'div',
      { class: 'text-text-secondary text-xs' },
      `正向 ${stats.positiveReplies} / 负向 ${stats.negativeReplies} / 失败 ${stats.failedTasks}`,
    ),
  ]);
}

function renderActions(record: OutreachTemplate) {
  const templateId = Number(record.templateId || 0);
  return h(Space, { size: 4, wrap: true }, () => [
    h(
      Button,
      {
        onClick: () => openPreviewModal(record),
        size: 'small',
      },
      () => '预览',
    ),
    h(
      Button,
      {
        onClick: () => openVersionDrawer(record),
        size: 'small',
      },
      () => '版本',
    ),
    h(
      Button,
      {
        onClick: () => openEditModal(record),
        size: 'small',
      },
      () => '编辑',
    ),
    h(
      Button,
      {
        disabled: record.approvalStatus === 'PENDING_APPROVAL',
        loading: actionLoadingId.value === templateId,
        onClick: () => handleTemplateApprovalAction(record, 'submit'),
        size: 'small',
      },
      () => '提交',
    ),
    h(
      Button,
      {
        disabled: record.approvalStatus !== 'PENDING_APPROVAL',
        loading: actionLoadingId.value === templateId,
        onClick: () => handleTemplateApprovalAction(record, 'approve'),
        size: 'small',
        type: 'primary',
      },
      () => '通过',
    ),
    h(
      Button,
      {
        danger: true,
        disabled: record.approvalStatus !== 'PENDING_APPROVAL',
        loading: actionLoadingId.value === templateId,
        onClick: () => handleTemplateApprovalAction(record, 'reject'),
        size: 'small',
      },
      () => '驳回',
    ),
    h(
      Button,
      {
        danger: record.enabled,
        loading: actionLoadingId.value === templateId,
        onClick: () => toggleTemplate(record),
        size: 'small',
        type: record.enabled ? 'default' : 'primary',
      },
      () => (record.enabled ? '停用' : '启用'),
    ),
  ]);
}

const columns: TableColumnsType<OutreachTemplate> = [
  {
    customRender: ({ record }) => renderTemplateInfo(record),
    dataIndex: 'templateName',
    key: 'templateName',
    title: '模板',
    width: 240,
  },
  {
    customRender: ({ record }) => renderTemplateTags(record),
    dataIndex: 'enabled',
    key: 'enabled',
    title: '类型',
    width: 320,
  },
  {
    customRender: ({ text }) => text || '-',
    dataIndex: 'content',
    key: 'content',
    title: '内容',
    width: 360,
  },
  {
    customRender: ({ record }) =>
      normalizePlaceholderText(record.placeholderJson),
    dataIndex: 'placeholderJson',
    key: 'placeholderJson',
    title: '变量',
    width: 180,
  },
  {
    customRender: ({ text }) => formatTime(text),
    dataIndex: 'updateTime',
    key: 'updateTime',
    title: '更新时间',
    width: 170,
  },
  {
    customRender: ({ record }) => renderStats(record),
    dataIndex: 'templateCode',
    key: 'stats',
    title: '效果统计',
    width: 240,
  },
  {
    customRender: ({ record }) => renderActions(record),
    fixed: 'right',
    key: 'operation',
    title: '操作',
    width: 300,
  },
];

const versionColumns: TableColumnsType<OutreachTemplateVersion> = [
  {
    dataIndex: 'versionNo',
    key: 'versionNo',
    title: '版本',
    width: 80,
  },
  {
    dataIndex: 'changeType',
    key: 'changeType',
    title: '变更',
    width: 120,
  },
  {
    customRender: ({ record }) =>
      h(Tag, { color: getApprovalColor(record.approvalStatus) }, () =>
        getApprovalLabel(record.approvalStatus),
      ),
    dataIndex: 'approvalStatus',
    key: 'approvalStatus',
    title: '审批',
    width: 120,
  },
  {
    customRender: ({ text }) => text || '-',
    dataIndex: 'content',
    key: 'content',
    title: '内容',
  },
  {
    customRender: ({ text }) => formatTime(text),
    dataIndex: 'createTime',
    key: 'createTime',
    title: '时间',
    width: 170,
  },
];

watch(
  () => props.open,
  (value) => {
    if (value) {
      void loadTemplates();
    }
  },
);
</script>

<template>
  <Drawer
    v-model:open="drawerOpen"
    destroy-on-close
    placement="right"
    title="触达模板管理"
    :width="mobile ? '100%' : 1040"
  >
    <div class="outreach-template-manager">
      <div class="outreach-template-toolbar">
        <Form class="outreach-template-filter" layout="inline">
          <Form.Item label="关键字">
            <AutoComplete
              v-model:value="searchForm.keyword"
              v-bind="searchableDropdownProps"
              allow-clear
              class="outreach-template-keyword"
              :options="keywordOptions"
              placeholder="模板名称 / 编码 / 内容"
              @press-enter="handleSearch"
              @select="handleSearch"
            />
          </Form.Item>
          <Form.Item label="状态">
            <Select
              v-model:value="searchForm.enabled"
              class="outreach-template-control"
              :options="enabledOptions"
            />
          </Form.Item>
          <Form.Item label="审批">
            <Select
              v-model:value="searchForm.approvalStatus"
              class="outreach-template-control"
              :options="approvalStatusOptions"
            />
          </Form.Item>
          <Form.Item label="渠道">
            <Select
              v-model:value="searchForm.channel"
              allow-clear
              class="outreach-template-control"
              :options="channelOptions"
            />
          </Form.Item>
          <Form.Item label="类型">
            <Select
              v-model:value="searchForm.taskType"
              allow-clear
              class="outreach-template-control"
              :options="taskTypeOptions"
            />
          </Form.Item>
        </Form>
        <Space wrap>
          <Button @click="handleReset">重置</Button>
          <Button type="primary" @click="handleSearch">查询</Button>
          <Button type="primary" @click="openCreateModal">新增模板</Button>
        </Space>
      </div>

      <Table
        bordered
        :columns="columns"
        :data-source="templates"
        :loading="loading"
        :locale="tableLocale"
        :pagination="{
          current: currentPage,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (value: number) => `共 ${value} 条`,
        }"
        :scroll="{ x: 1400 }"
        row-key="templateId"
        size="small"
        table-layout="fixed"
        @change="handleTableChange"
      >
        <template #emptyText>
          <Empty description="暂无触达模板" />
        </template>
      </Table>

      <Modal
        v-model:open="modalOpen"
        destroy-on-close
        :confirm-loading="saving"
        :title="editingTemplate ? '编辑触达模板' : '新增触达模板'"
        @ok="submitTemplate"
      >
        <Form layout="vertical">
          <Form.Item label="模板编码">
            <Input
              v-model:value="templateForm.templateCode"
              placeholder="例如 RADAR_A_SMS"
            />
          </Form.Item>
          <Form.Item label="模板名称">
            <Input
              v-model:value="templateForm.templateName"
              placeholder="例如 A级线索短信首触达"
            />
          </Form.Item>
          <Form.Item label="类型 / 渠道 / 优先级">
            <Space wrap>
              <Select
                v-model:value="templateForm.taskType"
                class="outreach-template-modal-control"
                :options="taskTypeOptions"
              />
              <Select
                v-model:value="templateForm.channel"
                class="outreach-template-modal-control"
                :options="channelOptions"
              />
              <Select
                v-model:value="templateForm.priorityLevel"
                class="outreach-template-modal-control"
                :options="priorityOptions"
              />
            </Space>
          </Form.Item>
          <Form.Item label="模板变量">
            <Select
              v-model:value="templateForm.placeholderJson"
              mode="tags"
              placeholder="companyName / parkName / intentArea"
            />
          </Form.Item>
          <Form.Item label="模板内容">
            <Input.TextArea
              v-model:value="templateForm.content"
              :auto-size="{ minRows: 4, maxRows: 7 }"
              placeholder="可使用 {companyName}、{parkName}、{intentArea}"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        v-model:open="previewModalOpen"
        destroy-on-close
        title="变量预览"
        :footer="null"
      >
        <Input.TextArea
          :value="previewContent"
          :auto-size="{ minRows: 5, maxRows: 10 }"
          readonly
        />
      </Modal>

      <Drawer
        v-model:open="versionDrawerOpen"
        destroy-on-close
        placement="right"
        title="模板版本"
        :width="mobile ? '100%' : 720"
      >
        <Table
          bordered
          :columns="versionColumns"
          :data-source="templateVersions"
          :loading="versionLoading"
          :pagination="false"
          row-key="versionId"
          size="small"
        />
      </Drawer>
    </div>
  </Drawer>
</template>

<style scoped>
.outreach-template-manager {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.outreach-template-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
}

.outreach-template-filter {
  gap: 8px;
}

.outreach-template-keyword {
  width: min(280px, 100%);
}

.outreach-template-control,
.outreach-template-modal-control {
  width: 140px;
}
</style>
