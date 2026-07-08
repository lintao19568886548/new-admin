package cn.yizuw.magic.backend.system.key;

import cn.yizuw.magic.backend.common.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SystemKeyController {

  private final SystemKeyService systemKeyService;

  public SystemKeyController(SystemKeyService systemKeyService) {
    this.systemKeyService = systemKeyService;
  }

  @GetMapping("/system/key")
  public ApiResponse<Map<String, Object>> get(@RequestParam String key) {
    return ApiResponse.ok(systemKeyService.getSystemKey(key));
  }
}
