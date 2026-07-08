package cn.yizuw.magic.backend.maintenance;

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
import org.springframework.util.StringUtils;

/**
 * 维保模块接口服务。
 *
 * <p>负责统一处理登录态、租户库、园区权限和分页参数；Repository 只负责执行 SQL。
 */
@Service
@Transactional(readOnly = true)
public class MaintenanceService {

  private final MaintenanceRepository maintenanceRepository;
  private final ParkScopeService parkScopeService;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public MaintenanceService(
      MaintenanceRepository maintenanceRepository,
      ParkScopeService parkScopeService,
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.maintenanceRepository = maintenanceRepository;
    this.parkScopeService = parkScopeService;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  /** 报修工单列表，按当前用户授权园区过滤。 */
  public PageResult<Map<String, Object>> getRepairOrderList(
      Integer currentPage,
      Integer pageSize,
      Integer parkId,
      Integer currentPark,
      Integer factoryId,
      String tenantName,
      String repairType,
      String status,
      String priority,
      String assignee,
      String orderNo,
      String startTime,
      String endTime) {
    MaintenanceContext context = maintenanceContext();
    MaintenanceRepairOrderQuery query =
        new MaintenanceRepairOrderQuery(
            assignee,
            PageRequestParams.normalizePage(currentPage, 1),
            currentPark,
            endTime,
            factoryId,
            orderNo,
            PageRequestParams.normalizePageSize(pageSize, 20),
            parkId,
            priority,
            repairType,
            startTime,
            status,
            tenantName);
    return maintenanceRepository.findRepairOrderPage(
        context.jdbcTemplate(), query, context.authorizedParkIds());
  }

  /** 报修工单详情，补齐旧端相同的园区权限边界。 */
  public Map<String, Object> getRepairOrderDetail(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "repairOrderId 错误");
    }
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.findRepairOrderDetail(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  /** 新增报修工单；只写主表，不发送通知或创建外部派单任务。 */
  @Transactional
  public Map<String, Object> createRepairOrder(MaintenanceRepairOrderRequest request) {
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.createRepairOrder(
        context.jdbcTemplate(), request, context.authorizedParkIds());
  }

  /** 更新报修工单；写入前校验工单归属园区和目标园区权限。 */
  @Transactional
  public Map<String, Object> updateRepairOrder(
      int id, MaintenanceRepairOrderRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "repairOrderId 错误");
    }
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.updateRepairOrder(
        context.jdbcTemplate(), id, request, context.authorizedParkIds());
  }

  /** 删除报修工单；旧接口为物理删除并返回被删除记录。 */
  @Transactional
  public Map<String, Object> deleteRepairOrder(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "repairOrderId 错误");
    }
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.deleteRepairOrder(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  /** 升降机列表。兼容旧接口的 pageSize 和前端现有 limit 两种分页参数。 */
  public PageResult<Map<String, Object>> getElevatorList(
      Integer currentPage,
      Integer pageSize,
      Integer limit,
      Integer parkId,
      Integer currentPark,
      Integer factoryId,
      String name,
      String status,
      String area,
      String loadCapacity,
      String brand,
      String checker,
      String size,
      String productionDateStart,
      String productionDateEnd,
      String checkTimeStart,
      String checkTimeEnd,
      String startTime,
      String endTime) {
    MaintenanceContext context = maintenanceContext();
    MaintenanceListQuery query =
        new MaintenanceListQuery(
            null,
            area,
            brand,
            null,
            null,
            checker,
            firstText(checkTimeEnd, endTime),
            firstText(checkTimeStart, startTime),
            PageRequestParams.normalizePage(currentPage, 1),
            currentPark,
            null,
            factoryId,
            null,
            null,
            null,
            loadCapacity,
            null,
            null,
            name,
            normalizedPageSize(pageSize, limit),
            parkId,
            null,
            productionDateEnd,
            productionDateStart,
            size,
            null,
            status,
            null);
    return maintenanceRepository.findElevatorPage(
        context.jdbcTemplate(), query, context.authorizedParkIds());
  }

  /** 升降机详情。 */
  public Map<String, Object> getElevatorDetail(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "elevatorId错误");
    }
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.findElevatorDetail(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  /** 新增升降机记录；只写主表白名单字段并校验目标园区权限。 */
  @Transactional
  public Map<String, Object> createElevator(MaintenanceElevatorUpdateRequest request) {
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.createElevator(
        context.jdbcTemplate(), request, context.authorizedParkIds());
  }

  /** 更新升降机记录；写接口必须登录并使用当前租户库。 */
  @Transactional
  public Map<String, Object> updateElevator(
      int id, MaintenanceElevatorUpdateRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "elevatorId错误");
    }
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.updateElevator(
        context.jdbcTemplate(), id, request, context.authorizedParkIds());
  }

  /** 删除升降机记录；旧接口为物理删除并返回被删除记录。 */
  @Transactional
  public Map<String, Object> deleteElevator(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "elevatorId错误");
    }
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.deleteElevator(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  /** 消防设施列表。 */
  public PageResult<Map<String, Object>> getFirefightingList(
      Integer currentPage,
      Integer pageSize,
      Integer limit,
      Integer parkId,
      Integer currentPark,
      Integer factoryId,
      String firefightingName,
      String address,
      String extinguisher,
      String hydrant,
      String fireExit,
      String checker,
      String startTime,
      String endTime) {
    MaintenanceContext context = maintenanceContext();
    MaintenanceListQuery query =
        new MaintenanceListQuery(
            address,
            null,
            null,
            null,
            null,
            checker,
            endTime,
            startTime,
            PageRequestParams.normalizePage(currentPage, 1),
            currentPark,
            extinguisher,
            factoryId,
            fireExit,
            firefightingName,
            hydrant,
            null,
            null,
            null,
            null,
            normalizedPageSize(pageSize, limit),
            parkId,
            null,
            null,
            null,
            null,
            null,
            null,
            null);
    return maintenanceRepository.findFirefightingPage(
        context.jdbcTemplate(), query, context.authorizedParkIds());
  }

  /** 消防设施详情。 */
  public Map<String, Object> getFirefightingDetail(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "firefightingId错误");
    }
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.findFirefightingDetail(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  /** 新增消防设施记录；只写主表字段，不写图片关系。 */
  @Transactional
  public Map<String, Object> createFirefighting(MaintenanceFirefightingUpdateRequest request) {
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.createFirefighting(
        context.jdbcTemplate(), request, context.authorizedParkIds());
  }

  /** 更新消防设施记录；仅写主表字段。 */
  @Transactional
  public Map<String, Object> updateFirefighting(
      int id, MaintenanceFirefightingUpdateRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "firefightingId错误");
    }
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.updateFirefighting(
        context.jdbcTemplate(), id, request, context.authorizedParkIds());
  }

  /** 删除消防设施记录；旧接口为物理删除并返回被删除记录。 */
  @Transactional
  public Map<String, Object> deleteFirefighting(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "firefightingId错误");
    }
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.deleteFirefighting(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  /** 变压器列表。 */
  public PageResult<Map<String, Object>> getTransformerList(
      Integer currentPage,
      Integer pageSize,
      Integer limit,
      Integer parkId,
      Integer currentPark,
      Integer factoryId,
      String transformerName,
      String address,
      String checker,
      String status,
      String specifications,
      String startTime,
      String endTime) {
    MaintenanceContext context = maintenanceContext();
    MaintenanceListQuery query =
        new MaintenanceListQuery(
            address,
            null,
            null,
            null,
            null,
            checker,
            endTime,
            startTime,
            PageRequestParams.normalizePage(currentPage, 1),
            currentPark,
            null,
            factoryId,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            normalizedPageSize(pageSize, limit),
            parkId,
            null,
            null,
            null,
            null,
            specifications,
            status,
            transformerName);
    return maintenanceRepository.findTransformerPage(
        context.jdbcTemplate(), query, context.authorizedParkIds());
  }

  /** 变压器详情。 */
  public Map<String, Object> getTransformerDetail(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "transformerId错误");
    }
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.findTransformerDetail(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  /** 新增变压器记录；只写本地 transformer 主表。 */
  @Transactional
  public Map<String, Object> createTransformer(MaintenanceTransformerUpdateRequest request) {
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.createTransformer(
        context.jdbcTemplate(), request, context.authorizedParkIds());
  }

  /** 更新变压器记录；只处理旧 transformer 主表字段。 */
  @Transactional
  public Map<String, Object> updateTransformer(
      int id, MaintenanceTransformerUpdateRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "transformerId错误");
    }
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.updateTransformer(
        context.jdbcTemplate(), id, request, context.authorizedParkIds());
  }

  /** 删除变压器记录；旧接口为物理删除并返回被删除记录。 */
  @Transactional
  public Map<String, Object> deleteTransformer(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "transformerId错误");
    }
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.deleteTransformer(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  /** 卫生检查列表。 */
  public PageResult<Map<String, Object>> getHygieneCheckList(
      Integer currentPage,
      Integer pageSize,
      Integer limit,
      Integer parkId,
      Integer currentPark,
      Integer factoryId,
      String checkItems,
      String checker,
      String checkResult,
      String startTime,
      String endTime) {
    MaintenanceContext context = maintenanceContext();
    MaintenanceListQuery query =
        new MaintenanceListQuery(
            null,
            null,
            null,
            checkItems,
            checkResult,
            checker,
            endTime,
            startTime,
            PageRequestParams.normalizePage(currentPage, 1),
            currentPark,
            null,
            factoryId,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            normalizedPageSize(pageSize, limit),
            parkId,
            null,
            null,
            null,
            null,
            null,
            null,
            null);
    return maintenanceRepository.findHygieneCheckPage(
        context.jdbcTemplate(), query, context.authorizedParkIds());
  }

  /** 卫生检查详情。 */
  public Map<String, Object> getHygieneCheckDetail(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "hygieneCheckId错误");
    }
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.findHygieneCheckDetail(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  /** 新增卫生检查记录；只写 hygiene_check 主表字段。 */
  @Transactional
  public Map<String, Object> createHygieneCheck(MaintenanceHygieneCheckUpdateRequest request) {
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.createHygieneCheck(
        context.jdbcTemplate(), request, context.authorizedParkIds());
  }

  /** 更新卫生检查记录；只处理 hygiene_check 主表字段。 */
  @Transactional
  public Map<String, Object> updateHygieneCheck(
      int id, MaintenanceHygieneCheckUpdateRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "hygieneCheckId错误");
    }
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.updateHygieneCheck(
        context.jdbcTemplate(), id, request, context.authorizedParkIds());
  }

  /** 删除卫生检查记录；旧接口为物理删除并返回被删除记录。 */
  @Transactional
  public Map<String, Object> deleteHygieneCheck(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "hygieneCheckId错误");
    }
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.deleteHygieneCheck(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  /** 厂房维护列表。 */
  public PageResult<Map<String, Object>> getFactoryMaintList(
      Integer currentPage,
      Integer pageSize,
      Integer limit,
      Integer parkId,
      Integer currentPark,
      Integer factoryId,
      String maintenanceItem,
      String maintenanceStatus,
      String personInCharge,
      String startTime,
      String endTime) {
    MaintenanceContext context = maintenanceContext();
    MaintenanceListQuery query =
        new MaintenanceListQuery(
            null,
            null,
            null,
            null,
            null,
            null,
            endTime,
            startTime,
            PageRequestParams.normalizePage(currentPage, 1),
            currentPark,
            null,
            factoryId,
            null,
            null,
            null,
            null,
            maintenanceItem,
            maintenanceStatus,
            null,
            normalizedPageSize(pageSize, limit),
            parkId,
            personInCharge,
            null,
            null,
            null,
            null,
            null,
            null);
    return maintenanceRepository.findFactoryMaintPage(
        context.jdbcTemplate(), query, context.authorizedParkIds());
  }

  /** 厂房维护详情。 */
  public Map<String, Object> getFactoryMaintDetail(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "factoryMaintenanceId错误");
    }
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.findFactoryMaintDetail(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  /** 新增厂房维护记录；只写 factory_maintenance 主表字段。 */
  @Transactional
  public Map<String, Object> createFactoryMaint(MaintenanceFactoryMaintUpdateRequest request) {
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.createFactoryMaint(
        context.jdbcTemplate(), request, context.authorizedParkIds());
  }

  /** 更新厂房维护记录；只处理 factory_maintenance 主表字段。 */
  @Transactional
  public Map<String, Object> updateFactoryMaint(
      int id, MaintenanceFactoryMaintUpdateRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "factoryMaintenanceId错误");
    }
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.updateFactoryMaint(
        context.jdbcTemplate(), id, request, context.authorizedParkIds());
  }

  /** 删除厂房维护记录；旧接口为物理删除并返回被删除记录。 */
  @Transactional
  public Map<String, Object> deleteFactoryMaint(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "factoryMaintenanceId错误");
    }
    MaintenanceContext context = maintenanceContext();
    return maintenanceRepository.deleteFactoryMaint(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  private MaintenanceContext maintenanceContext() {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return new MaintenanceContext(jdbcTemplate, authorizedParkIds);
  }

  private int normalizedPageSize(Integer pageSize, Integer limit) {
    return PageRequestParams.normalizePageSize(pageSize == null ? limit : pageSize, 20);
  }

  private String firstText(String primary, String fallback) {
    return StringUtils.hasText(primary) ? primary : fallback;
  }

  private record MaintenanceContext(JdbcTemplate jdbcTemplate, List<Integer> authorizedParkIds) {}
}
