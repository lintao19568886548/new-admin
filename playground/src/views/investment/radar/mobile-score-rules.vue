<script lang="ts" setup>
import type {
  LeadScoreRule,
  LeadScoreRuleUpdatePayload,
} from '#/api/investment';

import { computed, onMounted, ref } from 'vue';

import {
  EditOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons-vue';
import {
  Alert,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Spin,
  Switch,
  Tag,
} from 'ant-design-vue';

import {
  getLeadScoreRuleList,
  recalculateDemoLeadScores,
  updateLeadScoreRule,
} from '#/api/investment';

import { formatDateOnly } from './mobile-utils';

defineOptions({ name: 'InvestmentRadarMobileScoreRules' });

const loading = ref(false);
const saving = ref(false);
const recalculating = ref(false);
const togglingRuleId = ref<null | number>(null);
const editOpen = ref(false);
const items = ref<LeadScoreRule[]>([]);
const currentRule = ref<LeadScoreRule | null>(null);
const recalculateSummary = ref<null | {
  recalculatedCount: number;
  totalLeadCount: number;
}>(null);
const editForm = ref({
  enabled: true,
  keywordJson: '',
  ruleDescription: '',
  scoreDelta: 0,
});

const scoreKeywordPlaceholder = '["扩建","新增产线"]';

const eventTypeLabel: Record<string, string> = {
  EVENT_EA_EXPAND: '环评扩产信号',
  FACTORY_RENT_DEMAND: '租厂需求信号',
  KEYWORD_EXPAND: '关键词：扩建',
  KEYWORD_NEW_LINE: '关键词：新增产线',
  KEYWORD_RECRUITMENT: '关键词：招聘',
  KEYWORD_RELOCATION: '关键词：搬迁',
  KEYWORD_WAREHOUSE: '关键词：仓储',
  NEWS_EXPAND: '新闻扩产信号',
  PUBLIC_FACTORY_DEMAND: '公开厂房需求信号',
  RECRUITMENT_EXPAND: '招聘扩产信号',
  RELOCATION: '搬迁信号',
  UNKNOWN: '未知信号',
};

const enabledRuleCount = computed(
  () => items.value.filter((item) => item.enabled).length,
);

const disabledRuleCount = computed(
  () => items.value.length - enabledRuleCount.value,
);

const enabledScoreDeltaTotal = computed(() =>
  items.value
    .filter((item) => item.enabled)
    .reduce((sum, item) => sum + item.scoreDelta, 0),
);

function formatKeywordJson(value: string[]) {
  return value.length > 0 ? JSON.stringify(value, null, 2) : '';
}

function formatEventType(eventType?: null | string) {
  if (!eventType) {
    return '-';
  }
  return eventTypeLabel[eventType] || eventType;
}

function parseKeywordJson(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  try {
    const parsed = JSON.parse(normalized);
    if (
      !Array.isArray(parsed) ||
      parsed.some((item) => typeof item !== 'string')
    ) {
      throw new Error('invalid keyword array');
    }
    return parsed.map((item) => item.trim()).filter(Boolean);
  } catch {
    throw new Error('关键词必须是字符串数组 JSON');
  }
}

function syncEditForm(rule: LeadScoreRule) {
  editForm.value = {
    enabled: rule.enabled,
    keywordJson: formatKeywordJson(rule.keywordJson),
    ruleDescription: rule.ruleDescription || '',
    scoreDelta: rule.scoreDelta,
  };
}

async function loadRules() {
  loading.value = true;
  try {
    const result = await getLeadScoreRuleList();
    items.value = result.items;
  } catch (error) {
    console.error('加载评分规则失败:', error);
    items.value = [];
  } finally {
    loading.value = false;
  }
}

function openEdit(rule: LeadScoreRule) {
  currentRule.value = rule;
  syncEditForm(rule);
  editOpen.value = true;
}

async function saveRule() {
  if (!currentRule.value || saving.value) {
    return;
  }

  let payload: LeadScoreRuleUpdatePayload;
  try {
    payload = {
      enabled: editForm.value.enabled,
      keywordJson: parseKeywordJson(editForm.value.keywordJson),
      ruleDescription: editForm.value.ruleDescription.trim() || null,
      scoreDelta: editForm.value.scoreDelta,
    };
  } catch (error) {
    message.error(error instanceof Error ? error.message : '评分规则格式无效');
    return;
  }

  saving.value = true;
  try {
    await updateLeadScoreRule(currentRule.value.ruleId, payload);
    message.success('评分规则已保存');
    editOpen.value = false;
    await loadRules();
  } catch (error) {
    console.error('保存评分规则失败:', error);
    message.error('评分规则保存失败');
  } finally {
    saving.value = false;
  }
}

async function toggleRule(rule: LeadScoreRule) {
  if (togglingRuleId.value !== null) {
    return;
  }

  togglingRuleId.value = rule.ruleId;
  try {
    await updateLeadScoreRule(rule.ruleId, {
      enabled: !rule.enabled,
    });
    message.success(rule.enabled ? '评分规则已停用' : '评分规则已启用');
    await loadRules();
  } catch (error) {
    console.error('更新评分规则状态失败:', error);
    message.error('评分规则状态更新失败');
  } finally {
    togglingRuleId.value = null;
  }
}

async function recalculateDemoScores() {
  if (recalculating.value) {
    return;
  }
  recalculating.value = true;
  try {
    const result = await recalculateDemoLeadScores();
    recalculateSummary.value = {
      recalculatedCount: result.recalculatedCount,
      totalLeadCount: result.totalLeadCount,
    };
    message.success(`已重算 ${result.recalculatedCount} 条 demo 潜客评分`);
  } catch (error) {
    console.error('重算 demo 评分失败:', error);
    message.error('重算 demo 评分失败');
  } finally {
    recalculating.value = false;
  }
}

onMounted(() => {
  void loadRules();
});
</script>

<template>
  <div class="radar-mobile-page">
    <div class="radar-mobile-header">
      <div>
        <h2>评分规则</h2>
        <p>维护信号评分规则并重算 demo 潜客分数。</p>
      </div>
      <Button type="primary" :loading="loading" @click="loadRules">
        <ReloadOutlined class="mr-1 h-4 w-4" />
        刷新
      </Button>
    </div>

    <Alert
      v-if="recalculateSummary"
      class="radar-mobile-alert"
      :message="`最近重算：候选 ${recalculateSummary.totalLeadCount}，完成 ${recalculateSummary.recalculatedCount}`"
      show-icon
      type="info"
    />

    <div class="radar-mobile-overview">
      <div class="overview-item">
        <span>规则总数</span>
        <strong>{{ items.length }}</strong>
      </div>
      <div class="overview-item">
        <span>启用</span>
        <strong>{{ enabledRuleCount }}</strong>
      </div>
      <div class="overview-item">
        <span>停用</span>
        <strong>{{ disabledRuleCount }}</strong>
      </div>
      <div class="overview-item">
        <span>启用分值</span>
        <strong>{{ enabledScoreDeltaTotal }}</strong>
      </div>
    </div>

    <div class="radar-mobile-actions">
      <Button
        type="primary"
        :loading="recalculating"
        @click="recalculateDemoScores"
      >
        <ThunderboltOutlined class="mr-1 h-4 w-4" />
        重算 demo 评分
      </Button>
    </div>

    <Spin :spinning="loading">
      <div v-if="items.length > 0" class="radar-mobile-list">
        <Card
          v-for="item in items"
          :key="item.ruleId"
          class="radar-mobile-card"
          :body-style="{ padding: '0' }"
        >
          <div class="radar-card-head">
            <div>
              <div class="radar-card-title">{{ item.ruleName }}</div>
              <div class="radar-card-subtitle">{{ item.ruleCode }}</div>
            </div>
            <Tag :color="item.enabled ? 'green' : 'default'">
              {{ item.enabled ? '启用' : '停用' }}
            </Tag>
          </div>
          <div class="radar-card-meta">
            <div class="meta-row">
              <span class="meta-label">事件类型</span>
              <span class="meta-value">{{
                formatEventType(item.eventType)
              }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">分值</span>
              <span class="meta-value">{{ item.scoreDelta }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">关键词</span>
              <span class="meta-value">
                <Tag
                  v-for="kw in item.keywordJson.slice(0, 3)"
                  :key="kw"
                  color="blue"
                >
                  {{ kw }}
                </Tag>
                <span
                  v-if="item.keywordJson.length > 3"
                  class="text-text-secondary"
                >
                  +{{ item.keywordJson.length - 3 }}
                </span>
              </span>
            </div>
            <div v-if="item.ruleDescription" class="meta-row">
              <span class="meta-label">说明</span>
              <span class="meta-value">{{ item.ruleDescription }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">更新时间</span>
              <span class="meta-value">{{
                formatDateOnly(item.updateTime)
              }}</span>
            </div>
          </div>
          <div class="radar-card-actions">
            <Button
              size="small"
              class="radar-action-btn"
              @click="openEdit(item)"
            >
              <EditOutlined class="mr-1 h-4 w-4" />
              编辑
            </Button>
            <Button
              size="small"
              class="radar-action-btn"
              :danger="item.enabled"
              :type="item.enabled ? 'default' : 'primary'"
              :loading="togglingRuleId === item.ruleId"
              @click="toggleRule(item)"
            >
              <PoweroffOutlined class="mr-1 h-4 w-4" />
              {{ item.enabled ? '停用' : '启用' }}
            </Button>
          </div>
        </Card>
      </div>
      <Empty v-else class="radar-mobile-empty" description="暂无评分规则" />
    </Spin>

    <Drawer
      v-model:open="editOpen"
      destroy-on-close
      title="编辑评分规则"
      placement="right"
      width="100%"
    >
      <Form layout="vertical">
        <Form.Item label="启用状态">
          <Switch v-model:checked="editForm.enabled" />
        </Form.Item>
        <Form.Item label="分值">
          <InputNumber
            v-model:value="editForm.scoreDelta"
            class="w-full"
            :max="100"
            :min="-100"
          />
        </Form.Item>
        <Form.Item label="关键词">
          <Input.TextArea
            v-model:value="editForm.keywordJson"
            :auto-size="{ minRows: 3, maxRows: 6 }"
            :placeholder="scoreKeywordPlaceholder"
          />
        </Form.Item>
        <Form.Item label="说明">
          <Input.TextArea
            v-model:value="editForm.ruleDescription"
            :auto-size="{ minRows: 2, maxRows: 4 }"
            placeholder="规则说明"
          />
        </Form.Item>
      </Form>
      <div class="radar-drawer-actions">
        <Button type="primary" :loading="saving" @click="saveRule">
          保存
        </Button>
        <Button @click="editOpen = false">取消</Button>
      </div>
    </Drawer>
  </div>
</template>

<style scoped>
.radar-mobile-page {
  box-sizing: border-box;
  min-height: 100%;
  padding: 10px 8px calc(88px + env(safe-area-inset-bottom));
  background: #f0f2f5;
}

.dark .radar-mobile-page {
  background: #1a1a1a;
}

.radar-mobile-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px;
  margin-bottom: 8px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
}

.dark .radar-mobile-header {
  background: #2d2d2d;
}

.radar-mobile-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 26px;
  color: var(--ant-color-text);
}

.radar-mobile-header p {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.radar-mobile-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.radar-mobile-alert {
  margin-bottom: 8px;
}

.radar-mobile-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.overview-item {
  min-width: 0;
  padding: 9px 8px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
}

.dark .overview-item {
  background: #2d2d2d;
}

.overview-item span {
  display: block;
  overflow: hidden;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-item strong {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  font-size: 17px;
  line-height: 24px;
  color: var(--ant-color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.radar-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.radar-mobile-card {
  overflow: hidden;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.dark .radar-mobile-card {
  background: #2d2d2d;
}

.radar-mobile-card :deep(.ant-card-body) {
  padding: 13px !important;
}

.radar-card-head {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
  min-width: 0;
}

.radar-card-head > div:first-child {
  min-width: 0;
}

.radar-card-title {
  font-size: 16px;
  font-weight: 700;
  line-height: 23px;
  color: var(--ant-color-text);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.radar-card-subtitle {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.radar-card-meta {
  margin-top: 10px;
}

.meta-row {
  display: flex;
  gap: 8px;
  min-width: 0;
  margin-bottom: 6px;
}

.meta-row:last-child {
  margin-bottom: 0;
}

.meta-label {
  flex-shrink: 0;
  min-width: 70px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.meta-value {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.meta-value :deep(.ant-tag) {
  max-width: 100%;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: top;
}

.radar-card-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding-top: 10px;
  margin-top: 12px;
  border-top: 1px solid var(--ant-color-border);
}

.radar-action-btn {
  justify-content: center;
  min-width: 0;
  height: auto;
  min-height: 32px;
  white-space: normal;
}

.radar-action-btn :deep(span) {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: normal;
}

.radar-drawer-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 16px;
}

.radar-drawer-actions button {
  width: 100%;
}

.radar-mobile-empty {
  padding: 32px 0;
}

@media (max-width: 420px) {
  .radar-mobile-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
