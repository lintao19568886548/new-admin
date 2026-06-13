import { describe, expect, it } from 'vitest';

import { appendProfileAuxiliaryRouteMenus } from '../profile-route-menus';

function visibleInvestmentChildren(menus: any[]) {
  const investmentRoot = menus.find(
    (menu) => menu.name === 'InvestmentPublicCrawl',
  );
  return (investmentRoot?.children || []).filter(
    (child: any) => child?.meta?.hideInMenu !== true,
  );
}

describe('profile auxiliary route menus', () => {
  it('appends hidden PC investment agent route under investment root', () => {
    const menus = appendProfileAuxiliaryRouteMenus(
      [
        {
          component: 'BasicLayout',
          meta: {
            title: '招商管理',
          },
          name: 'Investment',
          path: '/investment',
          type: 'menu',
        },
      ],
      {
        investmentScope: 'full',
      },
    );
    const root = menus.find((menu) => menu.name === 'Investment');
    const pcAgentRoute = root?.children?.find(
      (child: any) => child.name === 'InvestmentAgent',
    );

    expect(pcAgentRoute?.path).toBe('/investment/agent');
    expect(pcAgentRoute?.component).toBe('/investment/agent/list');
    expect(pcAgentRoute?.meta.hideInMenu).toBe(true);
    expect(pcAgentRoute?.meta.activePath).toBe('/investment');

    const acquisitionRoute = root?.children?.find(
      (child: any) => child.name === 'CrmQrcodeTest',
    );
    expect(acquisitionRoute?.path).toBe('/crm/qrcode-test');
    expect(acquisitionRoute?.component).toBe('/crm/qrcode-test');
    expect(acquisitionRoute?.meta.hideInMenu).toBe(false);
    expect(acquisitionRoute?.meta.title).toBe('获客推广');
    expect(acquisitionRoute?.meta.activePath).toBe('/investment');
  });

  it('limits non-super investment menu to public crawl entries', () => {
    const menus = appendProfileAuxiliaryRouteMenus([], {
      investmentScope: 'publicCrawlOnly',
    });
    const root = menus.find((menu) => menu.name === 'InvestmentPublicCrawl');
    const visibleChildren = visibleInvestmentChildren(menus);

    expect(root?.path).toBe('/investment-public-crawl');
    expect(root?.redirect).toBe('/investment/radar-factory-listings');
    expect(visibleChildren.map((child: any) => child.name)).toEqual([
      'InvestmentRadarPublicDemands',
      'CrmQrcodeTest',
      'InvestmentRadarFactoryListings',
    ]);
    expect(visibleChildren.map((child: any) => child.meta.activePath)).toEqual([
      '/investment-public-crawl',
      '/investment-public-crawl',
      '/investment-public-crawl',
    ]);
    expect(visibleChildren.map((child: any) => child.meta.title)).toEqual([
      '公开需求采集',
      '获客推广',
      '公开房源采集',
    ]);
  });
});
