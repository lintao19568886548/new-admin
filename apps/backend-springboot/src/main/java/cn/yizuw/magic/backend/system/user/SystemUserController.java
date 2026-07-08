package cn.yizuw.magic.backend.system.user;

import cn.yizuw.magic.backend.common.ApiResponse;
import cn.yizuw.magic.backend.common.PageResult;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 系统用户账号接口，按旧 Nitro `/api/user*` 路由逐步迁移。 */
@RestController
public class SystemUserController {

  private final SystemUserService systemUserService;

  public SystemUserController(SystemUserService systemUserService) {
    this.systemUserService = systemUserService;
  }

  @GetMapping("/user/list")
  public ApiResponse<PageResult<Map<String, Object>>> list(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String phone,
      @RequestParam(required = false) String realName,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String username) {
    return ApiResponse.ok(
        systemUserService.getUserList(currentPage, pageSize, phone, realName, status, username));
  }

  /** 新增租户账号，并同步中心库账号和租户映射。 */
  @PostMapping("/user")
  public ApiResponse<Map<String, Object>> create(@RequestBody UserWriteRequest request) {
    return ApiResponse.ok(systemUserService.createUser(request));
  }

  /** 更新租户账号基础资料、角色和园区范围。 */
  @PutMapping("/user/{id}")
  public ApiResponse<Map<String, Object>> update(
      @PathVariable int id, @RequestBody UserWriteRequest request) {
    return ApiResponse.ok(systemUserService.updateUser(id, request));
  }

  /** 软删除指定租户账号，不允许删除当前登录账号。 */
  @DeleteMapping("/user/{id}")
  public ApiResponse<Map<String, Object>> delete(@PathVariable int id) {
    return ApiResponse.ok(systemUserService.deleteUser(id));
  }

  /** 注销当前登录账号，并清理 refresh token cookie。 */
  @PostMapping("/user/cancel")
  public ApiResponse<Map<String, Object>> cancel(HttpServletResponse response) {
    return ApiResponse.ok(systemUserService.cancelCurrentUser(response));
  }
}
