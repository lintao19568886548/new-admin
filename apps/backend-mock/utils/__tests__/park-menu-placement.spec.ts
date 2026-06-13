import { describe, expect, it } from 'vitest';

import { normalizeParkManagementMenuPlacement } from '../park-menu-placement';

describe('park menu placement', () => {
  it('moves legacy rental park management into a visible system menu entry', () => {
    const menus = normalizeParkManagementMenuPlacement(
      [
        {
          children: [
            {
              component: '/rental/manage/list',
              meta: {
                hideInMenu: false,
                title: 'page.rental.management',
              },
              name: 'RentalManage',
              path: '/rental/manage/',
              type: 'menu',
            },
          ],
          meta: {
            title: 'page.rental.title',
          },
          name: 'Rental',
          path: '/rental',
          type: 'catalog',
        },
      ],
      {
        includeCompatibilityRoutes: true,
        includeMobileRoute: true,
      },
    );

    const systemMenu = menus.find((menu) => menu.name === 'System');
    const systemParkMenu = systemMenu?.children?.find(
      (menu: any) => menu.name === 'SystemPark',
    );

    expect(systemParkMenu?.path).toBe('/system/park');
    expect(systemParkMenu?.component).toBe('/system/park/list');
    expect(systemParkMenu?.meta.hideInMenu).toBe(false);
  });
});
