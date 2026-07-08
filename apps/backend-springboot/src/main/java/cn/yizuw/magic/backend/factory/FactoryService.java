package cn.yizuw.magic.backend.factory;

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
 * 第六批厂房/租赁园区只读接口服务。
 *
 * <p>这里集中处理公开接口、登录接口和园区数据权限的边界，Repository 只负责按传入条件查库。
 */
@Service
@Transactional(readOnly = true)
public class FactoryService {

  private final FactoryRepository factoryRepository;
  private final ParkScopeService parkScopeService;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public FactoryService(
      FactoryRepository factoryRepository,
      ParkScopeService parkScopeService,
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.factoryRepository = factoryRepository;
    this.parkScopeService = parkScopeService;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  public PageResult<Map<String, Object>> getFactoryList(
      String address,
      Integer currentPage,
      String factoryName,
      String isOwn,
      Integer pageSize,
      Integer parkId) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    FactoryQuery query = buildQuery(address, currentPage, factoryName, isOwn, pageSize, parkId, null);
    return factoryRepository.findFactoryPage(jdbcTemplate, query, authorizedParkIds);
  }

  /**
   * 公开待租厂房列表。
   *
   * <p>旧后端允许未登录访问；未登录时读取默认租户库，已登录时读取当前租户库。
   */
  public PageResult<Map<String, Object>> getAvailableFactoryList(
      String address,
      Integer currentPage,
      String factoryName,
      String isOwn,
      Integer pageSize,
      Integer parkId) {
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentOrDefaultTenantJdbcTemplate();
    FactoryQuery query = buildQuery(address, currentPage, factoryName, isOwn, pageSize, parkId, null);
    return factoryRepository.findAvailableFactoryPage(jdbcTemplate, query);
  }

  public Map<String, Object> getFactoryDetail(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的厂房ID");
    }
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentOrDefaultTenantJdbcTemplate();
    Map<String, Object> detail = factoryRepository.findFactoryDetail(jdbcTemplate, id);
    if (detail == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "厂房不存在");
    }
    return detail;
  }

  /** 新增旧厂房主表；不迁移旧接口的 floors 嵌套楼层和楼层图片关系。 */
  @Transactional
  public Map<String, Object> createFactory(FactoryCreateRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return factoryRepository.createFactory(jdbcTemplate, request, authorizedParkIds);
  }

  /** 更新旧厂房主表；不迁移旧接口的 floors 重建和楼层图片关系。 */
  @Transactional
  public Map<String, Object> updateFactory(int id, FactoryUpdateRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的厂房ID");
    }
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return factoryRepository.updateFactory(jdbcTemplate, id, request, authorizedParkIds);
  }

  /** 逻辑删除厂房；旧 factory 删除接口只标记 isDeleted，不删除楼层或图片关系。 */
  @Transactional
  public Map<String, Object> deleteFactory(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的厂房ID");
    }
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return factoryRepository.softDeleteFactory(jdbcTemplate, id, authorizedParkIds);
  }

  /** 维护模块级联下拉使用，必须按当前用户园区范围过滤。 */
  public List<Map<String, Object>> getFactoryTreeByPark() {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return factoryRepository.findFactoryTreeByParks(jdbcTemplate, authorizedParkIds);
  }

  public PageResult<Map<String, Object>> getRentalParkList(
      String address,
      Integer currentPage,
      String parkName,
      Integer pageSize,
      String status) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    int page = PageRequestParams.normalizePage(currentPage, 1);
    int size = PageRequestParams.normalizePageSize(pageSize, 9);
    return factoryRepository.findRentalParkPage(
        jdbcTemplate, authorizedParkIds, page, size, parkName, address, status);
  }

  public PageResult<Map<String, Object>> getRentalManageList(
      String address,
      String area,
      String availableArea,
      String contact,
      Integer currentPage,
      Integer currentPark,
      String description,
      String factoryName,
      Integer pageSize,
      String rentPrice) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    RentalManageQuery query =
        new RentalManageQuery(
            address,
            area,
            availableArea,
            contact,
            PageRequestParams.normalizePage(currentPage, 1),
            currentPark,
            description,
            factoryName,
            PageRequestParams.normalizePageSize(pageSize, 20),
            rentPrice);
    return factoryRepository.findRentalManagePage(jdbcTemplate, query, authorizedParkIds);
  }

  public Map<String, Object> getRentalManageDetail(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "factoryId错误");
    }
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return factoryRepository.findRentalManageDetail(jdbcTemplate, id, authorizedParkIds);
  }

  /** 新增租赁管理厂房；只写 factory 主表，创建前校验当前用户可操作园区。 */
  @Transactional
  public Map<String, Object> createRentalManage(RentalManageCreateRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return factoryRepository.createRentalManage(jdbcTemplate, request, authorizedParkIds);
  }

  /** 更新租赁管理厂房主表字段；写入前后按当前用户授权园区校验。 */
  @Transactional
  public Map<String, Object> updateRentalManage(int id, RentalManageUpdateRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "factoryId错误");
    }
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return factoryRepository.updateRentalManage(jdbcTemplate, id, request, authorizedParkIds);
  }

  /** 删除租赁管理厂房；旧接口是物理删除，暂不改为 is_deleted 软删。 */
  @Transactional
  public void deleteRentalManage(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "factoryId错误");
    }
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    factoryRepository.deleteRentalManage(jdbcTemplate, id, authorizedParkIds);
  }

  private FactoryQuery buildQuery(
      String address,
      Integer currentPage,
      String factoryName,
      String isOwn,
      Integer pageSize,
      Integer parkId,
      String status) {
    return new FactoryQuery(
        address,
        PageRequestParams.normalizePage(currentPage, 1),
        factoryName,
        parseBoolean(isOwn),
        PageRequestParams.normalizePageSize(pageSize, 9),
        parkId,
        status);
  }

  private Boolean parseBoolean(String value) {
    if (value == null) {
      return null;
    }
    return "true".equalsIgnoreCase(value) || "1".equals(value);
  }
}
