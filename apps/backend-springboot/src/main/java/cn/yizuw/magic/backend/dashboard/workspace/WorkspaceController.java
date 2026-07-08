package cn.yizuw.magic.backend.dashboard.workspace;

import cn.yizuw.magic.backend.common.ApiResponse;
import cn.yizuw.magic.backend.common.PageResult;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 工作台模块只读接口，当前迁移访问日志列表。 */
@RestController
public class WorkspaceController {

  private final WorkspaceService workspaceService;

  public WorkspaceController(WorkspaceService workspaceService) {
    this.workspaceService = workspaceService;
  }

  /** 查询工作台访问日志列表，并按当前用户角色树过滤可见人员。 */
  @GetMapping("/dashboard/workspace/list")
  public ApiResponse<PageResult<Map<String, Object>>> list(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String endTime,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String startTime) {
    return ApiResponse.ok(workspaceService.getList(currentPage, endTime, pageSize, startTime));
  }
}
