package cn.yizuw.magic.backend.rental.tenant;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageRequestParams;
import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.park.ParkScopeService;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 租赁租户与工资接口服务。
 *
 * <p>每批只迁移低风险接口；涉及图片重建、批量同步、短信和财务联动的逻辑继续保留在旧 Nitro 后端。
 */
@Service
@Transactional(readOnly = true)
public class RentalTenantService {

  private final ParkScopeService parkScopeService;
  private final RentalTenantRepository rentalTenantRepository;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public RentalTenantService(
      ParkScopeService parkScopeService,
      RentalTenantRepository rentalTenantRepository,
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.parkScopeService = parkScopeService;
    this.rentalTenantRepository = rentalTenantRepository;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  public PageResult<Map<String, Object>> getTenantList(
      String address,
      String contractDate,
      String contractEnd,
      String contractStart,
      String contractView,
      Integer currentPage,
      Integer currentPark,
      String date,
      String increaseDate,
      String increaseRate,
      Integer pageSize,
      Integer parkId,
      String phoneNumber,
      String status,
      String tenantName,
      String transactionType) {
    RentalContext context = rentalContext();
    RentalTenantListQuery query =
        new RentalTenantListQuery(
            PageRequestParams.normalizePage(currentPage, 1),
            currentPark,
            address,
            contractDate,
            contractEnd,
            contractStart,
            contractView,
            date,
            increaseDate,
            increaseRate,
            PageRequestParams.normalizePageSize(pageSize, 20),
            parkId,
            phoneNumber,
            status,
            tenantName,
            transactionType);
    return rentalTenantRepository.findTenantPage(
        context.jdbcTemplate(), query, context.authorizedParkIds());
  }

  public Map<String, Object> getTenantDetail(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "tenantId错误");
    }
    RentalContext context = rentalContext();
    return rentalTenantRepository.findTenantDetail(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  /** 新增租户主表记录；不写 tenant_image，也不触发租赁月度支出财务同步。 */
  @Transactional(readOnly = false)
  public Map<String, Object> createTenant(RentalTenantCreateRequest request) {
    RentalContext context = rentalContext();
    return rentalTenantRepository.createTenant(
        context.jdbcTemplate(), request, context.authorizedParkIds());
  }

  /** 更新租户主表字段；不触发旧接口里的租户月度支出财务同步。 */
  @Transactional(readOnly = false)
  public Map<String, Object> updateTenant(int id, RentalTenantUpdateRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "tenantId错误");
    }
    RentalContext context = rentalContext();
    return rentalTenantRepository.updateTenant(
        context.jdbcTemplate(), id, request, context.authorizedParkIds());
  }

  /** 删除租户；旧接口会删除 tenant_image、软删 salary，并物理删除 rental_tenant。 */
  @Transactional(readOnly = false)
  public Map<String, Object> deleteTenant(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "tenantId错误");
    }
    RentalContext context = rentalContext();
    return rentalTenantRepository.deleteTenant(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  /** 查询发送租户短信所需字段，保持旧接口的轻量响应结构。 */
  public Map<String, Object> getTenantSmsInfo(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "rentalTenantId错误");
    }
    RentalContext context = rentalContext();
    return rentalTenantRepository.findTenantSmsInfo(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  public List<Map<String, Object>> getTenantSelectList(String scope, String area) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> parkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return rentalTenantRepository.findTenantSelectList(jdbcTemplate, parkIds);
  }

  public PageResult<Map<String, Object>> getSalaryList(
      Integer currentPage,
      Integer currentPark,
      Boolean issued,
      String issueDate,
      Integer pageSize,
      Integer parkId,
      String phoneNumber,
      String salaryAmount,
      String tenantName) {
    RentalContext context = rentalContext();
    SalaryListQuery query =
        new SalaryListQuery(
            PageRequestParams.normalizePage(currentPage, 1),
            currentPark,
            issued,
            issueDate,
            PageRequestParams.normalizePageSize(pageSize, 20),
            parkId,
            phoneNumber,
            salaryAmount,
            tenantName);
    return rentalTenantRepository.findSalaryPage(
        context.jdbcTemplate(), query, context.authorizedParkIds());
  }

  public Map<String, Object> getSalaryDetail(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "salaryId错误");
    }
    RentalContext context = rentalContext();
    return rentalTenantRepository.findSalaryDetail(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  /** 新增工资主表记录；不写 salary_image，也不触发批量工资同步。 */
  @Transactional(readOnly = false)
  public Map<String, Object> createSalary(SalaryCreateRequest request) {
    RentalContext context = rentalContext();
    return rentalTenantRepository.createSalary(
        context.jdbcTemplate(), request, context.authorizedParkIds());
  }

  /** 删除工资记录；旧接口会同时删除工资图片关系，并物理删除 salary 主表。 */
  @Transactional(readOnly = false)
  public Map<String, Object> deleteSalary(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "salaryId错误");
    }
    RentalContext context = rentalContext();
    return rentalTenantRepository.deleteSalary(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  /** 更新工资主表字段；不重建 salary_image，也不触发批量工资同步。 */
  @Transactional(readOnly = false)
  public Map<String, Object> updateSalary(int id, SalaryUpdateRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "salaryId错误");
    }
    RentalContext context = rentalContext();
    return rentalTenantRepository.updateSalary(
        context.jdbcTemplate(), id, request, context.authorizedParkIds());
  }

  /** 补齐当前授权园区内仍有效合同的工资主表记录；不处理图片或发放状态。 */
  @Transactional(readOnly = false)
  public Map<String, Object> syncSalary(SalarySyncRequest request) {
    RentalContext context = rentalContext();
    return rentalTenantRepository.syncMissingSalaries(
        context.jdbcTemplate(), request == null ? null : request.currentPark(), context.authorizedParkIds());
  }

  public List<Map<String, Object>> getSalaryTenantOptions(String keyword) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> parkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return rentalTenantRepository.findSalaryTenantOptions(jdbcTemplate, parkIds, keyword);
  }

  private RentalContext rentalContext() {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return new RentalContext(jdbcTemplate, authorizedParkIds);
  }

  private record RentalContext(JdbcTemplate jdbcTemplate, List<Integer> authorizedParkIds) {}
}
