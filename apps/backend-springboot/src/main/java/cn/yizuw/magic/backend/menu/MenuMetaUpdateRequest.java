package cn.yizuw.magic.backend.menu;

/** 系统菜单 meta 更新请求；字段与旧 Nitro 的 menu_meta 表字段保持兼容。 */
public record MenuMetaUpdateRequest(
    Object activeIcon,
    Object activePath,
    Object affixTab,
    Object affixTabOrder,
    Object badge,
    Object badgeType,
    Object badgeVariants,
    Object color,
    Object hideChildrenInMenu,
    Object hideInBreadcrumb,
    Object hideInMenu,
    Object hideInTab,
    Object icon,
    Object iframeSrc,
    Object isApp,
    Object keepAlive,
    Object link,
    Object maxNumOfOpenTab,
    Object noBasicLayout,
    Object openInNewWindow,
    Object order,
    Object title) {}
