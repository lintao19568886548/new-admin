package cn.yizuw.magic.backend.access;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.common.PageRequestParams;
import cn.yizuw.magic.backend.common.PageResult;
import cn.yizuw.magic.backend.park.ParkScopeService;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * 门禁模块接口服务。
 *
 * <p>统一在服务层解析登录态、租户库和园区数据权限，保证读写接口的访问边界一致。
 */
@Service
public class AccessService {

  private static final Pattern MAINLAND_PHONE_PATTERN = Pattern.compile("^1[3-9]\\d{9}$");

  private final AccessRepository accessRepository;
  private final ParkScopeService parkScopeService;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public AccessService(
      AccessRepository accessRepository,
      ParkScopeService parkScopeService,
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.accessRepository = accessRepository;
    this.parkScopeService = parkScopeService;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  public PageResult<Map<String, Object>> getBrandList(
      Integer currentPage,
      Integer pageSize,
      String brandName,
      String brandCode,
      String protocolType,
      String enabled,
      String isDefault) {
    TenantRequired.currentUser();
    return accessRepository.findBrandPage(
        tenantJdbcTemplateProvider.currentTenantJdbcTemplate(),
        PageRequestParams.normalizePage(currentPage, 1),
        PageRequestParams.normalizePageSize(pageSize, 20),
        blankToNull(brandName),
        blankToNull(brandCode),
        blankToNull(protocolType),
        normalizeOptionalBoolean(enabled),
        normalizeOptionalBoolean(isDefault));
  }

  public List<Map<String, String>> getBrandOptions(String field, String keyword) {
    TenantRequired.currentUser();
    return accessRepository.findBrandOptions(
        tenantJdbcTemplateProvider.currentTenantJdbcTemplate(),
        normalizeBrandOptionField(field),
        blankToNull(keyword));
  }

  public Map<String, Object> getBrandDetail(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "accessBrandId 错误");
    }
    TenantRequired.currentUser();
    return accessRepository.findBrandDetail(tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), id);
  }

  /** 新增门禁品牌；只写租户库 access_brand，不调用外部门禁平台。 */
  public Map<String, Object> createBrand(AccessBrandRequest request) {
    TenantRequired.currentUser();
    Map<String, Object> data = normalizeBrandData(request, true);
    return accessRepository.createBrand(tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), data);
  }

  /** 更新门禁品牌；isDefault=true 时仓储层在同一租户库事务中清理其它默认品牌。 */
  public Map<String, Object> updateBrand(int id, AccessBrandRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "accessBrandId 错误");
    }
    TenantRequired.currentUser();
    Map<String, Object> data = normalizeBrandData(request, false);
    return accessRepository.updateBrand(tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), id, data);
  }

  /** 删除门禁品牌，返回删除前记录用于兼容旧 Prisma delete 响应。 */
  public Map<String, Object> deleteBrand(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "accessBrandId 错误");
    }
    TenantRequired.currentUser();
    return accessRepository.deleteBrand(tenantJdbcTemplateProvider.currentTenantJdbcTemplate(), id);
  }

  private String normalizeBrandOptionField(String field) {
    String value = field == null ? "" : field.trim();
    if ("brandCode".equals(value) || "protocolType".equals(value)) {
      return value;
    }
    return "brandName";
  }

  public PageResult<Map<String, Object>> getVisitorList(
      Integer currentPage,
      Integer pageSize,
      Integer parkId,
      Integer currentPark,
      String visitorName,
      String phoneNumber,
      String carNum,
      Integer status,
      String registerTime) {
    AccessContext context = accessContext();
    AccessListQuery query =
        new AccessListQuery(
            carNum,
            null,
            PageRequestParams.normalizePage(currentPage, 1),
            currentPark,
            null,
            null,
            null,
            PageRequestParams.normalizePageSize(pageSize, 20),
            parkId,
            phoneNumber,
            registerTime,
            status,
            visitorName);
    return accessRepository.findVisitorPage(
        context.jdbcTemplate(), query, context.authorizedParkIds());
  }

  public Map<String, Object> getVisitorDetail(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "visitorId错误");
    }
    AccessContext context = accessContext();
    return accessRepository.findVisitorDetail(context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  /**
   * 新增访客出入记录。
   *
   * <p>旧中间件把 `/access/visitor` 作为公开接口；这里保持无 token 时写默认租户库，有 token 时写当前租户库并校验园区范围。
   */
  public Map<String, Object> createVisitor(AccessVisitorCreateRequest request) {
    Integer parkId = normalizePositiveInteger(request == null ? null : request.parkId(), "园区ID错误");
    String visitorName = requiredText(request == null ? null : request.visitorName(), "姓名不能为空");
    String phoneNumber = requiredText(request == null ? null : request.phoneNumber(), "手机号不能为空");
    Integer status = normalizeRequiredStatus(request == null ? null : request.status(), "访问状态不能为空");

    UserTokenPayload payload = cn.yizuw.magic.backend.tenant.TenantContext.get();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentOrDefaultTenantJdbcTemplate();
    if (payload != null && payload.customerId() != null) {
      List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
      assertWritablePark(parkId, authorizedParkIds);
    }
    return accessRepository.createVisitor(
        jdbcTemplate,
        visitorName,
        phoneNumber,
        uppercaseBlankToNull(request == null ? null : request.carNum()),
        blankToNull(request == null ? null : request.remark()),
        status,
        normalizeRegisterTimestamp(request == null ? null : request.registerTime()),
        parkId);
  }

  /** 更新访客记录；写入前后都按当前用户园区范围校验。 */
  public Map<String, Object> updateVisitor(int id, AccessVisitorUpdateRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "visitorId错误");
    }
    AccessContext context = accessContext();
    return accessRepository.updateVisitor(
        context.jdbcTemplate(), id, request, context.authorizedParkIds());
  }

  /** 删除访客记录；旧接口为物理删除。 */
  public void deleteVisitor(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "visitorId错误");
    }
    AccessContext context = accessContext();
    accessRepository.deleteVisitor(context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  /**
   * 公开访客登记。
   *
   * <p>旧中间件允许该接口未登录访问；Spring Boot 保持有 token 写当前租户库、无 token 写默认租户库。
   */
  public Map<String, Object> registerVisitor(AccessVisitorRegisterRequest request) {
    String visitorName = request == null ? null : trim(request.visitorName());
    if (!StringUtils.hasText(visitorName)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "姓名不能为空");
    }
    String phoneNumber = request == null ? null : trim(request.phoneNumber());
    if (!StringUtils.hasText(phoneNumber) || !MAINLAND_PHONE_PATTERN.matcher(phoneNumber).matches()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "请输入正确的手机号码");
    }
    Integer status = normalizeVisitorStatus(request == null ? null : request.status());
    if (status == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "访问状态不能为空");
    }

    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentOrDefaultTenantJdbcTemplate();
    Map<String, Object> visitor =
        accessRepository.createVisitorRegistration(
            jdbcTemplate,
            visitorName,
            phoneNumber,
            blankToNull(request == null ? null : request.carNum()),
            blankToNull(request == null ? null : request.remark()),
            status,
            normalizeRegisterTimestamp(request == null ? null : request.registerTime()));
    return Map.of("data", visitor, "message", "访客登记成功", "success", true);
  }

  public PageResult<Map<String, Object>> getCarList(
      Integer currentPage,
      Integer pageSize,
      Integer parkId,
      Integer currentPark,
      String carNumber,
      Integer status,
      String registerTime) {
    AccessContext context = accessContext();
    AccessListQuery query =
        new AccessListQuery(
            null,
            carNumber,
            PageRequestParams.normalizePage(currentPage, 1),
            currentPark,
            null,
            null,
            null,
            PageRequestParams.normalizePageSize(pageSize, 20),
            parkId,
            null,
            registerTime,
            status,
            null);
    return accessRepository.findCarPage(context.jdbcTemplate(), query, context.authorizedParkIds());
  }

  public Map<String, Object> getCarDetail(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "carId错误");
    }
    AccessContext context = accessContext();
    return accessRepository.findCarDetail(context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  /** 新增车辆出入记录；写入前校验当前用户对目标园区有操作权限。 */
  public Map<String, Object> createCar(AccessCarCreateRequest request) {
    String carNumber = requiredText(request == null ? null : request.carNumber(), "车牌号码不能为空");
    Integer parkId = normalizePositiveInteger(request == null ? null : request.parkId(), "parkId参数错误");
    Integer status = normalizeRequiredStatus(request == null ? null : request.status(), "status参数错误");
    AccessContext context = accessContext();
    assertWritablePark(parkId, context.authorizedParkIds());
    return accessRepository.createCar(
        context.jdbcTemplate(),
        carNumber.trim().toUpperCase(),
        status,
        normalizeRegisterTimestamp(request == null ? null : request.registerTime()),
        blankToNull(request == null ? null : request.remark()),
        parkId);
  }

  /** 更新车辆出入记录；写入前后都按当前用户园区范围校验。 */
  public Map<String, Object> updateCar(int id, AccessCarUpdateRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "carId错误");
    }
    AccessContext context = accessContext();
    return accessRepository.updateCar(
        context.jdbcTemplate(), id, request, context.authorizedParkIds());
  }

  /** 删除车辆出入记录；旧接口为物理删除。 */
  public void deleteCar(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "carId错误");
    }
    AccessContext context = accessContext();
    accessRepository.deleteCar(context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  public PageResult<Map<String, Object>> getDoorList(
      Integer currentPage,
      Integer pageSize,
      Integer parkId,
      Integer currentPark,
      String deviceCode,
      String deviceName,
      String location,
      Integer status) {
    AccessContext context = accessContext();
    AccessListQuery query =
        new AccessListQuery(
            null,
            null,
            PageRequestParams.normalizePage(currentPage, 1),
            currentPark,
            deviceCode,
            deviceName,
            location,
            PageRequestParams.normalizePageSize(pageSize, 20),
            parkId,
            null,
            null,
            status,
            null);
    return accessRepository.findDoorPage(context.jdbcTemplate(), query, context.authorizedParkIds());
  }

  /** 新增门禁设备；只写 access_door 主表，不触发外部硬件同步。 */
  public Map<String, Object> createDoor(AccessDoorCreateRequest request) {
    String deviceCode = requiredText(request == null ? null : request.deviceCode(), "设备编号不能为空");
    String deviceName = requiredText(request == null ? null : request.deviceName(), "门禁设备名称不能为空");
    String location = requiredText(request == null ? null : request.location(), "所在地点不能为空");
    Integer parkId = normalizePositiveInteger(request == null ? null : request.parkId(), "园区ID错误");
    Integer status = normalizeDoorStatus(request == null ? null : request.status());
    if (status == null || status != 0 && status != 1) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "status参数错误");
    }
    AccessContext context = accessContext();
    assertWritablePark(parkId, context.authorizedParkIds());
    return accessRepository.createDoor(
        context.jdbcTemplate(),
        deviceCode.trim().toUpperCase(),
        deviceName,
        location,
        parkId,
        status);
  }

  /** 更新门禁设备状态，严格限制 status 只能为 0 或 1。 */
  public Map<String, Object> updateDoorStatus(int id, AccessDoorStatusRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "deviceId错误");
    }
    Integer status = normalizeDoorStatus(request == null ? null : request.status());
    if (status == null || status != 0 && status != 1) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "status参数错误");
    }
    AccessContext context = accessContext();
    return accessRepository.updateDoorStatus(
        context.jdbcTemplate(), id, status, context.authorizedParkIds());
  }

  /** 删除门禁设备；仓储层复用详情读取逻辑校验园区操作权限。 */
  public void deleteDoor(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "deviceId错误");
    }
    AccessContext context = accessContext();
    accessRepository.deleteDoor(context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  private AccessContext accessContext() {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return new AccessContext(jdbcTemplate, authorizedParkIds);
  }

  private Integer normalizeDoorStatus(Object value) {
    if (value instanceof Number number) {
      return number.intValue();
    }
    if (value instanceof String text && !text.isBlank()) {
      try {
        return Integer.parseInt(text.trim());
      } catch (NumberFormatException ignored) {
        return null;
      }
    }
    return null;
  }

  private Integer normalizeVisitorStatus(Object value) {
    if (value == null) {
      return null;
    }
    if (value instanceof Number number) {
      return number.intValue();
    }
    String text = String.valueOf(value).trim();
    if ("进入".equals(text)) {
      return 0;
    }
    if ("离开".equals(text)) {
      return 1;
    }
    if (!StringUtils.hasText(text)) {
      return null;
    }
    try {
      return Integer.parseInt(text);
    } catch (NumberFormatException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "访问状态不能为空");
    }
  }

  private Integer normalizeRequiredStatus(Object value, String message) {
    Integer status = normalizeVisitorStatus(value);
    if (status == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
    return status;
  }

  private Integer normalizePositiveInteger(Object value, String message) {
    Integer number = normalizeDoorStatus(value);
    if (number == null || number <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
    return number;
  }

  private void assertWritablePark(Integer parkId, List<Integer> authorizedParkIds) {
    if (parkId != null && !authorizedParkIds.contains(parkId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "没有操作权限");
    }
  }

  private Map<String, Object> normalizeBrandData(AccessBrandRequest request, boolean create) {
    Map<String, Object> data = new LinkedHashMap<>();
    if (create) {
      data.put("brandName", requiredText(request == null ? null : request.brandName(), "品牌名称不能为空"));
      data.put("brandCode", requiredText(request == null ? null : request.brandCode(), "品牌编码不能为空").toUpperCase());
      data.put("enabled", normalizeBoolean(request == null ? null : request.enabled(), true));
      data.put("isDefault", normalizeBoolean(request == null ? null : request.isDefault(), false));
    } else if (request != null) {
      if (request.brandName() != null) {
        data.put("brandName", requiredText(request.brandName(), "品牌名称不能为空"));
      }
      if (request.brandCode() != null) {
        data.put("brandCode", requiredText(request.brandCode(), "品牌编码不能为空").toUpperCase());
      }
      if (request.enabled() != null) {
        data.put("enabled", normalizeBoolean(request.enabled(), true));
      }
      if (request.isDefault() != null) {
        data.put("isDefault", normalizeBoolean(request.isDefault(), false));
      }
    }
    if (request != null) {
      putNullableText(data, "apiEndpoint", request.apiEndpoint());
      putNullableText(data, "appKey", request.appKey());
      putNullableText(data, "appSecretRef", request.appSecretRef());
      putNullableText(data, "protocolType", request.protocolType());
      putNullableText(data, "remark", request.remark());
    }
    return data;
  }

  private void putNullableText(Map<String, Object> data, String key, String value) {
    if (value != null) {
      data.put(key, blankToNull(value));
    }
  }

  private Boolean normalizeOptionalBoolean(Object value) {
    String text = value == null ? "" : String.valueOf(value).trim();
    return StringUtils.hasText(text) ? normalizeBoolean(value, false) : null;
  }

  private boolean normalizeBoolean(Object value, boolean fallback) {
    if (value == null || !StringUtils.hasText(String.valueOf(value))) {
      return fallback;
    }
    if (value instanceof Boolean bool) {
      return bool;
    }
    String text = String.valueOf(value).trim();
    return "true".equalsIgnoreCase(text) || "1".equals(text);
  }

  private Timestamp normalizeRegisterTimestamp(String value) {
    if (!StringUtils.hasText(value)) {
      return Timestamp.from(Instant.now());
    }
    String text = value.trim();
    try {
      return Timestamp.from(Instant.parse(text));
    } catch (DateTimeParseException ignored) {
      // Continue with offset/local legacy date-time formats.
    }
    try {
      return Timestamp.from(OffsetDateTime.parse(text).toInstant());
    } catch (DateTimeParseException ignored) {
      // Continue with yyyy-MM-dd HH:mm:ss or yyyy-MM-ddTHH:mm:ss.
    }
    try {
      String normalized = text.replace('T', ' ');
      if (normalized.length() == 10) {
        normalized = normalized + " 00:00:00";
      }
      return Timestamp.valueOf(LocalDateTime.parse(normalized.replace(' ', 'T')));
    } catch (RuntimeException error) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "registerTime参数错误");
    }
  }

  private String trim(String value) {
    return value == null ? null : value.trim();
  }

  private String requiredText(String value, String message) {
    String text = trim(value);
    if (!StringUtils.hasText(text)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
    return text;
  }

  private String blankToNull(String value) {
    String text = trim(value);
    return StringUtils.hasText(text) ? text : null;
  }

  private String uppercaseBlankToNull(String value) {
    String text = blankToNull(value);
    return text == null ? null : text.toUpperCase();
  }

  private record AccessContext(JdbcTemplate jdbcTemplate, List<Integer> authorizedParkIds) {}
}
