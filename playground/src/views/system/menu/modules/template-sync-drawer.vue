<script lang="ts" setup>
import type { MenuTemplateSyncApi } from '#/api/system/menu-template-sync';

import { computed, h, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Empty,
  Input,
  message,
  Modal,
  Radio,
  Space,
  Spin,
  Tag,
} from 'ant-design-vue';

import {
  dryRunMenuTemplateSync,
  executeMenuTemplateSync,
  getMenuTemplateSyncJobLogs,
  getMenuTemplateSyncJobs,
} from '#/api/system/menu-template-sync';

type TargetScope = MenuTemplateSyncApi.TargetScope;
type TargetResult = MenuTemplateSyncApi.TargetResult;
type SummaryRecord = {
  code?: MenuTemplateSyncApi.SummaryGroup;
  menu?: MenuTemplateSyncApi.SummaryGroup;
};

const targetScope = ref<TargetScope>('public');
const tenantId = ref('');
const result = ref<MenuTemplateSyncApi.RunResult | null>(null);
const jobs = ref<MenuTemplateSyncApi.Job[]>([]);
const jobLogs = ref<MenuTemplateSyncApi.JobLog[]>([]);
const selectedJob = ref<MenuTemplateSyncApi.Job | null>(null);
const loading = ref(false);
const loadingJobLogs = ref(false);
const loadingJobs = ref(false);

const [Drawer] = useVbenDrawer({
  footer: false,
  onOpenChange(isOpen) {
    if (isOpen) {
      loadJobs();
    }
  },
  showCancelButton: false,
  showConfirmButton: false,
});

const targetLabel = computed(() => {
  if (targetScope.value === 'allTenants') {
    return '全部租户';
  }
  if (targetScope.value === 'tenant') {
    return tenantId.value.trim() || '单租户';
  }
  return 'public';
});

function buildParams(): MenuTemplateSyncApi.RunParams | null {
  if (targetScope.value === 'allTenants') {
    return { allTenants: true };
  }
  if (targetScope.value === 'tenant') {
    const value = tenantId.value.trim();
    if (!value) {
      message.warning('请填写租户 ID');
      return null;
    }
    return { targetCustomerId: value };
  }
  return { targetCustomerId: 'public' };
}

function getStatusColor(status?: string) {
  if (status === 'completed' || status === 'ready') {
    return 'success';
  }
  if (status === 'blocked') {
    return 'warning';
  }
  if (status === 'failed') {
    return 'error';
  }
  return 'default';
}

function getGroupTotal(group?: MenuTemplateSyncApi.SummaryGroup) {
  if (!group) {
    return 0;
  }
  return Object.values(group).reduce(
    (sum, value) => sum + Number(value || 0),
    0,
  );
}

function formatSummaryGroup(group?: MenuTemplateSyncApi.SummaryGroup) {
  if (!group || getGroupTotal(group) === 0) {
    return '无变化';
  }
  return [
    ['create', '新增'],
    ['adopt', '接管'],
    ['update', '更新'],
    ['parentChanged', '父级'],
    ['disable', '下线'],
    ['conflict', '冲突'],
  ]
    .map(([key, label]) => {
      const value = group[key as keyof MenuTemplateSyncApi.SummaryGroup];
      return value ? `${label} ${value}` : '';
    })
    .filter(Boolean)
    .join(' / ');
}

function formatSummary(target: TargetResult, scope: 'code' | 'menu') {
  return formatSummaryGroup(target.summary?.[scope]);
}

function formatLogSummary(
  log: MenuTemplateSyncApi.JobLog,
  scope: 'code' | 'menu',
) {
  const summary = log.summary as SummaryRecord | undefined;
  return formatSummaryGroup(summary?.[scope]);
}

function getRunChangeTotal(runResult: MenuTemplateSyncApi.RunResult) {
  return runResult.targets.reduce(
    (sum, target) =>
      sum +
      getGroupTotal(target.summary?.menu) +
      getGroupTotal(target.summary?.code),
    0,
  );
}

function getRunSummaryValue(
  runResult: MenuTemplateSyncApi.RunResult,
  key: string,
) {
  const summary = runResult.preflight || runResult.summary || {};
  const value = (summary as Record<string, unknown>)[key];
  return Number(value || 0);
}

function buildExecuteConfirmContent(
  dryRunResult: MenuTemplateSyncApi.RunResult,
  label: string,
) {
  const summaryTargets = getRunSummaryValue(dryRunResult, 'targets');
  const targets =
    summaryTargets > 0 ? summaryTargets : dryRunResult.targets.length;
  const ready = getRunSummaryValue(dryRunResult, 'ready');
  const changeTotal = getRunChangeTotal(dryRunResult);
  return [
    `本次 dry-run 已完成：Job #${dryRunResult.jobId || '-'}`,
    `目标范围：${label}`,
    `目标 ${targets} 个，ready ${ready} 个，menu/code 差异合计 ${changeTotal} 项`,
    '确认后后端会重新 preflight 再执行。',
  ].join('\n');
}

function renderExecuteConfirmContent(
  dryRunResult: MenuTemplateSyncApi.RunResult,
  label: string,
) {
  return h(
    'div',
    { class: 'execute-confirm' },
    buildExecuteConfirmContent(dryRunResult, label)
      .split('\n')
      .map((line) => h('p', { class: 'execute-confirm-line' }, line)),
  );
}

function hasRunBlocked(runResult: MenuTemplateSyncApi.RunResult) {
  return getRunSummaryValue(runResult, 'blocked') > 0;
}

function getLogPermissionCache(log: MenuTemplateSyncApi.JobLog) {
  const details = log.details as
    | undefined
    | { permissionCache?: { status?: string } };
  return details?.permissionCache;
}

function getLogDetails(log: MenuTemplateSyncApi.JobLog) {
  return log.details || log.errorMessage;
}

function shouldShowLogDetails(log: MenuTemplateSyncApi.JobLog) {
  return (
    Boolean(log.errorMessage) ||
    hasLogConflict(log) ||
    log.status === 'blocked' ||
    log.status === 'failed'
  );
}

function hasLogConflict(log: MenuTemplateSyncApi.JobLog) {
  const summary = log.summary as SummaryRecord | undefined;
  return (
    Number(summary?.menu?.conflict || 0) > 0 ||
    Number(summary?.code?.conflict || 0) > 0
  );
}

function formatLogDetails(log: MenuTemplateSyncApi.JobLog) {
  return JSON.stringify(getLogDetails(log), null, 2);
}

function formatTargetDetails(target: TargetResult) {
  return JSON.stringify(target.details || target.errorMessage, null, 2);
}

function hasConflict(target: TargetResult) {
  return (
    Number(target.summary?.menu?.conflict || 0) > 0 ||
    Number(target.summary?.code?.conflict || 0) > 0
  );
}

async function loadJobs() {
  loadingJobs.value = true;
  try {
    jobs.value = await getMenuTemplateSyncJobs(8);
    if (
      selectedJob.value &&
      !jobs.value.some((job) => job.id === selectedJob.value?.id)
    ) {
      selectedJob.value = null;
      jobLogs.value = [];
    }
  } finally {
    loadingJobs.value = false;
  }
}

async function openJobLogs(job: MenuTemplateSyncApi.Job) {
  if (selectedJob.value?.id === job.id && !loadingJobLogs.value) {
    selectedJob.value = null;
    jobLogs.value = [];
    return;
  }

  selectedJob.value = job;
  jobLogs.value = [];
  loadingJobLogs.value = true;
  try {
    const logs = await getMenuTemplateSyncJobLogs(job.id);
    if (selectedJob.value?.id === job.id) {
      jobLogs.value = logs;
    }
  } finally {
    if (selectedJob.value?.id === job.id) {
      loadingJobLogs.value = false;
    }
  }
}

async function runDryRun() {
  const params = buildParams();
  if (!params) {
    return;
  }
  loading.value = true;
  try {
    result.value = await dryRunMenuTemplateSync(params);
    await loadJobs();
    message.success('Dry-run 已完成');
  } finally {
    loading.value = false;
  }
}

async function runExecute() {
  const params = buildParams();
  if (!params) {
    return;
  }
  const label = targetLabel.value;
  loading.value = true;
  let dryRunResult: MenuTemplateSyncApi.RunResult;
  try {
    dryRunResult = await dryRunMenuTemplateSync(params);
    result.value = dryRunResult;
    await loadJobs();
  } finally {
    loading.value = false;
  }

  if (hasRunBlocked(dryRunResult)) {
    message.warning('Dry-run 存在阻断项，未进入 Execute');
    return;
  }

  Modal.confirm({
    cancelText: '取消',
    content: renderExecuteConfirmContent(dryRunResult, label),
    okButtonProps: { danger: true },
    okText: '执行',
    async onOk() {
      loading.value = true;
      try {
        result.value = await executeMenuTemplateSync(params);
        await loadJobs();
        if (result.value.executed) {
          message.success('Execute 已完成');
        } else {
          message.warning('Execute 未写入，请查看结果');
        }
      } finally {
        loading.value = false;
      }
    },
    title: '执行菜单模板 OTA',
  });
}
</script>

<template>
  <Drawer title="菜单模板发布" :width="960">
    <div class="template-sync">
      <section class="sync-panel">
        <div class="field-row">
          <span class="field-label">目标范围</span>
          <Radio.Group v-model:value="targetScope" button-style="solid">
            <Radio.Button value="public">public</Radio.Button>
            <Radio.Button value="tenant">单租户</Radio.Button>
            <Radio.Button value="allTenants">全部租户</Radio.Button>
          </Radio.Group>
          <Input
            v-if="targetScope === 'tenant'"
            v-model:value="tenantId"
            class="tenant-input"
            placeholder="tenantId"
          />
        </div>
        <Space>
          <Button :loading="loading" @click="runDryRun">
            <IconifyIcon icon="lucide:scan-search" class="size-4" />
            Dry-run
          </Button>
          <Button danger type="primary" :loading="loading" @click="runExecute">
            <IconifyIcon icon="lucide:send" class="size-4" />
            Execute
          </Button>
        </Space>
      </section>

      <Spin :spinning="loading">
        <section v-if="result" class="result-panel">
          <div class="result-header">
            <div>
              <strong>Job #{{ result.jobId || '-' }}</strong>
              <span>{{ result.source?.customerId || 'default' }}</span>
              <span>menu {{ result.source?.publishSet.menu ?? 0 }}</span>
              <span>code {{ result.source?.publishSet.code ?? 0 }}</span>
            </div>
            <Tag :color="getStatusColor(result.status)">
              {{ result.status }}
            </Tag>
          </div>

          <Alert
            v-if="result.redis"
            class="redis-alert"
            :message="`Redis: ${result.redis.url || '未配置'}`"
            :type="
              result.redis.required && !result.redis.url ? 'error' : 'info'
            "
            show-icon
          />

          <div class="target-list">
            <div
              v-for="target in result.targets"
              :key="`${target.targetCustomerId}-${target.targetDbName || ''}`"
              class="target-item"
            >
              <div class="target-title">
                <div>
                  <strong>{{ target.targetCustomerId }}</strong>
                  <span v-if="target.targetDbName">{{
                    target.targetDbName
                  }}</span>
                </div>
                <Tag :color="getStatusColor(target.status)">
                  {{ target.status }}
                </Tag>
              </div>
              <div class="metric-grid">
                <div>
                  <span>menu</span>
                  <strong>{{ formatSummary(target, 'menu') }}</strong>
                </div>
                <div>
                  <span>code</span>
                  <strong>{{ formatSummary(target, 'code') }}</strong>
                </div>
                <div v-if="target.permissionCache">
                  <span>cache</span>
                  <strong>{{ target.permissionCache.status }}</strong>
                </div>
              </div>
              <pre v-if="hasConflict(target) || target.errorMessage">{{
                formatTargetDetails(target)
              }}</pre>
            </div>
          </div>
        </section>
        <Empty v-else class="empty-result" description="暂无结果" />
      </Spin>

      <section class="jobs-panel">
        <div class="jobs-title">
          <strong>最近任务</strong>
          <Button
            aria-label="刷新任务"
            size="small"
            title="刷新任务"
            :loading="loadingJobs"
            @click="loadJobs"
          >
            <IconifyIcon icon="lucide:refresh-cw" class="size-4" />
          </Button>
        </div>
        <div v-if="jobs.length > 0" class="job-list">
          <article
            v-for="job in jobs"
            :key="job.id"
            class="job-item"
            :class="{ 'job-item-active': selectedJob?.id === job.id }"
          >
            <div class="job-row">
              <strong>#{{ job.id }}</strong>
              <Tag :color="getStatusColor(job.status)">
                {{ job.status }}
              </Tag>
              <span>{{ job.mode }}</span>
              <span>{{ job.targetScope }}</span>
              <time>{{ job.createTime || '-' }}</time>
              <Button
                size="small"
                :loading="loadingJobLogs && selectedJob?.id === job.id"
                @click="openJobLogs(job)"
              >
                {{ selectedJob?.id === job.id ? '收起' : '查看' }}
              </Button>
            </div>

            <div v-if="selectedJob?.id === job.id" class="job-detail">
              <Spin :spinning="loadingJobLogs">
                <div v-if="jobLogs.length > 0" class="job-log-list">
                  <div v-for="log in jobLogs" :key="log.id" class="job-log-row">
                    <div class="job-log-main">
                      <div class="target-name">
                        <strong>{{ log.targetCustomerId }}</strong>
                        <span v-if="log.targetDbName">
                          {{ log.targetDbName }}
                        </span>
                      </div>
                      <Tag :color="getStatusColor(log.status)">
                        {{ log.status }}
                      </Tag>
                    </div>
                    <div class="job-log-metrics">
                      <span>menu: {{ formatLogSummary(log, 'menu') }}</span>
                      <span>code: {{ formatLogSummary(log, 'code') }}</span>
                      <span v-if="getLogPermissionCache(log)">
                        cache: {{ getLogPermissionCache(log)?.status }}
                      </span>
                    </div>
                    <pre v-if="shouldShowLogDetails(log)">{{
                      formatLogDetails(log)
                    }}</pre>
                  </div>
                </div>
                <Empty v-else description="暂无日志" />
              </Spin>
            </div>
          </article>
        </div>
        <Empty v-else description="暂无任务" />
      </section>
    </div>
  </Drawer>
</template>

<style lang="scss" scoped>
.template-sync {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sync-panel,
.result-panel,
.jobs-panel {
  padding: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.field-row,
.result-header,
.target-title,
.jobs-title,
.job-row {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.field-row {
  flex-wrap: wrap;
  justify-content: flex-start;
  margin-bottom: 16px;
}

.field-label {
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.tenant-input {
  width: 220px;
}

.result-header span,
.target-title span,
.job-row span,
.job-row time {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.redis-alert {
  margin-top: 12px;
}

.target-list,
.job-list {
  display: flex;
  flex-direction: column;
  margin-top: 12px;
}

.target-list {
  gap: 12px;
}

.job-list {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.target-item {
  padding: 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.metric-grid div {
  min-width: 0;
  padding: 10px;
  background: hsl(var(--muted));
  border-radius: 6px;
}

.metric-grid span {
  display: block;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.metric-grid strong {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 500;
  overflow-wrap: anywhere;
}

pre {
  max-height: 220px;
  padding: 12px;
  margin: 12px 0 0;
  overflow: auto;
  font-size: 12px;
  background: hsl(var(--muted));
  border-radius: 6px;
}

.empty-result {
  padding: 28px 0;
}

.job-item {
  border-bottom: 1px solid hsl(var(--border));
}

.job-item:last-child {
  border-bottom: 0;
}

.job-item-active {
  background: hsl(var(--muted) / 35%);
}

.job-row {
  display: grid;
  grid-template-columns:
    48px minmax(70px, 82px) minmax(62px, 74px) minmax(72px, 1fr)
    minmax(0, 1fr) 56px;
  column-gap: 8px;
  padding: 9px 12px;
}

.job-row > * {
  min-width: 0;
}

.job-row strong,
.job-row span,
.job-row time {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job-detail {
  padding: 10px 12px 12px 68px;
  border-top: 1px solid hsl(var(--border));
}

.job-log-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.job-log-row {
  padding: 10px 12px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.job-log-main,
.job-log-metrics,
.target-name {
  display: flex;
  gap: 8px;
  align-items: center;
}

.job-log-main {
  justify-content: space-between;
}

.job-log-metrics {
  flex-wrap: wrap;
  margin-top: 8px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.target-name {
  min-width: 0;
}

.target-name strong,
.target-name span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.target-name span {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 720px) {
  .metric-grid {
    grid-template-columns: 1fr;
  }

  .tenant-input {
    width: 100%;
  }

  .job-row {
    grid-template-columns: 48px minmax(70px, 82px) minmax(0, 1fr) 56px;
  }

  .job-row span:first-of-type,
  .job-row time {
    display: none;
  }

  .job-detail {
    padding-left: 12px;
  }
}
</style>
