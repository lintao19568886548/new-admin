package cn.yizuw.magic.backend.notices;

import cn.yizuw.magic.backend.common.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 公告列表接口，承接旧 Nitro `/api/notices/list`。 */
@RestController
public class NoticesController {

  private final NoticesService noticesService;

  public NoticesController(NoticesService noticesService) {
    this.noticesService = noticesService;
  }

  /** 查询公告分页列表。 */
  @GetMapping("/notices/list")
  public ApiResponse<Map<String, Object>> list(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String regionCode,
      @RequestParam(required = false) Boolean validOnly) {
    return ApiResponse.ok(
        noticesService.listNotices(currentPage, keyword, pageSize, regionCode, validOnly));
  }
}
