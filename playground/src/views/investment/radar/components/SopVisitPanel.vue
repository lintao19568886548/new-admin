<script setup lang="ts">
import type {
  RadarAssignmentRecord,
  RadarFollowRecord,
  RadarSopReminder,
  RadarVisitRecord,
} from '#/api/investment';

import { computed, onMounted, ref, watch } from 'vue';

import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  List,
  message,
  Modal,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
} from 'ant-design-vue';

import {
  completeRadarSopReminder,
  completeRadarVisitRecord,
  createRadarFollowRecord,
  createRadarVisitRecord,
  getRadarLeadSop,
} from '#/api/investment';

const props = defineProps<{
  leadId: number | string;
}>();

const followForm = ref({
  content: '',
  followResult: 'CONTACTED',
  followType: 'PHONE',
  nextAction: '',
  nextFollowTime: '',
});
const assignmentRecords = ref<RadarAssignmentRecord[]>([]);
const followOpen = ref(false);
const followRecords = ref<RadarFollowRecord[]>([]);
const loading = ref(false);
const loadError = ref('');
const reminders = ref<RadarSopReminder[]>([]);
const savingFollow = ref(false);
const savingVisit = ref(false);
const savingVisitFeedback = ref(false);
const visitFeedbackForm = ref({
  actualTime: '',
  feedback: '',
  visitId: 0,
});
const visitFeedbackOpen = ref(false);
const visitForm = ref({
  feedback: '',
  scheduledTime: '',
  visitorName: '',
  visitorPhone: '',
});
const visitOpen = ref(false);
const visitRecords = ref<RadarVisitRecord[]>([]);

const assignmentCountText = computed(() =>
  String(assignmentRecords.value.length),
);
const followCountText = computed(() => String(followRecords.value.length));
const reminderCountText = computed(() => String(reminders.value.length));
const visitCountText = computed(() => String(visitRecords.value.length));

const followTypeOptions = [
  { label: '电话', value: 'PHONE' },
  { label: '微信', value: 'WECHAT' },
  { label: '拜访', value: 'VISIT' },
];

const followResultOptions = [
  { label: '已联系', value: 'CONTACTED' },
  { label: '正向反馈', value: 'POSITIVE' },
  { label: '有意向', value: 'INTENTED' },
  { label: '已回复', value: 'REPLIED' },
  { label: '未接通', value: 'NO_ANSWER' },
  { label: '暂不考虑', value: 'NEGATIVE' },
  { label: '无效线索', value: 'INVALID' },
];

const followTypeLabelMap: Record<string, string> = Object.fromEntries(
  followTypeOptions.map((item) => [item.value, item.label]),
);

const followResultLabelMap: Record<string, string> = Object.fromEntries(
  followResultOptions.map((item) => [item.value, item.label]),
);

const reminderStatusMap: Record<string, { color: string; label: string }> = {
  DONE: { color: 'green', label: '已处理' },
  OVERDUE: { color: 'red', label: '已逾期' },
  PENDING: { color: 'orange', label: '待处理' },
};

const assignmentSourceMap: Record<string, { color: string; label: string }> = {
  AUTO: { color: 'cyan', label: '系统自动分配' },
  MANUAL: { color: 'blue', label: '人工调整' },
  PIPELINE_AUTO: { color: 'cyan', label: '系统自动分配' },
  SYSTEM_AUTO: { color: 'cyan', label: '系统自动分配' },
};

const visitStatusMap: Record<string, { color: string; label: string }> = {
  CANCELED: { color: 'default', label: '已取消' },
  DONE: { color: 'green', label: '已带看' },
  PLANNED: { color: 'blue', label: '已预约' },
};

function formatTime(value?: null | string) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleString('zh-CN', { hour12: false });
}

function getFollowTypeLabel(value?: null | string) {
  return value ? followTypeLabelMap[value] || '其他跟进' : '-';
}

function getFollowResultLabel(value?: null | string) {
  return value ? followResultLabelMap[value] || '跟进记录' : '-';
}

function getReminderMeta(status?: null | string) {
  return status
    ? reminderStatusMap[status] || { color: 'default', label: '待确认' }
    : { color: 'default', label: '-' };
}

function getAssignmentMeta(source?: null | string) {
  return source
    ? assignmentSourceMap[source] || { color: 'default', label: '分配记录' }
    : { color: 'default', label: '分配记录' };
}

function getVisitMeta(status?: null | string) {
  return status
    ? visitStatusMap[status] || { color: 'default', label: '待确认' }
    : { color: 'default', label: '-' };
}

async function loadSop() {
  if (!Number(props.leadId)) {
    return;
  }

  loading.value = true;
  loadError.value = '';
  try {
    const result = await getRadarLeadSop(props.leadId);
    assignmentRecords.value = Array.isArray(result.assignmentRecords)
      ? result.assignmentRecords
      : [];
    followRecords.value = Array.isArray(result.followRecords)
      ? result.followRecords
      : [];
    reminders.value = Array.isArray(result.reminders) ? result.reminders : [];
    visitRecords.value = Array.isArray(result.visitRecords)
      ? result.visitRecords
      : [];
  } catch (error) {
    console.error('load radar SOP failed:', error);
    assignmentRecords.value = [];
    followRecords.value = [];
    reminders.value = [];
    visitRecords.value = [];
    loadError.value = 'SOP跟进数据加载失败';
  } finally {
    loading.value = false;
  }
}

function resetFollowForm() {
  followForm.value = {
    content: '',
    followResult: 'CONTACTED',
    followType: 'PHONE',
    nextAction: '',
    nextFollowTime: '',
  };
}

function resetVisitFeedbackForm() {
  visitFeedbackForm.value = {
    actualTime: '',
    feedback: '',
    visitId: 0,
  };
}

function resetVisitForm() {
  visitForm.value = {
    feedback: '',
    scheduledTime: '',
    visitorName: '',
    visitorPhone: '',
  };
}

async function saveFollow() {
  if (!followForm.value.content.trim()) {
    message.warning('请填写跟进内容');
    return;
  }

  savingFollow.value = true;
  try {
    await createRadarFollowRecord(props.leadId, {
      content: followForm.value.content,
      followResult: followForm.value.followResult,
      followType: followForm.value.followType,
      nextAction: followForm.value.nextAction,
      nextFollowTime: followForm.value.nextFollowTime,
    });
    message.success('已新增跟进记录');
    followOpen.value = false;
    resetFollowForm();
    await loadSop();
  } catch (error) {
    console.error('create radar follow failed:', error);
    message.error('新增跟进记录失败');
  } finally {
    savingFollow.value = false;
  }
}

async function saveVisit() {
  if (!visitForm.value.scheduledTime) {
    message.warning('请填写预约时间');
    return;
  }

  savingVisit.value = true;
  try {
    await createRadarVisitRecord(props.leadId, {
      feedback: visitForm.value.feedback,
      scheduledTime: visitForm.value.scheduledTime,
      visitorName: visitForm.value.visitorName,
      visitorPhone: visitForm.value.visitorPhone,
    });
    message.success('已新增带看预约');
    visitOpen.value = false;
    resetVisitForm();
    await loadSop();
  } catch (error) {
    console.error('create radar visit failed:', error);
    message.error('新增带看预约失败');
  } finally {
    savingVisit.value = false;
  }
}

function openVisitFeedback(record: RadarVisitRecord) {
  visitFeedbackForm.value = {
    actualTime: record.actualTime || record.scheduledTime || '',
    feedback: record.feedback || '',
    visitId: Number(record.visitId || 0),
  };
  visitFeedbackOpen.value = true;
}

async function saveVisitFeedback() {
  if (!visitFeedbackForm.value.visitId) {
    message.warning('带看记录无效');
    return;
  }
  if (!visitFeedbackForm.value.feedback.trim()) {
    message.warning('请填写带看反馈');
    return;
  }

  savingVisitFeedback.value = true;
  try {
    await completeRadarVisitRecord(visitFeedbackForm.value.visitId, {
      actualTime: visitFeedbackForm.value.actualTime,
      feedback: visitFeedbackForm.value.feedback,
    });
    message.success('已记录带看反馈');
    visitFeedbackOpen.value = false;
    resetVisitFeedbackForm();
    await loadSop();
  } catch (error) {
    console.error('complete radar visit failed:', error);
    message.error('记录带看反馈失败');
  } finally {
    savingVisitFeedback.value = false;
  }
}

async function handleCompleteReminder(reminder: RadarSopReminder) {
  if (reminder.reminderId <= 0) {
    message.warning('系统生成的提醒无法单独完成，请通过相关操作消除');
    return;
  }

  try {
    await completeRadarSopReminder(reminder.reminderId);
    message.success('已完成提醒');
    await loadSop();
  } catch (error) {
    console.error('complete reminder failed:', error);
    message.error('完成提醒失败');
  }
}

watch(
  () => props.leadId,
  () => {
    void loadSop();
  },
);

onMounted(() => {
  void loadSop();
});
</script>

<template>
  <Card class="sop-visit-panel" title="SOP跟进与带看">
    <template #extra>
      <Space wrap>
        <Button size="small" @click="loadSop">刷新</Button>
        <Button size="small" @click="followOpen = true">新增跟进</Button>
        <Button size="small" type="primary" @click="visitOpen = true">
          预约带看
        </Button>
      </Space>
    </template>

    <Spin :spinning="loading">
      <Tabs size="small">
        <Tabs.TabPane key="reminders" :tab="`提醒 ${reminderCountText}`">
          <List
            v-if="reminders.length > 0"
            :data-source="reminders"
            size="small"
          >
            <template #renderItem="{ item }">
              <List.Item class="sop-list-item">
                <List.Item.Meta
                  :description="`${formatTime(item.dueTime)} / ${item.description || '-'}`"
                  :title="item.title"
                />
                <div class="record-actions">
                  <Tag :color="getReminderMeta(item.reminderStatus).color">
                    {{ getReminderMeta(item.reminderStatus).label }}
                  </Tag>
                  <Button
                    v-if="
                      ['OVERDUE', 'PENDING'].includes(item.reminderStatus) &&
                      item.reminderId > 0
                    "
                    size="small"
                    @click="handleCompleteReminder(item)"
                  >
                    完成
                  </Button>
                </div>
              </List.Item>
            </template>
          </List>
          <Empty
            v-else
            class="panel-empty"
            :description="loadError || '暂无提醒'"
          />
        </Tabs.TabPane>

        <Tabs.TabPane key="assignment" :tab="`分配 ${assignmentCountText}`">
          <List
            v-if="assignmentRecords.length > 0"
            :data-source="assignmentRecords"
            size="small"
          >
            <template #renderItem="{ item }">
              <List.Item class="sop-list-item">
                <List.Item.Meta
                  :description="`${formatTime(item.createTime)} / ${item.assignReason || '负责人更新'}`"
                  :title="`分配给 ${item.ownerName || '未记录负责人'}`"
                />
                <div class="record-actions">
                  <Tag :color="getAssignmentMeta(item.assignmentSource).color">
                    {{ getAssignmentMeta(item.assignmentSource).label }}
                  </Tag>
                </div>
              </List.Item>
            </template>
          </List>
          <Empty v-else class="panel-empty" description="暂无分配记录" />
        </Tabs.TabPane>

        <Tabs.TabPane key="follow" :tab="`跟进 ${followCountText}`">
          <List
            v-if="followRecords.length > 0"
            :data-source="followRecords"
            size="small"
          >
            <template #renderItem="{ item }">
              <List.Item class="sop-list-item">
                <List.Item.Meta
                  :description="`${formatTime(item.createTime)} / ${item.operatorName || '-'}`"
                  :title="
                    item.content || getFollowResultLabel(item.followResult)
                  "
                />
                <div class="record-actions">
                  <Tag>{{ getFollowTypeLabel(item.followType) }}</Tag>
                  <Tag>{{ getFollowResultLabel(item.followResult) }}</Tag>
                </div>
              </List.Item>
            </template>
          </List>
          <Empty v-else class="panel-empty" description="暂无跟进记录" />
        </Tabs.TabPane>

        <Tabs.TabPane key="visit" :tab="`带看 ${visitCountText}`">
          <List
            v-if="visitRecords.length > 0"
            :data-source="visitRecords"
            size="small"
          >
            <template #renderItem="{ item }">
              <List.Item class="sop-list-item">
                <List.Item.Meta
                  :description="`${formatTime(item.scheduledTime)} / ${item.visitorName || '-'} ${item.visitorPhone || ''}`"
                  :title="item.feedback || '带看记录'"
                />
                <div class="record-actions">
                  <Tag :color="getVisitMeta(item.visitStatus).color">
                    {{ getVisitMeta(item.visitStatus).label }}
                  </Tag>
                  <Button
                    v-if="item.visitStatus !== 'DONE'"
                    size="small"
                    @click="openVisitFeedback(item)"
                  >
                    记录反馈
                  </Button>
                </div>
              </List.Item>
            </template>
          </List>
          <Empty v-else class="panel-empty" description="暂无带看记录" />
        </Tabs.TabPane>
      </Tabs>
    </Spin>

    <Modal
      v-model:open="followOpen"
      title="新增跟进记录"
      :confirm-loading="savingFollow"
      @ok="saveFollow"
    >
      <Form layout="vertical">
        <div class="form-grid">
          <Form.Item label="跟进方式">
            <Select
              v-model:value="followForm.followType"
              :options="followTypeOptions"
            />
          </Form.Item>
          <Form.Item label="跟进结果">
            <Select
              v-model:value="followForm.followResult"
              :options="followResultOptions"
            />
          </Form.Item>
        </div>
        <Form.Item label="跟进内容" required>
          <Input.TextArea
            v-model:value="followForm.content"
            :auto-size="{ minRows: 3, maxRows: 6 }"
          />
        </Form.Item>
        <Form.Item label="下一步动作">
          <Input v-model:value="followForm.nextAction" />
        </Form.Item>
        <Form.Item label="下次跟进时间">
          <Input
            v-model:value="followForm.nextFollowTime"
            placeholder="2026-05-20 10:00:00"
          />
        </Form.Item>
      </Form>
    </Modal>

    <Modal
      v-model:open="visitOpen"
      title="预约带看"
      :confirm-loading="savingVisit"
      @ok="saveVisit"
    >
      <Form layout="vertical">
        <Form.Item label="预约时间" required>
          <Input
            v-model:value="visitForm.scheduledTime"
            placeholder="2026-05-20 10:00:00"
          />
        </Form.Item>
        <Form.Item label="访客姓名">
          <Input v-model:value="visitForm.visitorName" />
        </Form.Item>
        <Form.Item label="访客电话">
          <Input v-model:value="visitForm.visitorPhone" />
        </Form.Item>
        <Form.Item label="备注">
          <Input.TextArea
            v-model:value="visitForm.feedback"
            :auto-size="{ minRows: 3, maxRows: 6 }"
          />
        </Form.Item>
      </Form>
    </Modal>

    <Modal
      v-model:open="visitFeedbackOpen"
      title="记录带看反馈"
      :confirm-loading="savingVisitFeedback"
      @ok="saveVisitFeedback"
    >
      <Form layout="vertical">
        <Form.Item label="实际带看时间">
          <Input
            v-model:value="visitFeedbackForm.actualTime"
            placeholder="2026-05-20 10:00:00"
          />
        </Form.Item>
        <Form.Item label="客户反馈" required>
          <Input.TextArea
            v-model:value="visitFeedbackForm.feedback"
            :auto-size="{ minRows: 4, maxRows: 8 }"
          />
        </Form.Item>
      </Form>
    </Modal>
  </Card>
</template>

<style scoped>
.sop-visit-panel :deep(.ant-card-body) {
  padding: 8px 16px 16px;
}

.sop-visit-panel :deep(.ant-tabs-nav) {
  margin-bottom: 8px;
}

.sop-list-item {
  align-items: flex-start;
  padding: 10px 0;
}

.sop-list-item :deep(.ant-list-item-meta-title) {
  margin-bottom: 3px;
  font-size: 14px;
  line-height: 22px;
  color: var(--ant-color-text);
  word-break: break-word;
}

.sop-list-item :deep(.ant-list-item-meta-description) {
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
  word-break: break-word;
}

.record-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  min-width: 112px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.panel-empty {
  padding: 18px 0;
}

@media (max-width: 767px) {
  .sop-visit-panel {
    margin-top: 8px;
  }

  .sop-visit-panel :deep(.ant-card-body) {
    padding: 6px 12px 12px;
  }

  .sop-list-item {
    flex-direction: column;
    gap: 8px;
  }

  .record-actions {
    justify-content: flex-start;
    width: 100%;
  }

  .form-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
