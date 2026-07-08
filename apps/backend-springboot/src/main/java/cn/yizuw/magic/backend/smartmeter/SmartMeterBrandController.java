package cn.yizuw.magic.backend.smartmeter;

import cn.yizuw.magic.backend.common.ApiResponse;
import cn.yizuw.magic.backend.common.PageResult;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 智能水电表品牌配置接口；当前批次只迁移列表、详情、新增和更新。 */
@RestController
public class SmartMeterBrandController {

  private final SmartMeterBrandService smartMeterBrandService;

  public SmartMeterBrandController(SmartMeterBrandService smartMeterBrandService) {
    this.smartMeterBrandService = smartMeterBrandService;
  }

  /** 水电表品牌分页列表，支持 meterType 和品牌字段筛选。 */
  @GetMapping("/smart-meter/brand/list")
  public ApiResponse<PageResult<Map<String, Object>>> brandList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String meterType,
      @RequestParam(required = false) String brandName,
      @RequestParam(required = false) String brandCode,
      @RequestParam(required = false) String protocolType,
      @RequestParam(required = false) String enabled,
      @RequestParam(required = false) String isDefault) {
    return ApiResponse.ok(
        smartMeterBrandService.getBrandList(
            currentPage, pageSize, meterType, brandName, brandCode, protocolType, enabled, isDefault));
  }

  /** 水电表品牌搜索候选；field 只允许 brandName、brandCode、protocolType。 */
  @GetMapping("/smart-meter/brand/options")
  public ApiResponse<List<Map<String, String>>> brandOptions(
      @RequestParam(required = false) String field,
      @RequestParam(required = false) String keyword,
      @RequestParam(required = false) String meterType) {
    return ApiResponse.ok(smartMeterBrandService.getBrandOptions(field, keyword, meterType));
  }

  /** 水电表品牌详情；保持旧端未找到时 data=null 的兼容返回。 */
  @GetMapping("/smart-meter/brand/{id}")
  public ApiResponse<Map<String, Object>> brandDetail(@PathVariable int id) {
    return ApiResponse.ok(smartMeterBrandService.getBrandDetail(id));
  }

  /** 新增水电表品牌；不连接外部表计平台。 */
  @PostMapping("/smart-meter/brand")
  public ApiResponse<Map<String, Object>> createBrand(
      @RequestBody(required = false) SmartMeterBrandRequest request) {
    return ApiResponse.ok(smartMeterBrandService.createBrand(request));
  }

  /** 更新水电表品牌；默认品牌只在同一 meterType 内互斥。 */
  @PutMapping("/smart-meter/brand/{id}")
  public ApiResponse<Map<String, Object>> updateBrand(
      @PathVariable int id, @RequestBody(required = false) SmartMeterBrandRequest request) {
    return ApiResponse.ok(smartMeterBrandService.updateBrand(id, request));
  }

  /** 删除水电表品牌，保持旧接口物理删除语义。 */
  @DeleteMapping("/smart-meter/brand/{id}")
  public ApiResponse<Map<String, Object>> deleteBrand(@PathVariable int id) {
    return ApiResponse.ok(smartMeterBrandService.deleteBrand(id));
  }
}
