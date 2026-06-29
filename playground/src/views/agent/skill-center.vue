<script setup lang="ts">
import { Page } from '@vben/common-ui';

import { Alert, Card, Tag } from 'ant-design-vue';

defineOptions({ name: 'AgentSkillCenter' });
</script>

<template>
  <Page auto-content-height>
    <div class="space-y-4 p-4">
      <Alert
        message="Skill 中心本地调试入口"
        description="当前页面用于本地补齐 Agent Skill 菜单和路由，后续接入 Skill 列表、风险等级、权限码、启停状态和审批策略。"
        show-icon
        type="info"
      />
      <Card size="small" title="当前范围">
        <div class="flex flex-wrap gap-2">
          <Tag color="blue">本地开发</Tag>
          <Tag color="processing">Skill管理</Tag>
          <Tag color="default">线上隐藏</Tag>
        </div>
      </Card>
    </div>
  </Page>
</template>
