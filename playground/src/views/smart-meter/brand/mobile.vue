<script lang="ts" setup>
import type { MeterType } from '#/api/smart-meter';

import { computed } from 'vue';

import {
  createMeterBrand,
  deleteMeterBrand,
  getMeterBrandList,
  updateMeterBrand,
} from '#/api/smart-meter';
import MobileBrandList from '#/components/MobileBrandList.vue';

import { BRAND_DEFAULT_OPTIONS, BRAND_ENABLED_OPTIONS } from './data';

const props = withDefaults(
  defineProps<{
    meterType?: MeterType;
  }>(),
  {
    meterType: 'electric',
  },
);

const pageLabel = computed(() =>
  props.meterType === 'water' ? '水表品牌' : '电表品牌',
);
</script>

<template>
  <MobileBrandList
    action-key="meter_brand_mobile_action"
    :create-api="createMeterBrand"
    :default-form-data="{
      enabled: true,
      isDefault: false,
      meterType,
    }"
    :default-options="BRAND_DEFAULT_OPTIONS"
    :delete-api="deleteMeterBrand"
    :enabled-options="BRAND_ENABLED_OPTIONS"
    :fixed-params="{ meterType }"
    :item-label="pageLabel"
    :list-api="getMeterBrandList"
    row-key="meterBrandId"
    :update-api="updateMeterBrand"
  />
</template>
