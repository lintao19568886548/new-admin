package cn.yizuw.magic.backend.status;

import cn.yizuw.magic.backend.common.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class StatusController {

  @GetMapping("/status")
  public ResponseEntity<ApiResponse<Void>> status(@RequestParam(defaultValue = "200") int status) {
    return ResponseEntity.status(status).body(ApiResponse.error(status, String.valueOf(status)));
  }
}
