package cn.yizuw.magic.backend.system.role;

import cn.yizuw.magic.backend.common.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SystemRoleController {

  private final SystemRoleService systemRoleService;

  public SystemRoleController(SystemRoleService systemRoleService) {
    this.systemRoleService = systemRoleService;
  }

  @GetMapping("/system/role/list")
  public ApiResponse<Object> list(
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String name,
      @RequestParam(required = false) String remark,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String startTime,
      @RequestParam(required = false) String endTime) {
    return ApiResponse.ok(
        systemRoleService.getRoleList(page, pageSize, name, remark, status, startTime, endTime));
  }

  @GetMapping("/system/role/{id}")
  public ApiResponse<Map<String, Object>> detail(@PathVariable int id) {
    return ApiResponse.ok(systemRoleService.getRoleById(id));
  }

  /** 新增系统角色及本地权限/园区关联，并清理当前租户授权缓存。 */
  @PostMapping("/system/role")
  public ApiResponse<Map<String, Object>> create(
      @RequestBody(required = false) RoleCreateRequest request) {
    return ApiResponse.ok(systemRoleService.createRole(request));
  }

  /** 更新系统角色主表、权限和园区范围；暂不覆盖组织角色作用域。 */
  @PutMapping("/system/role/{id}")
  public ApiResponse<Map<String, Object>> update(
      @PathVariable int id, @RequestBody(required = false) RoleUpdateRequest request) {
    return ApiResponse.ok(systemRoleService.updateRole(id, request));
  }

  /** 删除系统角色并清理本地角色关联，旧后端继续保留用于稳定观察。 */
  @DeleteMapping("/system/role/{id}")
  public ApiResponse<Void> delete(@PathVariable int id) {
    systemRoleService.deleteRole(id);
    return ApiResponse.ok(null);
  }

  /** 增量添加角色菜单权限；只写 role_menu，并清理当前租户授权缓存。 */
  @PostMapping("/system/role/{id}/add-permissions")
  public ApiResponse<Void> addPermissions(
      @PathVariable int id, @RequestBody(required = false) RolePermissionsRequest request) {
    systemRoleService.addPermissions(id, request);
    return ApiResponse.ok(null);
  }

  /** 增量移除角色菜单权限；保持旧接口软删 role_menu 的行为。 */
  @PostMapping("/system/role/{id}/remove-permissions")
  public ApiResponse<Void> removePermissions(
      @PathVariable int id, @RequestBody(required = false) RolePermissionsRequest request) {
    systemRoleService.removePermissions(id, request);
    return ApiResponse.ok(null);
  }

  /** 绑定角色权限码；只写 role_code 关联，不重算组织角色范围。 */
  @PostMapping("/system/role/code")
  public ApiResponse<Map<String, Object>> bindCode(
      @RequestBody(required = false) RoleCodeRequest request) {
    return ApiResponse.ok(systemRoleService.bindRoleCode(request));
  }

  /** 删除角色权限码绑定，返回旧接口兼容的 deletedCount。 */
  @DeleteMapping("/system/role/code")
  public ApiResponse<Map<String, Object>> unbindCode(
      @RequestBody(required = false) RoleCodeRequest request) {
    return ApiResponse.ok(systemRoleService.unbindRoleCode(request));
  }
}
