package cn.yizuw.magic.backend.factory;

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

/**
 * 厂房与租赁园区接口。
 *
 * <p>路径、参数名和返回字段优先保持旧 Nitro 接口兼容，方便网关按路径逐步切流。
 */
@RestController
public class FactoryController {

  private final FactoryService factoryService;

  public FactoryController(FactoryService factoryService) {
    this.factoryService = factoryService;
  }

  @GetMapping("/factory/list")
  public ApiResponse<PageResult<Map<String, Object>>> list(
      @RequestParam(required = false) String address,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String factoryName,
      @RequestParam(required = false) String isOwn,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) Integer parkId) {
    return ApiResponse.ok(
        factoryService.getFactoryList(address, currentPage, factoryName, isOwn, pageSize, parkId));
  }

  @GetMapping("/factory/available-list")
  public ApiResponse<PageResult<Map<String, Object>>> availableList(
      @RequestParam(required = false) String address,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String factoryName,
      @RequestParam(required = false) String isOwn,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) Integer parkId) {
    return ApiResponse.ok(
        factoryService.getAvailableFactoryList(
            address, currentPage, factoryName, isOwn, pageSize, parkId));
  }

  @GetMapping("/factory/{id}")
  public ApiResponse<Map<String, Object>> detail(@PathVariable int id) {
    return ApiResponse.ok(factoryService.getFactoryDetail(id));
  }

  /** 新增旧厂房主表记录；楼层和楼层图片嵌套写入仍保留在旧后端。 */
  @PostMapping("/factory")
  public ApiResponse<Map<String, Object>> createFactory(
      @RequestBody(required = false) FactoryCreateRequest request) {
    return ApiResponse.ok(factoryService.createFactory(request));
  }

  /** 更新旧厂房主表字段；旧接口的楼层重建逻辑留给后续专项迁移。 */
  @PutMapping("/factory/{id}")
  public ApiResponse<Map<String, Object>> updateFactory(
      @PathVariable int id, @RequestBody(required = false) FactoryUpdateRequest request) {
    return ApiResponse.ok(factoryService.updateFactory(id, request));
  }

  /** 逻辑删除厂房，保持旧 factory 删除接口返回删除后厂房快照。 */
  @DeleteMapping("/factory/{id}")
  public ApiResponse<Map<String, Object>> delete(@PathVariable int id) {
    return ApiResponse.ok(factoryService.deleteFactory(id));
  }

  @GetMapping("/factory/list-by-park")
  public ApiResponse<List<Map<String, Object>>> listByPark() {
    return ApiResponse.ok(factoryService.getFactoryTreeByPark());
  }

  @GetMapping("/rental/park/list")
  public ApiResponse<PageResult<Map<String, Object>>> rentalParkList(
      @RequestParam(required = false) String address,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) String parkName,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String status) {
    return ApiResponse.ok(
        factoryService.getRentalParkList(address, currentPage, parkName, pageSize, status));
  }

  @GetMapping("/rental/manage/list")
  public ApiResponse<PageResult<Map<String, Object>>> rentalManageList(
      @RequestParam(required = false) String address,
      @RequestParam(required = false) String area,
      @RequestParam(required = false) String availableArea,
      @RequestParam(required = false) String contact,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer currentPark,
      @RequestParam(required = false) String description,
      @RequestParam(required = false) String factoryName,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String rentPrice) {
    return ApiResponse.ok(
        factoryService.getRentalManageList(
            address,
            area,
            availableArea,
            contact,
            currentPage,
            currentPark,
            description,
            factoryName,
            pageSize,
            rentPrice));
  }

  @GetMapping("/rental/manage/{id}")
  public ApiResponse<Map<String, Object>> rentalManageDetail(@PathVariable int id) {
    return ApiResponse.ok(factoryService.getRentalManageDetail(id));
  }

  /** 新增租赁管理厂房主表记录；楼层、图片和账单联动仍保留在旧后端。 */
  @PostMapping("/rental/manage")
  public ApiResponse<Map<String, Object>> createRentalManage(
      @RequestBody(required = false) RentalManageCreateRequest request) {
    return ApiResponse.ok(factoryService.createRentalManage(request));
  }

  /** 更新租赁管理厂房主表字段；楼层、图片和账单联动仍保留在旧后端。 */
  @PutMapping("/rental/manage/{id}")
  public ApiResponse<Map<String, Object>> updateRentalManage(
      @PathVariable int id, @RequestBody(required = false) RentalManageUpdateRequest request) {
    return ApiResponse.ok(factoryService.updateRentalManage(id, request));
  }

  /** 删除租赁管理厂房，保持旧接口物理删除并返回 null。 */
  @DeleteMapping("/rental/manage/{id}")
  public ApiResponse<Void> deleteRentalManage(@PathVariable int id) {
    factoryService.deleteRentalManage(id);
    return ApiResponse.ok(null);
  }
}
