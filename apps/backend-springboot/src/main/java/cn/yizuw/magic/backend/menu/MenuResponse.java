package cn.yizuw.magic.backend.menu;

import java.time.LocalDateTime;
import java.util.List;

public record MenuResponse(
    String activePath,
    String authCode,
    List<MenuResponse> children,
    String code,
    String codeName,
    String component,
    Integer id,
    MenuMetaResponse meta,
    Integer menuId,
    String name,
    String path,
    Integer pid,
    String redirect,
    LocalDateTime templateDeletedAt,
    Boolean templateInternalOnly,
    String templateKey,
    Boolean templateManaged,
    String templateParentKey,
    Integer templateVersion,
    String type) {}
