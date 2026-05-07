<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '@vben-core/shadcn-ui';

interface Props {
  title: string;
}

defineOptions({
  name: 'AnalysisChartCard',
});

withDefaults(defineProps<Props>(), {});
</script>

<template>
  <Card>
    <CardHeader
      class="gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <CardTitle class="text-xl">{{ title }}</CardTitle>
      <div v-if="$slots.extra" class="w-full sm:w-auto">
        <slot name="extra"></slot>
      </div>
    </CardHeader>
    <CardContent>
      <slot></slot>
    </CardContent>
  </Card>
</template>
