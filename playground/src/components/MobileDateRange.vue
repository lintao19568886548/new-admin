<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import { ref, watch } from 'vue';

import { DatePicker } from 'ant-design-vue';
import dayjs from 'dayjs';

const props = withDefaults(
  defineProps<{
    allowClear?: boolean;
    disabled?: boolean;
    format?: string;
    placeholderEnd?: string;
    placeholderStart?: string;
    size?: 'large' | 'middle' | 'small';
    value?: [Dayjs | undefined, Dayjs | undefined];
  }>(),
  {
    allowClear: true,
    disabled: false,
    format: 'YYYY-MM-DD',
    placeholderEnd: '结束日期',
    placeholderStart: '开始日期',
    size: 'middle',
    value: () => [undefined, undefined],
  },
);

const emit = defineEmits<{
  (e: 'update:value', v: [Dayjs | undefined, Dayjs | undefined]): void;
}>();

const start = ref<Dayjs | undefined>();
const end = ref<Dayjs | undefined>();

watch(
  () => props.value,
  (v) => {
    start.value = v?.[0];
    end.value = v?.[1];
  },
  { deep: true, immediate: true },
);

function syncEmit() {
  let s = start.value;
  let e = end.value;
  if (s && e && s.isAfter(e)) {
    const tmp = s;
    s = e;
    e = tmp;
    start.value = s;
    end.value = e;
  }
  emit('update:value', [s, e]);
}

function onStartChange(value: Dayjs | string, _dateString: string) {
  let v: Dayjs | undefined;
  if (typeof value === 'string') {
    v = value ? dayjs(value) : undefined;
  } else {
    v = value ?? undefined;
  }
  start.value = v;
  syncEmit();
}

function onEndChange(value: Dayjs | string, _dateString: string) {
  let v: Dayjs | undefined;
  if (typeof value === 'string') {
    v = value ? dayjs(value) : undefined;
  } else {
    v = value ?? undefined;
  }
  end.value = v;
  syncEmit();
}

function disableStart(d: Dayjs) {
  return end.value ? d.isAfter(end.value, 'day') : false;
}

function disableEnd(d: Dayjs) {
  return start.value ? d.isBefore(start.value, 'day') : false;
}
</script>

<template>
  <div class="mobile-date-range">
    <DatePicker
      :disabled="props.disabled"
      :value="start"
      :format="props.format"
      :size="props.size"
      :allow-clear="props.allowClear"
      :placeholder="props.placeholderStart"
      :disabled-date="disableStart"
      input-read-only
      class="picker"
      @change="onStartChange"
    />
    <span class="range-separator">至</span>
    <DatePicker
      :disabled="props.disabled"
      :value="end"
      :format="props.format"
      :size="props.size"
      :allow-clear="props.allowClear"
      :placeholder="props.placeholderEnd"
      :disabled-date="disableEnd"
      input-read-only
      class="picker"
      @change="onEndChange"
    />
  </div>
</template>

<style scoped>
.mobile-date-range {
  display: flex;
  gap: 8px;
  align-items: center;
}

.picker {
  flex: 1;
}

.range-separator {
  color: #999;
}
</style>
