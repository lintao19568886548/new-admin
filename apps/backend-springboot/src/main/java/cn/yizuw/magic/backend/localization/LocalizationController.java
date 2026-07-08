package cn.yizuw.magic.backend.localization;

import cn.yizuw.magic.backend.common.ApiResponse;
import cn.yizuw.magic.backend.common.PageResult;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 打卡定位只读接口，迁移自 Nitro 的 /localization 系列 GET 接口。 */
@RestController
public class LocalizationController {

  private final LocalizationService localizationService;

  public LocalizationController(LocalizationService localizationService) {
    this.localizationService = localizationService;
  }

  /** 查询打卡定位分页列表，普通用户只能查看本人记录，Super 可以按用户名模糊查询。 */
  @GetMapping("/localization/list")
  public ApiResponse<PageResult<Map<String, Object>>> list(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String username) {
    return ApiResponse.ok(
        localizationService.getList(currentPage, pageSize, username), "获取打卡记录列表成功");
  }

  /** 查询单条打卡定位记录详情，保持旧接口的 id 校验和错误文案。 */
  @GetMapping("/localization/{id}")
  public ApiResponse<Map<String, Object>> detail(@PathVariable int id) {
    return ApiResponse.ok(localizationService.getDetail(id), "获取成功");
  }

  /** 新增当前用户打卡定位记录，保持旧接口的必填参数校验。 */
  @PostMapping("/localization")
  public ApiResponse<Map<String, Object>> create(
      @RequestBody(required = false) LocalizationCreateRequest request) {
    return ApiResponse.ok(localizationService.create(request), "创建成功");
  }

  /** 更新单条打卡定位记录；仅允许旧接口支持的 punchTime/status/longitude/latitude 字段。 */
  @PutMapping("/localization/{id}")
  public ApiResponse<Map<String, Object>> update(
      @PathVariable int id, @RequestBody(required = false) LocalizationUpdateRequest request) {
    return ApiResponse.ok(localizationService.update(id, request), "更新成功");
  }

  /** 删除单条打卡定位记录，保持旧接口物理删除语义。 */
  @DeleteMapping("/localization/{id}")
  public ApiResponse<Void> delete(@PathVariable int id) {
    localizationService.delete(id);
    return ApiResponse.ok(null, "删除成功");
  }
}
