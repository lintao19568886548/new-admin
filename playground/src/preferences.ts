import { defineOverridesPreferences } from '@vben/preferences';

/**
 * @description 项目配置文件
 * 只需要覆盖项目中的一部分配置，不需要的配置不用覆盖，会自动使用默认配置
 * !!! 更改配置后请清空缓存，否则可能不生效
 */
export const overridesPreferences = defineOverridesPreferences({
  // overrides
  app: {
    accessMode: 'backend',
    enableRefreshToken: true,
    name: import.meta.env.VITE_APP_TITLE,
  },
  breadcrumb: {
    showHome: true,
  },
  copyright: {
    companyName: '东莞市宜租网络科技有限公司',
    companySiteLink: 'https://kwzg.yizuw.cn',
    date: '2025',
    enable: true,
    icp: '粤ICP备2025409677号-2A',
    icpLink: 'https://beian.miit.gov.cn/',
    settingShow: true,
  },
  logo: {
    source: '/assets/favicon.png',
  },
  tabbar: {
    middleClickToClose: true,
  },
  theme: {
    mode: 'auto',
  },
  widget: {
    lockScreen: false,
  },
});
