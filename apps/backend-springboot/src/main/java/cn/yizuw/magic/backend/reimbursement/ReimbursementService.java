package cn.yizuw.magic.backend.reimbursement;

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
 * 报销模块只读服务。
 *
 * <p>审核权限来自登录 token 中的 {@code reimbursementAuth}；有审核权限按授权园区过滤，无审核权限只能查看本人申请。
 */
@Service
@Transactional(readOnly = true)
public class ReimbursementService {

  private final ParkScopeService parkScopeService;
  private final ReimbursementRepository reimbursementRepository;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public ReimbursementService(
      ParkScopeService parkScopeService,
      ReimbursementRepository reimbursementRepository,
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.parkScopeService = parkScopeService;
    this.reimbursementRepository = reimbursementRepository;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  public PageResult<Map<String, Object>> getList(
      String claimant,
      String department,
      String endDate,
      Integer pageNo,
      Integer pageSize,
      String payee,
      Integer parkId,
      String purpose,
      String startDate,
      Integer status) {
    ReimbursementContext context = reimbursementContext();
    ReimbursementQuery query =
        new ReimbursementQuery(
            claimant,
            department,
            endDate,
            PageRequestParams.normalizePage(pageNo, 1),
            PageRequestParams.normalizePageSize(pageSize, 10),
            payee,
            parkId,
            purpose,
            startDate,
            status);
    return reimbursementRepository.findPage(context.jdbcTemplate(), query, context.scope());
  }

  public Map<String, Object> getDetail(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的报销ID");
    }
    ReimbursementContext context = reimbursementContext();
    return reimbursementRepository.findDetail(context.jdbcTemplate(), id, context.scope());
  }

  /** 新增报销申请；只写 reimbursement 主表，不写图片关系、不触发财务同步。 */
  @Transactional(readOnly = false)
  public Map<String, Object> create(ReimbursementCreateRequest request) {
    ReimbursementContext context = reimbursementContext();
    return reimbursementRepository.create(
        context.jdbcTemplate(), request, context.scope());
  }

  /** 审核报销申请；本批不迁移审核通过后的 finance 同步副作用。 */
  @Transactional(readOnly = false)
  public Map<String, Object> audit(int id, ReimbursementAuditRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的报销ID");
    }
    int nextStatus = normalizeAuditStatus(request == null ? null : request.status());
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    if (payload.reimbursementAuth() == null || payload.reimbursementAuth() <= 0) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "无报销审核权限");
    }

    Map<String, Object> current = reimbursementRepository.findForWrite(jdbcTemplate, id);
    int currentStatus = intValue(current.get("status"), 0);
    if (currentStatus != 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "该报销记录已审核，无法重复操作");
    }
    int parkId = intValue(current.get("parkId"), 0);
    if (!authorizedParkIds.contains(parkId)) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "无该园区审核权限");
    }
    if (payload.rates() != null && payload.rates() >= 0) {
      java.math.BigDecimal amount = decimalValue(current.get("amount"));
      if (amount.compareTo(java.math.BigDecimal.valueOf(payload.rates())) > 0) {
        throw new BusinessException(HttpStatus.FORBIDDEN, "金额超出审核权限");
      }
    }

    String auditorName =
        payload.username() == null || payload.username().isBlank() ? "未知用户" : payload.username();
    String finalOpinion =
        "审核人：" + auditorName + "\n" + (request == null || request.auditOpinion() == null ? "" : request.auditOpinion());
    ReimbursementScope scope = new ReimbursementScope(true, payload.id(), authorizedParkIds);
    return reimbursementRepository.audit(jdbcTemplate, id, nextStatus, finalOpinion, scope);
  }

  /** 软删除报销申请；本批不联动删除已同步的 finance 记录。 */
  @Transactional(readOnly = false)
  public Map<String, Object> delete(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "无效的报销ID");
    }
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    Map<String, Object> current = reimbursementRepository.findForWrite(jdbcTemplate, id);
    boolean ownRecord =
        payload.id() != null && longValue(current.get("userId"), -1) == payload.id();
    boolean canDeleteByAuditRole =
        payload.reimbursementAuth() != null
            && payload.reimbursementAuth() > 0
            && authorizedParkIds.contains(intValue(current.get("parkId"), 0));
    if (!ownRecord && !canDeleteByAuditRole) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "无删除该报销记录权限");
    }
    return reimbursementRepository.softDelete(jdbcTemplate, id);
  }

  public Map<String, Object> getPendingCount() {
    ReimbursementContext context = reimbursementContext();
    return Map.of("count", reimbursementRepository.countPending(context.jdbcTemplate(), context.scope()));
  }

  public Map<String, Object> getSummary(
      String claimant,
      String department,
      String endDate,
      Integer parkId,
      String payee,
      String purpose,
      String startDate,
      Integer status) {
    ReimbursementContext context = reimbursementContext();
    ReimbursementQuery query =
        new ReimbursementQuery(
            claimant, department, endDate, 1, 10, payee, parkId, purpose, startDate, status);
    return reimbursementRepository.summary(context.jdbcTemplate(), query, context.scope());
  }

  public Map<String, Object> getAnalysis(
      String endDate, Integer parkId, String startDate, Integer status) {
    ReimbursementContext context = reimbursementContext();
    if (!context.scope().hasAuditPermission()) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "无报销分析权限");
    }
    return reimbursementRepository.analysis(
        context.jdbcTemplate(), startDate, endDate, parkId, status, context.scope());
  }

  private ReimbursementContext reimbursementContext() {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    boolean hasAuditPermission = payload.reimbursementAuth() != null && payload.reimbursementAuth() > 0;
    return new ReimbursementContext(
        jdbcTemplate, new ReimbursementScope(hasAuditPermission, payload.id(), authorizedParkIds));
  }

  private int normalizeAuditStatus(Object value) {
    int status = intValue(value, -1);
    if (status != 1 && status != 2) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "审核状态无效");
    }
    return status;
  }

  private int intValue(Object value, int fallback) {
    if (value instanceof Number number) {
      return number.intValue();
    }
    try {
      return Integer.parseInt(String.valueOf(value == null ? "" : value).trim());
    } catch (RuntimeException error) {
      return fallback;
    }
  }

  private long longValue(Object value, long fallback) {
    if (value instanceof Number number) {
      return number.longValue();
    }
    try {
      return Long.parseLong(String.valueOf(value == null ? "" : value).trim());
    } catch (RuntimeException error) {
      return fallback;
    }
  }

  private java.math.BigDecimal decimalValue(Object value) {
    if (value instanceof java.math.BigDecimal decimal) {
      return decimal;
    }
    if (value instanceof Number number) {
      return java.math.BigDecimal.valueOf(number.doubleValue());
    }
    try {
      return new java.math.BigDecimal(String.valueOf(value == null ? "0" : value));
    } catch (RuntimeException error) {
      return java.math.BigDecimal.ZERO;
    }
  }

  private record ReimbursementContext(JdbcTemplate jdbcTemplate, ReimbursementScope scope) {}
}
