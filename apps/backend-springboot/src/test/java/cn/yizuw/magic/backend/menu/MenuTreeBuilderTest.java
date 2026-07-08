package cn.yizuw.magic.backend.menu;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class MenuTreeBuilderTest {

  @Test
  void buildTreeUsesMenuMetaFieldsAndKeepsSystemIdsWhenRequested() {
    MenuTreeBuilder builder = new MenuTreeBuilder();

    List<MenuResponse> result =
        builder.buildTree(
            List.of(
                new MenuRow(
                    "active-icon",
                    "/menu-active",
                    true,
                    1,
                    "system:menu:list",
                    "",
                    null,
                    null,
                    "system:menu:list",
                    "菜单列表",
                    null,
                    "/system/menu/list",
                    null,
                    null,
                    false,
                    null,
                    "lucide:menu",
                    null,
                    false,
                    true,
                    null,
                    "/meta-active",
                    null,
                    1,
                    "SystemMenu",
                    false,
                    false,
                    5,
                    "/system/menu",
                    null,
                    null,
                    1,
                    null,
                    false,
                    "system-menu",
                    true,
                    "system",
                    1,
                    "菜单管理",
                    "menu")),
            new MenuTreeBuilder.MenuTreeOptions(true, true, true));

    assertThat(result).hasSize(1);
    MenuResponse menu = result.get(0);
    assertThat(menu.menuId()).isEqualTo(1);
    assertThat(menu.meta().title()).isEqualTo("菜单管理");
    assertThat(menu.meta().activePath()).isEqualTo("/meta-active");
    assertThat(menu.children()).isNull();
  }
}
