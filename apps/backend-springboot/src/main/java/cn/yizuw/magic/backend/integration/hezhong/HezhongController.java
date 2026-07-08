package cn.yizuw.magic.backend.integration.hezhong;

import cn.yizuw.magic.backend.common.ApiResponse;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 合众表计平台只读接口，供水表/电表页面查询设备树和抄表数据。 */
@RestController
public class HezhongController {

  private final HezhongService hezhongService;

  public HezhongController(HezhongService hezhongService) {
    this.hezhongService = hezhongService;
  }

  /** 水表抄表数据列表。 */
  @GetMapping("/hezhong/waterinfo/data")
  public ApiResponse<Map<String, Object>> waterData(
      @RequestParam(required = false) String comAddress,
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String projCode,
      @RequestParam(required = false) String timeFrom,
      @RequestParam(required = false) String timeTo,
      @RequestParam(required = false) String type) {
    return ApiResponse.ok(
        hezhongService.getData(
            HezhongMeterType.WATER, comAddress, page, pageSize, projCode, timeFrom, timeTo, type));
  }

  /** 水表设备树。 */
  @GetMapping("/hezhong/waterinfo/tree")
  public ApiResponse<List<Map<String, Object>>> waterTree(
      @RequestParam(required = false) String keyword) {
    return ApiResponse.ok(hezhongService.getTree(HezhongMeterType.WATER, keyword));
  }

  /** 电表抄表数据列表。 */
  @GetMapping("/hezhong/meterinfo/data")
  public ApiResponse<Map<String, Object>> meterData(
      @RequestParam(required = false) String comAddress,
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String projCode,
      @RequestParam(required = false) String timeFrom,
      @RequestParam(required = false) String timeTo,
      @RequestParam(required = false) String type) {
    return ApiResponse.ok(
        hezhongService.getData(
            HezhongMeterType.ELECTRICITY,
            comAddress,
            page,
            pageSize,
            projCode,
            timeFrom,
            timeTo,
            type));
  }

  /** 电表设备树。 */
  @GetMapping("/hezhong/meterinfo/tree")
  public ApiResponse<List<Map<String, Object>>> meterTree(
      @RequestParam(required = false) String keyword) {
    return ApiResponse.ok(hezhongService.getTree(HezhongMeterType.ELECTRICITY, keyword));
  }
}
