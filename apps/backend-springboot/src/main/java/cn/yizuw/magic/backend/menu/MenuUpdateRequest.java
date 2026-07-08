package cn.yizuw.magic.backend.menu;

/** 系统菜单更新请求；只开放旧接口中会写入 menu/menu_meta 的白名单字段。 */
public record MenuUpdateRequest(
    Object activePath,
    Object authCode,
    Object component,
    MenuMetaUpdateRequest meta,
    Object name,
    Object path,
    Object pid,
    Object redirect,
    Object status,
    Object templateInternalOnly,
    Object templateManaged,
    Object type) {}
