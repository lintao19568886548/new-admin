package cn.yizuw.magic.backend.system.feedback;

import cn.yizuw.magic.backend.common.ApiResponse;
import cn.yizuw.magic.backend.common.PageResult;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SystemFeedbackController {

  private final SystemFeedbackService systemFeedbackService;

  public SystemFeedbackController(SystemFeedbackService systemFeedbackService) {
    this.systemFeedbackService = systemFeedbackService;
  }

  @GetMapping("/system/feedback/list")
  public ApiResponse<PageResult<Map<String, Object>>> list(
      @RequestParam(required = false) String category,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String endTime,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String startTime) {
    return ApiResponse.ok(
        systemFeedbackService.getFeedbackList(
            category, currentPage, endTime, keyword, pageSize, startTime));
  }
}
