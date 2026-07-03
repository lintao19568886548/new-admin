<script lang="ts" setup>
import {
  createAccessBrand,
  deleteAccessBrand,
  getAccessBrandList,
  updateAccessBrand,
} from '#/api/access/brand';
import MobileBrandList from '#/components/MobileBrandList.vue';

import {
  ACCESS_BRAND_DEFAULT_OPTIONS,
  ACCESS_BRAND_ENABLED_OPTIONS,
} from './data';
</script>

<template>
  <MobileBrandList
    action-key="access_brand_mobile_action"
    :create-api="createAccessBrand"
    :default-form-data="{ enabled: true, isDefault: false }"
    :default-options="ACCESS_BRAND_DEFAULT_OPTIONS"
    :delete-api="deleteAccessBrand"
    :enabled-options="ACCESS_BRAND_ENABLED_OPTIONS"
    item-label="门禁品牌"
    :list-api="getAccessBrandList"
    row-key="accessBrandId"
    :update-api="updateAccessBrand"
  />
</template>
