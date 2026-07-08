package cn.yizuw.magic.backend.bill;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.messaging.rabbit.RabbitMessagePublisher;
import cn.yizuw.magic.backend.messaging.rabbit.RabbitMessageRequest;
import cn.yizuw.magic.backend.park.ParkScopeService;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantJdbcTemplateProvider;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import com.fasterxml.jackson.databind.ObjectMapper;
import javax.sql.DataSource;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 总账单只读辅助服务，统一处理登录态、租户库和园区权限。 */
@Service
@Transactional(readOnly = true)
public class AmountBillService {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  private final AmountBillRepository amountBillRepository;
  private final ParkScopeService parkScopeService;
  private final RabbitMessagePublisher rabbitMessagePublisher;
  private final TenantJdbcTemplateProvider tenantJdbcTemplateProvider;

  public AmountBillService(
      AmountBillRepository amountBillRepository,
      ParkScopeService parkScopeService,
      RabbitMessagePublisher rabbitMessagePublisher,
      TenantJdbcTemplateProvider tenantJdbcTemplateProvider) {
    this.amountBillRepository = amountBillRepository;
    this.parkScopeService = parkScopeService;
    this.rabbitMessagePublisher = rabbitMessagePublisher;
    this.tenantJdbcTemplateProvider = tenantJdbcTemplateProvider;
  }

  /** 总账单分页列表，保持旧接口 summary 和收款状态字段。 */
  public Map<String, Object> getAmountBillList(AmountBillListQuery query) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return amountBillRepository.findAmountBillPage(jdbcTemplate, query, authorizedParkIds);
  }

  /** 总账单详情；非法 ID 保持旧接口 `billId错误` 文案。 */
  public Map<String, Object> getAmountBillDetail(Integer billId) {
    UserTokenPayload payload = TenantRequired.currentUser();
    if (billId == null || billId <= 0) {
      throw new BusinessException(HttpStatus.OK, "billId错误");
    }
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return amountBillRepository.findAmountBillDetail(jdbcTemplate, billId, authorizedParkIds);
  }

  public List<Map<String, Object>> getProjectOptions(
      String keyword, Integer currentPark, Integer parkId) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    Integer requestedParkId = parkId == null ? currentPark : parkId;
    return amountBillRepository.findProjectOptions(
        jdbcTemplate, keyword, requestedParkId, authorizedParkIds);
  }

  /**
   * 旧 Nitro 工具文件兼容说明。
   *
   * <p>`utils.ts` 和 `delete-utils.ts` 原本是服务端内部复用函数，不是业务接口；迁移期显式返回说明，
   * 让路由差异可追踪，同时避免暴露无权限边界的删除/财务同步工具。
   */
  public Map<String, Object> getAmountBillUtilityRouteInfo(String name) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("externalRoute", false);
    result.put("module", "amount-bill");
    result.put("name", name);
    result.put("status", "compatibility_stub");
    result.put("message", "该路径在旧 Nitro 中是 api 目录下的内部工具文件，Spring Boot 不提供直接业务操作。");
    return result;
  }

  /** 导出总账单 JSON 数据，按授权园区过滤，保持旧接口返回分组结构。 */
  public List<Map<String, Object>> exportAmountBills(AmountBillExportRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return amountBillRepository.exportAmountBills(jdbcTemplate, request, authorizedParkIds);
  }

  /** 催缴短信预览只读计算；不会发送短信，也不会写发送日志。 */
  public Map<String, Object> previewCollectionSms(AmountBillCollectionSmsPreviewRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return amountBillRepository.previewCollectionSms(jdbcTemplate, request, authorizedParkIds);
  }

  /** 新增总账单；本批只写账单主表和水电明细，不直接创建 finance。 */
  @Transactional(readOnly = false)
  public Map<String, Object> createAmountBill(AmountBillSaveRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return amountBillRepository.createAmountBill(
        tenantJdbcTemplateProvider.currentTenantDataSource(), request, authorizedParkIds);
  }

  /** 更新总账单；水电明细采用显式传入才重建的低风险边界。 */
  @Transactional(readOnly = false)
  public Map<String, Object> updateAmountBill(Integer billId, AmountBillSaveRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    if (billId == null || billId <= 0) {
      throw new BusinessException(HttpStatus.OK, "billId错误");
    }
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return amountBillRepository.updateAmountBill(
        tenantJdbcTemplateProvider.currentTenantDataSource(), billId, request, authorizedParkIds);
  }

  /**
   * 催缴短信发送兼容入口。
   *
   * <p>迁移期不直连短信供应商，先复用预览候选并投递 RabbitMQ 通知任务，消费者和真实短信回执后续专项补齐。
   */
  public Map<String, Object> enqueueCollectionSms(AmountBillCollectionSmsPreviewRequest request) {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    Map<String, Object> preview = amountBillRepository.previewCollectionSms(jdbcTemplate, request, authorizedParkIds);
    List<Integer> billIds = amountBillRepository.normalizeCollectionSmsBillIds(request);
    if (billIds.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "请选择要发送催收短信的账单");
    }

    Map<Integer, Map<String, Object>> itemsByBillId = new LinkedHashMap<>();
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> items = (List<Map<String, Object>>) preview.getOrDefault("items", List.of());
    for (Map<String, Object> item : items) {
      Object rawBillId = item.get("billId");
      if (rawBillId instanceof Number number) {
        itemsByBillId.put(number.intValue(), item);
      }
    }

    List<Map<String, Object>> results = new ArrayList<>();
    int successCount = 0;
    for (Integer billId : billIds) {
      Map<String, Object> item = itemsByBillId.get(billId);
      if (item == null) {
        results.add(sendResult(billId, false, "账单不存在、已结清或超出当前权限范围", null, item));
        continue;
      }
      if (!Boolean.TRUE.equals(item.get("canSend"))) {
        results.add(sendResult(billId, false, String.valueOf(item.getOrDefault("reason", "账单不可发送催收短信")), null, item));
        continue;
      }
      String messageId = rabbitMessagePublisher.publishNotification(collectionSmsMessageRequest(payload, item, preview));
      results.add(sendResult(billId, true, null, messageId, item));
      successCount += 1;
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("failedCount", results.size() - successCount);
    result.put("results", results);
    result.put("successCount", successCount);
    result.put("summary", preview.get("summary"));
    result.put("totalCount", results.size());
    result.put("transport", "rabbitmq");
    return result;
  }

  /** 删除总账单主记录、水电明细并软删关联财务流水。 */
  @Transactional(readOnly = false)
  public Map<String, Object> deleteAmountBill(Integer billId) {
    UserTokenPayload payload = TenantRequired.currentUser();
    if (billId == null || billId <= 0) {
      throw new BusinessException(HttpStatus.OK, "billId错误");
    }
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    DataSource dataSource = tenantJdbcTemplateProvider.currentTenantDataSource();
    return amountBillRepository.deleteAmountBill(dataSource, billId, authorizedParkIds);
  }

  /** 批量删除当前用户授权园区内的总账单；不执行旧端无范围全库删除。 */
  @Transactional(readOnly = false)
  public Map<String, Object> deleteAuthorizedAmountBills() {
    UserTokenPayload payload = TenantRequired.currentUser();
    JdbcTemplate jdbcTemplate = tenantJdbcTemplateProvider.currentTenantJdbcTemplate();
    List<Integer> authorizedParkIds = parkScopeService.resolveAuthorizedParkIds(jdbcTemplate, payload);
    return amountBillRepository.deleteAuthorizedAmountBills(
        tenantJdbcTemplateProvider.currentTenantDataSource(), authorizedParkIds);
  }

  private RabbitMessageRequest collectionSmsMessageRequest(
      UserTokenPayload payload, Map<String, Object> item, Map<String, Object> preview) {
    String payloadJson;
    try {
      payloadJson =
          OBJECT_MAPPER.writeValueAsString(
              Map.of(
                  "item", item,
                  "options", preview.getOrDefault("options", Map.of()),
                  "source", "amount_bill_collection_sms"));
    } catch (Exception error) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "催缴短信任务序列化失败");
    }
    String billId = String.valueOf(item.get("billId"));
    return new RabbitMessageRequest(
        billId,
        "amount_bill_collection_sms",
        payload.customerId(),
        Map.of("source", "springboot_migration"),
        "amount-bill-collection-sms:" + billId,
        null,
        payloadJson,
        null);
  }

  private Map<String, Object> sendResult(
      int billId, boolean success, String error, String messageId, Map<String, Object> item) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("billId", billId);
    result.put("success", success);
    if (error != null) {
      result.put("error", error);
    }
    if (messageId != null) {
      result.put("messageId", messageId);
      result.put("sendChannel", "rabbitmq");
    }
    if (item != null) {
      result.put("parkName", item.get("parkName"));
      result.put("phoneNumber", item.get("phoneNumber"));
      result.put("projectName", item.get("projectName"));
      result.put("smsCompanyName", item.get("smsCompanyName"));
      result.put("templateId", item.get("smsTemplateId"));
      result.put("tenantName", item.get("tenantName"));
    } else {
      result.put("projectName", "");
      result.put("tenantName", "");
    }
    return result;
  }
}
