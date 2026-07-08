package cn.yizuw.magic.backend.system.menutemplatesync;

import cn.yizuw.magic.backend.common.ApiResponse;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MenuTemplateSyncController {

  private final MenuTemplateSyncService menuTemplateSyncService;

  public MenuTemplateSyncController(MenuTemplateSyncService menuTemplateSyncService) {
    this.menuTemplateSyncService = menuTemplateSyncService;
  }

  @GetMapping("/system/menu-template-sync/jobs")
  public ApiResponse<List<Map<String, Object>>> jobs(
      @RequestParam(required = false) Integer limit) {
    return ApiResponse.ok(menuTemplateSyncService.getJobs(limit));
  }

  @GetMapping("/system/menu-template-sync/jobs/{id}")
  public ApiResponse<List<Map<String, Object>>> logs(@PathVariable int id) {
    return ApiResponse.ok(menuTemplateSyncService.getJobLogs(id));
  }

  /** 生成菜单模板同步 dry-run 计划；不落库、不写租户菜单。 */
  @PostMapping("/system/menu-template-sync/dry-run")
  public ApiResponse<Map<String, Object>> dryRun(
      @RequestBody(required = false) MenuTemplateSyncRunRequest request) {
    return ApiResponse.ok(menuTemplateSyncService.dryRun(request));
  }

  /** 接收菜单模板同步执行请求并写入中心库审计；真实跨租户写入由 XXL-Job 专项执行。 */
  @PostMapping("/system/menu-template-sync/execute")
  public ApiResponse<Map<String, Object>> execute(
      @RequestBody(required = false) MenuTemplateSyncRunRequest request) {
    return ApiResponse.ok(menuTemplateSyncService.execute(request));
  }
}
