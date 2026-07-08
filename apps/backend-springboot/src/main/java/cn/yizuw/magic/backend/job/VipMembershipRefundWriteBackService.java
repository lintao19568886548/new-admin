package cn.yizuw.magic.backend.job;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.integration.wechat.WechatPayRefundResponseMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** 会员退款对账写回服务；只更新退款快照，不撤销权益、不写 outbox。 */
@Service
public class VipMembershipRefundWriteBackService {

  private static final ObjectMapper JSON = new ObjectMapper();
  private static final long RECHECK_DELAY_SECONDS = 60L;

  private final JdbcTemplate centerJdbcTemplate;

  public VipMembershipRefundWriteBackService(
      @Qualifier("centerJdbcTemplate") JdbcTemplate centerJdbcTemplate) {
    this.centerJdbcTemplate = centerJdbcTemplate;
  }

  /**
   * 将微信可信退款状态写回本地退款表。
   *
   * <p>本方法只更新 `vip_membership_refund` 的退款状态快照；`SUCCESS` 后的权益撤销、outbox 事件和组织状态联动
   * 继续留给后续批次单独接入。
   */
  @Transactional(readOnly = false)
  public VipMembershipRefundWriteBackResult writeBack(
      String expectedOutRefundNo,
      WechatPayRefundResponseMapper.WechatPayRefundResponse refund,
      Instant checkedAt) {
    String outRefundNo = requiredText(expectedOutRefundNo, "outRefundNo");
    if (refund == null) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少微信退款写回结果");
    }
    if (!Objects.equals(outRefundNo, refund.outRefundNo())) {
      throw new BusinessException(HttpStatus.CONFLICT, "微信返回 outRefundNo 与本地候选退款单不一致");
    }
    Instant now = checkedAt == null ? Instant.now() : checkedAt;
    String status = localStatus(refund.localStatus());
    boolean terminal = terminalRefundStatus(status);
    boolean success = "SUCCESS".equals(status);
    Instant successAt = success ? successAt(refund.successTime(), now) : null;
    Instant nextCheckAt = terminal ? null : now.plusSeconds(RECHECK_DELAY_SECONDS);
    int updatedRows =
        centerJdbcTemplate.update(
            """
            UPDATE vip_membership_refund
            SET refund_id = COALESCE(NULLIF(?, ''), refund_id),
                status = ?,
                success_at = ?,
                last_checked_at = ?,
                next_check_at = ?,
                provider_raw = ?,
                update_time = ?
            WHERE out_refund_no = ?
            """,
            clean(refund.refundId()),
            status,
            timestamp(successAt),
            timestamp(now),
            timestamp(nextCheckAt),
            providerRaw(refund),
            timestamp(now),
            outRefundNo);
    return new VipMembershipRefundWriteBackResult(
        outRefundNo,
        updatedRows,
        status,
        terminal,
        success,
        iso(successAt),
        iso(now),
        iso(nextCheckAt),
        success ? "revoke_vip_membership_for_refund" : "none",
        false);
  }

  private String providerRaw(WechatPayRefundResponseMapper.WechatPayRefundResponse refund) {
    Map<String, Object> raw = new LinkedHashMap<>();
    raw.put("currency", refund.currency());
    raw.put("outRefundNo", refund.outRefundNo());
    raw.put("outTradeNo", refund.outTradeNo());
    raw.put("providerStatus", refund.providerStatus());
    raw.put("refundAmount", refund.refundAmount());
    raw.put("refundId", refund.refundId());
    raw.put("source", "wechat-pay-refund-reconcile");
    raw.put("status", refund.localStatus());
    raw.put("successTime", refund.successTime());
    raw.put("totalAmount", refund.totalAmount());
    raw.put("transactionId", refund.transactionId());
    try {
      return JSON.writeValueAsString(raw);
    } catch (JsonProcessingException error) {
      throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "微信退款写回 providerRaw 序列化失败");
    }
  }

  private Instant successAt(String successTime, Instant fallback) {
    String value = clean(successTime);
    if (!StringUtils.hasText(value)) {
      return fallback;
    }
    try {
      return Instant.parse(value);
    } catch (RuntimeException ignored) {
      // WeChat success_time usually carries an offset, for example 2026-07-02T08:00:00+08:00.
    }
    try {
      return OffsetDateTime.parse(value).toInstant();
    } catch (RuntimeException ignored) {
      // Keep trying common local datetime forms used by older local snapshots.
    }
    try {
      return LocalDateTime.parse(value).atZone(ZoneId.systemDefault()).toInstant();
    } catch (RuntimeException error) {
      return fallback;
    }
  }

  private Timestamp timestamp(Instant instant) {
    return instant == null ? null : Timestamp.from(instant);
  }

  private String iso(Instant instant) {
    return instant == null ? null : instant.toString();
  }

  private String localStatus(String status) {
    String value = clean(status).toUpperCase(java.util.Locale.ROOT);
    return StringUtils.hasText(value) ? value : "UNKNOWN";
  }

  private boolean terminalRefundStatus(String status) {
    return List.of("ABNORMAL", "CLOSED", "SUCCESS").contains(localStatus(status));
  }

  private String requiredText(String value, String name) {
    String cleaned = clean(value);
    if (!StringUtils.hasText(cleaned)) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "缺少微信退款写回参数 " + name);
    }
    return cleaned;
  }

  private String clean(String value) {
    return StringUtils.hasText(value) ? value.trim() : "";
  }

  public record VipMembershipRefundWriteBackResult(
      String outRefundNo,
      int updatedRows,
      String status,
      boolean terminal,
      boolean entitlementRevokeRequired,
      String successAt,
      String checkedAt,
      String nextCheckAt,
      String followUp,
      boolean entitlementRevokeExecuted) {}
}
