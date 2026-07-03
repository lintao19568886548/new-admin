import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:gauge',
      order: -1,
      title: $t('智能抄表'),
    },
    name: 'SmartMeter',
    path: '/smart-meter',
    children: [
      {
        component: () => import('#/views/smart-meter/meter/list.vue'),
        meta: {
          icon: 'mdi:flash',
          isApp: true,
          title: $t('电表抄表数据'),
        },
        name: 'SmartMeterElectricReading',
        path: 'meter',
      },
      {
        component: () => import('#/views/smart-meter/water/list.vue'),
        meta: {
          icon: 'mdi:water',
          isApp: true,
          title: $t('水表抄表数据'),
        },
        name: 'SmartMeterWaterReading',
        path: 'water',
      },
      {
        component: () => import('#/views/smart-meter/reading/mobile.vue'),
        meta: {
          hideMenu: true,
          icon: 'mdi:cellphone-text',
          title: $t('水电表抄表数据'),
        },
        name: 'SmartMeterReadingMobile',
        path: 'reading/mobile',
      },
      {
        component: () => import('#/views/smart-meter/brand/responsive.vue'),
        meta: {
          icon: 'mdi:flash-triangle',
          isApp: true,
          title: $t('电表品牌管理'),
        },
        name: 'ElectricMeterBrand',
        path: 'electric-brand',
        props: {
          meterType: 'electric',
        },
      },
      {
        component: () => import('#/views/smart-meter/brand/mobile.vue'),
        meta: {
          hideMenu: true,
          icon: 'mdi:cellphone-cog',
          title: $t('电表品牌管理'),
        },
        name: 'ElectricMeterBrandMobile',
        path: 'electric-brand/mobile',
        props: {
          meterType: 'electric',
        },
      },
      {
        component: () => import('#/views/smart-meter/brand/responsive.vue'),
        meta: {
          icon: 'mdi:water-check',
          isApp: true,
          title: $t('水表品牌管理'),
        },
        name: 'WaterMeterBrand',
        path: 'water-brand',
        props: {
          meterType: 'water',
        },
      },
      {
        component: () => import('#/views/smart-meter/brand/mobile.vue'),
        meta: {
          hideMenu: true,
          icon: 'mdi:cellphone-cog',
          title: $t('水表品牌管理'),
        },
        name: 'WaterMeterBrandMobile',
        path: 'water-brand/mobile',
        props: {
          meterType: 'water',
        },
      },
    ],
  },
];

export default routes;
