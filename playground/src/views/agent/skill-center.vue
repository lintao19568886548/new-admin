<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type { AgentRiskLevel, AgentSkill } from '#/api/agent';

import { computed, h, onMounted, ref } from 'vue';

import { Page, VbenIcon } from '@vben/common-ui';

import { Button, Card, message, Statistic, Table, Tag } from 'ant-design-vue';

import { getAgentSkillListApi } from '#/api/agent';

defineOptions({ name: 'AgentSkillCenter' });

const loading = ref(false);
const skills = ref<AgentSkill[]>([]);

const tableLocale = {
  emptyText: '暂无 Agent Skill',
};

const summaryItems = computed(() => [
  {
    icon: 'lucide:blocks',
    title: 'Skill 总数',
    value: skills.value.length,
  },
  {
    icon: 'lucide:circle-check',
    title: '已启用',
    value: skills.value.filter((item) => item.enabled).length,
  },
  {
    icon: 'lucide:shield-alert',
    title: '需审批',
    value: skills.value.filter((item) => item.requiresApproval).length,
  },
  {
    icon: 'lucide:triangle-alert',
    title: '高风险',
    value: skills.value.filter((item) => item.riskLevel === 'high').length,
  },
]);

function getRiskColor(riskLevel: AgentRiskLevel) {
  const riskMap: Record<AgentRiskLevel, string> = {
    high: 'red',
    low: 'green',
    medium: 'orange',
  };
  return riskMap[riskLevel] || 'default';
}

function getRiskText(riskLevel: AgentRiskLevel) {
  const riskMap: Record<AgentRiskLevel, string> = {
    high: '高',
    low: '低',
    medium: '中',
  };
  return riskMap[riskLevel] || riskLevel;
}

async function loadSkills() {
  loading.value = true;
  try {
    const result = await getAgentSkillListApi();
    skills.value = result.items;
  } catch (error) {
    console.error('load agent skills failed:', error);
    message.error('Agent Skill 加载失败');
  } finally {
    loading.value = false;
  }
}

const columns: TableColumnsType<AgentSkill> = [
  {
    dataIndex: 'title',
    key: 'title',
    title: 'Skill',
    width: 180,
  },
  {
    dataIndex: 'name',
    key: 'name',
    title: '标识',
    width: 220,
  },
  {
    customRender: ({ record }) =>
      h(Tag, { color: getRiskColor(record.riskLevel) }, () =>
        getRiskText(record.riskLevel),
      ),
    dataIndex: 'riskLevel',
    key: 'riskLevel',
    title: '风险',
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
    customRender: ({ record }) =>
      h(Tag, { color: record.requiresApproval ? 'orange' : 'default' }, () =>
        record.requiresApproval ? '需要' : '不需要',
      ),
    dataIndex: 'requiresApproval',
    key: 'requiresApproval',
    title: '审批',
    width: 100,
  },
  {
    customRender: ({ record }) => record.permissionCode || '-',
    dataIndex: 'permissionCode',
    key: 'permissionCode',
    title: '权限码',
    width: 200,
  },
  {
    customRender: ({ record }) => record.description || '-',
    dataIndex: 'description',
    ellipsis: true,
    key: 'description',
    title: '说明',
    width: 320,
  },
];

onMounted(() => {
  void loadSkills();
});
</script>

<template>
  <Page auto-content-height title="Agent Skill 中心">
    <div class="agent-skill-center">
      <div class="mb-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card v-for="item in summaryItems" :key="item.title" size="small">
          <div class="flex items-center gap-3">
            <span
              class="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <VbenIcon :icon="item.icon" class="text-xl" />
            </span>
            <Statistic :title="item.title" :value="item.value" />
          </div>
        </Card>
      </div>

      <Card class="agent-skill-table-card" size="small" title="Skill 列表">
        <template #extra>
          <Button :loading="loading" size="small" @click="loadSkills">
            刷新
          </Button>
        </template>
        <Table
          bordered
          :columns="columns"
          :data-source="skills"
          :loading="loading"
          :locale="tableLocale"
          :pagination="false"
          row-key="name"
          :scroll="{ x: 1200 }"
          size="small"
        />
      </Card>
    </div>
  </Page>
</template>

<style lang="less" scoped>
.agent-skill-center {
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 16px;
}

.agent-skill-table-card {
  flex: none;
}

:deep(.ant-table-thead > tr > th) {
  color: var(--ant-color-text);
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  vertical-align: middle;
}

:deep(.ant-table-tbody > tr > td) {
  color: var(--ant-color-text);
  font-size: 14px;
  line-height: 22px;
  text-align: center;
  vertical-align: middle;
}
</style>
