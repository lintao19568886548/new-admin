import type { Locale } from 'ant-design-vue/es/locale';

import type { App } from 'vue';

import type { LocaleSetupOptions, SupportedLanguagesType } from '@vben/locales';

import { ref } from 'vue';

import {
  $t,
  setupI18n as coreSetup,
  loadLocalesMapFromDir,
} from '@vben/locales';
import { preferences } from '@vben/preferences';

import antdEnLocale from 'ant-design-vue/es/locale/en_US';
import antdDefaultLocale from 'ant-design-vue/es/locale/zh_CN';
import dayjs from 'dayjs';

const antdLocale = ref<Locale>(antdDefaultLocale);

const modules = import.meta.glob('./langs/**/*.json');
const sharedModules = import.meta.glob(
  '../../../packages/locales/src/langs/**/*.json',
);

const localesMap = loadLocalesMapFromDir(
  /\.\/langs\/([^/]+)\/(.*)\.json$/,
  modules,
);
const sharedLocalesMap = loadLocalesMapFromDir(
  /\.\.\/\.\.\/\.\.\/packages\/locales\/src\/langs\/([^/]+)\/(.*)\.json$/,
  sharedModules,
);

function isLocaleObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeLocaleMessages(
  ...sources: Array<Record<string, any> | undefined>
) {
  const target: Record<string, any> = {};

  const mergeInto = (
    destination: Record<string, any>,
    source: Record<string, any>,
  ) => {
    for (const [key, value] of Object.entries(source)) {
      if (isLocaleObject(value) && isLocaleObject(destination[key])) {
        mergeInto(destination[key], value);
      } else if (isLocaleObject(value)) {
        destination[key] = mergeLocaleMessages(value);
      } else {
        destination[key] = value;
      }
    }
  };

  for (const source of sources) {
    if (source) {
      mergeInto(target, source);
    }
  }

  return target;
}
/**
 * 加载应用特有的语言包
 * 这里也可以改造为从服务端获取翻译数据
 * @param lang
 */
async function loadMessages(lang: SupportedLanguagesType) {
  const [sharedLocaleMessages, appLocaleMessages] = await Promise.all([
    sharedLocalesMap[lang]?.(),
    localesMap[lang]?.(),
    loadThirdPartyMessage(lang),
  ]);
  return mergeLocaleMessages(
    sharedLocaleMessages?.default,
    appLocaleMessages?.default,
  );
}

/**
 * 加载第三方组件库的语言包
 * @param lang
 */
async function loadThirdPartyMessage(lang: SupportedLanguagesType) {
  await Promise.all([loadAntdLocale(lang), loadDayjsLocale(lang)]);
}

/**
 * 加载dayjs的语言包
 * @param lang
 */
async function loadDayjsLocale(lang: SupportedLanguagesType) {
  let locale;
  switch (lang) {
    case 'en-US': {
      locale = await import('dayjs/locale/en');
      break;
    }
    case 'zh-CN': {
      locale = await import('dayjs/locale/zh-cn');
      break;
    }
    // 默认使用英语
    default: {
      locale = await import('dayjs/locale/en');
    }
  }
  if (locale) {
    dayjs.locale(locale);
  } else {
    console.error(`Failed to load dayjs locale for ${lang}`);
  }
}

/**
 * 加载antd的语言包
 * @param lang
 */
async function loadAntdLocale(lang: SupportedLanguagesType) {
  switch (lang) {
    case 'en-US': {
      antdLocale.value = antdEnLocale;
      break;
    }
    case 'zh-CN': {
      antdLocale.value = antdDefaultLocale;
      break;
    }
  }
}

async function setupI18n(app: App, options: LocaleSetupOptions = {}) {
  await coreSetup(app, {
    defaultLocale: preferences.app.locale,
    loadMessages,
    missingWarn: !import.meta.env.PROD,
    ...options,
  });
}

export { $t, antdLocale, setupI18n };
