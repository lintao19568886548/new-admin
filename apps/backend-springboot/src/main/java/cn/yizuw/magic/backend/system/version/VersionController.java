package cn.yizuw.magic.backend.system.version;

import cn.yizuw.magic.backend.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class VersionController {

  private final VersionService versionService;

  public VersionController(VersionService versionService) {
    this.versionService = versionService;
  }

  @GetMapping("/system/version")
  public ApiResponse<AppVersion> latestVersion() {
    return ApiResponse.ok(versionService.getLatestVersion());
  }
}
