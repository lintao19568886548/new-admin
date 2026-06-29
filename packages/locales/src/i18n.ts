import type { App } from 'vue';
import type { Locale } from 'vue-i18n';

import type {
  ImportLocaleFn,
  LoadMessageFn,
  LocaleSetupOptions,
  SupportedLanguagesType,
} from './typing';

import { unref } from 'vue';
import { createI18n } from 'vue-i18n';

import { useSimpleLocale } from '@vben-core/composables';

import enUSAuthentication from './langs/en-US/authentication.json';
import enUSCommon from './langs/en-US/common.json';
import enUSPreferences from './langs/en-US/preferences.json';
import enUSUi from './langs/en-US/ui.json';
import zhCNAuthentication from './langs/zh-CN/authentication.json';
import zhCNCommon from './langs/zh-CN/common.json';
import zhCNPreferences from './langs/zh-CN/preferences.json';
import zhCNUi from './langs/zh-CN/ui.json';

const builtinMessages: Record<SupportedLanguagesType, Record<string, any>> = {
  'en-US': {
    authentication: enUSAuthentication,
    common: enUSCommon,
    preferences: enUSPreferences,
    ui: enUSUi,
  },
  'zh-CN': {
    authentication: zhCNAuthentication,
    common: zhCNCommon,
    preferences: zhCNPreferences,
    ui: zhCNUi,
  },
};

const i18n = createI18n({
  fallbackLocale: 'zh-CN',
  fallbackWarn: false,
  globalInjection: true,
  legacy: false,
  locale: '',
  messages: {},
  missingWarn: false,
});

const modules = import.meta.glob('./langs/**/*.json');

const { setSimpleLocale } = useSimpleLocale();

const localesMap = loadLocalesMapFromDir(
  /\.\/langs\/([^/]+)\/(.*)\.json$/,
  modules,
);
let loadMessages: LoadMessageFn;
const loadedLocales = new Set<SupportedLanguagesType>();

/**
 * Load locale modules
 * @param modules
 */
function loadLocalesMap(modules: Record<string, () => Promise<unknown>>) {
  const localesMap: Record<Locale, ImportLocaleFn> = {};

  for (const [path, loadLocale] of Object.entries(modules)) {
    const key = path.match(/([\w-]*)\.(json)/)?.[1];
    if (key) {
      localesMap[key] = loadLocale as ImportLocaleFn;
    }
  }
  return localesMap;
}

/**
 * Load locale modules with directory structure
 * @param regexp - Regular expression to match language and file names
 * @param modules - The modules object containing paths and import functions
 * @returns A map of locales to their corresponding import functions
 */
function loadLocalesMapFromDir(
  regexp: RegExp,
  modules: Record<string, () => Promise<unknown>>,
): Record<Locale, ImportLocaleFn> {
  const localesRaw: Record<Locale, Record<string, () => Promise<unknown>>> = {};
  const localesMap: Record<Locale, ImportLocaleFn> = {};

  // Iterate over the modules to extract language and file names
  for (const path in modules) {
    const match = path.match(regexp);
    if (match) {
      const [_, locale, fileName] = match;
      if (locale && fileName) {
        if (!localesRaw[locale]) {
          localesRaw[locale] = {};
        }
        if (modules[path]) {
          localesRaw[locale][fileName] = modules[path];
        }
      }
    }
  }

  // Convert raw locale data into async import functions
  for (const [locale, files] of Object.entries(localesRaw)) {
    localesMap[locale] = async () => {
      const messages: Record<string, any> = {};
      for (const [fileName, importFn] of Object.entries(files)) {
        messages[fileName] = ((await importFn()) as any)?.default;
      }
      return { default: messages };
    };
  }

  return localesMap;
}

/**
 * Set i18n language
 * @param locale
 */
function setI18nLanguage(locale: Locale) {
  i18n.global.locale.value = locale;

  document?.querySelector('html')?.setAttribute('lang', locale);
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function resolveMessageValue(messages: Record<string, any>, key: string) {
  let current: unknown = messages;
  for (const segment of key.split('.')) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function getLocaleMessageValue(locale: SupportedLanguagesType, key: string) {
  const loadedMessages = i18n.global.getLocaleMessage(locale);
  const loadedValue = resolveMessageValue(loadedMessages, key);
  if (typeof loadedValue === 'string') {
    return loadedValue;
  }

  const builtinValue = resolveMessageValue(builtinMessages[locale], key);
  return typeof builtinValue === 'string' ? builtinValue : undefined;
}

function normalizeTranslateList(values: unknown[]) {
  if (Array.isArray(values[0])) {
    return values[0];
  }
  return values;
}

function normalizeTranslateNamed(values: unknown[]) {
  const firstValue = values[0];
  return isRecord(firstValue) ? firstValue : undefined;
}

function formatFallbackMessage(message: string, values: unknown[]) {
  const listValues = normalizeTranslateList(values);
  const namedValues = normalizeTranslateNamed(values);

  return message.replaceAll(/\{(\w+)\}/g, (match, key) => {
    if (/^\d+$/.test(key)) {
      const value = listValues[Number(key)];
      return value === undefined ? match : String(value);
    }

    const value = namedValues?.[key];
    return value === undefined ? match : String(value);
  });
}

function getFallbackLocaleMessage(
  key: string,
  values: unknown[] = [],
  fallbackLocales: SupportedLanguagesType[] = ['zh-CN', 'en-US'],
) {
  for (const locale of fallbackLocales) {
    const message = getLocaleMessageValue(locale, key);
    if (message) {
      return formatFallbackMessage(message, values);
    }
  }
}

function translateWithFallback(key: string, ...values: unknown[]) {
  const translated = (i18n.global.t as any)(key, ...values);
  if (translated && translated !== key) {
    return translated;
  }

  return getFallbackLocaleMessage(key, values) || translated || key;
}

function teWithFallback(key: string, locale?: Locale) {
  if ((i18n.global.te as any)(key, locale)) {
    return true;
  }

  const fallbackLocales = [locale, 'zh-CN', 'en-US'].filter(
    (item): item is SupportedLanguagesType =>
      item === 'zh-CN' || item === 'en-US',
  );

  return Boolean(getFallbackLocaleMessage(key, [], fallbackLocales));
}

async function setupI18n(app: App, options: LocaleSetupOptions = {}) {
  const { defaultLocale = 'zh-CN' } = options;
  // app可以自行扩展一些第三方库和组件库的国际化
  loadMessages = options.loadMessages || (async () => ({}));
  app.use(i18n);
  await loadLocaleMessages(defaultLocale);
  const globalProperties = app.config.globalProperties as Record<
    string,
    unknown
  >;
  globalProperties.$t = translateWithFallback;
  globalProperties.$te = teWithFallback;

  // 在控制台打印警告
  i18n.global.setMissingHandler((locale, key) => {
    const fallbackMessage = getFallbackLocaleMessage(String(key));
    if (fallbackMessage) {
      return fallbackMessage;
    }

    if (options.missingWarn && key.includes('.')) {
      console.warn(
        `[intlify] Not found '${key}' key in '${locale}' locale messages.`,
      );
    }
  });
}

/**
 * Load and merge locale messages without changing current language
 * @param lang
 */
async function loadAndMergeLocaleMessages(lang: SupportedLanguagesType) {
  if (loadedLocales.has(lang)) {
    return;
  }

  const message = await localesMap[lang]?.();

  if (message?.default) {
    i18n.global.setLocaleMessage(lang, message.default);
  }

  const mergeMessage = await loadMessages(lang);
  i18n.global.mergeLocaleMessage(lang, mergeMessage);
  loadedLocales.add(lang);
}

/**
 * Load locale messages
 * @param lang
 */
async function loadLocaleMessages(lang: SupportedLanguagesType) {
  if (unref(i18n.global.locale) === lang) {
    return setI18nLanguage(lang);
  }
  setSimpleLocale(lang);

  await loadAndMergeLocaleMessages('zh-CN');
  if (lang !== 'zh-CN') {
    await loadAndMergeLocaleMessages(lang);
  }

  return setI18nLanguage(lang);
}

export {
  i18n,
  loadLocaleMessages,
  loadLocalesMap,
  loadLocalesMapFromDir,
  setupI18n,
  teWithFallback,
  translateWithFallback,
};
