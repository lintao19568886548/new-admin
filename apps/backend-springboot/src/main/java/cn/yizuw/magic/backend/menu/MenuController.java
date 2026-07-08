package cn.yizuw.magic.backend.menu;

import cn.yizuw.magic.backend.common.ApiResponse;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MenuController {

  private final MenuService menuService;

  public MenuController(MenuService menuService) {
    this.menuService = menuService;
  }

  @GetMapping("/menu/all")
  public ApiResponse<List<MenuResponse>> all() {
    return ApiResponse.ok(menuService.getCurrentRouteMenus());
  }

  @GetMapping("/menu/by-parent-role")
  public ApiResponse<List<MenuResponse>> byParentRole(
      @RequestParam(required = false) Integer parentRoleId) {
    return ApiResponse.ok(menuService.getMenusByParentRole(parentRoleId));
  }
}
