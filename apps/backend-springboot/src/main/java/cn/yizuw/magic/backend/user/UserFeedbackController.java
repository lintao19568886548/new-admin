package cn.yizuw.magic.backend.user;

import cn.yizuw.magic.backend.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** 用户个人中心反馈提交接口，迁移自旧 Nitro `/api/user/feedback.post.ts`。 */
@RestController
public class UserFeedbackController {

  private final UserFeedbackService userFeedbackService;

  public UserFeedbackController(UserFeedbackService userFeedbackService) {
    this.userFeedbackService = userFeedbackService;
  }

  /** 提交反馈并返回反馈编号；图片只绑定已上传的 image 记录，不处理文件上传。 */
  @PostMapping("/user/feedback")
  public ApiResponse<Map<String, Object>> submit(
      @RequestBody(required = false) UserFeedbackRequest request, HttpServletRequest servletRequest) {
    return ApiResponse.ok(
        userFeedbackService.submit(request, servletRequest.getHeader("user-agent")),
        "反馈已提交，感谢您的建议");
  }
}
