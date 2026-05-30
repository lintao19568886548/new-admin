<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { OrganizationProvisioningAdminApi } from '#/api/system/organization-provisioning';

import { computed, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Input,
  message,
  Modal,
  Space,
  Tag,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getFailedManualOrganizationProvisioningJobs,
  requeueFailedManualOrganizationProvisioningJob,
} from '#/api/system/organization-provisioning';

import {
  formatMoney,
  formatNullableDate,
  getJobStatusColor,
  useColumns,
  useGridFormSchema,
} from './data';

type FailedManualJob = OrganizationProvisioningAdminApi.FailedManualJob;
type RequeueResult = OrganizationProvisioningAdminApi.RequeueResult;

const selectedJob = ref<FailedManualJob | null>(null);
const drawerOpen = ref(false);
const previewLoading = ref(false);
const executeLoading = ref(false);
const requeueReason = ref('');
const requeuePreview = ref<null | RequeueResult>(null);

const selectedJobTitle = computed(() =>
  selectedJob.value ? `Job #${selectedJob.value.id}` : '组织空间开通任务',
);
const canExecuteRequeue = computed(
  () =>
    Boolean(requeuePreview.value?.confirmation) &&
    Boolean(requeueReason.value.trim()) &&
    !previewLoading.value &&
    !executeLoading.value,
);

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
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        query: async () => {
          try {
            const formValues = (await gridApi.formApi?.getValues?.()) || {};
            return await getFailedManualOrganizationProvisioningJobs(
              Number(formValues.limit || 50),
            );
          } catch (error) {
            console.error('读取组织空间开通任务失败:', error);
            message.error(
              error instanceof Error
                ? error.message
                : '读取组织空间开通任务失败',
            );
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
  } as VxeTableGridOptions<FailedManualJob>,
});

function onActionClick({ code, row }: OnActionClickParams<FailedManualJob>) {
  if (code === 'requeue') {
    openRequeueDrawer(row);
  }
}

function openRequeueDrawer(job: FailedManualJob) {
  selectedJob.value = job;
  requeuePreview.value = null;
  requeueReason.value = '';
  drawerOpen.value = true;
}

async function previewRequeue() {
  if (!selectedJob.value || previewLoading.value) {
    return;
  }

  previewLoading.value = true;
  try {
    requeuePreview.value = await requeueFailedManualOrganizationProvisioningJob(
      {
        execute: false,
        jobId: selectedJob.value.id,
      },
    );
    message.success('重排预览已生成');
  } catch (error) {
    console.error('预览重排失败:', error);
    message.error(error instanceof Error ? error.message : '预览重排失败');
  } finally {
    previewLoading.value = false;
  }
}

function executeRequeue() {
  if (!selectedJob.value || !requeuePreview.value) {
    message.warning('请先完成重排预览');
    return;
  }
  if (!requeueReason.value.trim()) {
    message.warning('请填写重排原因');
    return;
  }

  Modal.confirm({
    centered: true,
    content: `确认将 Job #${selectedJob.value.id} 重置为 pending，worker 下一轮会全量重建目标库。`,
    okButtonProps: { danger: true },
    okText: '确认重排',
    onOk: async () => {
      executeLoading.value = true;
      try {
        const result = await requeueFailedManualOrganizationProvisioningJob({
          confirmation: requeuePreview.value?.confirmation,
          execute: true,
          jobId: selectedJob.value!.id,
          reason: requeueReason.value.trim(),
        });
        requeuePreview.value = result;
        message.success('任务已重排');
        drawerOpen.value = false;
        await gridApi.query();
      } catch (error) {
        console.error('执行重排失败:', error);
        message.error(error instanceof Error ? error.message : '执行重排失败');
      } finally {
        executeLoading.value = false;
      }
    },
    title: '确认重排组织空间开通任务',
  });
}
</script>

<template>
  <Page auto-content-height>
    <Grid table-title="组织空间开通任务">
      <template #toolbar-tools>
        <Space>
          <Button @click="gridApi.query">刷新</Button>
        </Space>
      </template>
    </Grid>

    <Drawer
      v-model:open="drawerOpen"
      width="680"
      :title="selectedJobTitle"
      destroy-on-close
    >
      <template v-if="selectedJob">
        <Alert
          class="mb-4"
          show-icon
          type="warning"
          message="仅在确认根因已处理后执行重排"
          description="重排会把 failed_manual 任务重置为 pending，worker 下一轮会重新执行开通流程。"
        />

        <Descriptions bordered size="small" :column="2">
          <Descriptions.Item label="状态">
            <Tag :color="getJobStatusColor(selectedJob.status)">
              {{ selectedJob.status }}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="步骤">
            {{ selectedJob.step || '-' }}
          </Descriptions.Item>
          <Descriptions.Item label="组织">
            {{ selectedJob.organization?.name || '-' }}
          </Descriptions.Item>
          <Descriptions.Item label="sourceOrgId">
            {{ selectedJob.sourceOrgId || '-' }}
          </Descriptions.Item>
          <Descriptions.Item label="目标组织空间">
            {{ selectedJob.targetCustomerId || '-' }}
          </Descriptions.Item>
          <Descriptions.Item label="目标库">
            {{ selectedJob.targetDbName || '-' }}
          </Descriptions.Item>
          <Descriptions.Item label="发起人">
            {{
              selectedJob.initiator?.realName ||
              selectedJob.initiator?.username ||
              selectedJob.initiatorCenterUserId
            }}
          </Descriptions.Item>
          <Descriptions.Item label="支付金额">
            {{
              selectedJob.lastPayment
                ? formatMoney(selectedJob.lastPayment.amountTotal)
                : '-'
            }}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {{ formatNullableDate(selectedJob.updateTime) }}
          </Descriptions.Item>
          <Descriptions.Item label="支付单">
            {{ selectedJob.lastPaymentOutTradeNo || '-' }}
          </Descriptions.Item>
        </Descriptions>

        <div v-if="selectedJob.errorMessage" class="task-error mt-4">
          {{ selectedJob.errorMessage }}
        </div>

        <div class="mt-4">
          <Button
            type="primary"
            :loading="previewLoading"
            @click="previewRequeue"
          >
            预览重排
          </Button>
        </div>

        <Descriptions
          v-if="requeuePreview"
          class="mt-4"
          bordered
          size="small"
          :column="1"
        >
          <Descriptions.Item label="确认串">
            <code>{{ requeuePreview.confirmation }}</code>
          </Descriptions.Item>
          <Descriptions.Item label="预览结果">
            {{ requeuePreview.message }}
          </Descriptions.Item>
        </Descriptions>

        <div class="mt-4">
          <label class="reason-label">重排原因</label>
          <Input.TextArea
            v-model:value="requeueReason"
            :rows="4"
            placeholder="说明已处理的根因、人工确认点或相关工单"
          />
        </div>
      </template>

      <template #footer>
        <Space>
          <Button @click="drawerOpen = false">取消</Button>
          <Button
            danger
            type="primary"
            :disabled="!canExecuteRequeue"
            :loading="executeLoading"
            @click="executeRequeue"
          >
            执行重排
          </Button>
        </Space>
      </template>
    </Drawer>
  </Page>
</template>

<style scoped>
.task-error {
  max-height: 180px;
  padding: 12px;
  overflow: auto;
  font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
  font-size: 12px;
  line-height: 1.7;
  color: #991b1b;
  white-space: pre-wrap;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  border-radius: 6px;
}

.reason-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}
</style>
