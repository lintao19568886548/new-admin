<script lang="ts" setup>
import { computed, onMounted } from 'vue';

import { useAntdDesignTokens } from '@vben/hooks';
import { preferences, usePreferences } from '@vben/preferences';
import '@vben/styles/antd';

import { App as AntdApp, ConfigProvider, message, theme } from 'ant-design-vue';

import { antdLocale } from '#/locales';
import { setupNeutralErrorFeedback } from '#/utils/neutral-feedback';

defineOptions({ name: 'AntdAppProvider' });

const { isDark } = usePreferences();
const { tokens } = useAntdDesignTokens();

const tokenTheme = computed(() => {
  const algorithm = isDark.value
    ? [theme.darkAlgorithm]
    : [theme.defaultAlgorithm];

  if (preferences.app.compact) {
    algorithm.push(theme.compactAlgorithm);
  }

  return {
    algorithm,
    token: tokens,
  };
});

onMounted(() => {
  setupNeutralErrorFeedback();
  message.config({
    top: 'calc(var(--app-safe-area-top) + 8px)',
  });
});
</script>

<template>
  <ConfigProvider :locale="antdLocale" :theme="tokenTheme">
    <AntdApp>
      <slot></slot>
    </AntdApp>
  </ConfigProvider>
</template>

<style>
.ant-app {
  box-sizing: border-box;
}

.is-ios-runtime input,
.is-ios-runtime textarea,
.is-ios-runtime select,
.is-ios-runtime .ant-input,
.is-ios-runtime .ant-input-number-input,
.is-ios-runtime .ant-picker-input > input,
.is-ios-runtime .ant-select-selection-search-input {
  font-size: max(16px, 1em);
}

.is-mobile-runtime .ant-modal {
  max-width: calc(100vw - 24px);
  margin: 0 auto;
}

.is-mobile-runtime .ant-modal-body {
  max-height: calc(
    var(--app-viewport-height) - var(--app-safe-area-top) -
      var(--app-safe-area-bottom) - 128px
  );
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.is-keyboard-open .ant-modal {
  top: max(8px, var(--app-safe-area-top)) !important;
  padding-bottom: var(--app-keyboard-height);
}

.is-keyboard-open .mobile-submit-bar,
.is-keyboard-open .mobile-floating-action,
.is-keyboard-open .ant-float-btn-group,
.is-keyboard-open .ant-float-btn {
  transform: translateY(calc(-1 * var(--app-keyboard-height)));
}

body.is-investment-route .ant-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

body.is-investment-route .ant-btn > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  text-align: center;
}

body.is-investment-route .ant-btn-block > span {
  width: 100%;
}

body.is-investment-route .ant-table-wrapper .ant-table-thead > tr > th,
body.is-investment-route .ant-table-wrapper .ant-table-tbody > tr > td {
  text-align: center;
  vertical-align: middle;
}

body.is-investment-route
  .ant-table-wrapper
  .ant-table.ant-table-bordered
  > .ant-table-container
  > .ant-table-content
  > table
  > thead
  > tr
  > th,
body.is-investment-route
  .ant-table-wrapper
  .ant-table.ant-table-bordered
  > .ant-table-container
  > .ant-table-content
  > table
  > tbody
  > tr
  > td,
body.is-investment-route
  .ant-table-wrapper
  .ant-table.ant-table-bordered
  > .ant-table-container
  > .ant-table-body
  > table
  > thead
  > tr
  > th,
body.is-investment-route
  .ant-table-wrapper
  .ant-table.ant-table-bordered
  > .ant-table-container
  > .ant-table-body
  > table
  > tbody
  > tr
  > td {
  border-inline-end: 1px solid
    var(--ant-color-border-secondary, rgb(217 217 217 / 100%)) !important;
  border-right: 1px solid
    var(--ant-color-border-secondary, rgb(217 217 217 / 100%)) !important;
}

body.is-investment-route .radar-search-form {
  justify-content: flex-start;
  width: 100%;
}

body.is-investment-route .radar-search-form .ant-form-item {
  align-items: center;
}

body.is-investment-route .radar-search-form .ant-input,
body.is-investment-route .radar-search-form .ant-input::placeholder,
body.is-investment-route
  .radar-search-form
  .ant-input-affix-wrapper
  input.ant-input,
body.is-investment-route
  .radar-search-form
  .ant-input-affix-wrapper
  input.ant-input::placeholder,
body.is-investment-route .radar-search-form .ant-select-selection-item,
body.is-investment-route .radar-search-form .ant-select-selection-placeholder,
body.is-investment-route .radar-search-form .ant-select-selection-search-input {
  text-align: left;
}

body.is-investment-route .ant-form:not(.radar-search-form) .ant-input,
body.is-investment-route
  .ant-form:not(.radar-search-form)
  .ant-input::placeholder,
body.is-investment-route
  .ant-form:not(.radar-search-form)
  .ant-input-affix-wrapper
  input.ant-input,
body.is-investment-route
  .ant-form:not(.radar-search-form)
  .ant-input-affix-wrapper
  input.ant-input::placeholder,
body.is-investment-route
  .ant-form:not(.radar-search-form)
  .ant-select-selection-item,
body.is-investment-route
  .ant-form:not(.radar-search-form)
  .ant-select-selection-placeholder,
body.is-investment-route
  .ant-form:not(.radar-search-form)
  .ant-select-selection-search-input {
  text-align: left;
}
</style>
