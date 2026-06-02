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
      'InvestmentRadarFactoryListings',
    ]);
    expect(visibleChildren.map((child: any) => child.meta.activePath)).toEqual([
      '/investment-public-crawl',
      '/investment-public-crawl',
    ]);
  });
});
