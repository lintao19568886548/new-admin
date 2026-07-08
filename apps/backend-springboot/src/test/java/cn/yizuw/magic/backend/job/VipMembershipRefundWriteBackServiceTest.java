package cn.yizuw.magic.backend.job;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cn.yizuw.magic.backend.common.BusinessException;
import cn.yizuw.magic.backend.integration.wechat.WechatPayRefundResponseMapper;
import java.sql.Timestamp;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

/** 会员退款对账写回服务测试；只使用 fake JdbcTemplate，不连接真实数据库。 */
class VipMembershipRefundWriteBackServiceTest {

  @Test
  void writeBackUpdatesTerminalSuccessSnapshotWithoutRevokingEntitlement() {
    CapturingJdbcTemplate jdbcTemplate = new CapturingJdbcTemplate(1);
    VipMembershipRefundWriteBackService service = new VipMembershipRefundWriteBackService(jdbcTemplate);

    VipMembershipRefundWriteBackService.VipMembershipRefundWriteBackResult result =
        service.writeBack(
            "vip_refund_wxapp_1",
            refund("vip_refund_wxapp_1", "SUCCESS", "2026-07-02T08:00:00+08:00"),
            Instant.parse("2026-07-02T08:10:00Z"));

    assertThat(result.updatedRows()).isEqualTo(1);
    assertThat(result.status()).isEqualTo("SUCCESS");
    assertThat(result.terminal()).isTrue();
    assertThat(result.entitlementRevokeRequired()).isTrue();
    assertThat(result.entitlementRevokeExecuted()).isFalse();
    assertThat(result.nextCheckAt()).isNull();
    assertThat(jdbcTemplate.sql()).contains("UPDATE vip_membership_refund");
    assertThat(jdbcTemplate.args()[0]).isEqualTo("5000001");
    assertThat(jdbcTemplate.args()[1]).isEqualTo("SUCCESS");
    assertThat(jdbcTemplate.args()[2]).isInstanceOf(Timestamp.class);
    assertThat(jdbcTemplate.args()[4]).isNull();
    assertThat(jdbcTemplate.args()[5].toString()).contains("\"status\":\"SUCCESS\"");
    assertThat(jdbcTemplate.args()[7]).isEqualTo("vip_refund_wxapp_1");
  }

  @Test
  void writeBackSchedulesRecheckForProcessingRefund() {
    CapturingJdbcTemplate jdbcTemplate = new CapturingJdbcTemplate(1);
    VipMembershipRefundWriteBackService service = new VipMembershipRefundWriteBackService(jdbcTemplate);

    VipMembershipRefundWriteBackService.VipMembershipRefundWriteBackResult result =
        service.writeBack(
            "vip_refund_wxapp_2",
            refund("vip_refund_wxapp_2", "PROCESSING", null),
            Instant.parse("2026-07-02T08:10:00Z"));

    assertThat(result.status()).isEqualTo("PROCESSING");
    assertThat(result.terminal()).isFalse();
    assertThat(result.entitlementRevokeRequired()).isFalse();
    assertThat(result.successAt()).isNull();
    assertThat(result.nextCheckAt()).isEqualTo("2026-07-02T08:11:00Z");
    assertThat(jdbcTemplate.args()[2]).isNull();
    assertThat(jdbcTemplate.args()[4]).isEqualTo(Timestamp.from(Instant.parse("2026-07-02T08:11:00Z")));
  }

  @Test
  void writeBackRejectsMismatchedOutRefundNoBeforeSql() {
    CapturingJdbcTemplate jdbcTemplate = new CapturingJdbcTemplate(1);
    VipMembershipRefundWriteBackService service = new VipMembershipRefundWriteBackService(jdbcTemplate);

    assertThatThrownBy(
            () ->
                service.writeBack(
                    "vip_refund_wxapp_3",
                    refund("vip_refund_other", "SUCCESS", null),
                    Instant.parse("2026-07-02T08:10:00Z")))
        .isInstanceOf(BusinessException.class)
        .hasMessageContaining("微信返回 outRefundNo 与本地候选退款单不一致");
    assertThat(jdbcTemplate.sql()).isNull();
  }

  private WechatPayRefundResponseMapper.WechatPayRefundResponse refund(
      String outRefundNo, String status, String successTime) {
    return new WechatPayRefundResponseMapper.WechatPayRefundResponse(
        outRefundNo,
        "5000001",
        "wxapp_order_1",
        "4200000000000000001",
        status,
        status,
        successTime,
        100,
        300,
        "CNY");
  }

  private static final class CapturingJdbcTemplate extends JdbcTemplate {

    private final int updatedRows;
    private Object[] args;
    private String sql;

    private CapturingJdbcTemplate(int updatedRows) {
      this.updatedRows = updatedRows;
    }

    @Override
    public int update(String sql, Object... args) {
      this.sql = sql;
      this.args = args;
      return updatedRows;
    }

    private Object[] args() {
      return args;
    }

    private String sql() {
      return sql;
    }
  }
}
