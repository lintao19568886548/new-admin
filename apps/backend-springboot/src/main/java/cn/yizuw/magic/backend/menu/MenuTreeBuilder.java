package cn.yizuw.magic.backend.menu;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
class MenuTreeBuilder {

  public List<MenuResponse> buildTree(List<MenuRow> rows, MenuTreeOptions options) {
    Map<Integer, MutableMenu> byId = new LinkedHashMap<>();
    for (MenuRow row : rows) {
      byId.put(row.menuId(), new MutableMenu(row));
    }

    List<MutableMenu> roots = new ArrayList<>();
    for (MutableMenu menu : byId.values()) {
      Integer pid = menu.row.pid();
      if (pid == null || !byId.containsKey(pid)) {
        roots.add(menu);
      } else {
        byId.get(pid).children.add(menu);
      }
    }

    return roots.stream().map(menu -> toResponse(menu, options)).toList();
  }

  private MenuResponse toResponse(MutableMenu menu, MenuTreeOptions options) {
    MenuRow row = menu.row;
    List<MenuResponse> children = menu.children.stream().map(child -> toResponse(child, options)).toList();
    List<MenuResponse> visibleChildren =
        options.removeEmptyChildren() && children.isEmpty() ? null : children;
    MenuMetaResponse meta = toMeta(row, options);
    return new MenuResponse(
        normalize(row.activePath(), options.removeEmptyFields()),
        normalize(row.authCode(), options.removeEmptyFields()),
        visibleChildren,
        normalize(row.code(), options.removeEmptyFields()),
        normalize(row.codeName(), options.removeEmptyFields()),
        normalize(row.component(), options.removeEmptyFields()),
        options.includeSystemFields() ? row.menuId() : null,
        meta,
        options.includeSystemFields() ? row.menuId() : null,
        row.name(),
        row.path(),
        options.includeSystemFields() ? row.pid() : null,
        normalize(row.redirect(), options.removeEmptyFields()),
        options.includeSystemFields() ? row.templateDeletedAt() : null,
        options.includeSystemFields() ? row.templateInternalOnly() : null,
        options.includeSystemFields() ? normalize(row.templateKey(), options.removeEmptyFields()) : null,
        options.includeSystemFields() ? row.templateManaged() : null,
        options.includeSystemFields()
            ? normalize(row.templateParentKey(), options.removeEmptyFields())
            : null,
        options.includeSystemFields() ? row.templateVersion() : null,
        row.type());
  }

  private MenuMetaResponse toMeta(MenuRow row, MenuTreeOptions options) {
    MenuMetaResponse meta =
            new MenuMetaResponse(
            normalize(row.activeIcon(), options.removeEmptyFields()),
            normalize(row.metaActivePath(), options.removeEmptyFields()),
            row.affixTab(),
            row.affixTabOrder(),
            normalize(row.badge(), options.removeEmptyFields()),
            normalize(row.badgeType(), options.removeEmptyFields()),
            normalize(row.badgeVariants(), options.removeEmptyFields()),
            normalize(row.color(), options.removeEmptyFields()),
            row.hideChildrenInMenu(),
            row.hideInBreadcrumb(),
            row.hideInMenu(),
            row.hideInTab(),
            normalize(row.icon(), options.removeEmptyFields()),
            normalize(row.iframeSrc(), options.removeEmptyFields()),
            row.isApp(),
            row.keepAlive(),
            normalize(row.link(), options.removeEmptyFields()),
            row.maxNumOfOpenTab(),
            row.noBasicLayout(),
            row.openInNewWindow(),
            row.order(),
            normalize(row.title(), options.removeEmptyFields()));
    return meta;
  }

  private String normalize(String value, boolean removeEmptyFields) {
    if (!removeEmptyFields) {
      return value;
    }
    return StringUtils.hasText(value) ? value : null;
  }

  private static final class MutableMenu {
    private final List<MutableMenu> children = new ArrayList<>();
    private final MenuRow row;

    private MutableMenu(MenuRow row) {
      this.row = row;
    }
  }

  record MenuTreeOptions(
      boolean includeSystemFields, boolean removeEmptyChildren, boolean removeEmptyFields) {}
}
