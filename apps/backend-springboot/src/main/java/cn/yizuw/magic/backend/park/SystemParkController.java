package cn.yizuw.magic.backend.park;

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

@RestController
public class SystemParkController {

  private final ParkService parkService;

  public SystemParkController(ParkService parkService) {
    this.parkService = parkService;
  }

  @GetMapping("/system/park/list")
  public ApiResponse<PageResult<Map<String, Object>>> list(
      @RequestParam(required = false) String area,
      @RequestParam(required = false) String address,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String parkName,
      @RequestParam(required = false) Integer pageSize) {
    return ApiResponse.ok(
        parkService.getSystemParkList(area, address, currentPage, parkName, pageSize));
  }

  @GetMapping("/system/park/{id}")
  public ApiResponse<Map<String, Object>> detail(@PathVariable int id) {
    return ApiResponse.ok(parkService.getSystemParkDetail(id));
  }

  /** 兼容旧 `/api/park` 园区新增路径，只创建 park 主表记录。 */
  @PostMapping("/park")
  public ApiResponse<Map<String, Object>> createLegacyPark(
      @RequestBody(required = false) ParkCreateRequest request) {
    return ApiResponse.ok(parkService.createLegacyPark(request));
  }

  /** 兼容旧 `/api/system/park` 新增路径，只创建 park 主表记录。 */
  @PostMapping("/system/park")
  public ApiResponse<Map<String, Object>> createSystemPark(
      @RequestBody(required = false) ParkCreateRequest request) {
    return ApiResponse.ok(parkService.createLegacyPark(request));
  }

  /** 更新系统园区主表字段；图片、厂房和宿舍关系不在本批写入。 */
  @PutMapping("/system/park/{id}")
  public ApiResponse<Map<String, Object>> update(
      @PathVariable int id, @RequestBody(required = false) ParkUpdateRequest request) {
    return ApiResponse.ok(parkService.updateSystemPark(id, request));
  }

  /** 兼容旧 `/api/park/{id}` 更新路径，仍复用系统园区白名单更新逻辑。 */
  @PutMapping("/park/{id}")
  public ApiResponse<Map<String, Object>> updateLegacyPark(
      @PathVariable int id, @RequestBody(required = false) ParkUpdateRequest request) {
    return ApiResponse.ok(parkService.updateSystemPark(id, request));
  }

  /** 逻辑删除系统园区，保持旧接口返回被更新园区快照。 */
  @DeleteMapping("/system/park/{id}")
  public ApiResponse<Map<String, Object>> delete(@PathVariable int id) {
    return ApiResponse.ok(parkService.deleteSystemPark(id));
  }

  /** 旧 `/api/park/{id}` 原为物理删除；迁移期先走软删，稳定后再评估是否开放物理删除。 */
  @DeleteMapping("/park/{id}")
  public ApiResponse<Map<String, Object>> deleteLegacyPark(@PathVariable int id) {
    return ApiResponse.ok(parkService.deleteSystemPark(id));
  }

  /** 旧租赁园区详情路径，返回前台详情页需要的图片 URL 兼容字段。 */
  @GetMapping("/rental/park/{id}")
  public ApiResponse<Map<String, Object>> rentalParkDetail(@PathVariable int id) {
    return ApiResponse.ok(parkService.getRentalParkDetail(id));
  }

  @GetMapping("/park/list")
  public ApiResponse<Object> currentUserParks() {
    return ApiResponse.ok(parkService.getCurrentUserParks());
  }

  /** 访客登记页使用的园区下拉列表，保持旧接口只返回未删除园区的轻量字段。 */
  @GetMapping("/park/visitor-list")
  public ApiResponse<List<Map<String, Object>>> visitorParkList() {
    return ApiResponse.ok(parkService.getVisitorParkList());
  }

  /** 园区租赁统计，用于园区页顶部的面积、出租率和空置量汇总。 */
  @GetMapping("/park/dashboard-stats")
  public ApiResponse<Map<String, Object>> dashboardStats(
      @RequestParam(required = false) Integer parkId) {
    return ApiResponse.ok(parkService.getParkDashboardStats(parkId));
  }
}
