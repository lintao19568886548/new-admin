<script setup lang="ts">
import type {
  OutreachSuggestion,
  OutreachSuggestionItem,
} from '#/api/investment';

import { computed, onMounted, ref, watch } from 'vue';

import { Button, Card, Empty, message, Space, Spin, Tag } from 'ant-design-vue';

import { createOutreachTask, getOutreachSuggestion } from '#/api/investment';

const props = defineProps<{
  leadId: number | string;
  visible?: boolean;
}>();

const emit = defineEmits<{
  (event: 'taskCreated'): void;
}>();

const creatingTemplateCode = ref('');
const loading = ref(false);
const loadError = ref('');
const suggestion = ref<null | OutreachSuggestion>(null);

const canLoad = computed(
  () => props.visible !== false && Number(props.leadId) > 0,
);

const channelLabelMap: Record<string, string> = {
  CALL: '电话',
  EMAIL: '邮件',
  SMS: '短信',
  VISIT: '拜访',
  WECHAT: '微信',
};

const stageLabelMap: Record<string, string> = {
  CLOSED: '已关闭',
  CONTACTED: '已触达',
  DEAL: '已成交',
  INVALID: '无效',
  PENDING_CONTACT: '待触达',
  REPLIED: '已回复',
  VISITED: '已带看',
};

const taskTypeLabelMap: Record<string, string> = {
  FOLLOW_UP: '跟进',
  OUTREACH: '外呼触达',
  VISIT: '预约拜访',
};

function mapChannel(value?: string) {
  return value ? channelLabelMap[value] || value : '-';
}

function mapStage(value?: string) {
  return value ? stageLabelMap[value] || value : '-';
}

function mapTaskType(value?: string) {
  return value ? taskTypeLabelMap[value] || value : '-';
}

async function createTask(item: OutreachSuggestionItem) {
  if (!suggestion.value?.phoneNumber) {
    message.warning('当前线索没有可用联系电话');
    return;
  }

  creatingTemplateCode.value = item.templateCode;
  try {
    await createOutreachTask({
      channel: item.channel,
      content: item.suggestedContent,
      leadId: Number(props.leadId),
      phoneNumber: suggestion.value.phoneNumber,
      taskType: item.taskType,
      templateCode: item.templateCode,
    });
    message.success('已生成触达任务');
    emit('taskCreated');
    await loadSuggestion();
  } catch (error) {
    console.error('create outreach task failed:', error);
    message.error('生成触达任务失败');
  } finally {
    creatingTemplateCode.value = '';
  }
}

async function loadSuggestion() {
  if (!canLoad.value) {
    return;
  }

  loading.value = true;
  loadError.value = '';
  try {
    suggestion.value = await getOutreachSuggestion(props.leadId);
  } catch (error) {
    console.error('load outreach suggestion failed:', error);
    suggestion.value = null;
    loadError.value = '触达建议数据加载失败';
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.leadId, props.visible],
  () => {
    void loadSuggestion();
  },
);

onMounted(() => {
  void loadSuggestion();
});
</script>

<template>
  <Card class="outreach-suggestion-panel" title="触达建议">
    <template #extra>
      <Button size="small" :loading="loading" @click="loadSuggestion">
        刷新
      </Button>
    </template>

    <Spin :spinning="loading">
      <template v-if="suggestion">
        <div class="outreach-summary">
          <span>
            联系人：{{ suggestion.contactName || '-' }} /
            {{ suggestion.phoneNumber || '-' }}
          </span>
          <span>阶段：{{ mapStage(suggestion.stage) }}</span>
          <span>总分：{{ suggestion.totalScore ?? '-' }}</span>
        </div>

        <div v-if="!suggestion.canContact" class="outreach-restriction">
          {{ suggestion.contactRestrictionReason || '当前线索暂不建议触达' }}
        </div>

        <div v-if="suggestion.suggestions.length > 0" class="outreach-list">
          <div
            v-for="item in suggestion.suggestions"
            :key="item.templateId || item.templateCode"
            class="outreach-row"
          >
            <div class="outreach-row-main">
              <div class="outreach-title">{{ item.templateName }}</div>
              <Space :size="4" wrap>
                <Tag color="blue">{{ mapTaskType(item.taskType) }}</Tag>
                <Tag>{{ mapChannel(item.channel) }}</Tag>
                <Tag color="orange">{{ item.priorityLevel || '-' }}级</Tag>
              </Space>
              <p>{{ item.suggestedContent || '-' }}</p>
            </div>
            <Button
              size="small"
              type="primary"
              :disabled="!suggestion.canContact"
              :loading="creatingTemplateCode === item.templateCode"
              @click="createTask(item)"
            >
              生成任务
            </Button>
          </div>
        </div>

        <Empty v-else class="panel-empty" description="暂无触达方案" />
      </template>

      <Empty
        v-else-if="!loading"
        class="panel-empty"
        :description="loadError || '暂无触达建议'"
      />
    </Spin>
  </Card>
</template>

<style scoped>
.outreach-suggestion-panel :deep(.ant-card-body) {
  padding: 12px 16px 14px;
}

.outreach-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-bottom: 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.outreach-restriction {
  padding: 7px 10px;
  margin-bottom: 12px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-warning-text);
  background: var(--ant-color-warning-bg);
  border: 1px solid var(--ant-color-warning-border);
  border-radius: 6px;
}

.outreach-list {
  border-top: 1px solid var(--ant-color-border-secondary);
}

.outreach-row {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--ant-color-border-secondary);
}

.outreach-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.outreach-row-main {
  min-width: 0;
}

.outreach-row > :deep(.ant-btn) {
  flex: none;
}

.outreach-title {
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: var(--ant-color-text);
}

.outreach-row p {
  display: -webkit-box;
  margin: 7px 0 0;
  overflow: hidden;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
  -webkit-line-clamp: 3;
  word-break: break-word;
  -webkit-box-orient: vertical;
}

.panel-empty {
  padding: 18px 0;
}

@media (max-width: 767px) {
  .outreach-suggestion-panel {
    margin-top: 8px;
  }

  .outreach-suggestion-panel :deep(.ant-card-body) {
    padding: 12px;
  }

  .outreach-row {
    display: block;
  }

  .outreach-row > .ant-btn {
    width: 100%;
    margin-top: 10px;
  }
}
</style>
