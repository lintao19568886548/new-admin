package cn.yizuw.magic.backend.access;

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
 * 门禁模块接口。
 *
 * <p>第七批先迁移只读接口；第三十五批开始迁移访客/车辆/门禁状态低副作用写接口；第四十二批补齐新增接口。
 */
@RestController
public class AccessController {

  private final AccessService accessService;

  public AccessController(AccessService accessService) {
    this.accessService = accessService;
  }

  /** 门禁品牌分页列表；只读当前租户库 access_brand 主表。 */
  @GetMapping("/access/brand/list")
  public ApiResponse<PageResult<Map<String, Object>>> brandList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) String brandName,
      @RequestParam(required = false) String brandCode,
      @RequestParam(required = false) String protocolType,
      @RequestParam(required = false) String enabled,
      @RequestParam(required = false) String isDefault) {
    return ApiResponse.ok(
        accessService.getBrandList(
            currentPage, pageSize, brandName, brandCode, protocolType, enabled, isDefault));
  }

  /** 门禁品牌搜索候选；field 只允许 brandName、brandCode、protocolType。 */
  @GetMapping("/access/brand/options")
  public ApiResponse<List<Map<String, String>>> brandOptions(
      @RequestParam(required = false) String field,
      @RequestParam(required = false) String keyword) {
    return ApiResponse.ok(accessService.getBrandOptions(field, keyword));
  }

  /** 门禁品牌详情；兼容旧端不存在时返回空 data 的语义。 */
  @GetMapping("/access/brand/{id}")
  public ApiResponse<Map<String, Object>> brandDetail(@PathVariable int id) {
    return ApiResponse.ok(accessService.getBrandDetail(id));
  }

  /** 新增门禁品牌；isDefault=true 时会清理其它默认品牌。 */
  @PostMapping("/access/brand")
  public ApiResponse<Map<String, Object>> createBrand(
      @RequestBody(required = false) AccessBrandRequest request) {
    return ApiResponse.ok(accessService.createBrand(request));
  }

  /** 更新门禁品牌主表字段；不触发外部门禁硬件同步。 */
  @PutMapping("/access/brand/{id}")
  public ApiResponse<Map<String, Object>> updateBrand(
      @PathVariable int id, @RequestBody(required = false) AccessBrandRequest request) {
    return ApiResponse.ok(accessService.updateBrand(id, request));
  }

  /** 删除门禁品牌，保持旧接口物理删除并返回删除前快照。 */
  @DeleteMapping("/access/brand/{id}")
  public ApiResponse<Map<String, Object>> deleteBrand(@PathVariable int id) {
    return ApiResponse.ok(accessService.deleteBrand(id));
  }

  @GetMapping("/access/visitor/list")
  public ApiResponse<PageResult<Map<String, Object>>> visitorList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) Integer parkId,
      @RequestParam(required = false) Integer currentPark,
      @RequestParam(required = false) String visitorName,
      @RequestParam(required = false) String phoneNumber,
      @RequestParam(required = false) String carNum,
      @RequestParam(required = false) Integer status,
      @RequestParam(required = false) String registerTime) {
    return ApiResponse.ok(
        accessService.getVisitorList(
            currentPage, pageSize, parkId, currentPark, visitorName, phoneNumber, carNum, status, registerTime));
  }

  @GetMapping("/access/visitor/{id}")
  public ApiResponse<Map<String, Object>> visitorDetail(@PathVariable int id) {
    return ApiResponse.ok(accessService.getVisitorDetail(id));
  }

  /** 新增访客出入记录；旧中间件允许公开访问，有 token 时仍写当前租户库。 */
  @PostMapping("/access/visitor")
  public ApiResponse<Map<String, Object>> createVisitor(
      @RequestBody(required = false) AccessVisitorCreateRequest request) {
    return ApiResponse.ok(accessService.createVisitor(request));
  }

  /** 更新访客出入记录，只写当前租户库并校验园区权限。 */
  @PutMapping("/access/visitor/{id}")
  public ApiResponse<Map<String, Object>> updateVisitor(
      @PathVariable int id, @RequestBody(required = false) AccessVisitorUpdateRequest request) {
    return ApiResponse.ok(accessService.updateVisitor(id, request));
  }

  /** 删除访客出入记录，保持旧接口物理删除语义。 */
  @DeleteMapping("/access/visitor/{id}")
  public ApiResponse<Void> deleteVisitor(@PathVariable int id) {
    accessService.deleteVisitor(id);
    return ApiResponse.ok(null);
  }

  /** 公开访客登记接口；未登录时写默认租户库，有 token 时写当前租户库。 */
  @PostMapping("/access/visitor/register")
  public ApiResponse<Map<String, Object>> registerVisitor(
      @RequestBody(required = false) AccessVisitorRegisterRequest request) {
    return ApiResponse.ok(accessService.registerVisitor(request));
  }

  @GetMapping("/access/car/list")
  public ApiResponse<PageResult<Map<String, Object>>> carList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) Integer parkId,
      @RequestParam(required = false) Integer currentPark,
      @RequestParam(required = false) String carNumber,
      @RequestParam(required = false) Integer status,
      @RequestParam(required = false) String registerTime) {
    return ApiResponse.ok(
        accessService.getCarList(
            currentPage, pageSize, parkId, currentPark, carNumber, status, registerTime));
  }

  @GetMapping("/access/car/{id}")
  public ApiResponse<Map<String, Object>> carDetail(@PathVariable int id) {
    return ApiResponse.ok(accessService.getCarDetail(id));
  }

  /** 新增车辆出入记录，只写当前租户库并校验园区权限。 */
  @PostMapping("/access/car")
  public ApiResponse<Map<String, Object>> createCar(
      @RequestBody(required = false) AccessCarCreateRequest request) {
    return ApiResponse.ok(accessService.createCar(request));
  }

  /** 更新车辆出入记录，只写当前租户库并校验园区权限。 */
  @PutMapping("/access/car/{id}")
  public ApiResponse<Map<String, Object>> updateCar(
      @PathVariable int id, @RequestBody(required = false) AccessCarUpdateRequest request) {
    return ApiResponse.ok(accessService.updateCar(id, request));
  }

  /** 删除车辆出入记录，保持旧接口物理删除语义。 */
  @DeleteMapping("/access/car/{id}")
  public ApiResponse<Void> deleteCar(@PathVariable int id) {
    accessService.deleteCar(id);
    return ApiResponse.ok(null);
  }

  @GetMapping("/access/door/list")
  public ApiResponse<PageResult<Map<String, Object>>> doorList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) Integer parkId,
      @RequestParam(required = false) Integer currentPark,
      @RequestParam(required = false) String deviceCode,
      @RequestParam(required = false) String deviceName,
      @RequestParam(required = false) String location,
      @RequestParam(required = false) Integer status) {
    return ApiResponse.ok(
        accessService.getDoorList(
            currentPage, pageSize, parkId, currentPark, deviceCode, deviceName, location, status));
  }

  /** 新增门禁设备，校验设备编号唯一和园区权限。 */
  @PostMapping("/access/door")
  public ApiResponse<Map<String, Object>> createDoor(
      @RequestBody(required = false) AccessDoorCreateRequest request) {
    return ApiResponse.ok(accessService.createDoor(request));
  }

  /** 更新门禁设备启停状态；旧接口只允许 status=0/1。 */
  @PutMapping("/access/door/{id}")
  public ApiResponse<Map<String, Object>> updateDoorStatus(
      @PathVariable int id, @RequestBody(required = false) AccessDoorStatusRequest request) {
    return ApiResponse.ok(accessService.updateDoorStatus(id, request));
  }

  /** 删除门禁设备，保持旧接口物理删除并返回 null 的成功协议。 */
  @DeleteMapping("/access/door/{id}")
  public ApiResponse<Void> deleteDoor(@PathVariable int id) {
    accessService.deleteDoor(id);
    return ApiResponse.ok(null);
  }
}
