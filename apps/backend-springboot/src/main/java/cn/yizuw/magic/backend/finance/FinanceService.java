package cn.yizuw.magic.backend.finance;

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
 * 第十批财务只读接口服务。
 *
 * <p>服务层统一解析登录态、租户库和园区权限；本批不迁移旧 GET 接口中的写入同步副作用。
 */
@Service
@Transactional(readOnly = true)
public class FinanceService {

  private final FinanceRepository financeRepository;
  private final ParkScopeService parkScopeService;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public FinanceService(
      FinanceRepository financeRepository,
      ParkScopeService parkScopeService,
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.financeRepository = financeRepository;
    this.parkScopeService = parkScopeService;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  public PageResult<Map<String, Object>> getFinanceList(
      String amount,
      String billCategory,
      String billName,
      Integer currentPage,
      String endTime,
      Integer pageSize,
      Integer parkId,
      String startTime,
      Integer status,
      String transactionType) {
    FinanceContext context = financeContext();
    FinanceQuery query =
        new FinanceQuery(
            amount,
            billCategory,
            billName,
            PageRequestParams.normalizePage(currentPage, 1),
            endTime,
            PageRequestParams.normalizePageSize(pageSize, 20),
            parkId,
            startTime,
            status,
            transactionType);
    return financeRepository.findFinancePage(
        context.jdbcTemplate(), query, context.authorizedParkIds());
  }

  public Map<String, Object> getFinanceDetail(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "financeId错误");
    }
    FinanceContext context = financeContext();
    return financeRepository.findFinanceDetail(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  /** 新增财务流水主表记录；不写 finance_image，也不触发租赁业务同步。 */
  @Transactional
  public Map<String, Object> createFinance(FinanceCreateRequest request) {
    FinanceContext context = financeContext();
    return financeRepository.createFinance(
        context.jdbcTemplate(), request, context.authorizedParkIds());
  }

  /** 逻辑删除财务流水；写入前复用详情方法的园区权限校验。 */
  @Transactional
  public Map<String, Object> deleteFinance(int id) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "financeId错误");
    }
    FinanceContext context = financeContext();
    return financeRepository.softDeleteFinance(
        context.jdbcTemplate(), id, context.authorizedParkIds());
  }

  /** 批量软删当前用户授权园区内的财务流水；不触发租赁财务同步。 */
  @Transactional
  public Map<String, Object> deleteAuthorizedFinances() {
    FinanceContext context = financeContext();
    return financeRepository.softDeleteAuthorizedFinances(
        context.jdbcTemplate(), context.authorizedParkIds());
  }

  /** 更新财务流水主表字段；不重建 finance_image，也不触发租赁费用同步。 */
  @Transactional
  public Map<String, Object> updateFinance(int id, FinanceUpdateRequest request) {
    if (id <= 0) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "financeId错误");
    }
    FinanceContext context = financeContext();
    return financeRepository.updateFinance(
        context.jdbcTemplate(), id, request, context.authorizedParkIds());
  }

  public List<Map<String, Object>> getBillNameOptions(
      String keyword, Integer parkId, Integer currentPark) {
    FinanceContext context = financeContext();
    Integer requestedParkId = parkId == null ? currentPark : parkId;
    return financeRepository.findBillNameOptions(
        context.jdbcTemplate(), keyword, requestedParkId, context.authorizedParkIds());
  }

  private FinanceContext financeContext() {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return new FinanceContext(jdbcTemplate, authorizedParkIds);
  }

  private record FinanceContext(JdbcTemplate jdbcTemplate, List<Integer> authorizedParkIds) {}
}
