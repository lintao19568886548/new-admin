<script setup lang="ts">
import { Page } from '@vben/common-ui';

import { Alert, Card, Tag } from 'ant-design-vue';

defineOptions({ name: 'AgentTaskCenter' });
</script>

<template>
  <Page auto-content-height>
    <div class="space-y-4 p-4">
      <Alert
        message="任务中心本地调试入口"
        description="当前页面用于本地补齐 Agent 菜单和路由，后续接入任务列表、任务状态、步骤日志、审批和审计数据。"
        show-icon
        type="info"
      />
      <Card size="small" title="当前范围">
        <div class="flex flex-wrap gap-2">
          <Tag color="blue">本地开发</Tag>
          <Tag color="processing">Agent任务</Tag>
          <Tag color="default">线上隐藏</Tag>
        </div>
      </Card>
    </div>
  </Page>
</template>
