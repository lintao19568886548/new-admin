<script setup lang="ts">
import { Page } from '@vben/common-ui';

import { Alert, Card, Tag } from 'ant-design-vue';

defineOptions({ name: 'AgentModelConfig' });
</script>

<template>
  <Page auto-content-height>
    <div class="space-y-4 p-4">
      <Alert
        message="模型配置本地调试入口"
        description="当前页面用于本地补齐 Agent 模型配置菜单和路由，后续接入模型供应商、默认模型、温度参数和密钥脱敏配置。"
        show-icon
        type="info"
      />
      <Card size="small" title="当前范围">
        <div class="flex flex-wrap gap-2">
          <Tag color="blue">本地开发</Tag>
          <Tag color="processing">模型配置</Tag>
          <Tag color="default">线上隐藏</Tag>
        </div>
      </Card>
    </div>
  </Page>
</template>
