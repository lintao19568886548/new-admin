package cn.yizuw.magic.backend.park;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageRequestParams;
import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ParkService {

  private final ParkRepository parkRepository;
  private final ParkScopeService parkScopeService;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public ParkService(
      ParkRepository parkRepository,
      ParkScopeService parkScopeService,
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.parkRepository = parkRepository;
    this.parkScopeService = parkScopeService;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  public PageResult<Map<String, Object>> getSystemParkList(
      String area, String address, Integer currentPage, String parkName, Integer pageSize) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    if (authorizedParkIds.isEmpty()) {
      return new PageResult<>(
          List.of(),
          0,
          PageRequestParams.normalizePage(currentPage, 1),
          PageRequestParams.normalizePageSize(pageSize, 20));
    }
    ParkQuery query =
        new ParkQuery(
            address,
            area,
            PageRequestParams.normalizePage(currentPage, 1),
            PageRequestParams.normalizePageSize(pageSize, 20),
            parkName);
    return parkRepository.findParkPage(jdbcTemplate, query, authorizedParkIds);
  }

  public Map<String, Object> getSystemParkDetail(int parkId) {
    TenantRequired.currentUser();
    if (parkId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "id不能为空");
    }
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    Map<String, Object> detail = parkRepository.findParkDetail(jdbcTemplate, parkId);
    if (detail == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "未找到ID为" + parkId + "的园区");
    }
    return detail;
  }

  /** 创建旧 `/park` 园区主表记录；不处理图片、厂房和宿舍嵌套创建。 */
  @Transactional
  public Map<String, Object> createLegacyPark(ParkCreateRequest request) {
    TenantRequired.currentUser();
    return parkRepository.createLegacyPark(
        tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), request);
  }

  /** 更新系统园区主表字段；旧接口没有园区范围限制，这里保持登录态校验边界。 */
  @Transactional
  public Map<String, Object> updateSystemPark(int parkId, ParkUpdateRequest request) {
    TenantRequired.currentUser();
    if (parkId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "id is required");
    }
    return parkRepository.updateSystemPark(
        tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), parkId, request);
  }

  /** 逻辑删除系统园区，保持旧 system/park 删除接口的 isDeleted=true 语义。 */
  @Transactional
  public Map<String, Object> deleteSystemPark(int parkId) {
    TenantRequired.currentUser();
    if (parkId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "id不能为空");
    }
    return parkRepository.softDeleteSystemPark(
        tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), parkId);
  }

  /** 旧 `/rental/park/{id}` 详情接口，保留无 token 时读取默认租户库的兼容行为。 */
  public Map<String, Object> getRentalParkDetail(int parkId) {
    if (parkId <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的园区ID");
    }
    Map<String, Object> detail =
        parkRepository.findRentalParkDetail(
            tenantJdbcTemplateProvider.currentOrDefaultTenantJdbcTemplate(), parkId);
    if (detail == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "园区不存在");
    }
    return detail;
  }

  public List<Map<String, Object>> getCurrentUserParks() {
    UserTokenPayload payload = TenantRequired.currentUser();
    return parkScopeService.resolveAuthorizedParks(
        tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), payload);
  }

  /**
   * 查询访客登记页的园区选项。
   *
   * <p>旧 Nitro 接口未强制鉴权；这里有 token 时读取当前租户库，无 token 时回退默认租户库，便于灰度阶段兼容前端。
   */
  public List<Map<String, Object>> getVisitorParkList() {
    return parkRepository.findAllActiveParks(
        tenantJdbcTemplateProvider.currentOrDefaultTenantJdbcTemplate());
  }

  /** 查询当前用户授权园区范围内的厂房楼层租赁统计。 */
  public Map<String, Object> getParkDashboardStats(Integer parkId) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    if (authorizedParkIds.isEmpty()) {
      return emptyDashboardStats();
    }
    if (parkId != null && parkId != -1) {
      if (!authorizedParkIds.contains(parkId)) {
        return emptyDashboardStats();
      }
      return parkRepository.calculateRentalDashboardStats(jdbcTemplate, List.of(parkId));
    }
    return parkRepository.calculateRentalDashboardStats(jdbcTemplate, authorizedParkIds);
  }

  private Map<String, Object> emptyDashboardStats() {
    return Map.of(
        "rentalRate", "0.00",
        "rentedArea", "0.00",
        "rentedCount", 0,
        "totalArea", "0.00",
        "totalCount", 0,
        "vacantArea", "0.00",
        "vacantCount", 0);
  }
}
