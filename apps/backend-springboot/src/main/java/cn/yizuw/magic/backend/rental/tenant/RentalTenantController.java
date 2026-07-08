package cn.yizuw.magic.backend.rental.tenant;

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
 * 租赁租户与工资接口。
 *
 * <p>路径、参数和返回结构保持旧 Nitro 兼容；写接口按批次迁移，并明确排除图片重建、财务同步等高副作用逻辑。
 */
@RestController
public class RentalTenantController {

  private final RentalTenantService rentalTenantService;

  public RentalTenantController(RentalTenantService rentalTenantService) {
    this.rentalTenantService = rentalTenantService;
  }

  @GetMapping("/rental/tenant/list")
  public ApiResponse<PageResult<Map<String, Object>>> tenantList(
      @RequestParam(required = false) String address,
      @RequestParam(required = false) String contractDate,
      @RequestParam(required = false) String contractEnd,
      @RequestParam(required = false) String contractStart,
      @RequestParam(required = false) String contractView,
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer currentPark,
      @RequestParam(required = false) String date,
      @RequestParam(required = false) String increaseDate,
      @RequestParam(required = false) String increaseRate,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) Integer parkId,
      @RequestParam(required = false) String phoneNumber,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String tenantName,
      @RequestParam(required = false) String transactionType) {
    return ApiResponse.ok(
        rentalTenantService.getTenantList(
            address,
            contractDate,
            contractEnd,
            contractStart,
            contractView,
            currentPage,
            currentPark,
            date,
            increaseDate,
            increaseRate,
            pageSize,
            parkId,
            phoneNumber,
            status,
            tenantName,
            transactionType));
  }

  @GetMapping("/rental/tenant/{id}")
  public ApiResponse<Map<String, Object>> tenantDetail(@PathVariable int id) {
    return ApiResponse.ok(rentalTenantService.getTenantDetail(id));
  }

  /** 新增租户主表字段；租户图片关系和月度支出财务同步留到后续专项批次。 */
  @PostMapping("/rental/tenant")
  public ApiResponse<Map<String, Object>> createTenant(
      @RequestBody(required = false) RentalTenantCreateRequest request) {
    return ApiResponse.ok(rentalTenantService.createTenant(request));
  }

  /** 更新租户主表字段；图片关系和租户月度支出同步仍保留给后续专项批次。 */
  @PutMapping("/rental/tenant/{id}")
  public ApiResponse<Map<String, Object>> updateTenant(
      @PathVariable int id, @RequestBody(required = false) RentalTenantUpdateRequest request) {
    return ApiResponse.ok(rentalTenantService.updateTenant(id, request));
  }

  /** 删除租户、租户图片关系，并软删关联工资记录。 */
  @DeleteMapping("/rental/tenant/{id}")
  public ApiResponse<Map<String, Object>> deleteTenant(@PathVariable int id) {
    return ApiResponse.ok(rentalTenantService.deleteTenant(id));
  }

  /** 租户短信发送前置查询，只返回模板渲染需要的轻量字段。 */
  @GetMapping("/rental/tenant/{id}/sms-info")
  public ApiResponse<Map<String, Object>> tenantSmsInfo(@PathVariable int id) {
    return ApiResponse.ok(rentalTenantService.getTenantSmsInfo(id));
  }

  @GetMapping("/rental/tenant/select")
  public ApiResponse<List<Map<String, Object>>> tenantSelect(
      @RequestParam(required = false) String scope,
      @RequestParam(required = false) String area) {
    return ApiResponse.ok(rentalTenantService.getTenantSelectList(scope, area));
  }

  @GetMapping("/rental/salary/list")
  public ApiResponse<PageResult<Map<String, Object>>> salaryList(
      @RequestParam(required = false) Integer currentPage,
      @RequestParam(required = false) Integer currentPark,
      @RequestParam(required = false) Boolean issued,
      @RequestParam(required = false) String issueDate,
      @RequestParam(required = false) Integer pageSize,
      @RequestParam(required = false) Integer parkId,
      @RequestParam(required = false) String phoneNumber,
      @RequestParam(required = false) String salaryAmount,
      @RequestParam(required = false) String tenantName) {
    return ApiResponse.ok(
        rentalTenantService.getSalaryList(
            currentPage,
            currentPark,
            issued,
            issueDate,
            pageSize,
            parkId,
            phoneNumber,
            salaryAmount,
            tenantName));
  }

  @GetMapping("/rental/salary/{id}")
  public ApiResponse<Map<String, Object>> salaryDetail(@PathVariable int id) {
    return ApiResponse.ok(rentalTenantService.getSalaryDetail(id));
  }

  /** 新增工资记录主表；工资图片关系仍保留给后续专项迁移。 */
  @PostMapping("/rental/salary")
  public ApiResponse<Map<String, Object>> createSalary(
      @RequestBody(required = false) SalaryCreateRequest request) {
    return ApiResponse.ok(rentalTenantService.createSalary(request));
  }

  /** 删除工资记录，先删除 salary_image 关系再物理删除 salary 主表。 */
  @DeleteMapping("/rental/salary/{id}")
  public ApiResponse<Map<String, Object>> deleteSalary(@PathVariable int id) {
    return ApiResponse.ok(rentalTenantService.deleteSalary(id));
  }

  /** 更新工资记录主表字段；工资图片关系仍保留给后续专项迁移。 */
  @PutMapping("/rental/salary/{id}")
  public ApiResponse<Map<String, Object>> updateSalary(
      @PathVariable int id, @RequestBody(required = false) SalaryUpdateRequest request) {
    return ApiResponse.ok(rentalTenantService.updateSalary(id, request));
  }

  /** 同步合同工资主表占位记录；不触发工资发放、图片关系或财务联动。 */
  @PostMapping("/rental/salary/sync")
  public ApiResponse<Map<String, Object>> syncSalary(
      @RequestBody(required = false) SalarySyncRequest request) {
    return ApiResponse.ok(rentalTenantService.syncSalary(request));
  }

  @GetMapping("/rental/salary/tenant-options")
  public ApiResponse<List<Map<String, Object>>> salaryTenantOptions(
      @RequestParam(required = false) String keyword) {
    return ApiResponse.ok(rentalTenantService.getSalaryTenantOptions(keyword));
  }
}
