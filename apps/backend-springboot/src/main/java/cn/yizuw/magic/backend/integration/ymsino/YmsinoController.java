package cn.yizuw.magic.backend.integration.ymsino;

import cn.yizuw.magic.backend.common.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 亿玛表计平台只读兼容接口。 */
@RestController
public class YmsinoController {

  private final YmsinoService ymsinoService;

  public YmsinoController(YmsinoService ymsinoService) {
    this.ymsinoService = ymsinoService;
  }

  /** 亿玛水表日冻结数据。 */
  @GetMapping("/ymsino/waterinfo/data")
  public ApiResponse<Map<String, Object>> waterData(
      @RequestParam(required = false) String comAddress,
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String ptId,
      @RequestParam(required = false) String tyDate) {
    return ApiResponse.ok(
        ymsinoService.getData(
            YmsinoMeterKind.WATER,
            comAddress,
            page != null ? page : currentPage,
            pageSize,
            ptId,
            tyDate));
  }

  /** 亿玛水表设备树。 */
  @GetMapping("/ymsino/waterinfo/tree")
  public ApiResponse<Object> waterTree(
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) String ptId,
      @RequestParam(required = false) String includeDiagnostics) {
    return ApiResponse.ok(
        ymsinoService.getTree(YmsinoMeterKind.WATER, keyword, ptId, includeDiagnostics));
  }

  /** 亿玛电表日冻结数据。 */
  @GetMapping("/ymsino/meterinfo/data")
  public ApiResponse<Map<String, Object>> meterData(
      @RequestParam(required = false) String comAddress,
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String ptId,
      @RequestParam(required = false) String tyDate) {
    return ApiResponse.ok(
        ymsinoService.getData(
            YmsinoMeterKind.ELECTRIC,
            comAddress,
            page != null ? page : currentPage,
            pageSize,
            ptId,
            tyDate));
  }

  /** 亿玛电表设备树。 */
  @GetMapping("/ymsino/meterinfo/tree")
  public ApiResponse<Object> meterTree(
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) String ptId,
      @RequestParam(required = false) String includeDiagnostics) {
    return ApiResponse.ok(
        ymsinoService.getTree(YmsinoMeterKind.ELECTRIC, keyword, ptId, includeDiagnostics));
  }
}
