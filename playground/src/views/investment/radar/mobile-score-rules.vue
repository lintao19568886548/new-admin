<script lang="ts" setup>
import type {
  LeadScoreRule,
  LeadScoreRuleUpdatePayload,
} from '#/api/investment';

import { onMounted, ref } from 'vue';

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

function formatKeywordJson(value: string[]) {
  return value.length > 0 ? JSON.stringify(value, null, 2) : '';
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
      <Button type="primary" :loading="loading" @click="loadRules">
        <ReloadOutlined class="mr-1 h-4 w-4" />
        刷新
      </Button>
    </div>

    <Alert
      v-if="recalculateSummary"
      message="最近重算：候选 {{ recalculateSummary.totalLeadCount }}，完成 {{ recalculateSummary.recalculatedCount }}"
      show-icon
      type="info"
    />

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
              <span class="meta-value">{{ item.eventType || '-' }}</span>
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
              @click="openEdit(item)"
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
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.radar-mobile-actions Button {
  flex: 1;
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
}

.radar-card-title {
  font-size: 16px;
  font-weight: 700;
  line-height: 23px;
  color: var(--ant-color-text);
}

.radar-card-subtitle {
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  margin-top: 2px;
}

.radar-card-meta {
  margin-top: 10px;
}

.meta-row {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}

.meta-row:last-child {
  margin-bottom: 0;
}

.meta-label {
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  min-width: 70px;
  flex-shrink: 0;
}

.meta-value {
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
  flex: 1;
  word-break: break-word;
}

.radar-card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--ant-color-border);
}

.radar-action-btn {
  flex: 1;
  justify-content: center;
}

.radar-drawer-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.radar-drawer-actions Button {
  flex: 1;
}

.radar-mobile-empty {
  padding: 32px 0;
}
</style>
