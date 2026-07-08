package cn.yizuw.magic.backend.integration.wechat;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.config.AppProperties;
import cn.yizuw.magic.backend.messaging.BusinessOutboxPublisher;
import cn.yizuw.magic.backend.messaging.VipMembershipPaymentCreatedEvent;
import cn.yizuw.magic.backend.messaging.VipMembershipPaymentNotifiedEvent;
import cn.yizuw.magic.backend.messaging.VipMembershipRefundNotifiedEvent;
import cn.yizuw.magic.backend.messaging.VipMembershipRefundRequestedEvent;
import cn.yizuw.magic.backend.security.UserTokenPayload;
import cn.yizuw.magic.backend.tenant.TenantRequired;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * 会员退款订单只读服务。
 *
 * <p>旧 GET 仅组装中心库订单、权益、退款和开通任务状态；这里不调用微信、不创建退款、不更新权益。
 */
@Service
@Transactional(readOnly = true)
public class WechatPayRefundOrderService {

  private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Shanghai");
  private static final String ACTIVE_ENTITLEMENT_STATUS = "active";
  private static final ObjectMapper JSON = new ObjectMapper();
  private static final int VIP_MEMBERSHIP_AMOUNT_TOTAL = 98_000;

  private final AppProperties appProperties;
  private final BusinessOutboxPublisher businessOutboxPublisher;
  private final JdbcTemplate centerJdbcTemplate;
  private final Environment environment;
  private final WechatPayNotificationDecryptService notificationDecryptService;
  private final WechatPaySignatureVerificationService signatureVerificationService;

  public WechatPayRefundOrderService(
      AppProperties appProperties,
      BusinessOutboxPublisher businessOutboxPublisher,
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate) {
    this(appProperties, businessOutboxPublisher, centerJdbcTemplate, null, null, null);
  }

  public WechatPayRefundOrderService(
      AppProperties appProperties,
      BusinessOutboxPublisher businessOutboxPublisher,
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate,
      WechatPaySignatureVerificationService signatureVerificationService,
      Environment environment) {
    this(appProperties, businessOutboxPublisher, centerJdbcTemplate, signatureVerificationService, null, environment);
  }

  @Autowired
  public WechatPayRefundOrderService(
      AppProperties appProperties,
      BusinessOutboxPublisher businessOutboxPublisher,
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate,
      WechatPaySignatureVerificationService signatureVerificationService,
      WechatPayNotificationDecryptService notificationDecryptService,
      Environment environment) {
    this.appProperties = appProperties;
    this.businessOutboxPublisher = businessOutboxPublisher;
    this.centerJdbcTemplate = centerJdbcTemplate;
    this.environment = environment;
    this.notificationDecryptService = notificationDecryptService;
    this.signatureVerificationService = signatureVerificationService;
  }

  /** 查询当前组织空间可展示的会员退款订单；仍保留旧端 Super 角色限制。 */
  public Map<String, Object> listRefundOrders() {
    UserTokenPayload payload = TenantRequired.currentUser();
    if (payload.roles() == null || !payload.roles().contains("Super")) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "仅 Super 角色可查看会员退款订单");
    }

    String customerId = clean(payload.customerId());
    if (!StringUtils.hasText(customerId)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少组织空间信息，无法读取组织订单");
    }
    String defaultCustomerId =
        clean(appProperties.getDefaultCustomerId()) == null
            ? "default"
            : clean(appProperties.getDefaultCustomerId());
    boolean allowCrossCustomerRead = Objects.equals(customerId, defaultCustomerId);
    if (!allowCrossCustomerRead && Set.of("default", "public").contains(customerId)) {
      return Map.of("items", List.of());
    }

    if (!hasTables(
        "vip_membership_payment",
        "vip_membership_entitlement",
        "vip_membership_refund",
        "tenant_provisioning_job")) {
      return Map.of("items", List.of());
    }

    List<Map<String, Object>> payments = findPayments(customerId);
    List<Map<String, Object>> entitlements = findEntitlements(customerId);
    List<Map<String, Object>> refunds = findRefunds(customerId);
    List<Map<String, Object>> jobs = findProvisioningJobs(customerId);
    Map<Integer, Map<String, Object>> organizations = findOrganizations(payments, jobs);
    Map<String, Map<String, Object>> entitlementMap = keyedBy(entitlements, "outTradeNo");
    Map<String, Map<String, Object>> latestRefundMap = latestRefundByOutTradeNo(refunds);
    Map<String, Map<String, Object>> jobByOutTradeNo = jobByOutTradeNo(jobs);
    Map<Integer, Map<String, Object>> jobBySourceOrgId = jobBySourceOrgId(jobs);
    Set<String> refundableOutTradeNos = refundableOutTradeNos(entitlements);

    List<Map<String, Object>> items = new ArrayList<>();
    for (Map<String, Object> payment : payments) {
      String outTradeNo = string(payment.get("outTradeNo"));
      Map<String, Object> entitlement = entitlementMap.get(outTradeNo);
      Map<String, Object> latestRefund = latestRefundMap.get(outTradeNo);
      Integer sourceOrgId = intValue(payment.get("sourceOrgId"));
      Map<String, Object> provisioningJob =
          jobByOutTradeNo.getOrDefault(
              outTradeNo, sourceOrgId == null ? null : jobBySourceOrgId.get(sourceOrgId));
      String tradeState = defaultString(payment.get("tradeState"), "UNKNOWN");
      String latestRefundStatus = latestRefund == null ? null : string(latestRefund.get("status"));
      boolean refundActionAllowed =
          latestRefund == null || "CREATE_FAILED".equals(normalizeRefundStatus(latestRefundStatus));
      boolean refundable =
          "SUCCESS".equals(tradeState)
              && entitlement != null
              && refundActionAllowed
              && refundableOutTradeNos.contains(outTradeNo);

      Map<String, Object> item = new LinkedHashMap<>();
      item.put("amountTotal", number(payment.get("amountTotal")));
      if (entitlement != null) {
        item.put("entitlement", entitlementSummary(entitlement));
      }
      if (latestRefund != null) {
        item.put("latestRefund", latestRefundSummary(latestRefund));
      }
      item.put("outTradeNo", outTradeNo);
      item.put("paidAt", payment.get("paidAt"));
      item.put("refundable", refundable);
      String disabledReason =
          refundDisabledReason(refundable, latestRefundStatus, tradeState, entitlement);
      if (disabledReason != null) {
        item.put("refundDisabledReason", disabledReason);
      }
      Map<String, Object> organization =
          sourceOrgId == null ? null : organizations.get(sourceOrgId);
      if (organization != null) {
        item.put("sourceOrganization", organization);
      }
      item.put(
          "targetCustomerId",
          firstText(string(payment.get("targetCustomerId")), string(payment.get("sourceCustomerId"))));
      if (provisioningJob != null) {
        item.put("organizationProvisioningJob", provisioningJobSummary(provisioningJob));
      }
      item.put("tradeState", tradeState);
      if (StringUtils.hasText(string(payment.get("transactionId")))) {
        item.put("transactionId", payment.get("transactionId"));
      }
      items.add(item);
    }

    return Map.of("items", items);
  }

  /**
   * 查询中心库支付订单本地快照。
   *
   * <p>旧接口会请求微信查单并同步会员状态；迁移期只读 `vip_membership_payment`，
   * 避免 GET 接口切流时触发外部支付请求或会员权益写库。
   */
  public Map<String, Object> queryLocalPaymentOrder(String outTradeNoValue) {
    String outTradeNo = clean(outTradeNoValue);
    if (!StringUtils.hasText(outTradeNo)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少 outTradeNo 参数");
    }
    if (!hasTable("vip_membership_payment")) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "支付订单不存在");
    }

    UserTokenPayload payload = TenantRequired.currentUser();
    Long centerUserId = payload.centerUserId() == null ? payload.id() : payload.centerUserId();
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT out_trade_no, amount_total, paid_at, source_customer_id,
                   target_customer_id, center_user_id, trade_state, transaction_id,
                   create_time, update_time
            FROM vip_membership_payment
            WHERE out_trade_no = ?
            LIMIT 1
            """,
            (rs, rowNum) -> localPaymentOrderMap(rs),
            outTradeNo);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "支付订单不存在");
    }
    Map<String, Object> order = rows.get(0);
    Integer ownerCenterUserId = intValue(order.get("centerUserId"));
    boolean superUser = payload.roles() != null && payload.roles().contains("Super");
    if (!superUser && ownerCenterUserId != null && !Objects.equals(centerUserId, ownerCenterUserId.longValue())) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "无权查询该支付订单");
    }
    order.put("externalCall", false);
    order.put("mode", "local_snapshot");
    order.put("vipMembershipResult", Map.of("externalCall", false, "synced", false));
    return order;
  }

  /**
   * 创建微信 APP 预支付本地兼容订单。
   *
   * <p>旧接口会请求微信 `/v3/pay/transactions/app` 并返回真实 prepayId；迁移期只生成本地
   * launchParams 和可查询的会员支付快照，不读取私钥、不请求微信、不触发会员权益或组织开通。
   */
  @Transactional(readOnly = false)
  public Map<String, Object> createAppPrepayLocal(Map<String, Object> body) {
    Map<String, Object> payload = body == null ? Map.of() : body;
    String description = clean(string(payload.get("description")));
    Integer amount = positiveInteger(payload.get("amount"));
    String currency = clean(string(payload.get("currency")));
    if (!StringUtils.hasText(description)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "支付描述不能为空");
    }
    if (amount == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "支付金额必须为大于 0 的整数分");
    }
    String outTradeNo = "wxapp_" + System.currentTimeMillis() + "_" + randomHex(12);
    String attach = clean(string(payload.get("attach")));
    String checkoutFlowToken = null;
    String outboxEventId = null;
    boolean paymentSnapshotRecorded = false;
    boolean vipMembership = isVipMembershipAttach(attach);
    if (vipMembership) {
      UserTokenPayload user = TenantRequired.currentUser();
      Long centerUserId = user.centerUserId() == null ? user.id() : user.centerUserId();
      if (centerUserId == null || centerUserId <= 0 || centerUserId > Integer.MAX_VALUE) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少中心用户信息，无法创建会员订单");
      }
      if (!Objects.equals(amount, VIP_MEMBERSHIP_AMOUNT_TOTAL)) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "会员支付金额不正确");
      }
      String sourceCustomerId = StringUtils.hasText(user.customerId()) ? user.customerId() : "default";
      attach = buildVipMembershipAttach(centerUserId.intValue(), user.id(), sourceCustomerId);
      paymentSnapshotRecorded =
          recordLocalVipPaymentPending(
              amount,
              centerUserId.intValue(),
              outTradeNo,
              attach,
              sourceCustomerId,
              user.username());
      if (paymentSnapshotRecorded) {
        outboxEventId =
            businessOutboxPublisher.publishVipMembershipPaymentCreated(
                new VipMembershipPaymentCreatedEvent(
                    amount,
                    centerUserId.intValue(),
                    "wechat_app",
                    outTradeNo,
                    sourceCustomerId,
                    user.username()));
      }
      checkoutFlowToken = "local_" + randomHex(24);
    }

    String prepayId = "local_" + outTradeNo;
    Map<String, Object> launchParams = new LinkedHashMap<>();
    launchParams.put("appId", "local-disabled");
    launchParams.put("nonceStr", randomHex(32));
    launchParams.put("outTradeNo", outTradeNo);
    launchParams.put("packageValue", "Sign=WXPay");
    launchParams.put("partnerId", "local-disabled");
    launchParams.put("prepayId", prepayId);
    launchParams.put("sign", "local-disabled");
    launchParams.put("timeStamp", String.valueOf(Instant.now().getEpochSecond()));

    Map<String, Object> result = new LinkedHashMap<>();
    if (StringUtils.hasText(checkoutFlowToken)) {
      result.put("checkoutFlowToken", checkoutFlowToken);
    }
    result.put("currency", StringUtils.hasText(currency) ? currency : "CNY");
    result.put("externalCall", false);
    result.put("launchParams", launchParams);
    result.put("mode", "local_prepay_snapshot");
    result.put("prepayId", prepayId);
    result.put("vipMembership", vipMembership);
    appendOutboxSummary(result, vipMembership, paymentSnapshotRecorded, outboxEventId);
    return result;
  }

  /**
   * 创建微信 H5 预支付本地兼容订单。
   *
   * <p>旧接口会请求微信 `/v3/pay/transactions/h5` 并返回真实 h5Url；迁移期只生成本地 H5 URL
   * 和可查询的会员支付快照，不读取支付私钥、不请求微信、不触发会员权益或组织开通。
   */
  @Transactional(readOnly = false)
  public Map<String, Object> createH5PrepayLocal(Map<String, Object> body) {
    Map<String, Object> payload = body == null ? Map.of() : body;
    String description = clean(string(payload.get("description")));
    Integer amount = positiveInteger(payload.get("amount"));
    String currency = clean(string(payload.get("currency")));
    if (!StringUtils.hasText(description)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "支付描述不能为空");
    }
    if (amount == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "支付金额必须为大于 0 的整数分");
    }

    String outTradeNo = "wxh5_" + System.currentTimeMillis() + "_" + randomHex(12);
    String attach = clean(string(payload.get("attach")));
    String checkoutFlowToken = null;
    String outboxEventId = null;
    boolean paymentSnapshotRecorded = false;
    boolean vipMembership = isVipMembershipAttach(attach);
    if (vipMembership) {
      UserTokenPayload user = TenantRequired.currentUser();
      Long centerUserId = user.centerUserId() == null ? user.id() : user.centerUserId();
      if (centerUserId == null || centerUserId <= 0 || centerUserId > Integer.MAX_VALUE) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少中心用户信息，无法创建会员订单");
      }
      if (!Objects.equals(amount, VIP_MEMBERSHIP_AMOUNT_TOTAL)) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "会员支付金额不正确");
      }
      String sourceCustomerId = StringUtils.hasText(user.customerId()) ? user.customerId() : "default";
      attach = buildVipMembershipAttach(centerUserId.intValue(), user.id(), sourceCustomerId);
      paymentSnapshotRecorded =
          recordLocalVipPaymentPending(
              amount,
              centerUserId.intValue(),
              outTradeNo,
              attach,
              sourceCustomerId,
              user.username());
      if (paymentSnapshotRecorded) {
        outboxEventId =
            businessOutboxPublisher.publishVipMembershipPaymentCreated(
                new VipMembershipPaymentCreatedEvent(
                    amount,
                    centerUserId.intValue(),
                    "wechat_h5",
                    outTradeNo,
                    sourceCustomerId,
                    user.username()));
      }
      checkoutFlowToken = "local_" + randomHex(24);
    }

    String h5Type = normalizeH5Type(payload.get("h5Type"));
    Map<String, Object> result = new LinkedHashMap<>();
    if (StringUtils.hasText(checkoutFlowToken)) {
      result.put("checkoutFlowToken", checkoutFlowToken);
    }
    result.put("currency", StringUtils.hasText(currency) ? currency : "CNY");
    result.put("externalCall", false);
    result.put("h5Info", Map.of("appName", firstText(clean(string(payload.get("appName"))), "职维智管"), "type", h5Type));
    result.put("h5Url", "https://pay.local.invalid/wechat/h5?out_trade_no=" + outTradeNo);
    result.put("mode", "local_h5_prepay_snapshot");
    result.put("outTradeNo", outTradeNo);
    result.put("vipMembership", vipMembership);
    appendOutboxSummary(result, vipMembership, paymentSnapshotRecorded, outboxEventId);
    return result;
  }

  /**
   * 接收微信支付通知原文。
   *
   * <p>当前只做原始报文解析和本地订单状态补记，不验签、不解密、不发放权益、不开通组织空间。
   */
  @Transactional(readOnly = false)
  public Map<String, Object> acceptPayNotificationLocal(
      String rawBody, Map<String, String> headers) {
    boolean signatureVerified = verifyNotificationSignatureIfRequired(rawBody, headers);
    NotificationResource notification = notificationResource(rawBody);
    Map<String, Object> resource = notification.data();
    String outTradeNo = firstText(string(resource.get("out_trade_no")), string(resource.get("outTradeNo")));
    String tradeState =
        firstText(firstText(string(resource.get("trade_state")), string(resource.get("tradeState"))), "NOTIFIED");
    String transactionId = firstText(string(resource.get("transaction_id")), string(resource.get("transactionId")));
    boolean paymentSnapshotUpdated = false;
    String outboxEventId = null;
    if (StringUtils.hasText(outTradeNo) && hasTable("vip_membership_payment")) {
      int updated =
          centerJdbcTemplate.update(
              """
              UPDATE vip_membership_payment
              SET trade_state = ?,
                  transaction_id = COALESCE(?, transaction_id),
                  update_time = NOW()
              WHERE out_trade_no = ?
              """,
              tradeState,
              clean(transactionId),
              outTradeNo);
      paymentSnapshotUpdated = updated > 0;
      if (paymentSnapshotUpdated) {
        Map<String, Object> payment = findPaymentSnapshotForOutbox(outTradeNo);
        if (payment != null) {
          outboxEventId =
              businessOutboxPublisher.publishVipMembershipPaymentNotified(
                  new VipMembershipPaymentNotifiedEvent(
                      number(payment.get("amountTotal")).intValue(),
                      number(payment.get("centerUserId")).intValue(),
                      outTradeNo,
                      string(payment.get("sourceCustomerId")),
                      tradeState,
                      clean(transactionId)));
        }
      }
    }
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("externalCall", false);
    result.put("mode", "local_notify_ack");
    result.put("outboxEventQueued", StringUtils.hasText(outboxEventId));
    if (StringUtils.hasText(outboxEventId)) {
      result.put("outboxEventId", outboxEventId);
    }
    result.put("outTradeNo", StringUtils.hasText(outTradeNo) ? outTradeNo : "");
    result.put("paymentSnapshotUpdated", paymentSnapshotUpdated);
    result.put("resourceDecrypted", notification.decrypted());
    result.put("signatureVerified", signatureVerified);
    result.put("synced", false);
    return result;
  }

  /**
   * 创建会员退款本地兼容申请。
   *
   * <p>旧接口会请求微信退款；这里只写 `vip_membership_refund` 为 CREATE_PENDING，后续由支付专项或
   * XXL-Job 对账任务接管真实退款提交。
   */
  @Transactional(readOnly = false)
  public Object createRefundLocal(Map<String, Object> body) {
    Map<String, Object> payload = body == null ? Map.of() : body;
    List<String> outTradeNos = stringList(payload.get("outTradeNos"));
    String outTradeNo = clean(string(payload.get("outTradeNo")));
    if (!StringUtils.hasText(outTradeNo) && outTradeNos.isEmpty()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少 outTradeNo 参数");
    }
    UserTokenPayload user = TenantRequired.currentUser();
    if (user.roles() == null || !user.roles().contains("Super")) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "仅 Super 角色可发起会员退款");
    }
    String reason = clean(string(payload.get("reason")));
    String requesterCustomerId = clean(user.customerId());
    boolean allowCrossCustomerRefund =
        Objects.equals(
            requesterCustomerId,
            StringUtils.hasText(appProperties.getDefaultCustomerId())
                ? appProperties.getDefaultCustomerId()
                : "default");
    if (!outTradeNos.isEmpty()) {
      return outTradeNos.stream()
          .map(value -> createSingleRefundLocal(value, reason, requesterCustomerId, allowCrossCustomerRefund))
          .toList();
    }
    return createSingleRefundLocal(outTradeNo, reason, requesterCustomerId, allowCrossCustomerRefund);
  }

  /**
   * 接收微信退款通知原文。
   *
   * <p>当前只记录到本地退款表的 providerRaw/状态字段，不撤销权益、不修改组织开通状态。
   */
  @Transactional(readOnly = false)
  public Map<String, Object> acceptRefundNotificationLocal(
      String rawBody, Map<String, String> headers) {
    boolean signatureVerified = verifyNotificationSignatureIfRequired(rawBody, headers);
    NotificationResource notification = notificationResource(rawBody);
    Map<String, Object> resource = notification.data();
    String outRefundNo = firstText(string(resource.get("out_refund_no")), string(resource.get("outRefundNo")));
    String refundId = firstText(string(resource.get("refund_id")), string(resource.get("refundId")));
    String status =
        firstText(
            firstText(string(resource.get("refund_status")), string(resource.get("status"))),
            "NOTIFIED");
    boolean refundSnapshotUpdated = false;
    String outboxEventId = null;
    if (StringUtils.hasText(outRefundNo) && hasTable("vip_membership_refund")) {
      int updated =
          centerJdbcTemplate.update(
              """
              UPDATE vip_membership_refund
              SET refund_id = COALESCE(?, refund_id),
                  status = ?,
                  provider_raw = ?,
                  last_checked_at = NOW(),
                  update_time = NOW()
              WHERE out_refund_no = ?
              """,
              clean(refundId),
              status,
              rawBody,
              outRefundNo);
      refundSnapshotUpdated = updated > 0;
      if (refundSnapshotUpdated) {
        Map<String, Object> refund = findRefundNotificationSnapshotForOutbox(outRefundNo);
        if (refund != null) {
          outboxEventId =
              businessOutboxPublisher.publishVipMembershipRefundNotified(
                  new VipMembershipRefundNotifiedEvent(
                      number(refund.get("amountTotal")).intValue(),
                      number(refund.get("centerUserId")).intValue(),
                      string(refund.get("customerId")),
                      string(refund.get("outRefundNo")),
                      string(refund.get("outTradeNo")),
                      clean(string(refund.get("refundId"))),
                      number(refund.get("refundAmount")).intValue(),
                      string(refund.get("status"))));
        }
      }
    }
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("externalCall", false);
    result.put("mode", "local_refund_notify_ack");
    result.put("outRefundNo", StringUtils.hasText(outRefundNo) ? outRefundNo : "");
    result.put("outboxEventQueued", StringUtils.hasText(outboxEventId));
    if (StringUtils.hasText(outboxEventId)) {
      result.put("outboxEventId", outboxEventId);
    }
    result.put("refundSnapshotUpdated", refundSnapshotUpdated);
    result.put("resourceDecrypted", notification.decrypted());
    result.put("signatureVerified", signatureVerified);
    result.put("synced", false);
    return result;
  }

  private List<Map<String, Object>> findPayments(String customerId) {
    return centerJdbcTemplate.query(
        """
        SELECT out_trade_no, amount_total, paid_at, source_org_id, source_customer_id,
               target_customer_id, trade_state, transaction_id, create_time
        FROM vip_membership_payment
        WHERE target_customer_id = ? OR source_customer_id = ?
        ORDER BY paid_at DESC, create_time DESC
        """,
        (rs, rowNum) -> paymentMap(rs),
        customerId,
        customerId);
  }

  private List<Map<String, Object>> findEntitlements(String customerId) {
    return centerJdbcTemplate.query(
        """
        SELECT out_trade_no, duration_months, end_at, start_at, status
        FROM vip_membership_entitlement
        WHERE customer_id = ?
        ORDER BY start_at DESC, id DESC
        """,
        (rs, rowNum) -> entitlementMap(rs),
        customerId);
  }

  private List<Map<String, Object>> findRefunds(String customerId) {
    return centerJdbcTemplate.query(
        """
        SELECT out_trade_no, out_refund_no, refund_amount, status, success_at, create_time, id
        FROM vip_membership_refund
        WHERE customer_id = ?
        ORDER BY create_time DESC, id DESC
        """,
        (rs, rowNum) -> refundMap(rs),
        customerId);
  }

  private List<Map<String, Object>> findProvisioningJobs(String customerId) {
    return centerJdbcTemplate.query(
        """
        SELECT id, source_org_id, status, target_customer_id, last_payment_out_trade_no
        FROM tenant_provisioning_job
        WHERE source_customer_id = ? OR target_customer_id = ?
        ORDER BY id DESC
        """,
        (rs, rowNum) -> provisioningJobMap(rs),
        customerId,
        customerId);
  }

  private Map<Integer, Map<String, Object>> findOrganizations(
      List<Map<String, Object>> payments, List<Map<String, Object>> jobs) {
    if (!hasTable("organization")) {
      return Map.of();
    }
    List<Integer> ids =
        java.util.stream.Stream.concat(payments.stream(), jobs.stream())
            .map(row -> intValue(row.get("sourceOrgId")))
            .filter(id -> id != null && id > 0)
            .distinct()
            .toList();
    if (ids.isEmpty()) {
      return Map.of();
    }

    Map<Integer, Map<String, Object>> result = new LinkedHashMap<>();
    centerJdbcTemplate.query(
        """
        SELECT id, name, source_customer_id
        FROM organization
        WHERE id IN (
        """
            + placeholders(ids.size())
            + ")",
        rs -> {
          Map<String, Object> row = new LinkedHashMap<>();
          int id = rs.getInt("id");
          row.put("id", id);
          row.put("name", rs.getString("name"));
          row.put("sourceCustomerId", rs.getString("source_customer_id"));
          result.put(id, row);
        },
        ids.toArray());
    return result;
  }

  private Set<String> refundableOutTradeNos(List<Map<String, Object>> entitlements) {
    List<Map<String, Object>> activeStack =
        entitlements.stream()
            .filter(row -> ACTIVE_ENTITLEMENT_STATUS.equals(row.get("status")))
            .sorted(
                Comparator.comparing(
                        (Map<String, Object> row) -> instant(row.get("startAt")),
                        Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(row -> string(row.get("outTradeNo")), Comparator.nullsLast(Comparator.reverseOrder())))
            .toList();
    Set<String> refundable = new java.util.LinkedHashSet<>();
    for (Map<String, Object> entitlement : activeStack) {
      if (!startNotBeforeToday(instant(entitlement.get("startAt")))) {
        break;
      }
      refundable.add(string(entitlement.get("outTradeNo")));
    }
    return refundable;
  }

  private String refundDisabledReason(
      boolean refundable, String latestRefundStatus, String tradeState, Map<String, Object> entitlement) {
    if (refundable) {
      return null;
    }
    if (StringUtils.hasText(latestRefundStatus)
        && !"CREATE_FAILED".equals(normalizeRefundStatus(latestRefundStatus))) {
      return refundStatusDisabledReason(latestRefundStatus);
    }
    if (!"SUCCESS".equals(tradeState)) {
      return "仅支付成功的订单可以退款";
    }
    if (entitlement == null) {
      return "该订单缺少权益流水";
    }
    if (!ACTIVE_ENTITLEMENT_STATUS.equals(entitlement.get("status"))) {
      return "该订单权益已失效";
    }
    return startNotBeforeToday(instant(entitlement.get("startAt")))
        ? "需先退款更新的组织订单"
        : "权益已开始，不能退款";
  }

  private String refundStatusDisabledReason(String status) {
    String normalized = normalizeRefundStatus(status);
    if ("SUCCESS".equals(normalized)) {
      return "该订单已退款成功";
    }
    if (List.of("CREATE_PENDING", "PENDING", "PROCESSING").contains(normalized)) {
      return "退款申请正在处理，请稍后查看结果";
    }
    if (List.of("ABNORMAL", "CLOSED").contains(normalized)) {
      return "退款未成功，请联系管理员核对";
    }
    return "该订单当前不能发起退款";
  }

  private boolean startNotBeforeToday(Instant startAt) {
    if (startAt == null) {
      return false;
    }
    return !LocalDate.ofInstant(startAt, BUSINESS_ZONE).isBefore(LocalDate.now(BUSINESS_ZONE));
  }

  private Map<String, Object> entitlementSummary(Map<String, Object> entitlement) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("durationMonths", entitlement.get("durationMonths"));
    result.put("endAt", entitlement.get("endAt"));
    result.put("startAt", entitlement.get("startAt"));
    result.put("status", entitlement.get("status"));
    return result;
  }

  private Map<String, Object> latestRefundSummary(Map<String, Object> refund) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("outRefundNo", refund.get("outRefundNo"));
    result.put("refundAmount", refund.get("refundAmount"));
    result.put("status", refund.get("status"));
    result.put("successAt", refund.get("successAt"));
    return result;
  }

  private Map<String, Object> provisioningJobSummary(Map<String, Object> job) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("id", job.get("id"));
    Integer sourceOrgId = intValue(job.get("sourceOrgId"));
    if (sourceOrgId != null) {
      result.put("sourceOrgId", sourceOrgId);
    }
    result.put("status", job.get("status"));
    if (StringUtils.hasText(string(job.get("targetCustomerId")))) {
      result.put("targetCustomerId", job.get("targetCustomerId"));
    }
    return result;
  }

  private Map<String, Map<String, Object>> latestRefundByOutTradeNo(
      List<Map<String, Object>> refunds) {
    Map<String, Map<String, Object>> result = new LinkedHashMap<>();
    for (Map<String, Object> refund : refunds) {
      result.putIfAbsent(string(refund.get("outTradeNo")), refund);
    }
    return result;
  }

  private Map<String, Map<String, Object>> jobByOutTradeNo(List<Map<String, Object>> jobs) {
    Map<String, Map<String, Object>> result = new LinkedHashMap<>();
    for (Map<String, Object> job : jobs) {
      String outTradeNo = string(job.get("lastPaymentOutTradeNo"));
      if (StringUtils.hasText(outTradeNo)) {
        result.putIfAbsent(outTradeNo, job);
      }
    }
    return result;
  }

  private Map<Integer, Map<String, Object>> jobBySourceOrgId(List<Map<String, Object>> jobs) {
    Map<Integer, Map<String, Object>> result = new LinkedHashMap<>();
    for (Map<String, Object> job : jobs) {
      Integer sourceOrgId = intValue(job.get("sourceOrgId"));
      if (sourceOrgId != null) {
        result.putIfAbsent(sourceOrgId, job);
      }
    }
    return result;
  }

  private Map<String, Map<String, Object>> keyedBy(List<Map<String, Object>> rows, String key) {
    return rows.stream()
        .filter(row -> StringUtils.hasText(string(row.get(key))))
        .collect(Collectors.toMap(row -> string(row.get(key)), row -> row, (first, second) -> first, LinkedHashMap::new));
  }

  private Map<String, Object> paymentMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("amountTotal", rs.getObject("amount_total"));
    map.put("createTime", iso(rs.getTimestamp("create_time")));
    map.put("outTradeNo", rs.getString("out_trade_no"));
    map.put("paidAt", iso(rs.getTimestamp("paid_at")));
    map.put("sourceCustomerId", rs.getString("source_customer_id"));
    map.put("sourceOrgId", rs.getObject("source_org_id"));
    map.put("targetCustomerId", rs.getString("target_customer_id"));
    map.put("tradeState", rs.getString("trade_state"));
    map.put("transactionId", rs.getString("transaction_id"));
    return map;
  }

  private Map<String, Object> localPaymentOrderMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("amount", Map.of("currency", "CNY", "total", rs.getObject("amount_total")));
    map.put("amountTotal", rs.getObject("amount_total"));
    map.put("centerUserId", rs.getObject("center_user_id"));
    map.put("createTime", iso(rs.getTimestamp("create_time")));
    map.put("outTradeNo", rs.getString("out_trade_no"));
    map.put("paidAt", iso(rs.getTimestamp("paid_at")));
    map.put("sourceCustomerId", rs.getString("source_customer_id"));
    map.put("targetCustomerId", rs.getString("target_customer_id"));
    map.put("tradeState", defaultString(rs.getString("trade_state"), "UNKNOWN"));
    map.put("tradeStateDesc", "");
    map.put("transactionId", rs.getString("transaction_id"));
    map.put("updateTime", iso(rs.getTimestamp("update_time")));
    return map;
  }

  private Map<String, Object> findPaymentSnapshotForOutbox(String outTradeNo) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT out_trade_no, amount_total, center_user_id, source_customer_id,
                   target_customer_id
            FROM vip_membership_payment
            WHERE out_trade_no = ?
            LIMIT 1
            """,
            (rs, rowNum) -> {
              String customerId = firstText(rs.getString("source_customer_id"), rs.getString("target_customer_id"));
              if (!StringUtils.hasText(customerId)) {
                return null;
              }
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("amountTotal", rs.getObject("amount_total"));
              row.put("centerUserId", rs.getObject("center_user_id"));
              row.put("outTradeNo", rs.getString("out_trade_no"));
              row.put("sourceCustomerId", customerId);
              return row;
            },
            outTradeNo);
    return rows.stream().filter(Objects::nonNull).findFirst().orElse(null);
  }

  private boolean recordLocalVipPaymentPending(
      int amountTotal,
      int centerUserId,
      String outTradeNo,
      String rawAttach,
      String sourceCustomerId,
      String username) {
    if (!hasTable("vip_membership_payment")) {
      return false;
    }
    centerJdbcTemplate.update(
        """
        INSERT INTO vip_membership_payment (
          out_trade_no, center_user_id, source_customer_id, username,
          amount_total, trade_state, raw_attach, create_time, update_time
        ) VALUES (
          ?, ?, ?, ?, ?, 'NOTPAY', ?, NOW(), NOW()
        )
        ON DUPLICATE KEY UPDATE
          amount_total = VALUES(amount_total),
          raw_attach = VALUES(raw_attach),
          update_time = NOW()
        """,
        outTradeNo,
        centerUserId,
        sourceCustomerId,
        username,
        amountTotal,
        rawAttach);
    return true;
  }

  private void appendOutboxSummary(
      Map<String, Object> result,
      boolean vipMembership,
      boolean paymentSnapshotRecorded,
      String outboxEventId) {
    if (!vipMembership) {
      return;
    }
    result.put("outboxEventQueued", StringUtils.hasText(outboxEventId));
    if (StringUtils.hasText(outboxEventId)) {
      result.put("outboxEventId", outboxEventId);
    }
    result.put("paymentSnapshotRecorded", paymentSnapshotRecorded);
  }

  private Map<String, Object> createSingleRefundLocal(
      String outTradeNoValue,
      String reason,
      String requesterCustomerId,
      boolean allowCrossCustomerRefund) {
    String outTradeNo = clean(outTradeNoValue);
    if (!StringUtils.hasText(outTradeNo)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少 outTradeNo 参数");
    }
    if (!hasTable("vip_membership_payment") || !hasTable("vip_membership_refund")) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "会员支付退款表未初始化，请先执行中心库 db push");
    }

    Map<String, Object> payment = findPaymentForRefund(outTradeNo);
    if (payment == null) {
      throw new BusinessException(HttpStatus.NOT_FOUND, "组织订单不存在");
    }
    String membershipCustomerId =
        firstText(string(payment.get("targetCustomerId")), string(payment.get("sourceCustomerId")));
    if (!StringUtils.hasText(membershipCustomerId)) {
      throw new BusinessException(HttpStatus.CONFLICT, "组织订单缺少组织空间归属，无法退款");
    }
    if (!allowCrossCustomerRefund
        && StringUtils.hasText(requesterCustomerId)
        && !Objects.equals(requesterCustomerId, membershipCustomerId)) {
      throw new BusinessException(HttpStatus.FORBIDDEN, "无权退款其他组织空间的组织订单");
    }
    if (!"SUCCESS".equals(string(payment.get("tradeState")))) {
      throw new BusinessException(HttpStatus.CONFLICT, "仅已支付成功的组织订单可以退款");
    }

    Map<String, Object> reusableRefund = findReusableRefund(outTradeNo);
    if (reusableRefund != null && !"CREATE_FAILED".equals(normalizeRefundStatus(string(reusableRefund.get("status"))))) {
      reusableRefund.put("externalCall", false);
      reusableRefund.put("mode", "local_refund_snapshot");
      return reusableRefund;
    }

    String outRefundNo =
        reusableRefund == null
            ? buildSystemRefundOutRefundNo(outTradeNo)
            : string(reusableRefund.get("outRefundNo"));
    int amountTotal = number(payment.get("amountTotal")).intValue();
    Integer centerUserId = intValue(payment.get("centerUserId"));
    if (centerUserId == null || centerUserId <= 0) {
      throw new BusinessException(HttpStatus.CONFLICT, "组织订单缺少中心用户信息，无法退款");
    }
    if (reusableRefund == null) {
      insertRefundRecord(
          outRefundNo,
          outTradeNo,
          centerUserId,
          membershipCustomerId,
          amountTotal,
          reason,
          string(payment.get("transactionId")));
    } else {
      centerJdbcTemplate.update(
          """
          UPDATE vip_membership_refund
          SET last_checked_at = NOW(),
              next_check_at = ?,
              reason = COALESCE(?, reason),
              status = 'CREATE_PENDING',
              update_time = NOW()
          WHERE out_refund_no = ?
          """,
          Timestamp.from(Instant.now().plusSeconds(60)),
          reason,
          outRefundNo);
    }
    Map<String, Object> refund = findRefundByOutRefundNo(outRefundNo);
    refund.put("externalCall", false);
    refund.put("mode", "local_refund_request");
    String outboxEventId =
        businessOutboxPublisher.publishVipMembershipRefundRequested(
            new VipMembershipRefundRequestedEvent(
                number(refund.get("amountTotal")).intValue(),
                number(refund.get("centerUserId")).intValue(),
                string(refund.get("customerId")),
                string(refund.get("outRefundNo")),
                string(refund.get("outTradeNo")),
                string(refund.get("reason")),
                number(refund.get("refundAmount")).intValue(),
                string(payment.get("transactionId"))));
    refund.put("outboxEventQueued", StringUtils.hasText(outboxEventId));
    if (StringUtils.hasText(outboxEventId)) {
      refund.put("outboxEventId", outboxEventId);
    }
    refund.put("submittedToWechat", false);
    return refund;
  }

  private Map<String, Object> findPaymentForRefund(String outTradeNo) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT out_trade_no, amount_total, center_user_id, source_customer_id,
                   target_customer_id, trade_state, transaction_id
            FROM vip_membership_payment
            WHERE out_trade_no = ?
            LIMIT 1
            """,
            (rs, rowNum) -> {
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("amountTotal", rs.getObject("amount_total"));
              row.put("centerUserId", rs.getObject("center_user_id"));
              row.put("outTradeNo", rs.getString("out_trade_no"));
              row.put("sourceCustomerId", rs.getString("source_customer_id"));
              row.put("targetCustomerId", rs.getString("target_customer_id"));
              row.put("tradeState", rs.getString("trade_state"));
              row.put("transactionId", rs.getString("transaction_id"));
              return row;
            },
            outTradeNo);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findReusableRefund(String outTradeNo) {
    List<String> statuses =
        List.of("ABNORMAL", "CLOSED", "CREATE_FAILED", "CREATE_PENDING", "PENDING", "PROCESSING", "SUCCESS");
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT out_refund_no, refund_id, out_trade_no, center_user_id, customer_id,
                   amount_total, refund_amount, status, reason, success_at, create_time
            FROM vip_membership_refund
            WHERE out_trade_no = ?
              AND status IN (
            """
                + placeholders(statuses.size())
                + ") ORDER BY create_time DESC, id DESC LIMIT 1",
            (rs, rowNum) -> refundDetailMap(rs),
            prepend(outTradeNo, statuses));
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Object> findRefundByOutRefundNo(String outRefundNo) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT out_refund_no, refund_id, out_trade_no, center_user_id, customer_id,
                   amount_total, refund_amount, status, reason, success_at, create_time
            FROM vip_membership_refund
            WHERE out_refund_no = ?
            LIMIT 1
            """,
            (rs, rowNum) -> refundDetailMap(rs),
            outRefundNo);
    if (rows.isEmpty()) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "退款申请创建后读取失败");
    }
    return rows.get(0);
  }

  private Map<String, Object> findRefundNotificationSnapshotForOutbox(String outRefundNo) {
    List<Map<String, Object>> rows =
        centerJdbcTemplate.query(
            """
            SELECT out_refund_no, refund_id, out_trade_no, center_user_id, customer_id,
                   amount_total, refund_amount, status
            FROM vip_membership_refund
            WHERE out_refund_no = ?
            LIMIT 1
            """,
            (rs, rowNum) -> {
              if (!StringUtils.hasText(rs.getString("customer_id"))) {
                return null;
              }
              Map<String, Object> row = new LinkedHashMap<>();
              row.put("amountTotal", rs.getObject("amount_total"));
              row.put("centerUserId", rs.getObject("center_user_id"));
              row.put("customerId", rs.getString("customer_id"));
              row.put("outRefundNo", rs.getString("out_refund_no"));
              row.put("outTradeNo", rs.getString("out_trade_no"));
              row.put("refundAmount", rs.getObject("refund_amount"));
              row.put("refundId", rs.getString("refund_id"));
              row.put("status", rs.getString("status"));
              return row;
            },
            outRefundNo);
    return rows.stream().filter(Objects::nonNull).findFirst().orElse(null);
  }

  private void insertRefundRecord(
      String outRefundNo,
      String outTradeNo,
      int centerUserId,
      String customerId,
      int amountTotal,
      String reason,
      String transactionId) {
    centerJdbcTemplate.update(
        connection -> {
          var statement =
              connection.prepareStatement(
                  """
                  INSERT INTO vip_membership_refund (
                    out_refund_no, out_trade_no, transaction_id, center_user_id, customer_id,
                    amount_total, refund_amount, status, reason, channel, requested_at,
                    next_check_at, create_time, update_time
                  ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, 'CREATE_PENDING', ?, 'springboot_local',
                    NOW(), ?, NOW(), NOW()
                  )
                  """);
          statement.setString(1, outRefundNo);
          statement.setString(2, outTradeNo);
          if (StringUtils.hasText(transactionId)) {
            statement.setString(3, transactionId);
          } else {
            statement.setNull(3, Types.VARCHAR);
          }
          statement.setInt(4, centerUserId);
          statement.setString(5, customerId);
          statement.setInt(6, amountTotal);
          statement.setInt(7, amountTotal);
          if (StringUtils.hasText(reason)) {
            statement.setString(8, reason);
          } else {
            statement.setNull(8, Types.VARCHAR);
          }
          statement.setTimestamp(9, Timestamp.from(Instant.now().plusSeconds(60)));
          return statement;
        });
  }

  private Map<String, Object> refundDetailMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("amountTotal", rs.getObject("amount_total"));
    map.put("centerUserId", rs.getObject("center_user_id"));
    map.put("createTime", iso(rs.getTimestamp("create_time")));
    map.put("customerId", rs.getString("customer_id"));
    map.put("outRefundNo", rs.getString("out_refund_no"));
    map.put("outTradeNo", rs.getString("out_trade_no"));
    map.put("reason", rs.getString("reason"));
    map.put("refundAmount", rs.getObject("refund_amount"));
    map.put("refundId", rs.getString("refund_id"));
    map.put("status", rs.getString("status"));
    map.put("successAt", iso(rs.getTimestamp("success_at")));
    return map;
  }

  private NotificationResource notificationResource(String rawBody) {
    if (notifyResourceDecryptEnabled()) {
      if (notificationDecryptService == null) {
        throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "微信支付回调 resource 解密服务未配置");
      }
      WechatPayNotificationDecryptService.WechatPayDecryptedResource decrypted =
          notificationDecryptService.decrypt(rawBody);
      return new NotificationResource(decrypted.data(), true);
    }
    Map<String, Object> body = parseJsonObject(rawBody);
    Object resource = body.get("resource");
    if (resource instanceof Map<?, ?> map) {
      Map<String, Object> data =
          map.entrySet().stream()
              .collect(
                  LinkedHashMap::new,
                  (target, entry) -> target.put(String.valueOf(entry.getKey()), entry.getValue()),
                  LinkedHashMap::putAll);
      return new NotificationResource(data, false);
    }
    return new NotificationResource(body, false);
  }

  /**
   * 回调验签灰度开关。
   *
   * <p>默认关闭，避免迁移期因为灰度环境暂未配置微信支付公钥而影响旧兼容 ACK。开启后必须带齐微信支付
   * `Wechatpay-*` 签名头，且本地公钥验签通过后才继续写本地快照。
   */
  private boolean verifyNotificationSignatureIfRequired(
      String rawBody, Map<String, String> headers) {
    if (!notifySignatureVerificationEnabled()) {
      return false;
    }
    if (signatureVerificationService == null) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "微信支付回调验签服务未配置");
    }
    WechatPaySignatureVerificationService.WechatPaySignatureVerification verification =
        signatureVerificationService.verify(
            headerValue(headers, "Wechatpay-Serial"),
            headerValue(headers, "Wechatpay-Timestamp"),
            headerValue(headers, "Wechatpay-Nonce"),
            rawBody,
            headerValue(headers, "Wechatpay-Signature"));
    if (!verification.verified()) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "微信支付回调签名校验失败");
    }
    return true;
  }

  private boolean notifySignatureVerificationEnabled() {
    String value =
        firstText(
            env("WECHAT_PAY_NOTIFY_SIGNATURE_VERIFY_ENABLED"),
            env("wechat.pay.notify-signature-verify-enabled"));
    return Set.of("1", "true", "yes", "on").contains(defaultString(value, "").toLowerCase(Locale.ROOT));
  }

  private boolean notifyResourceDecryptEnabled() {
    String value =
        firstText(
            env("WECHAT_PAY_NOTIFY_RESOURCE_DECRYPT_ENABLED"),
            env("wechat.pay.notify-resource-decrypt-enabled"));
    return Set.of("1", "true", "yes", "on").contains(defaultString(value, "").toLowerCase(Locale.ROOT));
  }

  private String env(String name) {
    if (environment == null) {
      return "";
    }
    String value = environment.getProperty(name);
    if (!StringUtils.hasText(value)) {
      value = System.getenv(name);
    }
    return StringUtils.hasText(value) ? value.trim() : "";
  }

  private String headerValue(Map<String, String> headers, String name) {
    if (headers == null || headers.isEmpty()) {
      return "";
    }
    String direct = headers.get(name);
    if (StringUtils.hasText(direct)) {
      return direct;
    }
    return headers.entrySet().stream()
        .filter(entry -> name.equalsIgnoreCase(entry.getKey()))
        .map(Map.Entry::getValue)
        .filter(StringUtils::hasText)
        .findFirst()
        .orElse("");
  }

  private Map<String, Object> parseJsonObject(String rawBody) {
    if (!StringUtils.hasText(rawBody)) {
      return Map.of();
    }
    try {
      return JSON.readValue(rawBody, new TypeReference<>() {});
    } catch (Exception ignored) {
      return Map.of("rawBody", rawBody);
    }
  }

  private boolean isVipMembershipAttach(String attach) {
    if (!StringUtils.hasText(attach)) {
      return false;
    }
    if ("vip-membership".equals(attach.trim())) {
      return true;
    }
    Map<String, Object> payload = parseJsonObject(attach);
    String tag = firstText(string(payload.get("t")), firstText(string(payload.get("tag")), string(payload.get("type"))));
    return "vip".equals(tag) || "vip-membership".equals(tag);
  }

  private String normalizeH5Type(Object value) {
    String normalized = clean(string(value));
    if ("Android".equals(normalized) || "iOS".equals(normalized) || "Wap".equals(normalized)) {
      return normalized;
    }
    return "Wap";
  }

  private String buildVipMembershipAttach(int centerUserId, Long tenantUserId, String sourceCustomerId) {
    Map<String, Object> attach = new LinkedHashMap<>();
    attach.put("c", sourceCustomerId);
    attach.put("cu", centerUserId);
    attach.put("t", "vip");
    attach.put("u", tenantUserId);
    try {
      return JSON.writeValueAsString(attach);
    } catch (Exception error) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "组织订单 attach 生成失败");
    }
  }

  private String buildSystemRefundOutRefundNo(String outTradeNo) {
    String suffix = sha256Hex(outTradeNo).substring(0, 12);
    String value = "vip_refund_" + outTradeNo + "_" + suffix;
    return value.length() > 64 ? value.substring(0, 64) : value;
  }

  private String sha256Hex(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception error) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "退款单号生成失败");
    }
  }

  private String randomHex(int length) {
    byte[] bytes = new byte[Math.max(1, (length + 1) / 2)];
    java.util.concurrent.ThreadLocalRandom.current().nextBytes(bytes);
    String hex = HexFormat.of().formatHex(bytes);
    return hex.length() > length ? hex.substring(0, length) : hex;
  }

  private List<String> stringList(Object value) {
    if (!(value instanceof List<?> list)) {
      return List.of();
    }
    return list.stream()
        .map(this::string)
        .map(this::clean)
        .filter(StringUtils::hasText)
        .distinct()
        .toList();
  }

  private Object[] prepend(String first, List<String> rest) {
    List<Object> values = new ArrayList<>();
    values.add(first);
    values.addAll(rest);
    return values.toArray();
  }

  private Integer positiveInteger(Object value) {
    Integer parsed = intValue(value);
    return parsed == null || parsed <= 0 ? null : parsed;
  }

  private Map<String, Object> entitlementMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("durationMonths", rs.getObject("duration_months"));
    map.put("endAt", iso(rs.getTimestamp("end_at")));
    map.put("outTradeNo", rs.getString("out_trade_no"));
    map.put("startAt", iso(rs.getTimestamp("start_at")));
    map.put("status", rs.getString("status"));
    return map;
  }

  private Map<String, Object> refundMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("createTime", iso(rs.getTimestamp("create_time")));
    map.put("id", rs.getObject("id"));
    map.put("outRefundNo", rs.getString("out_refund_no"));
    map.put("outTradeNo", rs.getString("out_trade_no"));
    map.put("refundAmount", rs.getObject("refund_amount"));
    map.put("status", rs.getString("status"));
    map.put("successAt", iso(rs.getTimestamp("success_at")));
    return map;
  }

  private Map<String, Object> provisioningJobMap(ResultSet rs) throws SQLException {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("id", rs.getObject("id"));
    map.put("lastPaymentOutTradeNo", rs.getString("last_payment_out_trade_no"));
    map.put("sourceOrgId", rs.getObject("source_org_id"));
    map.put("status", rs.getString("status"));
    map.put("targetCustomerId", rs.getString("target_customer_id"));
    return map;
  }

  private boolean hasTables(String... tableNames) {
    for (String tableName : tableNames) {
      if (!hasTable(tableName)) {
        return false;
      }
    }
    return true;
  }

  private boolean hasTable(String tableName) {
    Long count =
        centerJdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND table_name = ?
            """,
            Long.class,
            tableName);
    return count != null && count > 0;
  }

  private String placeholders(int count) {
    return String.join(",", java.util.Collections.nCopies(count, "?"));
  }

  private String normalizeRefundStatus(String status) {
    String value = clean(status);
    return value == null ? "UNKNOWN" : value.toUpperCase(Locale.ROOT);
  }

  private String firstText(String first, String second) {
    return StringUtils.hasText(first) ? first : second;
  }

  private String defaultString(Object value, String fallback) {
    String text = string(value);
    return StringUtils.hasText(text) ? text : fallback;
  }

  private String clean(String value) {
    return StringUtils.hasText(value) ? value.trim() : null;
  }

  private String string(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  private Number number(Object value) {
    if (value instanceof Number number) {
      return number;
    }
    try {
      return value == null ? 0 : Double.parseDouble(String.valueOf(value));
    } catch (NumberFormatException error) {
      return 0;
    }
  }

  private Integer intValue(Object value) {
    if (value instanceof Number number) {
      return number.intValue();
    }
    try {
      return value == null ? null : Integer.parseInt(String.valueOf(value));
    } catch (NumberFormatException error) {
      return null;
    }
  }

  private Instant instant(Object value) {
    if (!StringUtils.hasText(string(value))) {
      return null;
    }
    try {
      return Instant.parse(string(value));
    } catch (RuntimeException error) {
      return null;
    }
  }

  private String iso(Timestamp timestamp) {
    return timestamp == null ? null : timestamp.toInstant().toString();
  }

  private record NotificationResource(Map<String, Object> data, boolean decrypted) {}
}
