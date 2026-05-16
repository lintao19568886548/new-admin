<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type {
  LeadScoreRule,
  LeadScoreRuleUpdatePayload,
} from '#/api/investment';

import { h, onMounted, ref } from 'vue';

import { formatDateTime } from '@vben/utils';

import {
  Alert,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  message,
  Space,
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  getLeadScoreRuleList,
  recalculateDemoLeadScores,
  updateLeadScoreRule,
} from '#/api/investment';

defineOptions({ name: 'InvestmentRadarScoreRules' });

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

const tableLocale = {
  emptyText: '暂无评分规则',
};
const scoreKeywordPlaceholder = '["扩建","新增产线"]';

function formatOptionalTime(value?: null | string) {
  return value ? formatDateTime(value) : '-';
}

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
    throw new Error('keywordJson 必须是字符串数组 JSON');
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
    console.error('load score rules failed:', error);
    message.error('评分规则加载失败');
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
    console.error('save score rule failed:', error);
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
    console.error('recalculate demo scores failed:', error);
    message.error('重算 demo 评分失败');
  } finally {
    recalculating.value = false;
  }
}

const columns: TableColumnsType<LeadScoreRule> = [
  {
    dataIndex: 'ruleCode',
    key: 'ruleCode',
    title: '规则编码',
    width: 190,
  },
  {
    dataIndex: 'ruleName',
    key: 'ruleName',
    title: '规则名称',
    width: 160,
  },
  {
    customRender: ({ record }) => record.eventType || '-',
    dataIndex: 'eventType',
    key: 'eventType',
    title: '事件类型',
    width: 170,
  },
  {
    customRender: ({ record }) =>
      record.keywordJson.length > 0
        ? record.keywordJson.map((item) =>
            h(Tag, { color: 'blue' }, () => item),
          )
        : '-',
    dataIndex: 'keywordJson',
    key: 'keywordJson',
    title: '关键词',
    width: 220,
  },
  {
    dataIndex: 'scoreDelta',
    key: 'scoreDelta',
    title: '分值',
    width: 90,
  },
  {
    customRender: ({ record }) =>
      h(Tag, { color: record.enabled ? 'green' : 'default' }, () =>
        record.enabled ? '启用' : '停用',
      ),
    dataIndex: 'enabled',
    key: 'enabled',
    title: '状态',
    width: 90,
  },
  {
    customRender: ({ record }) => record.ruleDescription || '-',
    dataIndex: 'ruleDescription',
    key: 'ruleDescription',
    title: '说明',
    width: 260,
  },
  {
    customRender: ({ record }) => formatOptionalTime(record.updateTime),
    dataIndex: 'updateTime',
    key: 'updateTime',
    title: '更新时间',
    width: 170,
  },
  {
    customRender: ({ record }) =>
      h(
        Button,
        {
          onClick: () => openEdit(record),
          size: 'small',
          type: 'link',
        },
        () => '编辑',
      ),
    fixed: 'right',
    key: 'operation',
    title: '操作',
    width: 90,
  },
];

onMounted(() => {
  void loadRules();
});
</script>

<template>
  <div class="score-rules-pane">
    <Alert
      class="mb-3"
      message="评分规则基于企业信号事件命中，重算会写入评分拆解并更新雷达潜客分数与优先级。"
      show-icon
      type="info"
    />

    <Card class="score-rule-toolbar">
      <Space wrap>
        <Button :loading="loading" @click="loadRules">刷新规则</Button>
        <Button
          type="primary"
          :loading="recalculating"
          @click="recalculateDemoScores"
        >
          重算 demo lead 评分
        </Button>
        <span v-if="recalculateSummary" class="text-text-secondary text-sm">
          最近重算：候选 {{ recalculateSummary.totalLeadCount }}，完成
          {{ recalculateSummary.recalculatedCount }}
        </span>
      </Space>
    </Card>

    <Card class="score-rule-table-card" title="评分规则">
      <Table
        :columns="columns"
        :data-source="items"
        :loading="loading"
        :locale="tableLocale"
        :pagination="false"
        row-key="ruleId"
        :scroll="{ x: 1350 }"
        size="small"
      />
    </Card>

    <Drawer
      v-model:open="editOpen"
      destroy-on-close
      title="编辑评分规则"
      width="680"
    >
      <Form layout="vertical">
        <Form.Item label="enabled">
          <Switch v-model:checked="editForm.enabled" />
        </Form.Item>
        <Form.Item label="scoreDelta">
          <InputNumber
            v-model:value="editForm.scoreDelta"
            class="w-full"
            :max="100"
            :min="-100"
          />
        </Form.Item>
        <Form.Item label="keywordJson">
          <Input.TextArea
            v-model:value="editForm.keywordJson"
            :auto-size="{ minRows: 3, maxRows: 8 }"
            :placeholder="scoreKeywordPlaceholder"
          />
        </Form.Item>
        <Form.Item label="ruleDescription">
          <Input.TextArea
            v-model:value="editForm.ruleDescription"
            :auto-size="{ minRows: 3, maxRows: 6 }"
          />
        </Form.Item>
      </Form>
      <Space>
        <Button type="primary" :loading="saving" @click="saveRule">
          保存
        </Button>
        <Button @click="editOpen = false">取消</Button>
      </Space>
    </Drawer>
  </div>
</template>

<style lang="less" scoped>
.score-rules-pane {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: auto;
}

.score-rule-toolbar {
  margin-bottom: 12px;
  flex: none;
}

.score-rule-table-card {
  min-height: 0;
  flex: 1;
}
</style>
