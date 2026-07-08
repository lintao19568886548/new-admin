package cn.yizuw.magic.backend.user;

import cn.yizuw.magic.backend.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UserInfoController {

  private final UserInfoService userInfoService;

  public UserInfoController(UserInfoService userInfoService) {
    this.userInfoService = userInfoService;
  }

  @GetMapping("/user/info")
  public ApiResponse<UserInfoResponse> info() {
    return ApiResponse.ok(userInfoService.getCurrentUserInfo());
  }
}
