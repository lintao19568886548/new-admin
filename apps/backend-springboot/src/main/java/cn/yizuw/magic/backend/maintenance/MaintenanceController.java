package cn.yizuw.magic.backend.maintenance;

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

/**
 * 维保模块接口。
 *
 * <p>已迁移只读接口；第三十六批开始迁移不触发外部调用的低副作用写接口。
 */
@RestController
public class MaintenanceController {

  private final MaintenanceService maintenanceService;

  public MaintenanceController(MaintenanceService maintenanceService) {
    this.maintenanceService = maintenanceService;
  }

  @GetMapping("/maintenance/repair-order/list")
  public ApiResponse<PageResult<Map<String, Object>>> repairOrderList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) Integer parkId,
      @RequestParam(required = false) Integer currentPark,
      @RequestParam(required = false) Integer factoryId,
      @RequestParam(required = false) String tenantName,
      @RequestParam(required = false) String repairType,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String priority,
      @RequestParam(required = false) String assignee,
      @RequestParam(required = false) String orderNo,
      @RequestParam(required = false) String startTime,
      @RequestParam(required = false) String endTime) {
    return ApiResponse.ok(
        maintenanceService.getRepairOrderList(
            currentPage,
            pageSize,
            parkId,
            currentPark,
            factoryId,
            tenantName,
            repairType,
            status,
            priority,
            assignee,
            orderNo,
            startTime,
            endTime));
  }

  @GetMapping("/maintenance/repair-order/{id}")
  public ApiResponse<Map<String, Object>> repairOrderDetail(@PathVariable int id) {
    return ApiResponse.ok(maintenanceService.getRepairOrderDetail(id));
  }

  /** 新增报修工单，只写 repair_order 主表，不触发派单通知。 */
  @PostMapping("/maintenance/repair-order")
  public ApiResponse<Map<String, Object>> createRepairOrder(
      @RequestBody(required = false) MaintenanceRepairOrderRequest request) {
    return ApiResponse.ok(maintenanceService.createRepairOrder(request));
  }

  /** 更新报修工单主表记录；只处理 repair_order 字段并校验园区操作权限。 */
  @PutMapping("/maintenance/repair-order/{id}")
  public ApiResponse<Map<String, Object>> updateRepairOrder(
      @PathVariable int id,
      @RequestBody(required = false) MaintenanceRepairOrderRequest request) {
    return ApiResponse.ok(maintenanceService.updateRepairOrder(id, request));
  }

  /** 删除报修工单主表记录，保持旧接口物理删除语义。 */
  @DeleteMapping("/maintenance/repair-order/{id}")
  public ApiResponse<Map<String, Object>> deleteRepairOrder(@PathVariable int id) {
    return ApiResponse.ok(maintenanceService.deleteRepairOrder(id));
  }

  @GetMapping("/maintenance/elevator/list")
  public ApiResponse<PageResult<Map<String, Object>>> elevatorList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) Integer limit,
      @RequestParam(required = false) Integer parkId,
      @RequestParam(required = false) Integer currentPark,
      @RequestParam(required = false) Integer factoryId,
      @RequestParam(required = false) String name,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String area,
      @RequestParam(required = false) String loadCapacity,
      @RequestParam(required = false) String brand,
      @RequestParam(required = false) String checker,
      @RequestParam(required = false) String size,
      @RequestParam(required = false) String productionDateStart,
      @RequestParam(required = false) String productionDateEnd,
      @RequestParam(required = false) String checkTimeStart,
      @RequestParam(required = false) String checkTimeEnd,
      @RequestParam(required = false) String startTime,
      @RequestParam(required = false) String endTime) {
    return ApiResponse.ok(
        maintenanceService.getElevatorList(
            currentPage,
            pageSize,
            limit,
            parkId,
            currentPark,
            factoryId,
            name,
            status,
            area,
            loadCapacity,
            brand,
            checker,
            size,
            productionDateStart,
            productionDateEnd,
            checkTimeStart,
            checkTimeEnd,
            startTime,
            endTime));
  }

  @GetMapping("/maintenance/elevator/{id}")
  public ApiResponse<Map<String, Object>> elevatorDetail(@PathVariable int id) {
    return ApiResponse.ok(maintenanceService.getElevatorDetail(id));
  }

  /** 新增升降机主表记录，沿用旧接口路径并补齐园区权限校验。 */
  @PostMapping("/maintenance/elevator")
  public ApiResponse<Map<String, Object>> createElevator(
      @RequestBody(required = false) MaintenanceElevatorUpdateRequest request) {
    return ApiResponse.ok(maintenanceService.createElevator(request));
  }

  /** 更新升降机主表记录，写入前按当前用户授权园区校验。 */
  @PutMapping("/maintenance/elevator/{id}")
  public ApiResponse<Map<String, Object>> updateElevator(
      @PathVariable int id, @RequestBody(required = false) MaintenanceElevatorUpdateRequest request) {
    return ApiResponse.ok(maintenanceService.updateElevator(id, request));
  }

  /** 删除升降机主表记录，保持旧接口物理删除语义。 */
  @DeleteMapping("/maintenance/elevator/{id}")
  public ApiResponse<Map<String, Object>> deleteElevator(@PathVariable int id) {
    return ApiResponse.ok(maintenanceService.deleteElevator(id));
  }

  @GetMapping("/maintenance/firefighting/list")
  public ApiResponse<PageResult<Map<String, Object>>> firefightingList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) Integer limit,
      @RequestParam(required = false) Integer parkId,
      @RequestParam(required = false) Integer currentPark,
      @RequestParam(required = false) Integer factoryId,
      @RequestParam(required = false) String firefightingName,
      @RequestParam(required = false) String address,
      @RequestParam(required = false) String extinguisher,
      @RequestParam(required = false) String hydrant,
      @RequestParam(required = false) String fireExit,
      @RequestParam(required = false) String checker,
      @RequestParam(required = false) String startTime,
      @RequestParam(required = false) String endTime) {
    return ApiResponse.ok(
        maintenanceService.getFirefightingList(
            currentPage,
            pageSize,
            limit,
            parkId,
            currentPark,
            factoryId,
            firefightingName,
            address,
            extinguisher,
            hydrant,
            fireExit,
            checker,
            startTime,
            endTime));
  }

  @GetMapping("/maintenance/firefighting/{id}")
  public ApiResponse<Map<String, Object>> firefightingDetail(@PathVariable int id) {
    return ApiResponse.ok(maintenanceService.getFirefightingDetail(id));
  }

  /** 新增消防设施主表记录，不处理消防图片关系表。 */
  @PostMapping("/maintenance/firefighting")
  public ApiResponse<Map<String, Object>> createFirefighting(
      @RequestBody(required = false) MaintenanceFirefightingUpdateRequest request) {
    return ApiResponse.ok(maintenanceService.createFirefighting(request));
  }

  /** 更新消防设施主表记录，不处理图片关系表。 */
  @PutMapping("/maintenance/firefighting/{id}")
  public ApiResponse<Map<String, Object>> updateFirefighting(
      @PathVariable int id,
      @RequestBody(required = false) MaintenanceFirefightingUpdateRequest request) {
    return ApiResponse.ok(maintenanceService.updateFirefighting(id, request));
  }

  /** 删除消防设施主表记录，保持旧接口物理删除语义。 */
  @DeleteMapping("/maintenance/firefighting/{id}")
  public ApiResponse<Map<String, Object>> deleteFirefighting(@PathVariable int id) {
    return ApiResponse.ok(maintenanceService.deleteFirefighting(id));
  }

  @GetMapping("/maintenance/transformer/list")
  public ApiResponse<PageResult<Map<String, Object>>> transformerList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) Integer limit,
      @RequestParam(required = false) Integer parkId,
      @RequestParam(required = false) Integer currentPark,
      @RequestParam(required = false) Integer factoryId,
      @RequestParam(required = false) String transformerName,
      @RequestParam(required = false) String address,
      @RequestParam(required = false) String checker,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String specifications,
      @RequestParam(required = false) String startTime,
      @RequestParam(required = false) String endTime) {
    return ApiResponse.ok(
        maintenanceService.getTransformerList(
            currentPage,
            pageSize,
            limit,
            parkId,
            currentPark,
            factoryId,
            transformerName,
            address,
            checker,
            status,
            specifications,
            startTime,
            endTime));
  }

  @GetMapping("/maintenance/transformer/{id}")
  public ApiResponse<Map<String, Object>> transformerDetail(@PathVariable int id) {
    return ApiResponse.ok(maintenanceService.getTransformerDetail(id));
  }

  /** 新增变压器主表记录，不触发外部设备同步。 */
  @PostMapping("/maintenance/transformer")
  public ApiResponse<Map<String, Object>> createTransformer(
      @RequestBody(required = false) MaintenanceTransformerUpdateRequest request) {
    return ApiResponse.ok(maintenanceService.createTransformer(request));
  }

  /** 更新变压器主表记录，严格限制可写字段。 */
  @PutMapping("/maintenance/transformer/{id}")
  public ApiResponse<Map<String, Object>> updateTransformer(
      @PathVariable int id,
      @RequestBody(required = false) MaintenanceTransformerUpdateRequest request) {
    return ApiResponse.ok(maintenanceService.updateTransformer(id, request));
  }

  /** 删除变压器主表记录，保持旧接口物理删除语义。 */
  @DeleteMapping("/maintenance/transformer/{id}")
  public ApiResponse<Map<String, Object>> deleteTransformer(@PathVariable int id) {
    return ApiResponse.ok(maintenanceService.deleteTransformer(id));
  }

  @GetMapping("/maintenance/hygieneCheck/list")
  public ApiResponse<PageResult<Map<String, Object>>> hygieneCheckList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) Integer limit,
      @RequestParam(required = false) Integer parkId,
      @RequestParam(required = false) Integer currentPark,
      @RequestParam(required = false) Integer factoryId,
      @RequestParam(required = false) String checkItems,
      @RequestParam(required = false) String checker,
      @RequestParam(required = false) String checkResult,
      @RequestParam(required = false) String startTime,
      @RequestParam(required = false) String endTime) {
    return ApiResponse.ok(
        maintenanceService.getHygieneCheckList(
            currentPage,
            pageSize,
            limit,
            parkId,
            currentPark,
            factoryId,
            checkItems,
            checker,
            checkResult,
            startTime,
            endTime));
  }

  @GetMapping("/maintenance/hygieneCheck/{id}")
  public ApiResponse<Map<String, Object>> hygieneCheckDetail(@PathVariable int id) {
    return ApiResponse.ok(maintenanceService.getHygieneCheckDetail(id));
  }

  /** 新增卫生检查主表记录。 */
  @PostMapping("/maintenance/hygieneCheck")
  public ApiResponse<Map<String, Object>> createHygieneCheck(
      @RequestBody(required = false) MaintenanceHygieneCheckUpdateRequest request) {
    return ApiResponse.ok(maintenanceService.createHygieneCheck(request));
  }

  /** 更新卫生检查主表记录。 */
  @PutMapping("/maintenance/hygieneCheck/{id}")
  public ApiResponse<Map<String, Object>> updateHygieneCheck(
      @PathVariable int id,
      @RequestBody(required = false) MaintenanceHygieneCheckUpdateRequest request) {
    return ApiResponse.ok(maintenanceService.updateHygieneCheck(id, request));
  }

  /** 删除卫生检查主表记录，保持旧接口物理删除语义。 */
  @DeleteMapping("/maintenance/hygieneCheck/{id}")
  public ApiResponse<Map<String, Object>> deleteHygieneCheck(@PathVariable int id) {
    return ApiResponse.ok(maintenanceService.deleteHygieneCheck(id));
  }

  @GetMapping("/maintenance/factoryMaint/list")
  public ApiResponse<PageResult<Map<String, Object>>> factoryMaintList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) Integer limit,
      @RequestParam(required = false) Integer parkId,
      @RequestParam(required = false) Integer currentPark,
      @RequestParam(required = false) Integer factoryId,
      @RequestParam(required = false) String maintenanceItem,
      @RequestParam(required = false) String maintenanceStatus,
      @RequestParam(required = false) String personInCharge,
      @RequestParam(required = false) String startTime,
      @RequestParam(required = false) String endTime) {
    return ApiResponse.ok(
        maintenanceService.getFactoryMaintList(
            currentPage,
            pageSize,
            limit,
            parkId,
            currentPark,
            factoryId,
            maintenanceItem,
            maintenanceStatus,
            personInCharge,
            startTime,
            endTime));
  }

  @GetMapping("/maintenance/factoryMaint/{id}")
  public ApiResponse<Map<String, Object>> factoryMaintDetail(@PathVariable int id) {
    return ApiResponse.ok(maintenanceService.getFactoryMaintDetail(id));
  }

  /** 新增厂房维护主表记录。 */
  @PostMapping("/maintenance/factoryMaint")
  public ApiResponse<Map<String, Object>> createFactoryMaint(
      @RequestBody(required = false) MaintenanceFactoryMaintUpdateRequest request) {
    return ApiResponse.ok(maintenanceService.createFactoryMaint(request));
  }

  /** 更新厂房维护主表记录。 */
  @PutMapping("/maintenance/factoryMaint/{id}")
  public ApiResponse<Map<String, Object>> updateFactoryMaint(
      @PathVariable int id,
      @RequestBody(required = false) MaintenanceFactoryMaintUpdateRequest request) {
    return ApiResponse.ok(maintenanceService.updateFactoryMaint(id, request));
  }

  /** 删除厂房维护主表记录，保持旧接口物理删除语义。 */
  @DeleteMapping("/maintenance/factoryMaint/{id}")
  public ApiResponse<Map<String, Object>> deleteFactoryMaint(@PathVariable int id) {
    return ApiResponse.ok(maintenanceService.deleteFactoryMaint(id));
  }
}
