package cn.yizuw.magic.backend.system.menu;

import cn.yizuw.magic.backend.common.ApiResponse;
import cn.yizuw.magic.backend.menu.MenuUpdateRequest;
import cn.yizuw.magic.backend.menu.MenuResponse;
import cn.yizuw.magic.backend.menu.MenuService;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SystemMenuController {

  private final MenuService menuService;

  public SystemMenuController(MenuService menuService) {
    this.menuService = menuService;
  }

  @GetMapping("/system/menu/list")
  public ApiResponse<List<MenuResponse>> list() {
    return ApiResponse.ok(menuService.getSystemMenuList());
  }

  @GetMapping("/system/menu/name-exists")
  public ApiResponse<Boolean> nameExists(
      @org.springframework.web.bind.annotation.RequestParam(required = false) Integer id,
      @org.springframework.web.bind.annotation.RequestParam(required = false) String name) {
    return ApiResponse.ok(menuService.isMenuNameExists(name, id));
  }

  @GetMapping("/system/menu/path-exists")
  public ApiResponse<Boolean> pathExists(
      @org.springframework.web.bind.annotation.RequestParam(required = false) Integer id,
      @org.springframework.web.bind.annotation.RequestParam(required = false) String path) {
    return ApiResponse.ok(menuService.isMenuPathExists(path, id));
  }

  /** 新增系统菜单和 meta；button 类型会同步创建权限码。 */
  @PostMapping("/system/menu")
  public ApiResponse<MenuResponse> create(@RequestBody(required = false) MenuUpdateRequest request) {
    return ApiResponse.ok(menuService.createSystemMenu(request));
  }

  /** 更新系统菜单和 meta；旧接口同步 template 字段到 code 表。 */
  @PutMapping("/system/menu/{id}")
  public ApiResponse<MenuResponse> update(
      @PathVariable int id, @RequestBody(required = false) MenuUpdateRequest request) {
    return ApiResponse.ok(menuService.updateSystemMenu(id, request));
  }

  /** 删除系统菜单，保持旧接口成功时 data 为 null。 */
  @DeleteMapping("/system/menu/{id}")
  public ApiResponse<Void> delete(@PathVariable int id) {
    menuService.deleteSystemMenu(id);
    return ApiResponse.ok(null);
  }
}
