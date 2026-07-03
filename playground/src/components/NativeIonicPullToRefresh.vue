<script setup lang="ts">
import type { RefresherCustomEvent } from '@ionic/vue';

import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/vue';

interface Props {
  disabled?: boolean;
  pullFactor?: number;
  pullingIcon?: string;
  pullingText?: string;
  pullMax?: number;
  pullMin?: number;
  refreshingSpinner?:
    | 'bubbles'
    | 'circles'
    | 'circular'
    | 'crescent'
    | 'dots'
    | 'lines'
    | 'lines-sharp'
    | 'lines-sharp-small'
    | 'lines-small';
  refreshingText?: string;
  useNativeRefresher?: boolean;
}

interface Emits {
  (e: 'refresh', complete: () => void): void;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  pullFactor: 1,
  pullingIcon: undefined,
  pullingText: '下拉刷新',
  pullMax: 180,
  pullMin: 60,
  refreshingSpinner: 'circular',
  refreshingText: '正在刷新...',
  useNativeRefresher: true,
});

const emit = defineEmits<Emits>();

function handleRefresh(event: RefresherCustomEvent) {
  emit('refresh', () => {
    event.target.complete();
  });
}
</script>

<template>
  <IonContent class="ion-padding">
    <!-- eslint-disable vue/no-deprecated-slot-attribute -->
    <IonRefresher
      slot="fixed"
      :disabled="disabled"
      :pull-factor="props.useNativeRefresher ? undefined : pullFactor"
      :pull-min="props.useNativeRefresher ? undefined : pullMin"
      :pull-max="props.useNativeRefresher ? undefined : pullMax"
      @ion-refresh="handleRefresh($event)"
    >
      <IonRefresherContent
        :pulling-icon="props.useNativeRefresher ? undefined : pullingIcon"
        :pulling-text="pullingText"
        :refreshing-spinner="refreshingSpinner"
        :refreshing-text="refreshingText"
      />
    </IonRefresher>
    <!-- eslint-enable vue/no-deprecated-slot-attribute -->

    <slot></slot>
  </IonContent>
</template>
